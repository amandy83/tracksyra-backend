import type { ConnectorAsset } from "../assets/connectorAsset";

export interface UploadProvider {
  uploadSingle(asset: ConnectorAsset): Promise<ConnectorAsset> | ConnectorAsset;
  uploadMultipart(assets: readonly ConnectorAsset[]): Promise<readonly ConnectorAsset[]> | readonly ConnectorAsset[];
  uploadChunk(asset: ConnectorAsset, chunk: Readonly<Record<string, unknown>>): Promise<ConnectorAsset> | ConnectorAsset;
  uploadResumable(asset: ConnectorAsset): Promise<ConnectorAsset> | ConnectorAsset;
  uploadStreaming(asset: ConnectorAsset): Promise<ConnectorAsset> | ConnectorAsset;
}

