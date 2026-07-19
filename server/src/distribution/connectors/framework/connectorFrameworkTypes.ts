import type { ConnectorAsset } from "../assets/connectorAsset";
import type { ConnectorConfiguration, ConnectorCredentials } from "../configuration/connectorConfiguration";
import type { ConnectorContext } from "../context/connectorContext";
import type { ConnectorHealth } from "../health/connectorHealth";
import type { ConnectorMetadata } from "../metadata/connectorMetadata";
import type { ConnectorPolling } from "../polling/connectorPolling";
import type { ConnectorReport } from "../reports/connectorReport";
import type { ConnectorRetry } from "../retry/connectorRetry";
import type { ConnectorStatus } from "../status/connectorStatus";
import type { ConnectorTakedown } from "../takedown/connectorTakedown";
import type { ConnectorWebhook } from "../webhooks/connectorWebhook";
import type { OfficialDspPartnerName } from "../../partner-onboarding";
import type { Release } from "../../domain";

export type DSPConnectorId = OfficialDspPartnerName | string;

export type DSPCapabilities = Readonly<{
  connectorId: DSPConnectorId;
  supportedAudioFormats: readonly string[];
  artworkRules: Readonly<{
    maxSizeBytes: number | null;
    minWidth: number | null;
    minHeight: number | null;
    squareRequired: boolean;
  }>;
  metadataLimits: Readonly<{
    maxTitleLength: number | null;
    maxContributorCount: number | null;
    maxTerritories: number | null;
  }>;
  genreMappings: Readonly<Record<string, string>>;
  languageMappings: Readonly<Record<string, string>>;
  parentalAdvisoryRules: readonly string[];
  territorySupport: readonly string[];
  deliveryProtocol: string;
  identifierRequirements: readonly string[];
  lyricsSupport: boolean;
  canvasSupport: boolean;
  dolbySupport: boolean;
  spatialAudioSupport: boolean;
  videoSupport: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPDeliveryTarget = Readonly<{
  connectorId: DSPConnectorId;
  connectorVersion: string | null;
  partnerName: OfficialDspPartnerName | string;
  endpointUrl: string | null;
  territories: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPDeliveryJob = Readonly<{
  jobId: string;
  releaseId: string;
  release: Release | null;
  packageModel: DSPDeliveryPackage | null;
  target: DSPDeliveryTarget;
  requestedBy: string | null;
  scheduledFor: string | Date | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPDeliveryPackage = Readonly<{
  packageId: string;
  releaseId: string;
  version: string;
  generatedAt: string;
  normalizedRelease: unknown;
  packageModel: unknown;
  packageResult: unknown;
  manifest: unknown;
  checksum: string;
  signature: unknown;
  artifacts: readonly DSPDeliveryArtifact[];
  validation: unknown;
  checkpoint: unknown;
  resumedFromCheckpointId: string | null;
  rollbackOfPackageId: string | null;
  snapshot: unknown;
  auditTrail: readonly unknown[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPDeliveryArtifact = Readonly<{
  path: string;
  kind: string;
  checksum: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPDeliveryResult = Readonly<{
  connectorId: DSPConnectorId;
  releaseId: string;
  target: DSPDeliveryTarget;
  success: boolean;
  connectorStatus: string | null;
  receipt: string | null;
  errors: readonly string[];
  warnings: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPNormalizedMetadata = ConnectorMetadata;
export type DSPNormalizedAudio = ConnectorAsset;
export type DSPNormalizedArtwork = ConnectorAsset;
export type DSPRetryDecision = ConnectorRetry;
export type DSPHealthSnapshot = ConnectorHealth;
export type DSPWebhookEvent = ConnectorWebhook;
export type DSPStatusSnapshot = ConnectorStatus;
export type DSPPollSnapshot = ConnectorPolling;
export type DSPReportSnapshot = ConnectorReport;
export type DSPCredentials = ConnectorCredentials;

export interface DSPConnectorLifecycle {
  validateRelease(job: DSPDeliveryJob): Promise<unknown> | unknown;
  normalizeMetadata(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> | DSPNormalizedMetadata;
  normalizeArtwork(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> | DSPNormalizedArtwork;
  normalizeAudio(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> | DSPNormalizedAudio;
  buildPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> | DSPDeliveryResult;
  pollStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> | DSPStatusSnapshot;
}

export interface DSPMetadataTransformer {
  normalizeMetadata(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> | DSPNormalizedMetadata;
  normalizeArtwork(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> | DSPNormalizedArtwork;
  normalizeAudio(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> | DSPNormalizedAudio;
}

export interface DSPPackageBuilder {
  buildPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

export interface DSPAuthentication {
  authenticate(context: ConnectorContext): Promise<DSPCredentials> | DSPCredentials;
}

export interface DSPWebhookHandler {
  validateWebhook(event: DSPWebhookEvent): Promise<boolean> | boolean;
  parseWebhook(event: DSPWebhookEvent): Promise<DSPWebhookEvent> | DSPWebhookEvent;
}

export interface DSPStatusProvider {
  pollStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> | DSPStatusSnapshot;
  fetchErrors(job: DSPDeliveryJob): Promise<readonly string[]> | readonly string[];
  withdraw(job: DSPDeliveryJob): Promise<ConnectorTakedown> | ConnectorTakedown;
  restore(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> | DSPStatusSnapshot;
  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> | DSPDeliveryResult;
}

export interface DSPHealthCheck {
  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> | DSPHealthSnapshot;
}

export interface DSPRetryPolicy {
  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean;
  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null;
}

export interface DSPConnector extends DSPConnectorLifecycle, DSPMetadataTransformer, DSPPackageBuilder, DSPAuthentication, DSPWebhookHandler, DSPStatusProvider, DSPHealthCheck, DSPRetryPolicy {
  readonly connectorId: DSPConnectorId;
  readonly version: string;
  readonly configuration: ConnectorConfiguration;
  readonly capabilities: DSPCapabilities;
}

export type DSPConnectorCapabilityMatrix = Readonly<Record<string, DSPCapabilities>>;

export type DSPDeliveryReport = Readonly<{
  connectorId: DSPConnectorId;
  releaseId: string;
  generatedAt: string;
  packageId: string | null;
  connectorStatus: string | null;
  success: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DSPConnectorHealthReport = Readonly<{
  connectorId: DSPConnectorId;
  generatedAt: string;
  healthy: boolean;
  latencyMs: number | null;
  details: Readonly<Record<string, unknown>>;
}>;

export type DSPConnectorCapabilityReport = Readonly<{
  connectorId: DSPConnectorId;
  generatedAt: string;
  capabilities: DSPCapabilities;
}>;

export type DSPDeliveryErrorReport = Readonly<{
  connectorId: DSPConnectorId;
  releaseId: string;
  generatedAt: string;
  errors: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;
