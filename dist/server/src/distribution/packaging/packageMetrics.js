import { deepFreeze } from "./packageUtils.js";
export class PackageMetrics {
    startedAt = Date.now();
    finishedAt = null;
    files = 0;
    bytes = 0;
    resumed = false;
    markResumed() {
        this.resumed = true;
    }
    addFile(bytes) {
        this.files += 1;
        this.bytes += Math.max(0, Math.trunc(bytes));
    }
    finish() {
        this.finishedAt = Date.now();
    }
    snapshot() {
        return deepFreeze({
            startedAt: new Date(this.startedAt).toISOString(),
            finishedAt: this.finishedAt == null ? null : new Date(this.finishedAt).toISOString(),
            durationMs: this.finishedAt == null ? null : this.finishedAt - this.startedAt,
            files: this.files,
            bytes: this.bytes,
            resumed: this.resumed,
            metadata: Object.freeze({}),
        });
    }
}
