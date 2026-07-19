export class WorkerHeartbeat {
    heartbeatId;
    workerId;
    executionId;
    recordedAt;
    nextDueAt;
    latencyMs;
    constructor(input) {
        this.heartbeatId = input.heartbeatId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.recordedAt = input.recordedAt ?? new Date().toISOString();
        this.nextDueAt = input.nextDueAt ?? null;
        this.latencyMs = input.latencyMs;
        if (!this.heartbeatId || !this.workerId || !this.executionId) {
            throw new Error("WorkerHeartbeat requires non-empty identifiers");
        }
        if (!Number.isFinite(this.latencyMs) || this.latencyMs < 0) {
            throw new Error("WorkerHeartbeat.latencyMs must be non-negative");
        }
        Object.freeze(this);
    }
}
