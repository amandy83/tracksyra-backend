import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class DashboardProjection {
  readonly projectionId: string;
  readonly scope: string;
  readonly widgets: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    projectionId: string;
    scope: string;
    widgets?: Readonly<Record<string, unknown>>;
    updatedAt?: string;
    metadata?: ObservabilityMetadata;
  }) {
    this.projectionId = input.projectionId.trim();
    this.scope = input.scope.trim();
    this.widgets = Object.freeze({ ...(input.widgets ?? {}) });
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.projectionId || !this.scope) {
      throw new Error("DashboardProjection requires projectionId and scope");
    }
    Object.freeze(this);
  }
}

