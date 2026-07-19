import type { OrchestrationMetadata } from "../types/orchestratorTypes";
import type { OrchestratorCheckpoint } from "../checkpoint/orchestratorCheckpoint";

export class OrchestratorRecovery {
  readonly recoveryId: string;
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly checkpoint: OrchestratorCheckpoint | null;
  readonly resumed: boolean;
  readonly reason: string | null;
  readonly recoveredAt: string;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    recoveryId: string;
    orchestrationId: string;
    releaseId: string;
    checkpoint?: OrchestratorCheckpoint | null;
    resumed?: boolean;
    reason?: string | null;
    recoveredAt?: string;
    metadata?: OrchestrationMetadata;
  }) {
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

export interface OrchestratorRecoveryCoordinator {
  recover(orchestrationId: string, releaseId: string, checkpoint?: OrchestratorCheckpoint | null): Promise<OrchestratorRecovery> | OrchestratorRecovery;
}
