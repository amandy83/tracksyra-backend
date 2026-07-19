import type { ConnectorAsset } from "../assets/connectorAsset";
import type { AuthenticationProvider } from "../authentication/authentication";
import type { CapabilityProvider } from "../capabilities/connectorCapabilities";
import type { CatalogProvider, ConnectorSubmission } from "../catalog/connectorCatalog";
import type { ConnectorConfiguration, ConnectorCredentials } from "../configuration/connectorConfiguration";
import type { ConnectorContext } from "../context/connectorContext";
import type { ConnectorDelivery } from "../delivery/connectorDelivery";
import type { HealthProvider, ConnectorHealth } from "../health/connectorHealth";
import type { MetadataProvider, ConnectorMetadata } from "../metadata/connectorMetadata";
import type { PollingProvider, ConnectorPolling } from "../polling/connectorPolling";
import type { RateLimitProvider } from "../rate-limit/connectorRateLimit";
import type { ReportProvider, ConnectorReport } from "../reports/connectorReport";
import type { RetryProvider } from "../retry/connectorRetry";
import type { RoyaltyProvider, ConnectorRoyalty } from "../royalties/connectorRoyalty";
import type { StatusProvider, ConnectorStatus } from "../status/connectorStatus";
import type { TakedownProvider, ConnectorTakedown } from "../takedown/connectorTakedown";
import type { UploadProvider } from "../upload/connectorUpload";
import type { WebhookProvider, ConnectorWebhook } from "../webhooks/connectorWebhook";
import type { ConnectorCapabilities } from "../capabilities/connectorCapabilities";
import type { ConnectorError } from "../errors/connectorError";
import type { ConnectorMetadataMap } from "../types/connectorTypes";

export type ConnectorResponse<TPayload = unknown> = Readonly<{
  success: boolean;
  payload: TPayload;
  metadata: ConnectorMetadataMap;
}>;

export interface DSPConnector {
  readonly connectorId: string;
  readonly version: string;
  readonly configuration: ConnectorConfiguration;
  readonly credentials: ConnectorCredentials | null;

  authenticate(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCredentials>>;
  validateCapabilities(context: ConnectorContext, capabilities: ConnectorCapabilities): Promise<ConnectorResponse<ConnectorCapabilities>>;
  uploadAssets(context: ConnectorContext, assets: readonly ConnectorAsset[]): Promise<ConnectorResponse<readonly ConnectorAsset[]>>;
  submitMetadata(context: ConnectorContext, metadata: ConnectorMetadata): Promise<ConnectorResponse<ConnectorMetadata>>;
  createRelease(context: ConnectorContext, submission: ConnectorSubmission): Promise<ConnectorResponse<ConnectorSubmission>>;
  trackProcessing(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>>;
  trackLiveStatus(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>>;
  importRoyalties(context: ConnectorContext): Promise<ConnectorResponse<ConnectorRoyalty>>;
  generateReport(context: ConnectorContext): Promise<ConnectorResponse<ConnectorReport>>;
  takedownRelease(context: ConnectorContext): Promise<ConnectorResponse<ConnectorTakedown>>;
  checkHealth(context: ConnectorContext): Promise<ConnectorResponse<ConnectorHealth>>;
}

export interface ConnectorFactory {
  create(context: ConnectorContext): DSPConnector;
}

export interface ConnectorAdapter {
  authenticate(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCredentials>>;
  upload(context: ConnectorContext, assets: readonly ConnectorAsset[]): Promise<ConnectorResponse<readonly ConnectorAsset[]>>;
  submit(context: ConnectorContext, submission: ConnectorSubmission): Promise<ConnectorResponse<ConnectorSubmission>>;
  status(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>>;
  webhook(event: ConnectorWebhook): Promise<ConnectorResponse<ConnectorWebhook>>;
  poll(context: ConnectorContext): Promise<ConnectorResponse<ConnectorPolling>>;
  royalties(context: ConnectorContext): Promise<ConnectorResponse<ConnectorRoyalty>>;
  reports(context: ConnectorContext): Promise<ConnectorResponse<ConnectorReport>>;
  takedown(context: ConnectorContext): Promise<ConnectorResponse<ConnectorTakedown>>;
  health(context: ConnectorContext): Promise<ConnectorResponse<ConnectorHealth>>;
  capabilities(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCapabilities>>;
}

