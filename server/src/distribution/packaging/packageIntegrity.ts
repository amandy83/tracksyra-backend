import type { PackageIntegrityDocument, PackageManifestDocument } from "./packageTypes";

export class PackageIntegrity {
  verify(manifest: PackageManifestDocument, checksums: ReadonlyMap<string, string>): PackageIntegrityDocument {
    const errors: string[] = [];
    let bytesVerified = 0;
    for (const file of manifest.files) {
      bytesVerified += file.size;
      const checksum = checksums.get(file.path);
      if (!checksum) {
        errors.push(`Missing checksum for ${file.path}`);
        continue;
      }
      if (checksum !== file.checksum) {
        errors.push(`Checksum mismatch for ${file.path}`);
      }
    }
    return {
      valid: errors.length === 0,
      filesVerified: manifest.files.length,
      bytesVerified,
      errors: Object.freeze(errors),
      metadata: Object.freeze({}),
    };
  }
}

