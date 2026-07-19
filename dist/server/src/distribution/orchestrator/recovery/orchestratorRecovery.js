export class OrchestratorRecovery {
    recoveryId;
    orchestrationId;
    releaseId;
    checkpoint;
    resumed;
    reason;
    recoveredAt;
    metadata;
    constructor(input) {
        this.recoveryId = input.recoveryId.trim();
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.checkpoint = input.checkpoint ?? null;
        this.resumed = input.resumed ?? false;
        this.reason = input.reason ?? null;
        this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.recoveryId || !this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestratorRecovery requires identifiers");
        }
        Object.freeze(this);
    }
}
