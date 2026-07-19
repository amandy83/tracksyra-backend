import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorAsset {
  readonly assetId: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly uri: string;
  readonly checksum: string | null;
  readonly sizeBytes: number | null;
  readonly mediaType: string | null;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    assetId: string;
    releaseId: string;
    kind: string;
    uri: string;
    checksum?: string | null;
    sizeBytes?: number | null;
    mediaType?: string | null;
    metadata?: ConnectorMetadataMap;
  }) {
    this.assetId = input.assetId.trim();
    this.releaseId = input.releaseId.trim();
    this.kind = input.kind.trim();
    this.uri = input.uri.trim();
    this.checksum = input.checksum ?? null;
    this.sizeBytes = input.sizeBytes ?? null;
    this.mediaType = input.mediaType ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.assetId || !this.releaseId || !this.kind || !this.uri) {
      throw new Error("ConnectorAsset requires non-empty assetId, releaseId, kind, and uri");
    }
    Object.freeze(this);
  }
}

export interface AssetProvider {
  uploadAsset(asset: ConnectorAsset): Promise<ConnectorAsset> | ConnectorAsset;
}

