import type { ConnectorEventType, ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorEvent {
  readonly type: ConnectorEventType;
  readonly connectorId: string;
  readonly releaseId: string | null;
  readonly occurredAt: string;
  readonly payload: ConnectorMetadataMap;

  constructor(input: {
    type: ConnectorEventType;
    connectorId: string;
    releaseId?: string | null;
    occurredAt?: string;
    payload?: ConnectorMetadataMap;
  }) {
    this.type = input.type;
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId ?? null;
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.connectorId) {
      throw new Error("ConnectorEvent.connectorId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface ConnectorEventPublisher {
  publish(event: ConnectorEvent): Promise<void> | void;
}

