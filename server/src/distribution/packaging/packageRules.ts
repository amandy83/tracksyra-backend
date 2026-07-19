import type { PackageLayoutPaths, PackageValidationIssue } from "./packageTypes";
import { normalizeArchivePath } from "./packageUtils";

export class PackageRules {
  static requiredPaths(layout: PackageLayoutPaths): readonly string[] {
    return [
      layout.manifest,
      layout.release,
      layout.tracks,
      layout.contributors,
      layout.publishing,
      layout.rights,
      layout.territories,
      layout.pricing,
      layout.fingerprint,
      layout.package,
    ];
  }

  static validatePaths(paths: readonly string[], layout: PackageLayoutPaths): readonly PackageValidationIssue[] {
    const normalized = new Set(paths.map((path) => normalizeArchivePath(path)));
    const issues: PackageValidationIssue[] = [];
    for (const required of this.requiredPaths(layout)) {
      if (!normalized.has(normalizeArchivePath(required))) {
        issues.push({
          path: required,
          code: "MISSING_REQUIRED_PATH",
          message: `Missing required package path: ${required}`,
          severity: "error",
          value: required,
        });
      }
    }
    return Object.freeze(issues);
  }
}

