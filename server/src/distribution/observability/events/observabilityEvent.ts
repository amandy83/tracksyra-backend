import type { ObservabilityEventType, ObservabilityMetadata } from "../types/observabilityTypes";

export class ObservabilityEvent {
  readonly type: ObservabilityEventType;
  readonly source: string;
  readonly subject: string;
  readonly occurredAt: string;
  readonly payload: ObservabilityMetadata;

  constructor(input: {
    type: ObservabilityEventType;
    source: string;
    subject: string;
    occurredAt?: string;
    payload?: ObservabilityMetadata;
  }) {
    this.type = input.type;
    this.source = input.source.trim();
    this.subject = input.subject.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.source || !this.subject) {
      throw new Error("ObservabilityEvent requires source and subject");
    }
    Object.freeze(this);
  }
}

export interface ObservabilityEventPublisher {
  publish(event: ObservabilityEvent): Promise<void> | void;
}

