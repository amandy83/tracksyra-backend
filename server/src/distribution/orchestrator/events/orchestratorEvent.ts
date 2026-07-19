import type { OrchestrationEventType, OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorEvent {
  readonly type: OrchestrationEventType;
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly occurredAt: string;
  readonly payload: OrchestrationMetadata;

  constructor(input: {
    type: OrchestrationEventType;
    orchestrationId: string;
    releaseId: string;
    occurredAt?: string;
    payload?: OrchestrationMetadata;
  }) {
    this.type = input.type;
    this.orchestrationId = input.orchestrationId.trim();
    this.releaseId = input.releaseId.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.orchestrationId || !this.releaseId) {
      throw new Error("OrchestratorEvent requires identifiers");
    }
    Object.freeze(this);
  }
}

export interface OrchestratorEventPublisher {
  publish(event: OrchestratorEvent): Promise<void> | void;
}

