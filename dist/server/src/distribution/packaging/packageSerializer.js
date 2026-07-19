import { stableStringify } from "./packageUtils.js";
import { PackageManifest } from "./packageManifest.js";
import { PackageSnapshot } from "./packageSnapshot.js";
export class PackageSerializer {
    serializeManifest(manifest) {
        return `${stableStringify(manifest instanceof PackageManifest ? manifest.toJSON() : manifest)}\n`;
    }
    deserializeManifest(payload) {
        return new PackageManifest(JSON.parse(payload));
    }
    serializeSnapshot(snapshot) {
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
    deserializeSnapshot(payload) {
        return new PackageSnapshot(JSON.parse(payload));
    }
    serializeDiff(diff) {
        return `${stableStringify(diff)}\n`;
    }
}
