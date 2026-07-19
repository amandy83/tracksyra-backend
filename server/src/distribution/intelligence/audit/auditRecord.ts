import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class AuditRecord {
  readonly recordId: string;
  readonly releaseId: string;
  readonly eventType: string;
  readonly recordedAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    recordId: string;
    releaseId: string;
    eventType: string;
    recordedAt?: string;
    payload?: Readonly<Record<string, unknown>>;
    metadata?: ProjectionMetadata;
  }) {
    this.recordId = input.recordId.trim();
    this.releaseId = input.releaseId.trim();
    this.eventType = input.eventType.trim();
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.recordId || !this.releaseId || !this.eventType) {
      throw new Error("AuditRecord requires recordId, releaseId, and eventType");
    }
    Object.freeze(this);
  }
}

