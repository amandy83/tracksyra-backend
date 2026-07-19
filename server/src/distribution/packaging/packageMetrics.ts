import type { PackageMetricSnapshot } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageMetrics {
  private startedAt = Date.now();
  private finishedAt: number | null = null;
  private files = 0;
  private bytes = 0;
  private resumed = false;

  markResumed(): void {
    this.resumed = true;
  }

  addFile(bytes: number): void {
    this.files += 1;
    this.bytes += Math.max(0, Math.trunc(bytes));
  }

  finish(): void {
    this.finishedAt = Date.now();
  }

  snapshot(): PackageMetricSnapshot {
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

