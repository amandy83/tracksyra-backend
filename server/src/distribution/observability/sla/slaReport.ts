import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class SLAReport {
  readonly reportId: string;
  readonly serviceName: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly availability: number;
  readonly latency: number;
  readonly violations: readonly string[];
  readonly generatedAt: string;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    reportId: string;
    serviceName: string;
    windowStart: string;
    windowEnd: string;
    availability: number;
    latency: number;
    violations?: readonly string[];
    generatedAt?: string;
    metadata?: ObservabilityMetadata;
  }) {
    this.reportId = input.reportId.trim();
    this.serviceName = input.serviceName.trim();
    this.windowStart = input.windowStart.trim();
    this.windowEnd = input.windowEnd.trim();
    this.availability = input.availability;
    this.latency = input.latency;
    this.violations = Object.freeze([...(input.violations ?? [])]);
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.reportId || !this.serviceName || !this.windowStart || !this.windowEnd) {
      throw new Error("SLAReport requires reportId, serviceName, and window bounds");
    }
    Object.freeze(this);
  }
}

