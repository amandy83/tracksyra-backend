import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorWebhook {
  readonly webhookId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly eventType: string;
  readonly receivedAt: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: ConnectorMetadataMap;
  readonly signatureValid: boolean;

  constructor(input: {
    webhookId: string;
    connectorId: string;
    releaseId: string;
    eventType: string;
    receivedAt?: string;
    headers?: Readonly<Record<string, string>>;
    payload?: ConnectorMetadataMap;
    signatureValid?: boolean;
  }) {
    this.webhookId = input.webhookId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.eventType = input.eventType.trim();
    this.receivedAt = input.receivedAt ?? new Date().toISOString();
    this.headers = Object.freeze({ ...(input.headers ?? {}) });
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    this.signatureValid = input.signatureValid ?? false;
    if (!this.webhookId || !this.connectorId || !this.releaseId || !this.eventType) {
      throw new Error("ConnectorWebhook requires non-empty identifiers and eventType");
    }
    Object.freeze(this);
  }
}

export interface WebhookProvider {
  validateSignature(webhook: ConnectorWebhook): Promise<boolean> | boolean;
  parse(webhook: ConnectorWebhook): Promise<ConnectorWebhook> | ConnectorWebhook;
}

