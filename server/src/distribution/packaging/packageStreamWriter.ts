import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable, type Writable } from "node:stream";
import { createDeflateRaw } from "node:zlib";
import type { PackageArtifact, PackageFileEntry } from "./packageTypes";
import type { PackageContext } from "./packageContext";
import { PackageFingerprint } from "./packageFingerprint";
import { PackageManifest } from "./packageManifest";
import { PackageMetadata } from "./packageMetadata";
import { PackageResult } from "./packageResult";
import { PackageSerializer } from "./packageSerializer";
import { PackageLayout } from "./packageLayout";
import { PackageError } from "./packageError";
import { crc32Update, deepFreeze, normalizeArchivePath, stableStringify } from "./packageUtils";

type ZipEntryState = Readonly<{
  path: string;
  kind: PackageFileEntry["kind"];
  mediaType: string | null;
  offset: bigint;
  crc32: number;
  compressedSize: bigint;
  uncompressedSize: bigint;
  checksum: string;
  method: number;
}>;

type CentralDirectoryEntry = Readonly<{
  buffer: Buffer;
  zip64: boolean;
}>;

const UINT32_MAX = 0xffffffffn;

export class PackageStreamWriter {
  constructor(
    private readonly layout: PackageLayout,
    private readonly serializer: PackageSerializer,
    private readonly fingerprint: PackageFingerprint,
  ) {}

  async write(context: PackageContext): Promise<PackageResult> {
    await mkdir(dirname(context.outputPath), { recursive: true });
    await mkdir(context.workspacePath, { recursive: true });

    const output = createWriteStream(context.outputPath);
    const archiveHash = createHash("sha256");
    let offset = 0n;

    const baseArtifacts = context.artifacts.filter((artifact) => !isDerivedArtifact(artifact.path));
    const states: ZipEntryState[] = [];

    try {
      for (const artifact of baseArtifacts) {
        const state = await this.writeArtifact(output, archiveHash, artifact, offset, context.compression === "deflate");
        offset += BigInt(localHeaderSize(state.path));
        offset += state.compressedSize;
        offset += BigInt(descriptorSize(state.compressedSize, state.uncompressedSize));
        states.push(state);
      }

      const baseEntries = states.map((state) => ({
        path: state.path,
        kind: state.kind,
        size: Number(state.uncompressedSize),
        checksum: state.checksum,
        mediaType: state.mediaType,
      })) satisfies PackageFileEntry[];

      const fingerprintValue = this.fingerprint.fingerprintFromFiles(baseEntries);
      const generated = buildGeneratedArtifacts(context, fingerprintValue, baseEntries, this.layout, this.serializer, this.fingerprint);

      for (const artifact of generated.artifacts) {
        const state = await this.writeArtifact(output, archiveHash, artifact, offset, context.compression === "deflate");
        offset += BigInt(localHeaderSize(state.path));
        offset += state.compressedSize;
        offset += BigInt(descriptorSize(state.compressedSize, state.uncompressedSize));
        states.push(state);
      }

      const packageEntries = states.map((state) => ({
        path: state.path,
        kind: state.kind,
        size: Number(state.uncompressedSize),
        checksum: state.checksum,
        mediaType: state.mediaType,
      })) satisfies PackageFileEntry[];

      const manifest = PackageManifest.create({
        version: context.version,
        packageId: context.packageId,
        releaseId: context.release.id,
        fingerprint: fingerprintValue,
        files: packageEntries,
        metadata: deepFreeze({
          package: context.packageId,
          release: context.release.id,
          compression: context.compression,
        }),
      });

      const manifestText = this.serializer.serializeManifest(manifest);
      const manifestArtifact = textArtifact(this.layout.paths().manifest, "manifest", manifestText, "application/json");
      const manifestState = await this.writeArtifact(output, archiveHash, manifestArtifact, offset, context.compression === "deflate");
      offset += BigInt(localHeaderSize(manifestState.path));
      offset += manifestState.compressedSize;
      offset += BigInt(descriptorSize(manifestState.compressedSize, manifestState.uncompressedSize));
      states.push(manifestState);

      await writeCentralDirectory(output, archiveHash, states, offset);
      await closeStream(output);

      return new PackageResult({
        packageId: context.packageId,
        releaseId: context.release.id,
        version: context.version,
        fingerprint: fingerprintValue,
        checksum: archiveHash.digest("hex"),
        outputPath: context.outputPath,
        workspacePath: context.workspacePath,
        manifestPath: this.layout.paths().manifest,
        createdAt: new Date().toISOString(),
        files: Object.freeze(packageEntries),
        metadata: deepFreeze({
          manifest: manifest.toJSON(),
          generated: generated.metadata,
        }),
      });
    } catch (error) {
      output.destroy();
      throw new PackageError("Failed to write package archive", "PACKAGE_WRITE_FAILED", { error });
    }
  }

  private async writeArtifact(
    output: Writable,
    archiveHash: ReturnType<typeof createHash>,
    artifact: PackageArtifact,
    offset: bigint,
    deflate: boolean,
  ): Promise<ZipEntryState> {
    const path = normalizeArchivePath(artifact.path);
    const nameBytes = Buffer.from(path, "utf8");
    const method = deflate ? 8 : 0;
    const header = createLocalFileHeader(nameBytes.length, method);
    await writeBuffer(output, archiveHash, header);
    await writeBuffer(output, archiveHash, nameBytes);

    const fileHash = createHash("sha256");
    let crc32 = 0;
    let uncompressedSize = 0n;
    let compressedSize = 0n;

    const source = openArtifactSource(artifact);
    const stream = deflate ? source.pipe(createDeflateRaw({ level: 6 })) : source;
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      fileHash.update(buffer);
      crc32 = crc32Update(crc32, buffer);
      if (deflate) {
        compressedSize += BigInt(buffer.length);
      } else {
        compressedSize += BigInt(buffer.length);
      }
      uncompressedSize += BigInt(buffer.length);
      await writeBuffer(output, archiveHash, buffer);
    }

    const checksum = fileHash.digest("hex");
    const descriptor = createDataDescriptor(crc32, compressedSize, uncompressedSize);
    await writeBuffer(output, archiveHash, descriptor);

    return deepFreeze({
      path,
      kind: artifact.kind,
      mediaType: artifact.mediaType,
      offset,
      crc32,
      compressedSize,
      uncompressedSize,
      checksum,
      method,
    });
  }
}

function isDerivedArtifact(path: string): boolean {
  const normalized = normalizeArchivePath(path);
  return normalized === "release/manifest.json";
}

function openArtifactSource(artifact: PackageArtifact): Readable {
  switch (artifact.source.type) {
    case "file":
      return createReadStream(artifact.source.path);
    case "stream":
      return artifact.source.stream();
    case "buffer":
      return Readable.from([artifact.source.buffer]);
    case "text":
      return Readable.from([Buffer.from(artifact.source.text, "utf8")]);
  }
}

async function writeBuffer(output: Writable, archiveHash: ReturnType<typeof createHash>, buffer: Buffer): Promise<void> {
  archiveHash.update(buffer);
  if (!output.write(buffer)) {
    await new Promise<void>((resolve, reject) => {
      output.once("drain", resolve);
      output.once("error", reject);
    });
  }
}

function createLocalFileHeader(nameLength: number, method: number): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(45, 4);
  buffer.writeUInt16LE(0x0808, 6);
  buffer.writeUInt16LE(method, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(0, 14);
  buffer.writeUInt32LE(0, 18);
  buffer.writeUInt32LE(0, 22);
  buffer.writeUInt16LE(nameLength, 26);
  buffer.writeUInt16LE(0, 28);
  return buffer;
}

function createDataDescriptor(crc32: number, compressedSize: bigint, uncompressedSize: bigint): Buffer {
  const zip64 = compressedSize > UINT32_MAX || uncompressedSize > UINT32_MAX;
  const buffer = Buffer.alloc(zip64 ? 24 : 16);
  buffer.writeUInt32LE(0x08074b50, 0);
  buffer.writeUInt32LE(crc32 >>> 0, 4);
  if (zip64) {
    buffer.writeBigUInt64LE(compressedSize, 8);
    buffer.writeBigUInt64LE(uncompressedSize, 16);
  } else {
    buffer.writeUInt32LE(Number(compressedSize), 8);
    buffer.writeUInt32LE(Number(uncompressedSize), 12);
  }
  return buffer;
}

function descriptorSize(compressedSize: bigint, uncompressedSize: bigint): number {
  return compressedSize > UINT32_MAX || uncompressedSize > UINT32_MAX ? 24 : 16;
}

function localHeaderSize(name: string): number {
  return 30 + Buffer.byteLength(name, "utf8");
}

function buildGeneratedArtifacts(
  context: PackageContext,
  fingerprintValue: string,
  baseEntries: readonly PackageFileEntry[],
  layout: PackageLayout,
  serializer: PackageSerializer,
  fingerprint: PackageFingerprint,
): Readonly<{ artifacts: readonly PackageArtifact[]; metadata: Readonly<Record<string, unknown>> }> {
  const checksums = {
    version: context.version,
    files: baseEntries.map((entry) => ({
      path: entry.path,
      checksum: entry.checksum,
      size: entry.size,
      kind: entry.kind,
    })),
  };

  const audit = {
    packageId: context.packageId,
    releaseId: context.release.id,
    version: context.version,
    fingerprint: fingerprintValue,
    createdAt: new Date().toISOString(),
    fileCount: baseEntries.length,
    workspacePath: context.workspacePath,
  };

  return deepFreeze({
    artifacts: [
      textArtifact(layout.paths().fingerprint, "fingerprint", `${stableStringify({ version: context.version, packageId: context.packageId, releaseId: context.release.id, fingerprint: fingerprintValue })}\n`, "application/json"),
      textArtifact(layout.paths().checksums + "/sha256.json", "checksum", `${stableStringify(checksums)}\n`, "application/json"),
      textArtifact(layout.paths().audit + "/package.json", "audit", `${stableStringify(audit)}\n`, "application/json"),
    ],
    metadata: {
      fingerprint,
      checksums,
      audit,
      manifestPreview: serializer.serializeManifest(PackageManifest.create({
        version: context.version,
        packageId: context.packageId,
        releaseId: context.release.id,
        fingerprint: fingerprintValue,
        files: baseEntries,
        metadata: Object.freeze({ preview: true }),
      })),
    },
  });
}

function textArtifact(path: string, kind: PackageFileEntry["kind"], text: string, mediaType: string): PackageArtifact {
  return Object.freeze({
    path,
    kind,
    source: Object.freeze({ type: "text", text }) as PackageArtifact["source"],
    mediaType,
    size: Buffer.byteLength(text),
    checksum: null,
    metadata: Object.freeze({}),
  });
}

async function writeCentralDirectory(output: Writable, archiveHash: ReturnType<typeof createHash>, states: readonly ZipEntryState[], offset: bigint): Promise<void> {
  const centralEntries: CentralDirectoryEntry[] = states.map((state) => createCentralDirectoryEntry(state));
  const directorySize = centralEntries.reduce((total, entry) => total + BigInt(entry.buffer.length), 0n);
  const directoryOffset = offset;

  for (const entry of centralEntries) {
    await writeBuffer(output, archiveHash, entry.buffer);
  }

  const needsZip64 = directoryOffset > UINT32_MAX || directorySize > UINT32_MAX || states.length > 0xffff;
  if (needsZip64) {
    const zip64 = createZip64EndRecord(states.length, directorySize, directoryOffset);
    await writeBuffer(output, archiveHash, zip64.record);
    await writeBuffer(output, archiveHash, zip64.locator);
  }

  const eocd = createEndOfCentralDirectory(states.length, directorySize, directoryOffset, needsZip64);
  await writeBuffer(output, archiveHash, eocd);
}

function createCentralDirectoryEntry(state: ZipEntryState): CentralDirectoryEntry {
  const nameBytes = Buffer.from(state.path, "utf8");
  const zip64 = state.compressedSize > UINT32_MAX || state.uncompressedSize > UINT32_MAX || state.offset > UINT32_MAX;
  const extra = zip64 ? createZip64Extra(state) : Buffer.alloc(0);
  const buffer = Buffer.alloc(46 + nameBytes.length + extra.length);
  let position = 0;
  buffer.writeUInt32LE(0x02014b50, position); position += 4;
  buffer.writeUInt16LE(45, position); position += 2;
  buffer.writeUInt16LE(45, position); position += 2;
  buffer.writeUInt16LE(0x0808, position); position += 2;
  buffer.writeUInt16LE(state.method, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt32LE(state.crc32 >>> 0, position); position += 4;
  buffer.writeUInt32LE(zip64 ? 0xffffffff : Number(state.compressedSize), position); position += 4;
  buffer.writeUInt32LE(zip64 ? 0xffffffff : Number(state.uncompressedSize), position); position += 4;
  buffer.writeUInt16LE(nameBytes.length, position); position += 2;
  buffer.writeUInt16LE(extra.length, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt32LE(0, position); position += 4;
  buffer.writeUInt32LE(zip64 ? 0xffffffff : Number(state.offset), position); position += 4;
  nameBytes.copy(buffer, position); position += nameBytes.length;
  extra.copy(buffer, position);
  return { buffer, zip64 };
}

function createZip64Extra(state: ZipEntryState): Buffer {
  const extra = Buffer.alloc(4 + 8 + 8 + 8);
  let position = 0;
  extra.writeUInt16LE(0x0001, position); position += 2;
  extra.writeUInt16LE(24, position); position += 2;
  extra.writeBigUInt64LE(state.uncompressedSize, position); position += 8;
  extra.writeBigUInt64LE(state.compressedSize, position); position += 8;
  extra.writeBigUInt64LE(state.offset, position);
  return extra;
}

function createZip64EndRecord(totalEntries: number, directorySize: bigint, directoryOffset: bigint): Readonly<{ record: Buffer; locator: Buffer }> {
  const record = Buffer.alloc(56);
  let position = 0;
  record.writeUInt32LE(0x06064b50, position); position += 4;
  record.writeBigUInt64LE(44n, position); position += 8;
  record.writeUInt16LE(45, position); position += 2;
  record.writeUInt16LE(45, position); position += 2;
  record.writeUInt32LE(0, position); position += 4;
  record.writeUInt32LE(0, position); position += 4;
  record.writeBigUInt64LE(BigInt(totalEntries), position); position += 8;
  record.writeBigUInt64LE(BigInt(totalEntries), position); position += 8;
  record.writeBigUInt64LE(directorySize, position); position += 8;
  record.writeBigUInt64LE(directoryOffset, position);

  const locator = Buffer.alloc(20);
  let loc = 0;
  locator.writeUInt32LE(0x07064b50, loc); loc += 4;
  locator.writeUInt32LE(0, loc); loc += 4;
  locator.writeBigUInt64LE(directoryOffset + directorySize, loc); loc += 8;
  locator.writeUInt32LE(1, loc);
  return { record, locator };
}

function createEndOfCentralDirectory(totalEntries: number, directorySize: bigint, directoryOffset: bigint, zip64: boolean): Buffer {
  const buffer = Buffer.alloc(22);
  let position = 0;
  buffer.writeUInt32LE(0x06054b50, position); position += 4;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt16LE(0, position); position += 2;
  buffer.writeUInt16LE(zip64 ? 0xffff : totalEntries, position); position += 2;
  buffer.writeUInt16LE(zip64 ? 0xffff : totalEntries, position); position += 2;
  buffer.writeUInt32LE(zip64 ? 0xffffffff : Number(directorySize), position); position += 4;
  buffer.writeUInt32LE(zip64 ? 0xffffffff : Number(directoryOffset), position); position += 4;
  buffer.writeUInt16LE(0, position);
  return buffer;
}

async function closeStream(output: Writable): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    output.end(() => resolve());
    output.once("error", reject);
  });
}
