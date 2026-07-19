import { sha256Hex, stableStringify } from "./packageUtils.js";
export class PackageFingerprint {
    fingerprintFromManifest(manifest) {
        return sha256Hex(stableStringify({
            version: manifest.version,
            packageId: manifest.packageId,
            releaseId: manifest.releaseId,
            files: [...manifest.files].sort((left, right) => left.path.localeCompare(right.path)).map((file) => ({
                path: file.path,
                kind: file.kind,
                size: file.size,
                checksum: file.checksum,
            })),
        }));
    }
    fingerprintFromFiles(files) {
        return sha256Hex(stableStringify([...files].sort((left, right) => left.path.localeCompare(right.path))));
    }
}
