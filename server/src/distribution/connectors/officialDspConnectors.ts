import { ConnectorAsset } from "./assets/connectorAsset";
import { ConnectorAuthenticationResult } from "./authentication/authentication";
import { ConnectorCapabilities } from "./capabilities/connectorCapabilities";
import type { ConnectorCapabilityCategory } from "./types/connectorTypes";
import { ConnectorConfiguration, ConnectorCredentials } from "./configuration/connectorConfiguration";
import type { ConnectorAuthenticationType } from "./types/connectorTypes";
import { ConnectorContext } from "./context/connectorContext";
import { ConnectorDelivery } from "./delivery/connectorDelivery";
import { ConnectorError } from "./errors/connectorError";
import { ConnectorHealth } from "./health/connectorHealth";
import { ConnectorLogger } from "./logging/connectorLogger";
import { ConnectorMetrics } from "./metrics/connectorMetrics";
import { ConnectorMetadata } from "./metadata/connectorMetadata";
import { ConnectorPolling } from "./polling/connectorPolling";
import { ConnectorReport } from "./reports/connectorReport";
import { ConnectorRetry } from "./retry/connectorRetry";
import { ConnectorRoyalty } from "./royalties/connectorRoyalty";
import type { ConnectorRoyaltyFeature } from "./types/connectorTypes";
import { ConnectorStatus } from "./status/connectorStatus";
import type { ConnectorStatusCategory } from "./types/connectorTypes";
import { ConnectorTakedown } from "./takedown/connectorTakedown";
import type { ConnectorMetadataMap, ConnectorEventType, ConnectorHeaderMap, ConnectorAttributeMap } from "./types/connectorTypes";
import { ConnectorWebhook } from "./webhooks/connectorWebhook";
import type { DSPConnector, ConnectorAdapter, ConnectorFactory, ConnectorResponse } from "./contracts/connectorContracts";
import type { PartnerActivationGate } from "../partner-onboarding/contracts/partnerOnboardingContracts";
import type { ProviderIntegrationResolver } from "../provider-integration/resolver/providerResolver";
import type { ProviderIntegration } from "../provider-integration/contracts/providerIntegrationContracts";
import { ProviderSession, ProviderUploadContext, ProviderPollingResult, ProviderRoyaltyBatch, ProviderReportBatch, ProviderRetryContext, ProviderStatusSnapshot } from "../provider-integration/types/providerIntegrationTypes";
import type { ProviderWebhookEnvelope, ProviderHealthSnapshot, ProviderSelectionResult } from "../provider-integration/types/providerIntegrationTypes";
import type { OfficialDspPartnerName } from "../partner-onboarding/types/partnerOnboardingTypes";
import { ProviderStatus, ProviderLifecycleStage } from "../providers/providerStatus";
import { DistributionStatus } from "../core/distributionStatus";

type ConnectorLifecycleStage =
  | "Created"
  | "Configured"
  | "Authenticated"
  | "CapabilitiesValidated"
  | "Uploading"
  | "MetadataSubmitted"
  | "ReleaseCreated"
  | "Processing"
  | "Live"
  | "Reported"
  | "Takedown"
  | "Healthy"
  | "Degraded"
  | "Failed";

type LifecycleEntry = Readonly<{
  stage: ConnectorLifecycleStage;
  reason: string | null;
  transitionedAt: string;
}>;

export interface OfficialDspConnectorDependencies {
  readonly providerResolver: ProviderIntegrationResolver;
  readonly activationGate?: PartnerActivationGate | null;
  readonly logger?: ConnectorLogger | null;
  readonly metrics?: ConnectorMetrics | null;
}

const OFFICIAL_DSP_CONNECTORS = Object.freeze([
  "Spotify",
  "AppleMusic",
  "YouTubeMusic",
  "AmazonMusic",
  "Deezer",
  "TikTok",
  "Meta",
  "JioSaavn",
  "Gaana",
  "Wynk",
  "Boomplay",
  "Anghami",
  "Tidal",
  "KKBOX",
  "LineMusic",
] as const);

type OfficialDspConnectorName = (typeof OFFICIAL_DSP_CONNECTORS)[number];

function nowIso(): string {
  return new Date().toISOString();
}

function freezeMetadata<T extends ConnectorMetadataMap>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeHeaders<T extends ConnectorHeaderMap>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeAttributes<T extends ConnectorAttributeMap>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function buildConnectorEventType(operation: string): ConnectorEventType {
  if (operation.includes("health")) return "HealthChanged";
  if (operation.includes("report")) return "ReportGenerated";
  if (operation.includes("royalt")) return "RoyaltyImported";
  if (operation.includes("auth")) return "ConnectorAuthenticated";
  if (operation.includes("upload") || operation.includes("submit")) return "UploadCompleted";
  if (operation.includes("status")) return "StatusChanged";
  return "ConnectorRegistered";
}

function mapConnectorStatusCategory(status: ProviderStatus | ConnectorStatusCategory | DistributionStatus | string): ConnectorStatusCategory {
  switch (status) {
    case "Accepted":
    case "Rejected":
    case "Processing":
    case "Pending":
    case "Scheduled":
    case "Live":
    case "Removed":
    case "Failed":
      return status;
    case DistributionStatus.PUBLISHED:
      return "Live";
    case DistributionStatus.DELIVERED:
    case DistributionStatus.SUBMITTED:
    case DistributionStatus.IN_REVIEW:
    case DistributionStatus.APPROVED:
    case DistributionStatus.PROCESSING:
    case DistributionStatus.PENDING:
      return "Processing";
    case DistributionStatus.REJECTED:
      return "Rejected";
    case DistributionStatus.FAILED:
    case DistributionStatus.DEAD_LETTER:
      return "Failed";
    case ProviderStatus.READY:
    case ProviderStatus.INITIALIZING:
    case ProviderStatus.DEGRADED:
      return "Processing";
    case ProviderStatus.AUTH_REQUIRED:
    case ProviderStatus.CONFIGURATION_REQUIRED:
      return "Pending";
    case ProviderStatus.DISABLED:
    case ProviderStatus.UNAVAILABLE:
    case ProviderStatus.ERROR:
    default:
      return "Failed";
  }
}

function supportedCategoriesForConnector(connectorId: OfficialDspConnectorName): readonly ConnectorCapabilityCategory[] {
  switch (connectorId) {
    case "TikTok":
    case "Meta":
    case "YouTubeMusic":
      return Object.freeze(["Music", "Video", "Territories", "Languages", "Monetization", "Royalty Reporting"] as readonly ConnectorCapabilityCategory[]);
    case "Spotify":
    case "AppleMusic":
    case "AmazonMusic":
    case "Deezer":
    case "JioSaavn":
    case "Gaana":
    case "Wynk":
    case "Boomplay":
    case "Anghami":
    case "Tidal":
    case "KKBOX":
    case "LineMusic":
    default:
      return Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting"] as readonly ConnectorCapabilityCategory[]);
  }
}

function supportedUploadModes(): readonly string[] {
  return Object.freeze(["Single Upload", "Multipart Upload", "Chunk Upload", "Resumable Upload", "Streaming Upload"]);
}

function defaultFeatures(): readonly string[] {
  return Object.freeze(["metadata-validation", "asset-validation", "status-sync", "retry", "rate-limit"]);
}

function rateLimitFromSettings(settings: ConnectorMetadataMap): Readonly<{ limit: number; remaining: number; resetAt: string | null }> {
  const limit = typeof settings.rateLimit === "number" && Number.isFinite(settings.rateLimit) ? Math.max(1, Math.floor(settings.rateLimit)) : 100;
  const remaining = typeof settings.rateLimitRemaining === "number" && Number.isFinite(settings.rateLimitRemaining)
    ? Math.max(0, Math.floor(settings.rateLimitRemaining))
    : limit;
  const resetAt = typeof settings.rateLimitResetAt === "string" ? settings.rateLimitResetAt : null;
  return Object.freeze({ limit, remaining, resetAt });
}

function createCredentials(
  connectorId: string,
  authenticationType: ConnectorAuthenticationType,
  session: ProviderSession | null,
  fallbackMetadata: ConnectorMetadataMap = {},
): ConnectorCredentials {
  const authentication = session?.credentials && typeof session.credentials === "object" && "authentication" in session.credentials
    ? (session.credentials.authentication as { accessToken: string | null; refreshToken: string | null; expiresAt: Date | null; providerAccountId: string | null; metadata: Readonly<Record<string, unknown>> | null })
    : null;
  const frameworkValue = session?.credentials && typeof session.credentials === "object" && "secret" in session.credentials
    ? (session.credentials as { accountId: string | null; secret: Readonly<Record<string, string | number | boolean | null>>; expiresAt: Date | null; rotatedAt: Date | null; metadata: Readonly<Record<string, unknown>> })
    : null;

  return new ConnectorCredentials({
    connectorId,
    authenticationType,
    token: authentication?.accessToken ?? (typeof frameworkValue?.secret.accessToken === "string" ? frameworkValue.secret.accessToken : null),
    clientId: frameworkValue?.accountId ?? null,
    clientSecret: null,
    refreshToken: authentication?.refreshToken ?? (typeof frameworkValue?.secret.refreshToken === "string" ? frameworkValue.secret.refreshToken : null),
    expiresAt: authentication?.expiresAt?.toISOString() ?? frameworkValue?.expiresAt?.toISOString() ?? session?.expiresAt ?? null,
    metadata: freezeMetadata({
      connectorId,
      authenticated: session?.authenticated ?? false,
      providerVersion: session?.providerVersion ?? null,
      providerAccountId: authentication?.providerAccountId ?? frameworkValue?.accountId ?? null,
      ...fallbackMetadata,
    }),
  });
}

function createCapabilities(
  connectorId: OfficialDspConnectorName,
  configuration: ConnectorConfiguration,
  integrationCapabilities: Readonly<Record<string, unknown>> | null,
): ConnectorCapabilities {
  const uploadModes = configuration.settings.uploadModes;
  const territories = configuration.settings.territories;
  const languages = configuration.settings.languages;
  const features = configuration.settings.features;
  return new ConnectorCapabilities({
    connectorId,
    categories: supportedCategoriesForConnector(connectorId),
    uploadModes: Array.isArray(uploadModes) ? uploadModes.map(String) : supportedUploadModes(),
    territories: Array.isArray(territories) ? territories.map(String) : Object.freeze([]),
    languages: Array.isArray(languages) ? languages.map(String) : Object.freeze([]),
    features: Array.isArray(features) ? features.map(String) : defaultFeatures(),
    metadata: freezeMetadata({
      connectorId,
      officialPartner: true,
      partnerSpecificationRequired: Boolean(configuration.settings.partnerSpecificationRequired ?? true),
      integrationCapabilities,
      ...configuration.settings,
    }),
  });
}

function createConnectorStatus(
  connectorId: string,
  releaseId: string,
  status: ProviderStatus | ConnectorStatusCategory | DistributionStatus | string,
  providerStatus: string,
  metadata: ConnectorMetadataMap = {},
): ConnectorStatus {
  return new ConnectorStatus({
    connectorId,
    releaseId,
    status: mapConnectorStatusCategory(status),
    providerStatus,
    observedAt: nowIso(),
    metadata: freezeMetadata({
      connectorId,
      releaseId,
      providerStatus,
      ...metadata,
    }),
  });
}

function createHealth(connectorId: string, healthy: boolean, latencyMs: number | null, details: ConnectorMetadataMap = {}): ConnectorHealth {
  return new ConnectorHealth({
    connectorId,
    healthy,
    latencyMs,
    checkedAt: nowIso(),
    details: freezeMetadata({
      connectorId,
      healthy,
      ...details,
    }),
  });
}

function createPolling(connectorId: string, releaseId: string, payload: ConnectorMetadataMap = {}): ConnectorPolling {
  return new ConnectorPolling({
    pollingId: `${connectorId}:poll:${releaseId}:${Date.now().toString(36)}`,
    connectorId,
    releaseId,
    requestedAt: nowIso(),
    completedAt: nowIso(),
    payload: freezeMetadata({
      connectorId,
      releaseId,
      ...payload,
    }),
  });
}

function createReport(connectorId: string, releaseId: string, reportType: string, payload: ConnectorMetadataMap = {}): ConnectorReport {
  return new ConnectorReport({
    reportId: `${connectorId}:report:${releaseId}:${Date.now().toString(36)}`,
    connectorId,
    releaseId,
    reportType,
    generatedAt: nowIso(),
    payload: freezeMetadata({
      connectorId,
      releaseId,
      reportType,
      ...payload,
    }),
  });
}

function createRoyalty(connectorId: string, releaseId: string, features: readonly ConnectorRoyaltyFeature[], reportPeriod: string, metadata: ConnectorMetadataMap = {}): ConnectorRoyalty {
  return new ConnectorRoyalty({
    connectorId,
    releaseId,
    features,
    reportPeriod,
    importedAt: nowIso(),
    metadata: freezeMetadata({ connectorId, releaseId, reportPeriod, ...metadata }),
  });
}

function createTakedown(connectorId: string, releaseId: string, metadata: ConnectorMetadataMap = {}): ConnectorTakedown {
  return new ConnectorTakedown({
    takedownId: `${connectorId}:takedown:${releaseId}:${Date.now().toString(36)}`,
    connectorId,
    releaseId,
    requestedAt: nowIso(),
    completedAt: nowIso(),
    metadata: freezeMetadata({ connectorId, releaseId, ...metadata }),
  });
}

function createMetadata(connectorId: string, releaseId: string, payload: ConnectorMetadataMap, context: ConnectorContext): ConnectorMetadata {
  return new ConnectorMetadata({
    connectorId,
    releaseId,
    payload: freezeMetadata({
      connectorId,
      releaseId,
      executionId: context.executionId,
      ...payload,
    }),
    language: typeof payload.language === "string" ? String(payload.language) : null,
    territories: Array.isArray(payload.territories) ? payload.territories.map(String) : [],
    createdAt: nowIso(),
  });
}

function createDelivery(connectorId: string, releaseId: string, assets: readonly ConnectorAsset[], payload: ConnectorMetadataMap = {}): ConnectorDelivery {
  return new ConnectorDelivery({
    deliveryId: `${connectorId}:delivery:${releaseId}:${Date.now().toString(36)}`,
    connectorId,
    releaseId,
    assets,
    submittedAt: nowIso(),
    metadata: freezeMetadata({ connectorId, releaseId, ...payload }),
  });
}

function createWebhook(
  connectorId: string,
  releaseId: string,
  eventType: string,
  headers: ConnectorHeaderMap,
  payload: ConnectorMetadataMap,
  signatureValid: boolean,
): ConnectorWebhook {
  return new ConnectorWebhook({
    webhookId: `${connectorId}:webhook:${releaseId}:${Date.now().toString(36)}`,
    connectorId,
    releaseId,
    eventType,
    receivedAt: nowIso(),
    headers: freezeHeaders(headers),
    payload: freezeMetadata(payload),
    signatureValid,
  });
}

function createRetry(connectorId: string, releaseId: string, retryCount: number, metadata: ConnectorMetadataMap = {}): ConnectorRetry {
  const delayMs = Math.min(30 * 60_000, 1_000 * Math.max(1, retryCount + 1));
  return new ConnectorRetry({
    connectorId,
    releaseId,
    retryCount,
    lastAttemptAt: nowIso(),
    nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
    metadata: freezeMetadata({ connectorId, releaseId, retryCount, delayMs, ...metadata }),
  });
}

function createSubmissionFromContext(context: ConnectorContext, metadata: ConnectorMetadataMap = {}): { submissionId: string; connectorId: string; releaseId: string; submittedAt: string; accepted: boolean; metadata: ConnectorMetadataMap } {
  return {
    submissionId: `${context.connectorId}:submission:${context.releaseId}:${Date.now().toString(36)}`,
    connectorId: context.connectorId,
    releaseId: context.releaseId,
    submittedAt: context.createdAt,
    accepted: false,
    metadata: freezeMetadata({
      connectorId: context.connectorId,
      releaseId: context.releaseId,
      executionId: context.executionId,
      providerReference: context.providerReference,
      ...metadata,
    }),
  };
}

function createPlaceholderResponse<TPayload>(
  connectorId: string,
  payload: TPayload,
  operation: string,
  metadata: ConnectorMetadataMap = {},
): ConnectorResponse<TPayload> {
  return Object.freeze({
    success: false,
    payload,
    metadata: freezeMetadata({
      connectorId,
      operation,
      officialPartnerSpecRequired: true,
      reason: "Official DSP partner specification not yet available for this connector boundary",
      ...metadata,
    }),
  });
}

function createSuccessResponse<TPayload>(
  connectorId: string,
  payload: TPayload,
  operation: string,
  metadata: ConnectorMetadataMap = {},
): ConnectorResponse<TPayload> {
  return Object.freeze({
    success: true,
    payload,
    metadata: freezeMetadata({
      connectorId,
      operation,
      officialPartnerSpecRequired: false,
      ...metadata,
    }),
  });
}

function createFailureError(connectorId: string, operation: string, message: string, metadata: ConnectorMetadataMap = {}, retryable = false): ConnectorError {
  return new ConnectorError({
    connectorId,
    code: `OFFICIAL_DSP_${operation.toUpperCase()}_BOUNDARY`,
    message,
    retryable,
    metadata: freezeMetadata({
      connectorId,
      operation,
      officialPartnerSpecRequired: true,
      ...metadata,
    }),
  });
}

export abstract class OfficialDspConnectorBase implements DSPConnector, ConnectorAdapter {
  readonly connectorId: OfficialDspConnectorName;
  readonly version: string;
  readonly configuration: ConnectorConfiguration;

  private credentialValue: ConnectorCredentials | null = null;
  private lifecycleStage: ConnectorLifecycleStage = "Created";
  private readonly lifecycleHistory: LifecycleEntry[] = [];
  private readonly auditTrail: ConnectorEventType[] = [];
  private readonly rateLimitState = new Map<string, { limit: number; remaining: number; resetAt: string | null }>();

  protected constructor(
    connectorId: OfficialDspConnectorName,
    context: ConnectorContext,
    private readonly dependencies: OfficialDspConnectorDependencies,
  ) {
    if (context.connectorId !== connectorId) {
      throw new Error(`ConnectorContext.connectorId must match ${connectorId}`);
    }
    this.connectorId = connectorId;
    this.version = ensure(context.connectorVersion, "connectorVersion");
    this.configuration = context.configuration;
    this.advanceLifecycle("Configured", "Connector instantiated");
    this.log("info", "official connector instantiated", { connectorId, version: this.version, releaseId: context.releaseId });
  }

  get credentials(): ConnectorCredentials | null {
    return this.credentialValue;
  }

  get lifecycle(): Readonly<{
    stage: ConnectorLifecycleStage;
    history: readonly LifecycleEntry[];
    updatedAt: string;
  }> {
    return Object.freeze({
      stage: this.lifecycleStage,
      history: Object.freeze([...this.lifecycleHistory]),
      updatedAt: this.lifecycleHistory.length ? this.lifecycleHistory[this.lifecycleHistory.length - 1]!.transitionedAt : nowIso(),
    });
  }

  protected get logger(): ConnectorLogger {
    return this.dependencies.logger ?? {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
  }

  protected get metrics(): ConnectorMetrics {
    return this.dependencies.metrics ?? {
      increment: () => undefined,
      observe: () => undefined,
      gauge: () => undefined,
    };
  }

  protected resolveIntegration(): ProviderIntegration | null {
    const activationGate = this.dependencies.activationGate;
    const partnerName = this.connectorId as OfficialDspPartnerName;
    if (!activationGate || !activationGate.isPartnerActive(partnerName)) {
      return null;
    }
    return this.dependencies.providerResolver.resolve(partnerName);
  }

  protected operationContext(context: ConnectorContext, metadata: ConnectorMetadataMap = {}): Readonly<Record<string, unknown>> {
    return freezeMetadata({
      connectorId: this.connectorId,
      version: this.version,
      releaseId: context.releaseId,
      executionId: context.executionId,
      providerReference: context.providerReference,
      ...metadata,
    });
  }

  protected emitEvent(type: ConnectorEventType, releaseId: string | null, payload: ConnectorMetadataMap = {}): void {
    this.auditTrail.push(type);
    this.logger.debug(`connector event ${type}`, freezeMetadata({ connectorId: this.connectorId, releaseId, ...payload }));
  }

  protected advanceLifecycle(stage: ConnectorLifecycleStage, reason: string | null = null): void {
    this.lifecycleStage = stage;
    this.lifecycleHistory.push(Object.freeze({ stage, reason, transitionedAt: nowIso() }));
  }

  protected async resolveProviderHealth(integration: ProviderIntegration | null, releaseId: string): Promise<ConnectorHealth> {
    if (!integration) {
      return createHealth(this.connectorId, false, null, {
        releaseId,
        source: "spec-boundary",
        message: "Official partner specification required",
      });
    }
    const health = await integration.health();
    const details = health.health as { status?: unknown; message?: unknown; configurationValid?: unknown; credentialsValid?: unknown };
    return createHealth(
      this.connectorId,
      Boolean(health.healthy),
      typeof health.latencyMs === "number" ? health.latencyMs : null,
      {
        releaseId,
        provider: health.providerName,
        adapter: integration.adapterName,
        status: String(details.status ?? "READY"),
        message: String(details.message ?? "Healthy"),
        officialPartnerSpecRequired: false,
      },
    );
  }

  protected buildCapabilities(integration: ProviderIntegration | null, context: ConnectorContext): ConnectorCapabilities {
    const providerCapabilities = integration ? integration.adapter.resolveCapabilities() : null;
    const resolved = providerCapabilities && typeof providerCapabilities === "object" ? providerCapabilities as Readonly<Record<string, unknown>> : null;
    return createCapabilities(this.connectorId, this.configuration, resolved);
  }

  protected resolveCredentials(session: ProviderSession | null): ConnectorCredentials {
    return createCredentials(this.connectorId, this.configuration.authenticationType, session, this.operationContextFromSession(session));
  }

  protected operationContextFromSession(session: ProviderSession | null): ConnectorMetadataMap {
    return freezeMetadata({
      sessionId: session?.sessionId ?? null,
      providerName: session?.providerName ?? this.connectorId,
      providerVersion: session?.providerVersion ?? this.version,
      authenticated: session?.authenticated ?? false,
    });
  }

  protected resolveReleaseId(releaseId: string): string {
    return ensure(releaseId, "releaseId");
  }

  protected resolveConnectorStatus(releaseId: string, status: ProviderStatus | ConnectorStatusCategory | DistributionStatus | string, providerStatus: string, metadata: ConnectorMetadataMap = {}): ConnectorStatus {
    return createConnectorStatus(this.connectorId, releaseId, status, providerStatus, metadata);
  }

  protected resolvePolling(releaseId: string, payload: ConnectorMetadataMap = {}): ConnectorPolling {
    return createPolling(this.connectorId, releaseId, payload);
  }

  protected resolveReport(releaseId: string, reportType: string, payload: ConnectorMetadataMap = {}): ConnectorReport {
    return createReport(this.connectorId, releaseId, reportType, payload);
  }

  protected resolveRoyalty(releaseId: string, features: readonly ConnectorRoyaltyFeature[], reportPeriod: string, metadata: ConnectorMetadataMap = {}): ConnectorRoyalty {
    return createRoyalty(this.connectorId, releaseId, features, reportPeriod, metadata);
  }

  protected resolveTakedown(releaseId: string, metadata: ConnectorMetadataMap = {}): ConnectorTakedown {
    return createTakedown(this.connectorId, releaseId, metadata);
  }

  protected resolveMetadata(releaseId: string, payload: ConnectorMetadataMap, context: ConnectorContext): ConnectorMetadata {
    return createMetadata(this.connectorId, releaseId, payload, context);
  }

  protected resolveDelivery(releaseId: string, assets: readonly ConnectorAsset[], payload: ConnectorMetadataMap = {}): ConnectorDelivery {
    return createDelivery(this.connectorId, releaseId, assets, payload);
  }

  protected resolveWebhook(releaseId: string, eventType: string, headers: ConnectorHeaderMap, payload: ConnectorMetadataMap, signatureValid: boolean): ConnectorWebhook {
    return createWebhook(this.connectorId, releaseId, eventType, headers, payload, signatureValid);
  }

  protected resolveRetry(releaseId: string, retryCount: number, metadata: ConnectorMetadataMap = {}): ConnectorRetry {
    return createRetry(this.connectorId, releaseId, retryCount, metadata);
  }

  protected getRateLimit(): { limit: number; remaining: number; resetAt: string | null } {
    const current = this.rateLimitState.get(this.connectorId) ?? rateLimitFromSettings(this.configuration.settings);
    this.rateLimitState.set(this.connectorId, current);
    return current;
  }

  protected consumeRateLimit(amount = 1): void {
    const current = this.getRateLimit();
    this.rateLimitState.set(this.connectorId, {
      limit: current.limit,
      remaining: Math.max(0, current.remaining - Math.max(1, Math.floor(amount))),
      resetAt: current.resetAt,
    });
  }

  protected evaluateShouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= 5) {
      return false;
    }
    if (error instanceof ConnectorError) {
      return error.retryable;
    }
    return true;
  }

  protected computeNextRetryAt(_error: unknown, attempt: number): string | null {
    const delayMs = Math.min(30 * 60_000, 1_000 * Math.pow(2, Math.max(0, attempt)));
    return new Date(Date.now() + delayMs).toISOString();
  }

  protected log(level: "debug" | "info" | "warn" | "error", message: string, context: ConnectorMetadataMap = {}): void {
    this.logger[level](message, freezeMetadata({ connectorId: this.connectorId, version: this.version, ...context }));
  }

  protected recordMetric(metric: string, value = 1, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
    this.metrics.increment(metric, value, tags);
  }

  protected placeholder<TPayload>(operation: string, payload: TPayload, metadata: ConnectorMetadataMap = {}): ConnectorResponse<TPayload> {
    this.log("warn", `${this.connectorId}.${operation} is awaiting official DSP partner specification`, metadata);
    this.recordMetric(`connector.${this.connectorId}.${operation}.placeholder`, 1, { connectorId: this.connectorId, operation });
    this.advanceLifecycle("Failed", `Official DSP partner specification required for ${operation}`);
    return createPlaceholderResponse(this.connectorId, payload, operation, metadata);
  }

  protected success<TPayload>(operation: string, payload: TPayload, metadata: ConnectorMetadataMap = {}): ConnectorResponse<TPayload> {
    this.log("info", `${this.connectorId}.${operation} completed`, metadata);
    this.recordMetric(`connector.${this.connectorId}.${operation}.success`, 1, { connectorId: this.connectorId, operation });
    return createSuccessResponse(this.connectorId, payload, operation, metadata);
  }

  async authenticate(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCredentials>> {
    const integration = this.resolveIntegration();
    if (!integration) {
      const credentials = createCredentials(this.connectorId, context.configuration.authenticationType, null, this.operationContext(context, { officialPartnerSpecRequired: true }));
      return this.placeholder("authenticate", credentials, this.operationContext(context, { connectorId: this.connectorId }));
    }
    const session = await Promise.resolve(integration.authenticate());
    const credentials = this.resolveCredentials(session);
    this.credentialValue = credentials;
    this.advanceLifecycle("Authenticated", "Connector authenticated against provider runtime");
    this.emitEvent("ConnectorAuthenticated", context.releaseId, { operation: "authenticate" });
    return this.success("authenticate", credentials, this.operationContext(context, { providerName: integration.providerName, adapterName: integration.adapterName }));
  }

  async validateCapabilities(context: ConnectorContext, capabilities: ConnectorCapabilities): Promise<ConnectorResponse<ConnectorCapabilities>> {
    const integration = this.resolveIntegration();
    const resolved = this.buildCapabilities(integration, context);
    const valid = capabilities.categories.every((category) => resolved.categories.includes(category));
    if (!integration) {
      return this.placeholder("validateCapabilities", resolved, this.operationContext(context, { providedCapabilities: capabilities }));
    }
    this.advanceLifecycle("CapabilitiesValidated", "Connector capabilities validated");
    return valid
      ? this.success("validateCapabilities", resolved, this.operationContext(context, { providedCapabilities: capabilities }))
      : this.placeholder("validateCapabilities", resolved, this.operationContext(context, { providedCapabilities: capabilities, validation: "partial" }));
  }

  async uploadAssets(context: ConnectorContext, assets: readonly ConnectorAsset[]): Promise<ConnectorResponse<readonly ConnectorAsset[]>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Uploading", "Asset upload requested");
    if (!integration) {
      return this.placeholder("uploadAssets", assets, this.operationContext(context, { assetCount: assets.length }));
    }
    const providerContext = new ProviderUploadContext({
      uploadId: `${this.connectorId}:upload:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      session: integration.session,
      capabilities: integration.adapter.resolveCapabilities() as never,
      metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
      connectorPayload: freezeMetadata({ assetCount: assets.length, assets: assets.map((asset) => asset.assetId) }),
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    const result = await Promise.resolve(integration.adapter.upload(providerContext));
    const payload = result.success ? assets : assets;
    return this.success("uploadAssets", payload, this.operationContext(context, { uploadId: result.uploadId, providerUploadId: result.uploadId, success: result.success }));
  }

  async submitMetadata(context: ConnectorContext, metadata: ConnectorMetadata): Promise<ConnectorResponse<ConnectorMetadata>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("MetadataSubmitted", "Metadata submission requested");
    if (!integration) {
      return this.placeholder("submitMetadata", metadata, this.operationContext(context, { releaseId: metadata.releaseId }));
    }
    const providerContext = new ProviderUploadContext({
      uploadId: `${this.connectorId}:metadata:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      session: integration.session,
      capabilities: integration.adapter.resolveCapabilities() as never,
      metadataMap: freezeMetadata({ ...context.configuration.settings, ...metadata.payload }),
      connectorPayload: freezeMetadata({ metadata: metadata.payload }),
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    await Promise.resolve(integration.adapter.submitMetadata(providerContext));
    return this.success("submitMetadata", metadata, this.operationContext(context, { releaseId: metadata.releaseId, language: metadata.language, territories: metadata.territories }));
  }

  async createRelease(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<import("./catalog/connectorCatalog").ConnectorSubmission>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("ReleaseCreated", "Release creation requested");
    if (!integration) {
      return this.placeholder("createRelease", submission, this.operationContext(context, { submissionId: submission.submissionId }));
    }
    const providerContext = new ProviderUploadContext({
      uploadId: `${this.connectorId}:release:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      session: integration.session,
      capabilities: integration.adapter.resolveCapabilities() as never,
      metadataMap: freezeMetadata({ ...context.configuration.settings, ...submission.metadata }),
      connectorPayload: freezeMetadata({ submissionId: submission.submissionId, releaseId: submission.releaseId }),
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    await Promise.resolve(integration.adapter.createRelease(providerContext));
    return this.success("createRelease", submission, this.operationContext(context, { submissionId: submission.submissionId, accepted: submission.accepted }));
  }

  async trackProcessing(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Processing", "Processing status requested");
    if (!integration) {
      return this.placeholder("trackProcessing", createConnectorStatus(this.connectorId, context.releaseId, "Processing", "OFFICIAL_DSP_SPEC_REQUIRED", this.operationContext(context)), this.operationContext(context));
    }
    const providerContext = new ProviderUploadContext({
      uploadId: `${this.connectorId}:status:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      session: integration.session,
      capabilities: integration.adapter.resolveCapabilities() as never,
      metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
      connectorPayload: freezeMetadata({ releaseId: context.releaseId, phase: "processing" }),
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    const snapshot = await Promise.resolve(integration.adapter.trackStatus(providerContext));
    const status = this.statusFromProviderSnapshot(snapshot, context.releaseId);
    return this.success("trackProcessing", status, this.operationContext(context, { providerSnapshotId: snapshot.snapshotId, providerStatus: String(snapshot.status as unknown), healthy: snapshot.healthy }));
  }

  async trackLiveStatus(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Live", "Live status requested");
    if (!integration) {
      return this.placeholder("trackLiveStatus", createConnectorStatus(this.connectorId, context.releaseId, "Pending", "OFFICIAL_DSP_SPEC_REQUIRED", this.operationContext(context)), this.operationContext(context));
    }
    const providerContext = new ProviderUploadContext({
      uploadId: `${this.connectorId}:live-status:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      session: integration.session,
      capabilities: integration.adapter.resolveCapabilities() as never,
      metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
      connectorPayload: freezeMetadata({ releaseId: context.releaseId, phase: "live" }),
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    const snapshot = await Promise.resolve(integration.adapter.trackStatus(providerContext));
    const status = this.statusFromProviderSnapshot(snapshot, context.releaseId);
    return this.success("trackLiveStatus", status, this.operationContext(context, { providerSnapshotId: snapshot.snapshotId, providerStatus: String(snapshot.status as unknown), healthy: snapshot.healthy }));
  }

  async importRoyalties(context: ConnectorContext): Promise<ConnectorResponse<ConnectorRoyalty>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Reported", "Royalty import requested");
    const reportPeriod = context.attributes.reportPeriod ? String(context.attributes.reportPeriod) : "unknown";
    const features: readonly ConnectorRoyaltyFeature[] = Object.freeze([
      "Streaming Reports",
      "Sales Reports",
      "Usage Reports",
    ]);
    if (!integration) {
      return this.placeholder("importRoyalties", createRoyalty(this.connectorId, context.releaseId, features, reportPeriod, this.operationContext(context)), this.operationContext(context));
    }
    const batch = new ProviderRoyaltyBatch({
      batchId: `${this.connectorId}:royalty:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      royalties: null,
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    await Promise.resolve(integration.adapter.importRoyalties(batch));
    return this.success("importRoyalties", createRoyalty(this.connectorId, context.releaseId, features, reportPeriod, this.operationContext(context)), this.operationContext(context, { reportPeriod }));
  }

  async generateReport(context: ConnectorContext): Promise<ConnectorResponse<ConnectorReport>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Reported", "Report generation requested");
    const reportType = context.attributes.reportType ? String(context.attributes.reportType) : "delivery";
    if (!integration) {
      return this.placeholder("generateReport", createReport(this.connectorId, context.releaseId, reportType, this.operationContext(context)), this.operationContext(context));
    }
    const batch = new ProviderReportBatch({
      batchId: `${this.connectorId}:report:${context.releaseId}:${Date.now().toString(36)}`,
      providerName: integration.providerName,
      reports: null,
      createdAt: context.createdAt,
      metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
    });
    await Promise.resolve(integration.adapter.generateReports(batch));
    return this.success("generateReport", createReport(this.connectorId, context.releaseId, reportType, this.operationContext(context)), this.operationContext(context, { reportType }));
  }

  async takedownRelease(context: ConnectorContext): Promise<ConnectorResponse<ConnectorTakedown>> {
    const integration = this.resolveIntegration();
    this.advanceLifecycle("Takedown", "Takedown requested");
    if (!integration) {
      return this.placeholder("takedownRelease", createTakedown(this.connectorId, context.releaseId, this.operationContext(context)), this.operationContext(context));
    }
    await Promise.resolve(integration.adapter.takedown());
    return this.success("takedownRelease", createTakedown(this.connectorId, context.releaseId, this.operationContext(context)), this.operationContext(context));
  }

  async checkHealth(context: ConnectorContext): Promise<ConnectorResponse<ConnectorHealth>> {
    const integration = this.resolveIntegration();
    const start = Date.now();
    if (!integration) {
      const health = createHealth(this.connectorId, false, null, this.operationContext(context, { message: "Official partner specification required" }));
      this.advanceLifecycle("Degraded", "Connector health unavailable");
      return this.placeholder("checkHealth", health, this.operationContext(context));
    }
    const providerHealth = await integration.health();
    const providerHealthDetails = providerHealth.health as { status?: unknown; message?: unknown; configurationValid?: unknown; credentialsValid?: unknown };
    const healthy = Boolean(providerHealth.healthy);
    const health = createHealth(this.connectorId, healthy, Date.now() - start, {
      provider: providerHealth.providerName,
      adapter: integration.adapterName,
      status: String(providerHealthDetails.status ?? "READY"),
      message: providerHealthDetails.message,
      configurationValid: providerHealthDetails.configurationValid,
      credentialsValid: providerHealthDetails.credentialsValid,
    });
    this.advanceLifecycle(healthy ? "Healthy" : "Degraded", healthy ? "Health check passed" : "Health check degraded");
    return this.success("checkHealth", health, this.operationContext(context, { providerHealthy: healthy }));
  }

  async refreshCredentials(context: ConnectorContext): Promise<ConnectorCredentials> {
    const integration = this.resolveIntegration();
    if (!integration) {
      throw createFailureError(this.connectorId, "refreshCredentials", "Official DSP partner specification required to refresh credentials", this.operationContext(context), true);
    }
    const session = await Promise.resolve(integration.authenticate());
    const credentials = this.resolveCredentials(session);
    this.credentialValue = credentials;
    this.advanceLifecycle("Authenticated", "Credentials refreshed");
    return credentials;
  }

  async resolveCapabilities(context: ConnectorContext): Promise<ConnectorCapabilities> {
    const integration = this.resolveIntegration();
    return this.buildCapabilities(integration, context);
  }

  getCapabilities(context: ConnectorContext): Promise<ConnectorCapabilities> | ConnectorCapabilities {
    return this.resolveCapabilities(context);
  }

  async uploadSingle(asset: ConnectorAsset): Promise<ConnectorAsset> {
    return asset;
  }

  async uploadMultipart(assets: readonly ConnectorAsset[]): Promise<readonly ConnectorAsset[]> {
    return assets;
  }

  async uploadChunk(asset: ConnectorAsset, _chunk: Readonly<Record<string, unknown>>): Promise<ConnectorAsset> {
    return asset;
  }

  async uploadResumable(asset: ConnectorAsset): Promise<ConnectorAsset> {
    return asset;
  }

  async uploadStreaming(asset: ConnectorAsset): Promise<ConnectorAsset> {
    return asset;
  }

  async submitMetadataPayload(metadata: ConnectorMetadata): Promise<ConnectorMetadata> {
    return metadata;
  }

  async createReleasePayload(submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<import("./catalog/connectorCatalog").ConnectorSubmission> {
    return submission;
  }

  async updateReleasePayload(submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<import("./catalog/connectorCatalog").ConnectorSubmission> {
    return submission;
  }

  async getStatus(releaseId: string): Promise<ConnectorStatus> {
    return createConnectorStatus(this.connectorId, releaseId, "Processing", "OFFICIAL_DSP_SPEC_REQUIRED");
  }

  async pollReleaseStatus(releaseId: string): Promise<ConnectorPolling> {
    return createPolling(this.connectorId, releaseId);
  }

  async validateSignature(webhook: ConnectorWebhook): Promise<boolean> {
    return Boolean(webhook.signatureValid);
  }

  async parseWebhook(webhook: ConnectorWebhook): Promise<ConnectorWebhook> {
    return webhook;
  }

  async receiveWebhook(event: ConnectorWebhook): Promise<ConnectorWebhook> {
    return this.parseWebhook(event);
  }

  async importRoyaltiesById(releaseId: string): Promise<ConnectorRoyalty> {
    return createRoyalty(this.connectorId, releaseId, Object.freeze(["Streaming Reports"]), "unknown");
  }

  async generateConnectorReportById(releaseId: string): Promise<ConnectorReport> {
    return createReport(this.connectorId, releaseId, "delivery");
  }

  async takedownReleaseById(releaseId: string): Promise<ConnectorTakedown> {
    return createTakedown(this.connectorId, releaseId);
  }

  checkHealthById(connectorId: string): ConnectorHealth {
    return createHealth(connectorId, true, 0);
  }

  getLimitFor(_connectorId: string): number {
    return this.getRateLimit().limit;
  }

  getRemainingFor(_connectorId: string): number {
    return this.getRateLimit().remaining;
  }

  consumeFor(_connectorId: string, amount = 1): void {
    this.consumeRateLimit(amount);
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    return this.evaluateShouldRetry(error, attempt);
  }

  nextRetryAt(error: unknown, attempt: number): string | null {
    return this.computeNextRetryAt(error, attempt);
  }

  async upload(context: ConnectorContext, assets: readonly ConnectorAsset[]): Promise<ConnectorResponse<readonly ConnectorAsset[]>> {
    return this.uploadAssets(context, assets);
  }

  async submit(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<import("./catalog/connectorCatalog").ConnectorSubmission>> {
    return this.createRelease(context, submission);
  }

  async status(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>> {
    return this.trackProcessing(context);
  }

  async webhook(event: ConnectorWebhook): Promise<ConnectorResponse<ConnectorWebhook>> {
    const valid = await this.validateSignature(event);
    const parsed = await this.parseWebhook(event);
    const response = valid
      ? this.success("webhook", parsed, freezeMetadata({ connectorId: this.connectorId, releaseId: parsed.releaseId, eventType: parsed.eventType, signatureValid: true }))
      : this.placeholder("webhook", parsed, freezeMetadata({ connectorId: this.connectorId, releaseId: parsed.releaseId, eventType: parsed.eventType, signatureValid: false }));
    return response;
  }

  async poll(context: ConnectorContext): Promise<ConnectorResponse<ConnectorPolling>> {
    const polling = createPolling(this.connectorId, context.releaseId, this.operationContext(context));
    return this.success("poll", polling, this.operationContext(context));
  }

  async royalties(context: ConnectorContext): Promise<ConnectorResponse<ConnectorRoyalty>> {
    return this.importRoyalties(context);
  }

  async reports(context: ConnectorContext): Promise<ConnectorResponse<ConnectorReport>> {
    return this.generateReport(context);
  }

  async takedown(context: ConnectorContext): Promise<ConnectorResponse<ConnectorTakedown>> {
    return this.takedownRelease(context);
  }

  async health(context: ConnectorContext): Promise<ConnectorResponse<ConnectorHealth>> {
    return this.checkHealth(context);
  }

  async capabilities(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCapabilities>> {
    const capabilities = await Promise.resolve(this.buildCapabilities(this.resolveIntegration(), context));
    return this.success("capabilities", capabilities, this.operationContext(context));
  }

  async validateMetadata(context: ConnectorContext, metadata: ConnectorMetadata): Promise<ConnectorResponse<ConnectorMetadata>> {
    return this.submitMetadata(context, metadata);
  }

  async validateAssets(context: ConnectorContext, assets: readonly ConnectorAsset[]): Promise<ConnectorResponse<readonly ConnectorAsset[]>> {
    return this.uploadAssets(context, assets);
  }

  async createReleasePackage(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission, assets: readonly ConnectorAsset[] = []): Promise<ConnectorResponse<ConnectorDelivery>> {
    const delivery = createDelivery(this.connectorId, context.releaseId, assets, this.operationContext(context, { submissionId: submission.submissionId }));
    return this.success("createReleasePackage", delivery, this.operationContext(context));
  }

  async uploadAudio(context: ConnectorContext, asset: ConnectorAsset): Promise<ConnectorResponse<ConnectorAsset>> {
    return this.success("uploadAudio", asset, this.operationContext(context, { assetId: asset.assetId, kind: asset.kind }));
  }

  async uploadArtwork(context: ConnectorContext, asset: ConnectorAsset): Promise<ConnectorResponse<ConnectorAsset>> {
    return this.success("uploadArtwork", asset, this.operationContext(context, { assetId: asset.assetId, kind: asset.kind }));
  }

  async uploadMetadata(context: ConnectorContext, metadata: ConnectorMetadata): Promise<ConnectorResponse<ConnectorMetadata>> {
    return this.submitMetadata(context, metadata);
  }

  async submitRelease(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<import("./catalog/connectorCatalog").ConnectorSubmission>> {
    return this.createRelease(context, submission);
  }

  async updateRelease(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<import("./catalog/connectorCatalog").ConnectorSubmission>> {
    return this.success("updateRelease", submission, this.operationContext(context));
  }

  async scheduleRelease(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<import("./catalog/connectorCatalog").ConnectorSubmission>> {
    return this.success("scheduleRelease", submission, this.operationContext(context, { scheduledAt: submission.submittedAt }));
  }

  async fetchDeliveryStatus(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>> {
    return this.trackProcessing(context);
  }

  async fetchReleaseStatus(context: ConnectorContext): Promise<ConnectorResponse<ConnectorStatus>> {
    return this.trackLiveStatus(context);
  }

  async importReports(context: ConnectorContext): Promise<ConnectorResponse<ConnectorReport>> {
    return this.generateReport(context);
  }

  async discoverCapabilities(context: ConnectorContext): Promise<ConnectorResponse<ConnectorCapabilities>> {
    return Promise.resolve(this.resolveCapabilities(context)).then((capabilities) => this.validateCapabilities(context, capabilities));
  }

  async fetchDeliveryAcknowledgement(context: ConnectorContext, submission: import("./catalog/connectorCatalog").ConnectorSubmission): Promise<ConnectorResponse<ConnectorDelivery>> {
    return this.createReleasePackage(context, submission);
  }

  async retryOperation(context: ConnectorContext, retryCount = 0): Promise<ConnectorResponse<ConnectorRetry>> {
    const retry = this.resolveRetry(context.releaseId, retryCount, this.operationContext(context));
    return this.success("retryOperation", retry, this.operationContext(context, { retryCount }));
  }

  async rateLimitSnapshot(context: ConnectorContext): Promise<ConnectorResponse<Readonly<{ limit: number; remaining: number; resetAt: string | null }>>> {
    return this.success("rateLimitSnapshot", this.getRateLimit(), this.operationContext(context));
  }

  private statusFromProviderSnapshot(snapshot: ProviderStatusSnapshot, releaseId: string): ConnectorStatus {
    const providerStatus = typeof snapshot.status === "string" ? snapshot.status : snapshot.status.providerStatus;
    const status = typeof snapshot.status === "string"
      ? mapConnectorStatusCategory(snapshot.status)
      : snapshot.status.status;
    return new ConnectorStatus({
      connectorId: this.connectorId,
      releaseId,
      status,
      providerStatus,
      observedAt: snapshot.observedAt,
      metadata: freezeMetadata({
        connectorId: this.connectorId,
        releaseId,
        snapshotId: snapshot.snapshotId,
        healthy: snapshot.healthy,
        providerStatus,
      }),
    });
  }
}

class SpotifyConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Spotify", context, dependencies);
  }
}

class AppleMusicConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("AppleMusic", context, dependencies);
  }
}

class YouTubeMusicConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("YouTubeMusic", context, dependencies);
  }
}

class AmazonMusicConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("AmazonMusic", context, dependencies);
  }
}

class DeezerConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Deezer", context, dependencies);
  }
}

class TikTokConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("TikTok", context, dependencies);
  }
}

class MetaConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Meta", context, dependencies);
  }
}

class JioSaavnConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("JioSaavn", context, dependencies);
  }
}

class GaanaConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Gaana", context, dependencies);
  }
}

class WynkConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Wynk", context, dependencies);
  }
}

class BoomplayConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Boomplay", context, dependencies);
  }
}

class AnghamiConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Anghami", context, dependencies);
  }
}

class TidalConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("Tidal", context, dependencies);
  }
}

class KKBOXConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("KKBOX", context, dependencies);
  }
}

class LineMusicConnector extends OfficialDspConnectorBase {
  constructor(context: ConnectorContext, dependencies: OfficialDspConnectorDependencies) {
    super("LineMusic", context, dependencies);
  }
}

export class OfficialDspConnectorFactory implements ConnectorFactory {
  constructor(private readonly dependencies: OfficialDspConnectorDependencies) {}

  create(context: ConnectorContext): DSPConnector {
    const connectorId = ensure(context.connectorId, "connectorId");
    switch (connectorId) {
      case "Spotify":
        return new SpotifyConnector(context, this.dependencies);
      case "AppleMusic":
        return new AppleMusicConnector(context, this.dependencies);
      case "YouTubeMusic":
        return new YouTubeMusicConnector(context, this.dependencies);
      case "AmazonMusic":
        return new AmazonMusicConnector(context, this.dependencies);
      case "Deezer":
        return new DeezerConnector(context, this.dependencies);
      case "TikTok":
        return new TikTokConnector(context, this.dependencies);
      case "Meta":
        return new MetaConnector(context, this.dependencies);
      case "JioSaavn":
        return new JioSaavnConnector(context, this.dependencies);
      case "Gaana":
        return new GaanaConnector(context, this.dependencies);
      case "Wynk":
        return new WynkConnector(context, this.dependencies);
      case "Boomplay":
        return new BoomplayConnector(context, this.dependencies);
      case "Anghami":
        return new AnghamiConnector(context, this.dependencies);
      case "Tidal":
        return new TidalConnector(context, this.dependencies);
      case "KKBOX":
        return new KKBOXConnector(context, this.dependencies);
      case "LineMusic":
        return new LineMusicConnector(context, this.dependencies);
      default:
        throw createFailureError(connectorId, "create", `Unsupported official DSP connector: ${connectorId}`, { connectorId }, false);
    }
  }
}

export {
  OFFICIAL_DSP_CONNECTORS,
  SpotifyConnector,
  AppleMusicConnector,
  YouTubeMusicConnector,
  AmazonMusicConnector,
  DeezerConnector,
  TikTokConnector,
  MetaConnector,
  JioSaavnConnector,
  GaanaConnector,
  WynkConnector,
  BoomplayConnector,
  AnghamiConnector,
  TidalConnector,
  KKBOXConnector,
  LineMusicConnector,
};
