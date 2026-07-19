import type { ProviderIntegrationMetadata } from "../types/providerIntegrationTypes";

export type ProviderIntegrationEventType =
  | "ProviderIntegrationRegistered"
  | "ProviderIntegrationAuthenticated"
  | "ProviderIntegrationSelected"
  | "ProviderIntegrationUploaded"
  | "ProviderIntegrationStatusChanged"
  | "ProviderIntegrationRoyaltiesImported"
  | "ProviderIntegrationReportsGenerated"
  | "ProviderIntegrationTakedownRequested"
  | "ProviderIntegrationHealthChanged";

export class ProviderIntegrationEvent<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly type: ProviderIntegrationEventType;
  readonly providerName: string;
  readonly adapterName: string;
  readonly occurredAt: string;
  readonly payload: TMetadata;

  constructor(input: {
    type: ProviderIntegrationEventType;
    providerName: string;
    adapterName: string;
    occurredAt?: string;
    payload?: TMetadata;
  }) {
    this.type = input.type;
    this.providerName = input.providerName.trim();
    this.adapterName = input.adapterName.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) }) as TMetadata;
    if (!this.providerName || !this.adapterName) {
      throw new Error("ProviderIntegrationEvent requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}
