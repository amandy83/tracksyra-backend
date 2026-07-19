import type { HealthCategory, ObservabilityMetadata } from "../types/observabilityTypes";
import { HealthStatus } from "./healthStatus";

export class HealthCheck {
  readonly checkId: string;
  readonly componentId: string;
  readonly category: HealthCategory;
  readonly status: HealthStatus;
  readonly checkedAt: string;
  readonly latencyMs: number | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    checkId: string;
    componentId: string;
    category: HealthCategory;
    status: HealthStatus;
    checkedAt?: string;
    latencyMs?: number | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.checkId = input.checkId.trim();
    this.componentId = input.componentId.trim();
    this.category = input.category;
    this.status = input.status;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.latencyMs = input.latencyMs ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.checkId || !this.componentId) {
      throw new Error("HealthCheck requires checkId and componentId");
    }
    Object.freeze(this);
  }
}

