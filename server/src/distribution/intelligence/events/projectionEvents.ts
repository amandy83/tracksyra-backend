import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class ProjectionEvent {
  readonly type: "ProjectionBuilt" | "ProjectionUpdated" | "ProjectionRebuilt" | "TimelineUpdated" | "DashboardUpdated" | "AnalyticsUpdated" | "AuditRecorded" | "SnapshotCreated";
  readonly releaseId: string;
  readonly occurredAt: string;
  readonly payload: ProjectionMetadata;

  constructor(input: {
    type: ProjectionEvent["type"];
    releaseId: string;
    occurredAt?: string;
    payload?: ProjectionMetadata;
  }) {
    this.type = input.type;
    this.releaseId = input.releaseId.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.releaseId) {
      throw new Error("ProjectionEvent.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface ProjectionEventPublisher {
  publish(event: ProjectionEvent): Promise<void> | void;
}

