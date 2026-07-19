import type { OrchestrationLifecycleState, OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorLifecycle {
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly state: OrchestrationLifecycleState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    orchestrationId: string;
    releaseId: string;
    state: OrchestrationLifecycleState;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string | null;
    metadata?: OrchestrationMetadata;
  }) {
    this.orchestrationId = input.orchestrationId.trim();
    this.releaseId = input.releaseId.trim();
    this.state = input.state;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.completedAt = input.completedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.orchestrationId || !this.releaseId) {
      throw new Error("OrchestratorLifecycle requires identifiers");
    }
    Object.freeze(this);
  }
}

export interface OrchestratorLifecycleCoordinator {
  create(orchestrationId: string, releaseId: string): OrchestratorLifecycle;
  reserve(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  start(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  running(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  checkpointing(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  complete(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  fail(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  cancel(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  recover(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
}
