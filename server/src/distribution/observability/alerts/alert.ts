import type { AlertLevel, ObservabilityMetadata } from "../types/observabilityTypes";

export class Alert {
  readonly alertId: string;
  readonly level: AlertLevel;
  readonly title: string;
  readonly message: string;
  readonly componentId: string | null;
  readonly raisedAt: string;
  readonly acknowledgedAt: string | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    alertId: string;
    level: AlertLevel;
    title: string;
    message: string;
    componentId?: string | null;
    raisedAt?: string;
    acknowledgedAt?: string | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.alertId = input.alertId.trim();
    this.level = input.level;
    this.title = input.title.trim();
    this.message = input.message.trim();
    this.componentId = input.componentId ?? null;
    this.raisedAt = input.raisedAt ?? new Date().toISOString();
    this.acknowledgedAt = input.acknowledgedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.alertId || !this.title || !this.message) {
      throw new Error("Alert requires alertId, title, and message");
    }
    Object.freeze(this);
  }
}

