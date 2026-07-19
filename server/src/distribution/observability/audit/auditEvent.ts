import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class AuditEvent {
  readonly auditId: string;
  readonly source: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actor: string | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    auditId: string;
    source: string;
    eventType: string;
    occurredAt?: string;
    actor?: string | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.auditId = input.auditId.trim();
    this.source = input.source.trim();
    this.eventType = input.eventType.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.actor = input.actor ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.auditId || !this.source || !this.eventType) {
      throw new Error("AuditEvent requires auditId, source, and eventType");
    }
    Object.freeze(this);
  }
}

