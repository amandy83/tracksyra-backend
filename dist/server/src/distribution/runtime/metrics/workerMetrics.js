export class WorkerStatistics {
    workerId;
    executionId;
    executionDurationMs;
    retryCount;
    checkpointCount;
    recoveryCount;
    failureCount;
    heartbeatLatencyMs;
    utilization;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.executionDurationMs = input.executionDurationMs;
        this.retryCount = input.retryCount ?? 0;
        this.checkpointCount = input.checkpointCount ?? 0;
        this.recoveryCount = input.recoveryCount ?? 0;
        this.failureCount = input.failureCount ?? 0;
        this.heartbeatLatencyMs = input.heartbeatLatencyMs ?? 0;
        this.utilization = input.utilization ?? 0;
        if (!this.workerId || !this.executionId) {
            throw new Error("WorkerStatistics requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
