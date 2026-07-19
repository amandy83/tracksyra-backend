import type { UniversalMetadataDiff, UniversalMetadataDiffEntry, UniversalRelease } from "./metadataTypes";
import { MetadataHasher } from "./metadataHasher";
import { normalizeForSerialization } from "./metadataUtils";

export class MetadataComparator {
  constructor(private readonly hasher: MetadataHasher) {}

  compare(before: UniversalRelease, after: UniversalRelease): UniversalMetadataDiff {
    const changes = diffValues(normalizeForSerialization(before), normalizeForSerialization(after));
    return Object.freeze({
      identical: changes.length === 0,
      changes: Object.freeze(changes),
      beforeFingerprint: this.hasher.hash(before),
      afterFingerprint: this.hasher.hash(after),
      metadata: Object.freeze({ beforeVersion: before.version, afterVersion: after.version }),
    });
  }
}

function diffValues(before: unknown, after: unknown, path = ""): UniversalMetadataDiffEntry[] {
  if (isEqual(before, after)) return [];

  if (Array.isArray(before) || Array.isArray(after)) {
    const left = Array.isArray(before) ? before : [];
    const right = Array.isArray(after) ? after : [];
    const changes: UniversalMetadataDiffEntry[] = [];
    const max = Math.max(left.length, right.length);
    for (let index = 0; index < max; index += 1) {
      const nextPath = `${path}[${index}]`;
      if (index >= left.length) {
        changes.push({ path: nextPath, before: undefined, after: right[index], changeType: "added" });
        continue;
      }
      if (index >= right.length) {
        changes.push({ path: nextPath, before: left[index], after: undefined, changeType: "removed" });
        continue;
      }
      changes.push(...diffValues(left[index], right[index], nextPath));
    }
    return changes;
  }

  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: UniversalMetadataDiffEntry[] = [];
    for (const key of [...keys].sort()) {
      const nextPath = path ? `${path}.${key}` : key;
      if (!(key in before)) {
        changes.push({ path: nextPath, before: undefined, after: (after as Record<string, unknown>)[key], changeType: "added" });
        continue;
      }
      if (!(key in after)) {
        changes.push({ path: nextPath, before: (before as Record<string, unknown>)[key], after: undefined, changeType: "removed" });
        continue;
      }
      changes.push(...diffValues((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], nextPath));
    }
    return changes;
  }

  return [{
    path,
    before,
    after,
    changeType: before === undefined ? "added" : after === undefined ? "removed" : "changed",
  }];
}

function isEqual(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
