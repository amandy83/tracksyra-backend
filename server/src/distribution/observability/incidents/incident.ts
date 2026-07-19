import type { IncidentLevel, ObservabilityMetadata } from "../types/observabilityTypes";

export class Incident {
  readonly incidentId: string;
  readonly level: IncidentLevel;
  readonly title: string;
  readonly description: string;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly status: "open" | "investigating" | "resolved" | "closed";
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    incidentId: string;
    level: IncidentLevel;
    title: string;
    description: string;
    openedAt?: string;
    resolvedAt?: string | null;
    status?: "open" | "investigating" | "resolved" | "closed";
    metadata?: ObservabilityMetadata;
  }) {
    this.incidentId = input.incidentId.trim();
    this.level = input.level;
    this.title = input.title.trim();
    this.description = input.description.trim();
    this.openedAt = input.openedAt ?? new Date().toISOString();
    this.resolvedAt = input.resolvedAt ?? null;
    this.status = input.status ?? "open";
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.incidentId || !this.title || !this.description) {
      throw new Error("Incident requires incidentId, title, and description");
    }
    Object.freeze(this);
  }
}

