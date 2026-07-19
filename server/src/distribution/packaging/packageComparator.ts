import type { PackageDiffDocument, PackageManifestDocument } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageComparator {
  compare(before: PackageManifestDocument, after: PackageManifestDocument): PackageDiffDocument {
    const beforeMap = new Map(before.files.map((file) => [file.path, file] as const));
    const afterMap = new Map(after.files.map((file) => [file.path, file] as const));
    const changes = new Map<string, PackageDiffDocument["changes"][number]>();

    for (const [path, file] of beforeMap) {
      const next = afterMap.get(path);
      if (!next) {
        changes.set(path, { path, before: file, after: null, changeType: "removed" });
        continue;
      }
      if (file.checksum !== next.checksum || file.size !== next.size || file.kind !== next.kind) {
        changes.set(path, { path, before: file, after: next, changeType: "changed" });
      }
    }

    for (const [path, file] of afterMap) {
      if (!beforeMap.has(path)) changes.set(path, { path, before: null, after: file, changeType: "added" });
    }

    return deepFreeze({
      identical: changes.size === 0,
      changes: Object.freeze([...changes.values()].sort((left, right) => left.path.localeCompare(right.path))),
      beforeFingerprint: before.fingerprint,
      afterFingerprint: after.fingerprint,
      metadata: Object.freeze({}),
    });
  }
}

