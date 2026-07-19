import type { ConnectorCapabilityCategory, ConnectorMetadataMap } from "../types/connectorTypes";
export type { ConnectorCapabilityCategory } from "../types/connectorTypes";

export class ConnectorCapabilities {
  readonly connectorId: string;
  readonly categories: readonly ConnectorCapabilityCategory[];
  readonly uploadModes: readonly string[];
  readonly territories: readonly string[];
  readonly languages: readonly string[];
  readonly features: readonly string[];
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    categories: readonly ConnectorCapabilityCategory[];
    uploadModes?: readonly string[];
    territories?: readonly string[];
    languages?: readonly string[];
    features?: readonly string[];
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.categories = Object.freeze([...(input.categories ?? [])]);
    this.uploadModes = Object.freeze([...(input.uploadModes ?? [])]);
    this.territories = Object.freeze([...(input.territories ?? [])]);
    this.languages = Object.freeze([...(input.languages ?? [])]);
    this.features = Object.freeze([...(input.features ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId) {
      throw new Error("ConnectorCapabilities.connectorId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface CapabilityProvider {
  getCapabilities(context: import("../context/connectorContext").ConnectorContext): Promise<ConnectorCapabilities> | ConnectorCapabilities;
}
