import { normalizeArchivePath } from "./packageUtils.js";
export class PackageRules {
    static requiredPaths(layout) {
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
    static validatePaths(paths, layout) {
        const normalized = new Set(paths.map((path) => normalizeArchivePath(path)));
        const issues = [];
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
