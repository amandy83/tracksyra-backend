import type { HealthCategory, ObservabilityMetadata } from "../types/observabilityTypes";

export class HealthStatus {
  readonly componentId: string;
  readonly category: HealthCategory;
  readonly healthy: boolean;
  readonly severity: "degraded" | "healthy" | "unhealthy" | "unknown";
  readonly observedAt: string;
  readonly message: string | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    componentId: string;
    category: HealthCategory;
    healthy: boolean;
    severity?: "degraded" | "healthy" | "unhealthy" | "unknown";
    observedAt?: string;
    message?: string | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.componentId = input.componentId.trim();
    this.category = input.category;
    this.healthy = input.healthy;
    this.severity = input.severity ?? (input.healthy ? "healthy" : "unhealthy");
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.message = input.message ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.componentId) {
      throw new Error("HealthStatus.componentId must not be empty");
    }
    Object.freeze(this);
  }
}

