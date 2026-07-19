import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { PackageError } from "./packageError";
import { PackageArtifactFactory } from "./packageArtifact";
import type { PackageArtifact } from "./packageTypes";
import { bytesToHex, crc32Update } from "./packageUtils";

export class PackageChecksum {
  async file(path: string): Promise<string> {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    try {
      for await (const chunk of stream) {
        hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
    } catch (error) {
      throw new PackageError(`Failed to hash file: ${path}`, "PACKAGE_CHECKSUM_FAILED", { path, error });
    }
    return hash.digest("hex");
  }

  streamHash(): { hash: ReturnType<typeof createHash>; crc32: number } {
    return { hash: createHash("sha256"), crc32: 0 };
  }

  update(state: { hash: ReturnType<typeof createHash>; crc32: number }, chunk: Buffer): { hash: ReturnType<typeof createHash>; crc32: number } {
    state.hash.update(chunk);
    state.crc32 = crc32Update(state.crc32, chunk);
    return state;
  }

  finalize(state: { hash: ReturnType<typeof createHash>; crc32: number }): Readonly<{ sha256: string; crc32: string }> {
    return {
      sha256: state.hash.digest("hex"),
      crc32: state.crc32.toString(16).padStart(8, "0"),
    };
  }

  fromArtifacts(artifacts: readonly PackageArtifact[]): readonly PackageArtifact[] {
    return Object.freeze([...artifacts.map((artifact) => (artifact.checksum ? artifact : PackageArtifactFactory.text(artifact.path, artifact.kind, "", artifact.mediaType, artifact.metadata)))]);
  }
}
