export class CancellationToken {
  readonly cancelled: boolean;
  readonly reason: string | null;

  constructor(input: { cancelled?: boolean; reason?: string | null } = {}) {
    this.cancelled = input.cancelled ?? false;
    this.reason = input.reason ?? null;
    Object.freeze(this);
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new Error(this.reason ?? "Worker execution cancelled");
    }
  }
}

export interface CancellationManager {
  cancel(workerId: string, executionId: string, reason?: string | null): CancellationToken;
  forceCancel(workerId: string, executionId: string, reason?: string | null): CancellationToken;
  release(workerId: string, executionId: string): boolean;
  persistCheckpoint(workerId: string, executionId: string): Promise<void>;
}

