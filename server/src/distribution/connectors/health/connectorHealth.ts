import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorHealth {
  readonly connectorId: string;
  readonly healthy: boolean;
  readonly latencyMs: number | null;
  readonly checkedAt: string;
  readonly details: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    healthy: boolean;
    latencyMs?: number | null;
    checkedAt?: string;
    details?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.healthy = input.healthy;
    this.latencyMs = input.latencyMs ?? null;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    if (!this.connectorId) {
      throw new Error("ConnectorHealth.connectorId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface HealthProvider {
  checkHealth(connectorId: string): Promise<ConnectorHealth> | ConnectorHealth;
}

