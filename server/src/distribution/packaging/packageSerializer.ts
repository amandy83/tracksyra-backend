import type { PackageDiffDocument, PackageManifestDocument, PackageSnapshotDocument } from "./packageTypes";
import { stableStringify } from "./packageUtils";
import { PackageManifest } from "./packageManifest";
import { PackageSnapshot } from "./packageSnapshot";

export class PackageSerializer {
  serializeManifest(manifest: PackageManifest | PackageManifestDocument): string {
    return `${stableStringify(manifest instanceof PackageManifest ? manifest.toJSON() : manifest)}\n`;
  }

  deserializeManifest(payload: string): PackageManifest {
    return new PackageManifest(JSON.parse(payload) as PackageManifestDocument);
  }

  serializeSnapshot(snapshot: PackageSnapshot): string {
    return `${stableStringify({
      id: snapshot.id,
      version: snapshot.version,
      packageId: snapshot.packageId,
      releaseId: snapshot.releaseId,
      fingerprint: snapshot.fingerprint,
      createdAt: snapshot.createdAt.toISOString(),
      serialized: snapshot.serialized,
      manifest: snapshot.manifest,
      metadata: snapshot.metadata,
    })}\n`;
  }

  deserializeSnapshot(payload: string): PackageSnapshot {
    return new PackageSnapshot(JSON.parse(payload) as PackageSnapshotDocument);
  }

  serializeDiff(diff: PackageDiffDocument): string {
    return `${stableStringify(diff)}\n`;
  }
}

