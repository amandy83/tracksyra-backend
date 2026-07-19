import { ProviderStatusEvent } from "../events/providerStatusEvent";
import { ReconciliationResult } from "../reconciliation/reconciliationResult";

export class WebhookEvent {
  readonly webhookId: string;
  readonly providerStatusEvent: ProviderStatusEvent;
  readonly receivedAt: string;
  readonly signatureValidatedAt: string | null;
  readonly validationPassed: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    webhookId: string;
    providerStatusEvent: ProviderStatusEvent;
    receivedAt?: string;
    signatureValidatedAt?: string | null;
    validationPassed?: boolean;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.webhookId = input.webhookId.trim();
    this.providerStatusEvent = input.providerStatusEvent;
    this.receivedAt = input.receivedAt ?? new Date().toISOString();
    this.signatureValidatedAt = input.signatureValidatedAt ?? null;
    this.validationPassed = input.validationPassed ?? false;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.webhookId) {
      throw new Error("WebhookEvent.webhookId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface WebhookProcessor {
  process(input: WebhookEvent): Promise<ReconciliationResult> | ReconciliationResult;
}

