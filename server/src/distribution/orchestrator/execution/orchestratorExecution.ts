import type { DistributionExecutionContext } from "../../execution/types";
import type { DistributionExecutionResult } from "../../execution/types";
import type { OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorExecution {
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly executionContext: DistributionExecutionContext | null;
  readonly result: DistributionExecutionResult | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    orchestrationId: string;
    releaseId: string;
    executionContext?: DistributionExecutionContext | null;
    result?: DistributionExecutionResult | null;
    startedAt?: string;
    completedAt?: string | null;
    metadata?: OrchestrationMetadata;
  }) {
    this.orchestrationId = input.orchestrationId.trim();
    this.releaseId = input.releaseId.trim();
    this.executionContext = input.executionContext ?? null;
    this.result = input.result ?? null;
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.completedAt = input.completedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.orchestrationId || !this.releaseId) {
      throw new Error("OrchestratorExecution requires identifiers");
    }
    Object.freeze(this);
  }
}

export interface OrchestratorExecutionCoordinator {
  coordinate(execution: OrchestratorExecution): Promise<OrchestratorExecution> | OrchestratorExecution;
}
