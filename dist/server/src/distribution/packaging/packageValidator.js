import { PackageRules } from "./packageRules.js";
import { PackageIndex } from "./packageIndex.js";
import { deepFreeze } from "./packageUtils.js";
export class PackageValidator {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    validate(context) {
        const layout = this.layout.paths();
        const index = new PackageIndex(context.artifacts);
        const issues = [];
        for (const artifact of context.artifacts) {
            if (!artifact.path || artifact.path !== artifact.path.trim()) {
                issues.push({
                    path: artifact.path,
                    code: "INVALID_PATH",
                    message: "Artifact path must be a trimmed, non-empty archive path",
                    severity: "error",
                    value: artifact.path,
                });
            }
            if (index.get(artifact.path) !== artifact) {
                issues.push({
                    path: artifact.path,
                    code: "DUPLICATE_PATH",
                    message: `Duplicate artifact path detected: ${artifact.path}`,
                    severity: "error",
                    value: artifact.path,
                });
            }
        }
        issues.push(...PackageRules.validatePaths(context.artifacts.map((artifact) => artifact.path), layout));
        return deepFreeze({
            valid: issues.every((issue) => issue.severity !== "error"),
            errors: Object.freeze(issues.filter((issue) => issue.severity === "error")),
            warnings: Object.freeze(issues.filter((issue) => issue.severity === "warning")),
            metadata: Object.freeze({ packageId: context.packageId }),
        });
    }
}
