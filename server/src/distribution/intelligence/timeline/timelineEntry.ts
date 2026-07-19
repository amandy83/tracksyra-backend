import type { TimelineStage, ProjectionMetadata } from "../types/intelligenceTypes";

export class TimelineEntry {
  readonly releaseId: string;
  readonly stage: TimelineStage;
  readonly label: string;
  readonly occurredAt: string;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    stage: TimelineStage;
    label: string;
    occurredAt?: string;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage;
    this.label = input.label.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.label) {
      throw new Error("TimelineEntry requires releaseId and label");
    }
    Object.freeze(this);
  }
}

