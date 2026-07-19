import { ConnectorPolling } from "../../connectors/polling/connectorPolling";
import { ConnectorReport } from "../../connectors/reports/connectorReport";
import { ConnectorRoyalty } from "../../connectors/royalties/connectorRoyalty";
import { ConnectorStatus } from "../../connectors/status/connectorStatus";
import { ConnectorWebhook } from "../../connectors/webhooks/connectorWebhook";
import { createProviderResult } from "../../providers/providerResult";
import { ExponentialProviderRetryStrategy } from "../../providers/providerRetryStrategy";
import { ProviderError } from "../../providers/providerError";
import { ProviderStatusMapper } from "../../providers/providerStatusMapper";
import { ProviderStatus as FrameworkProviderStatus } from "../../providers/providerStatus";
import type { ProviderCapabilities, ProviderOperation } from "../../providers/providerCapabilities";
import type { ProviderHealth } from "../../providers/providerHealth";
import type { ProviderAuthentication as FrameworkProviderAuthentication } from "../../providers/providerAuthentication";
import type { ProviderCredentials as FrameworkProviderCredentials } from "../../providers/providerCredentials";
import type { ProviderRateLimit } from "../../providers/providerRateLimit";
import { ProviderLifecycleStage } from "../../providers/providerStatus";
import type { ProviderLifecycle } from "../../providers/providerLifecycle";
import { DistributionStatus } from "../../core/distributionStatus";
import type { AuthenticationSnapshot, PartnerCredentialResolver } from "../../partner-credentials";
import { ProviderIntegrationEvent, type ProviderIntegrationEventType } from "../events/providerEvents";
import { ProviderIntegrationRegistryEntry, type ProviderIntegrationRegistry as ProviderIntegrationRegistryPort } from "../registry/providerRegistry";
import type { ProviderIntegrationResolver as ProviderIntegrationResolverPort } from "../resolver/providerResolver";
import type { ProviderIntegrationFactory as ProviderIntegrationFactoryPort } from "../factory/providerFactory";
import type { ProviderSelectionService } from "../selection/providerSelection";
import type { ProviderCapabilityRegistry } from "../capabilities/providerCapabilities";
import type { ProviderHealthManager } from "../health/providerHealth";
import type { ProviderAuthenticationGateway } from "../authentication/providerAuthentication";
import type { ProviderSessionGateway } from "../session/providerSession";
import type { ProviderCredentialStore } from "../credentials/providerCredentials";
import type { ProviderUploadManager } from "../upload/providerUpload";
import type { ProviderAssetManager } from "../assets/providerAssets";
import type { ProviderMetadataManager } from "../metadata/providerMetadata";
import type { ProviderCatalogManager } from "../catalog/providerCatalog";
import type { ProviderStatusManager } from "../status/providerStatus";
import type { ProviderWebhookManager } from "../webhooks/providerWebhook";
import type { ProviderPollingManager } from "../polling/providerPolling";
import type { ProviderRoyaltyManager } from "../royalty/providerRoyalty";
import type { ProviderReportManager } from "../reports/providerReports";
import type { ProviderTakedownManager } from "../takedown/providerTakedown";
import type { ProviderRateLimitManager } from "../ratelimit/providerRateLimit";
import type { ProviderRetryManager } from "../retry/providerRetry";
import type { ProviderIntegrationConfigurationProvider } from "../configuration/providerConfiguration";
import type { ProviderIntegrationLogger } from "../logging/providerLogger";
import type { ProviderIntegrationMetrics } from "../metrics/providerMetrics";
import type { ProviderIntegrationRouter } from "../router/providerRouter";
import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type {
  AuthenticationManager,
  CapabilityResolver,
  CatalogManager,
  ConfigurationProvider,
  CredentialManager,
  HealthManager,
  MetricsCollector,
  MetadataManager,
  PollingManager,
  ProviderAdapter,
  ProviderFactory,
  ProviderRegistry,
  ProviderResolver,
  ProviderRouter,
  ProviderSelector,
  RateLimitManager,
  ReportManager,
  RetryManager,
  SessionManager,
  StatusManager,
  TakedownManager,
  UploadManager,
  WebhookManager,
  RoyaltyManager,
} from "../contracts/providerIntegrationContracts";
import { ProviderConfiguration, ProviderCredentials, ProviderHealthSnapshot, ProviderSelectionResult, ProviderSession, ProviderUploadContext, ProviderUploadResult, ProviderStatusSnapshot, ProviderWebhookEnvelope, ProviderPollingResult, ProviderRoyaltyBatch, ProviderReportBatch, ProviderRetryContext, ProviderCapabilitySet } from "../types/providerIntegrationTypes";
import { ProviderIntegrationRegistryEntry as ProviderIntegrationEntry } from "../registry/providerRegistry";
import { type RuntimeRepository } from "../../infrastructure/repositories/runtime";

type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

type RuntimeTags = Readonly<Record<string, string | number | boolean>>;

type RuntimeLogEntry = Readonly<{
  level: RuntimeLogLevel;
  message: string;
  context: Readonly<Record<string, unknown>>;
  recordedAt: string;
}>;

type RuntimeMetricSample = Readonly<{
  value: number;
  recordedAt: string;
  tags: RuntimeTags;
}>;

type RuntimeProviderRecord = {
  integrationId: string;
  providerName: string;
  adapterName: string;
  configuration: ProviderConfiguration;
  integration: TrackSyraDspIntegration | null;
  credentials: ProviderCredentials | null;
  session: ProviderSession | null;
  capabilitySet: ProviderCapabilitySet;
  healthSnapshot: ProviderHealthSnapshot;
  selectionResult: ProviderSelectionResult | null;
  lifecycle: ProviderLifecycle;
  rateLimit: ProviderRateLimit;
  createdAt: string;
  updatedAt: string;
  lastOperationAt: string | null;
  uploads: Map<string, ProviderUploadResult>;
  statuses: Map<string, ProviderStatusSnapshot>;
  webhooks: Map<string, ProviderWebhookEnvelope>;
  polling: Map<string, ProviderPollingResult>;
  royalties: Map<string, ProviderRoyaltyBatch>;
  reports: Map<string, ProviderReportBatch>;
  retries: Map<string, ProviderRetryContext>;
};

export type ProviderRepositoryBundle = Readonly<{
  configurations: RuntimeRepository<string, { configuration: ProviderConfiguration; savedAt: string; order: number }>;
  records: RuntimeRepository<string, RuntimeProviderRecord>;
  entries: RuntimeRepository<string, ProviderIntegrationEntry>;
  metrics: RuntimeRepository<string, { total: number; samples: readonly RuntimeMetricSample[] }>;
}>;

export type ProviderIntegrationRuntimeDependencies = Readonly<{
  initialConfigurations: readonly ProviderConfiguration[];
  credentialResolver: PartnerCredentialResolver | null;
  store: TrackSyraDspRuntimeStore;
  repositories: ProviderRepositoryBundle;
  statusMapper: ProviderStatusMapper;
  retryStrategy: ExponentialProviderRetryStrategy;
}>;

function freezeRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function trimOrThrow(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function timestamp(): string {
  return new Date().toISOString();
}

function nextId(prefix: string, providerName: string, adapterName: string, sequence: number): string {
  return `${prefix}:${providerName}:${adapterName}:${sequence.toString(36)}:${Date.now().toString(36)}`;
}

function buildIntegrationId(providerName: string, adapterName: string, configurationId: string): string {
  return `${providerName}:${adapterName}:${configurationId}`;
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function cloneMetadata<T extends Readonly<Record<string, unknown>>>(metadata: T): T {
  return freezeRecord(metadata as Record<string, unknown>) as T;
}

function createFrameworkAuthentication(
  providerName: string,
  adapterName: string,
  accessToken: string,
  refreshToken: string,
  expiresInMs: number,
): FrameworkProviderAuthentication {
  return Object.freeze({
    authenticated: true,
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    scope: Object.freeze(["catalog", "metadata", "status", "reports", "royalty"]),
    expiresAt: new Date(Date.now() + expiresInMs),
    providerAccountId: `${providerName}:${adapterName}`,
    metadata: Object.freeze({
      providerName,
      adapterName,
      accessTokenHash: hashText(accessToken),
    }),
  });
}

function createFrameworkCredentials(
  providerName: string,
  adapterName: string,
  sequence: number,
): FrameworkProviderCredentials {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60_000);
  const accessToken = `${providerName}.${adapterName}.${sequence.toString(36)}.token`;
  const refreshToken = `${providerName}.${adapterName}.${sequence.toString(36)}.refresh`;
  return Object.freeze({
    credentialId: `${providerName}:${adapterName}:credential:${sequence.toString(36)}`,
    provider: providerName,
    version: adapterName,
    accountId: `${providerName}:${adapterName}`,
    secret: Object.freeze({
      accessToken,
      refreshToken,
      provider: providerName,
      adapter: adapterName,
      issuedAt: issuedAt.toISOString(),
    }),
    authentication: createFrameworkAuthentication(providerName, adapterName, accessToken, refreshToken, 24 * 60 * 60_000),
    issuedAt,
    expiresAt,
    rotatedAt: null,
    metadata: Object.freeze({
      providerName,
      adapterName,
      issuedAt: issuedAt.toISOString(),
    }),
  });
}

function createProviderCapabilities(configuration: ProviderConfiguration): ProviderCapabilities {
  const operations = Object.freeze([
    "authenticate",
    "refreshCredentials",
    "validateRelease",
    "validateAssets",
    "preparePackage",
    "submitRelease",
    "updateRelease",
    "takedownRelease",
    "checkStatus",
    "syncRelease",
    "receiveWebhook",
    "healthCheck",
    "disconnect",
  ] satisfies readonly ProviderOperation[]);
  return Object.freeze({
    operations,
    supportedStatuses: Object.freeze([
      FrameworkProviderStatus.INITIALIZING,
      FrameworkProviderStatus.READY,
      FrameworkProviderStatus.DEGRADED,
      FrameworkProviderStatus.DISABLED,
      FrameworkProviderStatus.AUTH_REQUIRED,
      FrameworkProviderStatus.CONFIGURATION_REQUIRED,
      FrameworkProviderStatus.UNAVAILABLE,
      FrameworkProviderStatus.ERROR,
    ]),
    supportsWebhookDelivery: Boolean(configuration.featureFlags.webhooks ?? true),
    supportsPolling: Boolean(configuration.featureFlags.polling ?? true),
    supportsTakedown: Boolean(configuration.featureFlags.takedown ?? true),
    supportsMetadataUpdate: Boolean(configuration.featureFlags.metadataUpdate ?? true),
    supportsAssetValidation: Boolean(configuration.featureFlags.assetValidation ?? true),
    supportsRetryAfterHeader: true,
    supportedAssetKinds: Object.freeze(["audio", "artwork", "lyrics", "manifest"]),
    supportedPackageKinds: Object.freeze(["release", "catalog", "takedown"]),
    supportedFormats: Object.freeze(["flac", "wav", "mp3", "jpg", "png", "json", "xml"]),
    featureFlags: freezeRecord({
      ...configuration.featureFlags,
    }),
    rateLimit: configuration.rateLimitPolicy
      ? Object.freeze({
          requestsPerSecond: 10,
          burst: 20,
          concurrency: 4,
          windowMs: 1000,
          retryAfterHeader: "Retry-After",
          dailyLimit: 1000,
        })
      : Object.freeze({
          requestsPerSecond: 5,
          burst: 10,
          concurrency: 2,
          windowMs: 1000,
          retryAfterHeader: "Retry-After",
          dailyLimit: 500,
        }),
    metadata: Object.freeze({
      providerName: configuration.providerName,
      adapterName: configuration.adapterName,
      configurationId: configuration.configurationId,
    }),
  });
}

function createProviderHealth(
  record: RuntimeProviderRecord,
  options: { healthy: boolean; latencyMs: number; message?: string | null; checks?: readonly { name: string; ok: boolean; message: string | null }[] } = {
    healthy: true,
    latencyMs: 0,
  },
): ProviderHealthSnapshot {
  const health: ProviderHealth = Object.freeze({
    provider: record.providerName,
    version: record.adapterName,
    status: options.healthy ? FrameworkProviderStatus.READY : FrameworkProviderStatus.DEGRADED,
    healthy: options.healthy,
    checkedAt: new Date(),
    latencyMs: options.latencyMs,
    configurationValid: record.configuration.enabled,
    credentialsValid: Boolean(record.credentials),
    message: options.message ?? null,
    checks: Object.freeze([
      ...(options.checks ?? [
        { name: "configuration", ok: record.configuration.enabled, message: record.configuration.enabled ? null : "Provider disabled" },
        { name: "credentials", ok: Boolean(record.credentials), message: record.credentials ? null : "Missing credentials" },
        { name: "session", ok: Boolean(record.session?.authenticated), message: record.session?.authenticated ? null : "No authenticated session" },
      ]),
    ]),
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      configurationId: record.configuration.configurationId,
    }),
  });

  return new ProviderHealthSnapshot({
    snapshotId: `${record.integrationId}:health:${Date.now().toString(36)}`,
    providerName: record.providerName,
    health,
    healthy: options.healthy,
    observedAt: timestamp(),
    latencyMs: options.latencyMs,
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      message: options.message ?? null,
    }),
  });
}

function createLifecycle(
  providerName: string,
  adapterName: string,
  stage: ProviderLifecycleStage,
  history: readonly { stage: ProviderLifecycleStage; transitionedAt: Date; reason?: string | null }[] = [],
  reason?: string | null,
): ProviderLifecycle {
  const nextHistory = [...history, { stage, transitionedAt: new Date(), reason: reason ?? null }];
  return Object.freeze({
    provider: providerName,
    version: adapterName,
    stage,
    createdAt: history.length ? history[0].transitionedAt : new Date(),
    lastTransitionAt: nextHistory[nextHistory.length - 1]!.transitionedAt,
    history: Object.freeze(nextHistory.map((entry) => Object.freeze({ ...entry }))),
    metadata: Object.freeze({
      providerName,
      adapterName,
      reason: reason ?? null,
    }),
  });
}

function createStatusSnapshot(
  record: RuntimeProviderRecord,
  statusMapper: ProviderStatusMapper,
  input: {
    status: ConnectorStatus | FrameworkProviderStatus;
    healthy: boolean;
    releaseId: string;
    providerStatus: string;
    resultOperation: string;
    metadata?: Readonly<Record<string, unknown>>;
  },
): ProviderStatusSnapshot {
  const providerResult = createProviderResult({
    provider: record.providerName,
    version: record.adapterName,
    operation: input.resultOperation,
    status: FrameworkProviderStatus.READY,
    distributionStatus: statusMapper.toDistributionStatus(
      typeof input.status === "string" ? input.providerStatus : input.status.status,
    ),
    referenceId: `${record.providerName}:${record.adapterName}:${input.releaseId}`,
    completedAt: new Date(),
    payload: Object.freeze({
      releaseId: input.releaseId,
      providerStatus: input.providerStatus,
      status: input.status,
    }),
    health: (record.healthSnapshot.health as ProviderHealth) ?? null,
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      releaseId: input.releaseId,
      providerStatus: input.providerStatus,
      ...input.metadata,
    }),
    errors: [],
  });

  return new ProviderStatusSnapshot({
    snapshotId: `${record.integrationId}:status:${Date.now().toString(36)}`,
    providerName: record.providerName,
    status: input.status,
    observedAt: timestamp(),
    healthy: input.healthy,
    result: providerResult,
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      releaseId: input.releaseId,
      providerStatus: input.providerStatus,
      ...input.metadata,
    }),
  });
}

function createUploadResult(
  record: RuntimeProviderRecord,
  operation: string,
  releaseId: string,
  statusCategory: "Accepted" | "Rejected" | "Processing" | "Pending" | "Scheduled" | "Live" | "Removed" | "Failed",
  success: boolean,
  metadata: Readonly<Record<string, unknown>> = {},
): ProviderUploadResult {
  const connectorStatus = new ConnectorStatus({
    connectorId: record.adapterName,
    releaseId,
    status: statusCategory,
    providerStatus: success ? FrameworkProviderStatus.READY : FrameworkProviderStatus.ERROR,
    observedAt: timestamp(),
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      operation,
      ...metadata,
    }),
  });

  const result = createProviderResult({
    provider: record.providerName,
    version: record.adapterName,
    operation,
    status: success ? FrameworkProviderStatus.READY : FrameworkProviderStatus.ERROR,
    distributionStatus: mapConnectorStatusToDistributionStatus(statusCategory),
    referenceId: `${record.providerName}:${record.adapterName}:${releaseId}:${operation}`,
    checksum: hashText(`${record.providerName}:${record.adapterName}:${releaseId}:${operation}`),
    completedAt: new Date(),
    payload: Object.freeze({
      releaseId,
      operation,
      statusCategory,
      ...metadata,
    }),
    health: record.healthSnapshot.health as ProviderHealth,
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      operation,
      releaseId,
      ...metadata,
    }),
    errors: [],
  });

  return new ProviderUploadResult({
    uploadId: `${record.integrationId}:${operation}:${Date.now().toString(36)}`,
    providerName: record.providerName,
    success,
    failure: !success,
    connectorStatus,
    result,
    completedAt: timestamp(),
    metadata: Object.freeze({
      providerName: record.providerName,
      adapterName: record.adapterName,
      operation,
      releaseId,
      ...metadata,
    }),
  });
}

function mapConnectorStatusToDistributionStatus(
  status: "Accepted" | "Rejected" | "Processing" | "Pending" | "Scheduled" | "Live" | "Removed" | "Failed",
): DistributionStatus {
  switch (status) {
    case "Accepted":
    case "Processing":
    case "Pending":
    case "Scheduled":
      return DistributionStatus.PROCESSING;
    case "Live":
      return DistributionStatus.PUBLISHED;
    case "Removed":
      return DistributionStatus.DELIVERED;
    case "Rejected":
      return DistributionStatus.REJECTED;
    case "Failed":
    default:
      return DistributionStatus.FAILED;
  }
}

function mapWebhookToConnectorStatus(event: ProviderWebhookEnvelope): "Accepted" | "Rejected" | "Processing" | "Pending" | "Scheduled" | "Live" | "Removed" | "Failed" {
  const eventType = event.payload.eventType.toLowerCase();
  if (event.payload.signatureValid === false) return "Failed";
  if (eventType.includes("reject")) return "Rejected";
  if (eventType.includes("remove") || eventType.includes("takedown")) return "Removed";
  if (eventType.includes("live") || eventType.includes("published")) return "Live";
  if (eventType.includes("accept")) return "Accepted";
  if (eventType.includes("schedule")) return "Scheduled";
  if (eventType.includes("pending")) return "Pending";
  return "Processing";
}

function resolveReleaseId(
  context: ProviderUploadContext | ProviderStatusSnapshot | ProviderPollingResult | ProviderWebhookEnvelope,
): string {
  if ("metadata" in context && context.metadata && typeof context.metadata.releaseId === "string") {
    return context.metadata.releaseId;
  }
  if ("snapshot" in context && context.snapshot) {
    return context.snapshot.snapshotId;
  }
  if ("eventId" in context) {
    return context.eventId;
  }
  if ("uploadId" in context) {
    return context.uploadId;
  }
  return `${context.providerName}:release`;
}

export class TrackSyraDspRuntimeStore {
  constructor(private readonly repositories: ProviderRepositoryBundle) {}
  private readonly logs: RuntimeLogEntry[] = [];
  private readonly events: ProviderIntegrationEvent[] = [];
  private sequence = 0;
  private configSequence = 0;

  saveConfiguration(configuration: ProviderConfiguration): ProviderConfiguration {
    const normalized = Object.freeze({
      ...configuration,
      featureFlags: freezeRecord(configuration.featureFlags),
      metadata: cloneMetadata(configuration.metadata),
    }) as ProviderConfiguration;
    this.repositories.configurations.set(normalized.configurationId, {
      configuration: normalized,
      savedAt: timestamp(),
      order: ++this.configSequence,
    });
    return normalized;
  }

  loadConfiguration(providerName: string): ProviderConfiguration | null {
    const matches = [...this.repositories.configurations.values()]
      .filter((entry) => entry.configuration.providerName === providerName)
      .sort((left, right) => {
        if (left.configuration.enabled !== right.configuration.enabled) return left.configuration.enabled ? -1 : 1;
        if (left.configuration.priority !== right.configuration.priority) return right.configuration.priority - left.configuration.priority;
        return right.order - left.order;
      });
    return matches[0]?.configuration ?? null;
  }

  listConfigurations(): readonly ProviderConfiguration[] {
    return Object.freeze(
      [...this.repositories.configurations.values()]
        .sort((left, right) => left.order - right.order)
        .map((entry) => entry.configuration),
    );
  }

  ensureRecord(configuration: ProviderConfiguration): RuntimeProviderRecord {
    const integrationId = buildIntegrationId(configuration.providerName, configuration.adapterName, configuration.configurationId);
    const existing = this.repositories.records.get(integrationId);
    if (existing) {
      const capabilitySet = new ProviderCapabilitySet({
        capabilityId: `${configuration.configurationId}:capabilities`,
        providerName: configuration.providerName,
        capabilities: createProviderCapabilities(configuration),
        enabled: configuration.enabled,
        version: configuration.adapterName,
        updatedAt: timestamp(),
        metadata: Object.freeze({
          providerName: configuration.providerName,
          adapterName: configuration.adapterName,
          configurationId: configuration.configurationId,
        }),
      });
      const rateLimit = "rateLimit" in capabilitySet.capabilities ? capabilitySet.capabilities.rateLimit ?? null : null;
      const updated = this.mergeRecord(existing, {
        configuration,
        capabilitySet,
        rateLimit: rateLimit ?? existing.rateLimit,
      });
      this.repositories.records.set(integrationId, updated);
      return updated;
    }

    const record = this.createRecord(configuration);
    this.repositories.records.set(record.integrationId, record);
    return record;
  }

  private createRecord(configuration: ProviderConfiguration): RuntimeProviderRecord {
    const integrationId = buildIntegrationId(configuration.providerName, configuration.adapterName, configuration.configurationId);
    const capabilitySet = new ProviderCapabilitySet({
      capabilityId: `${configuration.configurationId}:capabilities`,
      providerName: configuration.providerName,
      capabilities: createProviderCapabilities(configuration),
      enabled: configuration.enabled,
      version: configuration.adapterName,
      updatedAt: timestamp(),
      metadata: Object.freeze({
        providerName: configuration.providerName,
        adapterName: configuration.adapterName,
        configurationId: configuration.configurationId,
      }),
    });
    const rateLimit = "rateLimit" in capabilitySet.capabilities ? capabilitySet.capabilities.rateLimit ?? null : null;
    const healthSnapshot = createProviderHealth(
      {
        integrationId: configuration.configurationId,
        providerName: configuration.providerName,
        adapterName: configuration.adapterName,
        configuration,
        integration: null,
        credentials: null,
        session: null,
        capabilitySet,
        healthSnapshot: null as never,
        selectionResult: null,
        lifecycle: createLifecycle(configuration.providerName, configuration.adapterName, ProviderLifecycleStage.CREATED),
        rateLimit: rateLimit ?? {
          requestsPerSecond: 5,
          burst: 10,
          concurrency: 2,
          windowMs: 1000,
          retryAfterHeader: "Retry-After",
          dailyLimit: 500,
        },
        createdAt: timestamp(),
        updatedAt: timestamp(),
        lastOperationAt: null,
        uploads: new Map<string, ProviderUploadResult>(),
        statuses: new Map<string, ProviderStatusSnapshot>(),
        webhooks: new Map<string, ProviderWebhookEnvelope>(),
        polling: new Map<string, ProviderPollingResult>(),
        royalties: new Map<string, ProviderRoyaltyBatch>(),
        reports: new Map<string, ProviderReportBatch>(),
        retries: new Map<string, ProviderRetryContext>(),
      },
      {
        healthy: false,
        latencyMs: 0,
        message: "Integration not yet authenticated",
      },
    );

    return {
      integrationId,
      providerName: configuration.providerName,
      adapterName: configuration.adapterName,
      configuration,
      integration: null,
      credentials: null,
      session: null,
      capabilitySet,
      healthSnapshot,
      selectionResult: null,
      lifecycle: createLifecycle(configuration.providerName, configuration.adapterName, ProviderLifecycleStage.REGISTERED),
      rateLimit: rateLimit ?? {
        requestsPerSecond: 5,
        burst: 10,
        concurrency: 2,
        windowMs: 1000,
        retryAfterHeader: "Retry-After",
        dailyLimit: 500,
      },
      createdAt: timestamp(),
      updatedAt: timestamp(),
      lastOperationAt: null,
      uploads: new Map<string, ProviderUploadResult>(),
      statuses: new Map<string, ProviderStatusSnapshot>(),
      webhooks: new Map<string, ProviderWebhookEnvelope>(),
      polling: new Map<string, ProviderPollingResult>(),
      royalties: new Map<string, ProviderRoyaltyBatch>(),
      reports: new Map<string, ProviderReportBatch>(),
      retries: new Map<string, ProviderRetryContext>(),
    };
  }

  private mergeRecord(record: RuntimeProviderRecord, patch: Partial<RuntimeProviderRecord>): RuntimeProviderRecord {
    const merged = {
      ...record,
      ...patch,
      updatedAt: timestamp(),
    } as RuntimeProviderRecord;
    return merged;
  }

  getRecord(providerName: string, adapterName?: string | null): RuntimeProviderRecord | null {
    const records = [...this.repositories.records.values()].filter((record) => record.providerName === providerName && (!adapterName || record.adapterName === adapterName));
    records.sort((left, right) => {
      if (left.configuration.enabled !== right.configuration.enabled) return left.configuration.enabled ? -1 : 1;
      if (left.healthSnapshot.healthy !== right.healthSnapshot.healthy) return left.healthSnapshot.healthy ? -1 : 1;
      if (left.configuration.priority !== right.configuration.priority) return right.configuration.priority - left.configuration.priority;
      if (left.selectionResult?.score !== right.selectionResult?.score) return (right.selectionResult?.score ?? 0) - (left.selectionResult?.score ?? 0);
      return right.createdAt.localeCompare(left.createdAt);
    });
    return records[0] ?? null;
  }

  getRecordByIntegrationId(integrationId: string): RuntimeProviderRecord | null {
    return this.repositories.records.get(integrationId) ?? null;
  }

  listRecords(): readonly RuntimeProviderRecord[] {
    return Object.freeze([...this.repositories.records.values()]);
  }

  upsertIntegration(integration: TrackSyraDspIntegration): RuntimeProviderRecord {
    const record = this.ensureRecord(integration.configuration);
    const next = this.mergeRecord(record, { integration });
    this.repositories.records.set(record.integrationId, next);
    return next;
  }

  registerIntegration(integration: TrackSyraDspIntegration): RuntimeProviderRecord {
    const record = this.upsertIntegration(integration);
    this.repositories.entries.set(
      integration.providerName,
      new ProviderIntegrationRegistryEntry({
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        integration,
        registeredAt: timestamp(),
      }),
    );
    this.publishEvent("ProviderIntegrationRegistered", integration.providerName, integration.adapterName, {
      configurationId: integration.configuration.configurationId,
    });
    return record;
  }

  getEntry(providerName: string): ProviderIntegrationRegistryEntry | null {
    return this.repositories.entries.get(providerName) ?? null;
  }

  listEntries(): readonly ProviderIntegrationRegistryEntry[] {
    return Object.freeze([...this.repositories.entries.values()]);
  }

  removeEntry(providerName: string): void {
    this.repositories.entries.delete(providerName);
  }

  publishEvent(type: ProviderIntegrationEventType, providerName: string, adapterName: string, payload: Readonly<Record<string, unknown>> = {}): ProviderIntegrationEvent {
    const event = new ProviderIntegrationEvent({
      type,
      providerName,
      adapterName,
      payload: cloneMetadata(payload),
    });
    this.events.push(event);
    return event;
  }

  listEvents(providerName?: string): readonly ProviderIntegrationEvent[] {
    return Object.freeze(
      providerName ? this.events.filter((event) => event.providerName === providerName) : [...this.events],
    );
  }

  recordLog(level: RuntimeLogLevel, message: string, context: Readonly<Record<string, unknown>> = {}): RuntimeLogEntry {
    const entry: RuntimeLogEntry = Object.freeze({
      level,
      message,
      context: cloneMetadata(context),
      recordedAt: timestamp(),
    });
    this.logs.push(entry);
    return entry;
  }

  listLogs(): readonly RuntimeLogEntry[] {
    return Object.freeze([...this.logs]);
  }

  recordMetric(metric: string, value: number, tags: RuntimeTags = {}): void {
    const sample: RuntimeMetricSample = Object.freeze({
      value,
      recordedAt: timestamp(),
      tags: freezeRecord(tags as Record<string, string | number | boolean>),
    });
    const existing = this.repositories.metrics.get(metric) ?? { total: 0, samples: [] as RuntimeMetricSample[] };
    this.repositories.metrics.set(metric, {
      total: existing.total + value,
      samples: Object.freeze([...existing.samples, sample]),
    });
  }

  observeMetric(metric: string, value: number, tags: RuntimeTags = {}): void {
    const sample: RuntimeMetricSample = Object.freeze({
      value,
      recordedAt: timestamp(),
      tags: freezeRecord(tags as Record<string, string | number | boolean>),
    });
    const existing = this.repositories.metrics.get(metric) ?? { total: 0, samples: [] as RuntimeMetricSample[] };
    this.repositories.metrics.set(metric, {
      total: existing.total + value,
      samples: Object.freeze([...existing.samples, sample]),
    });
  }

  setGauge(metric: string, value: number, tags: RuntimeTags = {}): void {
    const key = `${metric}:${JSON.stringify(tags)}`;
    this.repositories.metrics.set(key, {
      total: value,
      samples: [Object.freeze({ value, recordedAt: timestamp(), tags: freezeRecord(tags as Record<string, string | number | boolean>) })],
    });
  }

  snapshotMetrics(): Readonly<Record<string, { total: number; samples: readonly RuntimeMetricSample[] }>> {
    const snapshot: Record<string, { total: number; samples: readonly RuntimeMetricSample[] }> = {};
    for (const [metric, value] of this.repositories.metrics.entries()) {
      snapshot[metric] = Object.freeze({
        total: value.total,
        samples: Object.freeze([...value.samples]),
      });
    }
    return freezeRecord(snapshot);
  }

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  withTelemetry<T>(operation: string, integration: TrackSyraDspIntegration, action: () => T): T {
    const startedAt = Date.now();
    try {
      return action();
    } finally {
      this.recordMetric("provider.runtime.operation", Date.now() - startedAt, {
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        operation,
      });
    }
  }
}

export class TrackSyraDspRuntimeEngine {
  readonly store: TrackSyraDspRuntimeStore;
  private readonly statusMapper: ProviderStatusMapper;
  private readonly retryStrategy: ExponentialProviderRetryStrategy;
  private readonly credentialResolver: PartnerCredentialResolver | null;

  constructor(dependencies: ProviderIntegrationRuntimeDependencies) {
    this.store = dependencies.store;
    this.statusMapper = dependencies.statusMapper;
    this.retryStrategy = dependencies.retryStrategy;
    this.credentialResolver = dependencies.credentialResolver;
    for (const configuration of dependencies.initialConfigurations) {
      this.registerConfiguration(configuration);
    }
  }

  withTelemetry<T>(operation: string, integration: TrackSyraDspIntegration, action: () => T): T {
    const startedAt = Date.now();
    try {
      return action();
    } finally {
      this.store.recordMetric("provider.runtime.operation", Date.now() - startedAt, {
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        operation,
      });
    }
  }

  registerConfiguration(configuration: ProviderConfiguration): TrackSyraDspIntegration {
    const saved = this.store.saveConfiguration(configuration);
    return this.createIntegration(saved);
  }

  createIntegration(configuration: ProviderConfiguration): TrackSyraDspIntegration {
    const saved = this.store.saveConfiguration(configuration);
    return new TrackSyraDspIntegration(this, saved);
  }

  registerIntegration(integration: TrackSyraDspIntegration): TrackSyraDspIntegration {
    this.store.registerIntegration(integration);
    return integration;
  }

  resolveIntegration(providerName: string, adapterName?: string | null): TrackSyraDspIntegration | null {
    const record = this.store.getRecord(providerName, adapterName ?? null);
    if (record?.integration) {
      return record.integration;
    }

    const configuration = adapterName
      ? this.store.listConfigurations().find((item) => item.providerName === providerName && item.adapterName === adapterName) ?? null
      : this.store.loadConfiguration(providerName);

    if (!configuration) {
      return null;
    }

    return this.createIntegration(configuration);
  }

  resolveAdapter(providerName: string, adapterName?: string | null): ProviderAdapter | null {
    return this.resolveIntegration(providerName, adapterName)?.adapter ?? null;
  }

  listIntegrations(): readonly TrackSyraDspIntegration[] {
    return Object.freeze(this.store.listRecords().map((record) => record.integration).filter((integration): integration is TrackSyraDspIntegration => Boolean(integration)));
  }

  selectIntegration(providerName: string): ProviderSelectionResult {
    const integration = this.resolveIntegration(providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    return this.selectIntegrationByInstance(integration);
  }

  selectIntegrationByInstance(integration: TrackSyraDspIntegration): ProviderSelectionResult {
    const startedAt = Date.now();
    const record = this.store.ensureRecord(integration.configuration);
    const health = this.healthForIntegration(integration);
    const score = this.computeSelectionScore(record, health);
    const selection = new ProviderSelectionResult({
      selectionId: `${integration.integrationId}:selection:${this.store.nextSequence().toString(36)}`,
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      priority: integration.configuration.priority,
      score,
      selectedAt: timestamp(),
      featureFlags: integration.configuration.featureFlags,
      healthSnapshot: health,
      metadata: Object.freeze({
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        configurationId: integration.configuration.configurationId,
      }),
    });
    this.store.recordMetric("provider.selection.count", 1, { providerName: integration.providerName, adapterName: integration.adapterName });
    this.store.observeMetric("provider.selection.latency", Date.now() - startedAt, { providerName: integration.providerName, adapterName: integration.adapterName });
    this.store.publishEvent("ProviderIntegrationSelected", integration.providerName, integration.adapterName, {
      selectionId: selection.selectionId,
      score: selection.score,
    });
    this.store.recordLog("info", "Provider selected", {
      providerName: integration.providerName,
      adapterName: integration.adapterName,
      selectionId: selection.selectionId,
    });
    this.store.ensureRecord(integration.configuration);
    return selection;
  }

  authenticateIntegration(integration: TrackSyraDspIntegration): ProviderSession {
    return this.withTelemetry("authenticate", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      if (!integration.configuration.enabled) {
        throw new ProviderError({
          code: "UNAVAILABLE",
          message: `Provider integration disabled: ${integration.providerName}`,
          provider: integration.providerName,
          version: integration.adapterName,
          retryable: false,
          status: FrameworkProviderStatus.DISABLED,
        });
      }

      const authentication = this.resolveAuthenticationSnapshot(integration.providerName);
      const sequence = this.store.nextSequence();
      const credentials = new ProviderCredentials({
        credentialId: `${integration.integrationId}:credential:${sequence.toString(36)}`,
        providerName: integration.providerName,
        type: integration.configuration.region ? `region:${integration.configuration.region}` : "native",
        value: createFrameworkCredentials(integration.providerName, integration.adapterName, sequence),
        authentication,
        issuedAt: timestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        rotatedAt: null,
        metadata: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
          configurationId: integration.configuration.configurationId,
          sequence,
        }),
      });

      const session = new ProviderSession({
        sessionId: `${integration.integrationId}:session:${sequence.toString(36)}`,
        providerName: integration.providerName,
        providerVersion: integration.adapterName,
        authenticated: true,
        startedAt: timestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        credentials: credentials.value,
        authentication,
        metadata: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
          credentialId: credentials.credentialId,
        }),
      });

      const updated = this.store.ensureRecord(integration.configuration);
      this.store.publishEvent("ProviderIntegrationAuthenticated", integration.providerName, integration.adapterName, {
        sessionId: session.sessionId,
        credentialId: credentials.credentialId,
      });
      this.store.recordLog("info", "Provider authenticated", {
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        sessionId: session.sessionId,
      });
      this.applySession(record.integration ?? integration, session, credentials);
      return session;
    });
  }

  refreshCredentials(integration: TrackSyraDspIntegration): ProviderCredentials {
    return this.withTelemetry("refreshCredentials", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const authentication = this.resolveAuthenticationSnapshot(integration.providerName);
      const sequence = this.store.nextSequence();
      const credentials = new ProviderCredentials({
        credentialId: `${integration.integrationId}:credential:${sequence.toString(36)}`,
        providerName: integration.providerName,
        type: "native",
        value: createFrameworkCredentials(integration.providerName, integration.adapterName, sequence),
        authentication,
        issuedAt: timestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        rotatedAt: timestamp(),
        metadata: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
          configurationId: integration.configuration.configurationId,
          sequence,
        }),
      });
      this.applyCredentials(record.integration ?? integration, credentials);
      this.store.publishEvent("ProviderIntegrationAuthenticated", integration.providerName, integration.adapterName, {
        credentialId: credentials.credentialId,
        rotated: true,
      });
      return credentials;
    });
  }

  private resolveAuthenticationSnapshot(providerName: string): AuthenticationSnapshot | null {
    return (this.credentialResolver?.resolve(providerName as never) ?? null) as AuthenticationSnapshot | null;
  }

  issueCredentials(integration: TrackSyraDspIntegration): ProviderCredentials {
    return this.refreshCredentials(integration);
  }

  startSession(integration: TrackSyraDspIntegration): ProviderSession {
    return this.authenticateIntegration(integration);
  }

  renewSession(session: ProviderSession): ProviderSession {
    const record = this.store.getRecord(session.providerName);
    if (!record) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Session provider not found: ${session.providerName}`,
        provider: session.providerName,
        retryable: false,
      });
    }
    const next = new ProviderSession({
      sessionId: session.sessionId,
      providerName: session.providerName,
      providerVersion: session.providerVersion,
      authenticated: true,
      startedAt: timestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      credentials: session.credentials,
      authentication: session.authentication,
      metadata: Object.freeze({
        ...session.metadata,
        renewedAt: timestamp(),
      }),
    });
    this.applySession(record.integration ?? this.resolveIntegration(session.providerName), next, null);
    return next;
  }

  endSession(session: ProviderSession): boolean {
    const record = this.store.getRecord(session.providerName);
    if (!record) {
      return false;
    }
    const nextLifecycle = createLifecycle(record.providerName, record.adapterName, ProviderLifecycleStage.DISCONNECTED, record.lifecycle.history, "Session ended");
    this.store.ensureRecord(record.configuration);
    this.store.recordLog("info", "Provider session ended", {
      providerName: record.providerName,
      adapterName: record.adapterName,
      sessionId: session.sessionId,
    });
    this.applyLifecycle(record.integration ?? this.resolveIntegration(record.providerName, record.adapterName), nextLifecycle);
    return true;
  }

  resolveCapabilities(integration: TrackSyraDspIntegration): ProviderCapabilitySet {
    const record = this.store.ensureRecord(integration.configuration);
    return record.capabilitySet;
  }

  selectProvider(providerName: string): ProviderSelectionResult {
    return this.selectIntegration(providerName);
  }

  healthForIntegration(integration: TrackSyraDspIntegration): ProviderHealthSnapshot {
    const record = this.store.ensureRecord(integration.configuration);
    const startedAt = Date.now();
    const healthy = Boolean(record.configuration.enabled && record.credentials && record.session?.authenticated);
    const snapshot = createProviderHealth(record, {
      healthy,
      latencyMs: Date.now() - startedAt,
      message: healthy ? "Healthy" : record.configuration.enabled ? "Authentication required" : "Disabled",
    });
    this.applyHealth(record.integration ?? integration, snapshot);
    return snapshot;
  }

  snapshotHealth(providerName: string): ProviderHealthSnapshot {
    const integration = this.resolveIntegration(providerName);
    if (!integration) {
      return new ProviderHealthSnapshot({
        snapshotId: `${providerName}:health:${Date.now().toString(36)}`,
        providerName,
        health: Object.freeze({
          provider: providerName,
          version: "unknown",
          status: FrameworkProviderStatus.CONFIGURATION_REQUIRED,
          healthy: false,
          checkedAt: new Date(),
          latencyMs: null,
          configurationValid: false,
          credentialsValid: false,
          message: "Provider integration not configured",
          checks: Object.freeze([]),
          metadata: Object.freeze({ providerName }),
        }),
        healthy: false,
        observedAt: timestamp(),
        latencyMs: 0,
        metadata: Object.freeze({
          providerName,
          adapterName: "unknown",
        }),
      });
    }
    return this.healthForIntegration(integration);
  }

  upload(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderUploadResult {
    return this.withTelemetry("upload", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = resolveReleaseId(context);
      const result = createUploadResult(record, "upload", releaseId, "Processing", true, {
        createdAt: context.createdAt,
        connectorPayload: context.connectorPayload,
        metadataMap: context.metadataMap,
      });
      record.uploads.set(result.uploadId, result);
      this.store.publishEvent("ProviderIntegrationUploaded", integration.providerName, integration.adapterName, {
        uploadId: result.uploadId,
        releaseId,
      });
      this.store.recordMetric("provider.upload.count", 1, { providerName: integration.providerName, adapterName: integration.adapterName });
      this.store.recordLog("info", "Provider upload completed", {
        providerName: integration.providerName,
        adapterName: integration.adapterName,
        uploadId: result.uploadId,
        releaseId,
      });
      return result;
    });
  }

  uploadAssets(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderUploadResult {
    return this.upload(integration, context);
  }

  submitMetadata(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderUploadResult {
    return this.withTelemetry("submitMetadata", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = resolveReleaseId(context);
      const result = createUploadResult(record, "submitMetadata", releaseId, "Accepted", true, {
        createdAt: context.createdAt,
        metadataMap: context.metadataMap,
      });
      record.uploads.set(result.uploadId, result);
      return result;
    });
  }

  createRelease(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderUploadResult {
    return this.withTelemetry("createRelease", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = resolveReleaseId(context);
      const result = createUploadResult(record, "createRelease", releaseId, "Accepted", true, {
        createdAt: context.createdAt,
        metadataMap: context.metadataMap,
      });
      record.uploads.set(result.uploadId, result);
      return result;
    });
  }

  updateRelease(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderUploadResult {
    return this.withTelemetry("updateRelease", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = resolveReleaseId(context);
      const result = createUploadResult(record, "updateRelease", releaseId, "Scheduled", true, {
        createdAt: context.createdAt,
      });
      record.uploads.set(result.uploadId, result);
      return result;
    });
  }

  syncRelease(integration: TrackSyraDspIntegration, context: ProviderUploadContext): ProviderStatusSnapshot {
    return this.trackStatus(integration, context);
  }

  trackStatus(integration: TrackSyraDspIntegration, context: ProviderStatusSnapshot | ProviderUploadContext): ProviderStatusSnapshot {
    return this.withTelemetry("checkStatus", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = "uploadId" in context ? resolveReleaseId(context) : resolveReleaseId(context);
      const latestStatus = "snapshotId" in context
        ? context
        : this.resolveLatestStatus(record, releaseId) ?? createStatusSnapshot(record, this.statusMapper, {
            status: new ConnectorStatus({
              connectorId: integration.adapterName,
              releaseId,
              status: "Processing",
              providerStatus: FrameworkProviderStatus.READY,
              observedAt: timestamp(),
              metadata: Object.freeze({ providerName: integration.providerName, adapterName: integration.adapterName }),
            }),
            healthy: record.healthSnapshot.healthy,
            releaseId,
            providerStatus: FrameworkProviderStatus.READY,
            resultOperation: "checkStatus",
            metadata: Object.freeze({ source: "default" }),
          });
      if ("snapshotId" in context) {
        record.statuses.set(context.snapshotId, context);
        return context;
      }
    const snapshot = createStatusSnapshot(record, this.statusMapper, {
        status: latestStatus.status,
        healthy: record.healthSnapshot.healthy,
        releaseId,
        providerStatus: FrameworkProviderStatus.READY,
        resultOperation: "checkStatus",
        metadata: Object.freeze({
          source: "upload-context",
          uploadId: context.uploadId,
        }),
      });
      record.statuses.set(snapshot.snapshotId, snapshot);
      this.store.publishEvent("ProviderIntegrationStatusChanged", integration.providerName, integration.adapterName, {
        snapshotId: snapshot.snapshotId,
        status: typeof snapshot.status === "string" ? snapshot.status : snapshot.status.status,
      });
      return snapshot;
    });
  }

  reconcileStatus(integration: TrackSyraDspIntegration, snapshot: ProviderStatusSnapshot): ProviderStatusSnapshot {
    return this.withTelemetry("syncRelease", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const normalized = this.normalizeStatusSnapshot(record, snapshot);
      record.statuses.set(normalized.snapshotId, normalized);
      return normalized;
    });
  }

  receiveWebhook(integration: TrackSyraDspIntegration, event: ProviderWebhookEnvelope): ProviderStatusSnapshot {
    return this.withTelemetry("receiveWebhook", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const statusCategory = mapWebhookToConnectorStatus(event);
      const releaseId = resolveReleaseId(event);
      const snapshot = createStatusSnapshot(record, this.statusMapper, {
        status: new ConnectorStatus({
          connectorId: integration.adapterName,
          releaseId,
          status: statusCategory,
          providerStatus: event.payload.eventType,
          observedAt: event.receivedAt,
          metadata: Object.freeze({
            providerName: integration.providerName,
            adapterName: integration.adapterName,
            webhookId: event.eventId,
          }),
        }),
        healthy: statusCategory !== "Failed" && statusCategory !== "Rejected",
        releaseId,
        providerStatus: event.payload.eventType,
        resultOperation: "receiveWebhook",
        metadata: Object.freeze({
          eventId: event.eventId,
          webhookEventType: event.payload.eventType,
        }),
      });
      record.webhooks.set(event.eventId, event);
      record.statuses.set(snapshot.snapshotId, snapshot);
      this.store.publishEvent("ProviderIntegrationStatusChanged", integration.providerName, integration.adapterName, {
        webhookEventId: event.eventId,
        status: statusCategory,
      });
      return snapshot;
    });
  }

  poll(providerName: string): ProviderPollingResult {
    const integration = this.resolveIntegration(providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    return this.withTelemetry("poll", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = record.integrationId;
      const snapshot = new ProviderPollingResult({
        pollingId: `${integration.integrationId}:polling:${this.store.nextSequence().toString(36)}`,
        providerName: integration.providerName,
        status: new ConnectorPolling({
          pollingId: `${integration.integrationId}:poll:${this.store.nextSequence().toString(36)}`,
          connectorId: integration.adapterName,
          releaseId,
          requestedAt: timestamp(),
          completedAt: timestamp(),
          payload: Object.freeze({
            providerName: integration.providerName,
            adapterName: integration.adapterName,
            releaseId,
          }),
        }),
        snapshot: this.resolveLatestStatus(record, releaseId) ?? null,
        polledAt: timestamp(),
        metadata: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
        }),
      });
      record.polling.set(snapshot.pollingId, snapshot);
      return snapshot;
    });
  }

  importRoyalties(batch: ProviderRoyaltyBatch): ProviderRoyaltyBatch {
    const integration = this.resolveIntegration(batch.providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${batch.providerName}`,
        provider: batch.providerName,
        retryable: false,
      });
    }
    return this.withTelemetry("importRoyalties", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const royalties = new ConnectorRoyalty({
        connectorId: integration.adapterName,
        releaseId: batch.batchId,
        features: Object.freeze(["Streaming Reports", "Sales Reports"]),
        reportPeriod: timestamp().slice(0, 7),
        importedAt: timestamp(),
        metadata: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
          batchId: batch.batchId,
        }),
      });
      const next = new ProviderRoyaltyBatch({
        batchId: batch.batchId,
        providerName: batch.providerName,
        royalties,
        createdAt: timestamp(),
        metadata: Object.freeze({
          ...batch.metadata,
          imported: true,
        }),
      });
      record.royalties.set(batch.batchId, next);
      this.store.publishEvent("ProviderIntegrationRoyaltiesImported", integration.providerName, integration.adapterName, {
        batchId: batch.batchId,
      });
      return next;
    });
  }

  generateReports(batch: ProviderReportBatch): ProviderReportBatch {
    const integration = this.resolveIntegration(batch.providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${batch.providerName}`,
        provider: batch.providerName,
        retryable: false,
      });
    }
    return this.withTelemetry("generateReports", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const report = new ConnectorReport({
        reportId: `${integration.integrationId}:report:${this.store.nextSequence().toString(36)}`,
        connectorId: integration.adapterName,
        releaseId: batch.batchId,
        reportType: "DeliveryAudit",
        generatedAt: timestamp(),
        payload: Object.freeze({
          providerName: integration.providerName,
          adapterName: integration.adapterName,
          batchId: batch.batchId,
        }),
      });
      const next = new ProviderReportBatch({
        batchId: batch.batchId,
        providerName: batch.providerName,
        reports: report,
        createdAt: timestamp(),
        metadata: Object.freeze({
          ...batch.metadata,
          generated: true,
        }),
      });
      record.reports.set(batch.batchId, next);
      this.store.publishEvent("ProviderIntegrationReportsGenerated", integration.providerName, integration.adapterName, {
        batchId: batch.batchId,
      });
      return next;
    });
  }

  takedown(providerName: string): ProviderUploadResult {
    const integration = this.resolveIntegration(providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    return this.withTelemetry("takedownRelease", integration, () => {
      const record = this.store.ensureRecord(integration.configuration);
      const releaseId = `${integration.integrationId}:takedown`;
      const result = createUploadResult(record, "takedownRelease", releaseId, "Removed", true, {
        takedown: true,
      });
      this.applyLifecycle(record.integration ?? integration, createLifecycle(integration.providerName, integration.adapterName, ProviderLifecycleStage.DISCONNECTED, record.lifecycle.history, "Takedown completed"));
      this.store.publishEvent("ProviderIntegrationTakedownRequested", integration.providerName, integration.adapterName, {
        takedownId: result.uploadId,
      });
      return result;
    });
  }

  checkHealth(integration: TrackSyraDspIntegration): ProviderHealthSnapshot {
    return this.healthForIntegration(integration);
  }

  healthSnapshot(providerName: string): ProviderHealthSnapshot {
    return this.snapshotHealth(providerName);
  }

  rateLimit(providerName: string): ProviderRateLimit {
    return this.evaluateRateLimit(providerName);
  }

  evaluateRateLimit(providerName: string): ProviderRateLimit {
    const record = this.store.getRecord(providerName);
    if (!record) {
      return Object.freeze({
        requestsPerSecond: 1,
        burst: 1,
        concurrency: 1,
        windowMs: 1000,
        retryAfterHeader: "Retry-After",
        dailyLimit: 100,
      });
    }
    return record.rateLimit;
  }

  retry(context: ProviderRetryContext): ProviderRetryContext {
    const integration = this.resolveIntegration(context.providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.withTelemetry("retry", integration, () => {
      const error = ProviderError.fromUnknown(
        context.lastError ?? "Retry requested",
        context.providerName,
        integration.adapterName,
        {
          code: "UNEXPECTED_ERROR",
          message: context.lastError ?? "Retry requested",
          retryable: true,
        },
      );
      const decision = this.retryStrategy.decide(error, context.attempt, () => new Date());
      const nextContext = new ProviderRetryContext({
        retryId: context.retryId,
        providerName: context.providerName,
        attempt: Math.min(context.maxAttempts, context.attempt + 1),
        maxAttempts: context.maxAttempts,
        nextRetryAt: decision.action === "RETRY" ? decision.retryAt.toISOString() : null,
        lastError: error.message,
        policy: context.policy,
        metadata: Object.freeze({
          ...context.metadata,
          decision: decision.action,
          delayMs: decision.action === "RETRY" ? decision.delayMs : 0,
        }),
      });
      const record = this.store.ensureRecord(integration.configuration);
      record.retries.set(nextContext.retryId, nextContext);
      this.store.publishEvent("ProviderIntegrationStatusChanged", integration.providerName, integration.adapterName, {
        retryId: nextContext.retryId,
        action: decision.action,
      });
      return nextContext;
    });
  }

  deliverBatch(contexts: readonly ProviderUploadContext[]): Promise<readonly ProviderUploadResult[]> {
    return Promise.all(contexts.map((context) => {
      const integration = this.resolveIntegration(context.providerName, context.adapterName);
      if (!integration) {
        throw new ProviderError({
          code: "NOT_FOUND",
          message: `Provider not found: ${context.providerName}`,
          provider: context.providerName,
          retryable: false,
        });
      }
      return this.upload(integration, context);
    }));
  }

  submitBatch(contexts: readonly ProviderUploadContext[]): Promise<readonly ProviderUploadResult[]> {
    return this.deliverBatch(contexts);
  }

  recordAuditTrail(providerName: string): readonly ProviderIntegrationEvent[] {
    return this.store.listEvents(providerName);
  }

  snapshotMetrics(): Readonly<Record<string, { total: number; samples: readonly RuntimeMetricSample[] }>> {
    return this.store.snapshotMetrics();
  }

  listLogs(): readonly RuntimeLogEntry[] {
    return this.store.listLogs();
  }

  recordMetric(metric: string, value: number, tags: RuntimeTags = {}): void {
    this.store.recordMetric(metric, value, tags);
  }

  observeMetric(metric: string, value: number, tags: RuntimeTags = {}): void {
    this.store.observeMetric(metric, value, tags);
  }

  setGauge(metric: string, value: number, tags: RuntimeTags = {}): void {
    this.store.setGauge(metric, value, tags);
  }

  recordLog(level: RuntimeLogLevel, message: string, context: Readonly<Record<string, unknown>> = {}): RuntimeLogEntry {
    return this.store.recordLog(level, message, context);
  }

  loadConfiguration(providerName: string): ProviderConfiguration | null {
    return this.store.loadConfiguration(providerName);
  }

  saveConfiguration(configuration: ProviderConfiguration): ProviderConfiguration {
    return this.store.saveConfiguration(configuration);
  }

  listConfigurations(): readonly ProviderConfiguration[] {
    return this.store.listConfigurations();
  }

  publishEvent(type: ProviderIntegrationEventType, providerName: string, adapterName: string, payload: Readonly<Record<string, unknown>> = {}): ProviderIntegrationEvent {
    return this.store.publishEvent(type, providerName, adapterName, payload);
  }

  listEvents(providerName?: string): readonly ProviderIntegrationEvent[] {
    return this.store.listEvents(providerName);
  }

  getEntry(providerName: string): ProviderIntegrationRegistryEntry | null {
    return this.store.getEntry(providerName);
  }

  listEntries(): readonly ProviderIntegrationRegistryEntry[] {
    return this.store.listEntries();
  }

  private computeSelectionScore(record: RuntimeProviderRecord, health: ProviderHealthSnapshot): number {
    const enabledScore = record.configuration.enabled ? 100 : 0;
    const healthScore = health.healthy ? 50 : 0;
    const priorityScore = Math.max(0, record.configuration.priority * 10);
    const credentialsScore = record.credentials ? 10 : 0;
    const sessionScore = record.session?.authenticated ? 10 : 0;
    return enabledScore + healthScore + priorityScore + credentialsScore + sessionScore;
  }

  private resolveLatestStatus(record: RuntimeProviderRecord, releaseId: string): ProviderStatusSnapshot | null {
    for (const status of [...record.statuses.values()].reverse()) {
      if (status.metadata.releaseId === releaseId || (typeof status.result?.referenceId === "string" && status.result.referenceId.includes(releaseId))) {
        return status;
      }
    }
    return record.statuses.values().next().value ?? null;
  }

  private normalizeStatusSnapshot(record: RuntimeProviderRecord, snapshot: ProviderStatusSnapshot): ProviderStatusSnapshot {
    const normalizedStatus = typeof snapshot.status === "string"
      ? new ConnectorStatus({
          connectorId: record.adapterName,
          releaseId: snapshot.snapshotId,
          status: "Processing",
          providerStatus: snapshot.status,
          observedAt: snapshot.observedAt,
          metadata: Object.freeze({
            ...snapshot.metadata,
            normalized: true,
          }),
        })
      : snapshot.status;

    return new ProviderStatusSnapshot({
      snapshotId: snapshot.snapshotId,
      providerName: snapshot.providerName,
      status: normalizedStatus,
      observedAt: snapshot.observedAt,
      healthy: snapshot.healthy,
      result: snapshot.result,
      metadata: Object.freeze({
        ...snapshot.metadata,
        normalized: true,
      }),
    });
  }

  private applySession(integration: TrackSyraDspIntegration | null, session: ProviderSession, credentials: ProviderCredentials | null): void {
    const record = this.store.getRecord(session.providerName);
    if (!record) {
      return;
    }
    const updated = this.store.ensureRecord(record.configuration);
    updated.session = session;
    updated.credentials = credentials ?? updated.credentials;
    updated.lifecycle = createLifecycle(record.providerName, record.adapterName, ProviderLifecycleStage.AUTHENTICATED, record.lifecycle.history);
    updated.updatedAt = timestamp();
    updated.healthSnapshot = createProviderHealth(updated, {
      healthy: true,
      latencyMs: 0,
      message: "Authenticated",
    });
    this.store.publishEvent("ProviderIntegrationHealthChanged", record.providerName, record.adapterName, {
      sessionId: session.sessionId,
      authenticated: true,
    });
    if (integration) {
      integration.bindSession(session, credentials);
    }
  }

  private applyCredentials(integration: TrackSyraDspIntegration | null, credentials: ProviderCredentials): void {
    const record = this.store.getRecord(credentials.providerName);
    if (!record) {
      return;
    }
    const updated = this.store.ensureRecord(record.configuration);
    updated.credentials = credentials;
    updated.updatedAt = timestamp();
    updated.healthSnapshot = createProviderHealth(updated, {
      healthy: Boolean(updated.session?.authenticated),
      latencyMs: 0,
      message: "Credentials rotated",
    });
    this.store.publishEvent("ProviderIntegrationHealthChanged", record.providerName, record.adapterName, {
      credentialId: credentials.credentialId,
    });
    if (integration) {
      integration.bindCredentials(credentials);
    }
  }

  private applyHealth(integration: TrackSyraDspIntegration | null, health: ProviderHealthSnapshot): void {
    const record = this.store.getRecord(health.providerName);
    if (!record) {
      return;
    }
    const updated = this.store.ensureRecord(record.configuration);
    updated.healthSnapshot = health;
    updated.lifecycle = createLifecycle(record.providerName, record.adapterName, health.healthy ? ProviderLifecycleStage.READY : ProviderLifecycleStage.DEGRADED, record.lifecycle.history, health.healthy ? "Healthy" : "Degraded");
    updated.updatedAt = timestamp();
    this.store.publishEvent("ProviderIntegrationHealthChanged", record.providerName, record.adapterName, {
      healthy: health.healthy,
      latencyMs: health.latencyMs,
    });
    if (integration) {
      integration.bindHealth(health);
    }
  }

  private applyLifecycle(integration: TrackSyraDspIntegration | null, lifecycle: ProviderLifecycle): void {
    const record = this.store.getRecord(lifecycle.provider);
    if (!record) {
      return;
    }
    const updated = this.store.ensureRecord(record.configuration);
    updated.lifecycle = lifecycle;
    updated.updatedAt = timestamp();
    this.store.publishEvent("ProviderIntegrationStatusChanged", record.providerName, record.adapterName, {
      lifecycleStage: lifecycle.stage,
    });
    if (integration) {
      integration.bindLifecycle(lifecycle);
    }
  }
}

export class TrackSyraDspIntegration implements ProviderIntegration {
  readonly integrationId: string;
  readonly providerName: string;
  readonly adapterName: string;
  readonly configuration: ProviderConfiguration;
  readonly adapter: ProviderAdapter;

  private sessionValue: ProviderSession | null = null;
  private credentialsValue: ProviderCredentials | null = null;
  private healthValue: ProviderHealthSnapshot | null = null;
  private lifecycleValue: ProviderLifecycle;

  constructor(private readonly runtime: TrackSyraDspRuntimeEngine, configuration: ProviderConfiguration) {
    this.configuration = Object.freeze({
      ...configuration,
      featureFlags: freezeRecord(configuration.featureFlags),
      metadata: cloneMetadata(configuration.metadata),
    }) as ProviderConfiguration;
    this.providerName = trimOrThrow(configuration.providerName, "ProviderConfiguration.providerName");
    this.adapterName = trimOrThrow(configuration.adapterName, "ProviderConfiguration.adapterName");
    this.integrationId = buildIntegrationId(
      this.providerName,
      this.adapterName,
      trimOrThrow(configuration.configurationId, "ProviderConfiguration.configurationId"),
    );
    this.adapter = Object.freeze({
      name: this.adapterName,
      version: this.adapterName,
      configuration: this.configuration,
      credentials: this.credentials,
      authenticate: () => this.authenticate(),
      refreshCredentials: () => this.refreshCredentials(),
      resolveCapabilities: () => this.resolveCapabilities(),
      upload: (context: ProviderUploadContext) => this.upload(context),
      submitMetadata: (context: ProviderUploadContext) => this.submitMetadata(context),
      createRelease: (context: ProviderUploadContext) => this.createRelease(context),
      trackStatus: (context: ProviderStatusSnapshot | ProviderUploadContext) => this.trackStatus(context),
      receiveWebhook: (event: ProviderWebhookEnvelope) => this.receiveWebhook(event),
      poll: (context: ProviderPollingResult) => this.poll(context),
      importRoyalties: (batch: ProviderRoyaltyBatch) => this.importRoyalties(batch),
      generateReports: (batch: ProviderReportBatch) => this.generateReports(batch),
      takedown: () => this.takedown(),
      health: () => this.health(),
      rateLimit: () => this.rateLimit(),
      retry: (context: ProviderRetryContext) => this.retry(context),
    });
    this.lifecycleValue = createLifecycle(this.providerName, this.adapterName, ProviderLifecycleStage.CREATED, [], "Integration created");
    this.runtime.registerIntegration(this);
  }

  get session(): ProviderSession | null {
    return this.sessionValue;
  }

  get credentials(): ProviderCredentials | null {
    return this.credentialsValue;
  }

  get lifecycle(): ProviderLifecycle {
    return this.lifecycleValue;
  }

  authenticate(): Promise<ProviderSession> | ProviderSession {
    return this.runtime.authenticateIntegration(this);
  }

  refreshCredentials(): Promise<ProviderCredentials> | ProviderCredentials {
    return this.runtime.issueCredentials(this);
  }

  select(): Promise<ProviderSelectionResult> | ProviderSelectionResult {
    return this.runtime.selectIntegrationByInstance(this);
  }

  health(): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot {
    return this.runtime.healthForIntegration(this);
  }

  resolveCapabilities(): ProviderCapabilities {
    const capabilitySet = this.runtime.resolveCapabilities(this) as ProviderCapabilitySet;
    return capabilitySet.capabilities as ProviderCapabilities;
  }

  upload(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult {
    return this.runtime.upload(this, context);
  }

  submitMetadata(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult {
    return this.runtime.submitMetadata(this, context);
  }

  createRelease(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult {
    return this.runtime.createRelease(this, context);
  }

  updateRelease(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult {
    return this.runtime.updateRelease(this, context);
  }

  trackStatus(context: ProviderStatusSnapshot | ProviderUploadContext): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    return this.runtime.trackStatus(this, context);
  }

  receiveWebhook(event: ProviderWebhookEnvelope): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    return this.runtime.receiveWebhook(this, event);
  }

  poll(context: ProviderPollingResult): Promise<ProviderPollingResult> | ProviderPollingResult {
    return this.runtime.poll(context.providerName);
  }

  importRoyalties(batch: ProviderRoyaltyBatch): Promise<ProviderRoyaltyBatch> | ProviderRoyaltyBatch {
    return this.runtime.importRoyalties(batch);
  }

  generateReports(batch: ProviderReportBatch): Promise<ProviderReportBatch> | ProviderReportBatch {
    return this.runtime.generateReports(batch);
  }

  takedown(): Promise<ProviderUploadResult> | ProviderUploadResult {
    return this.runtime.takedown(this.providerName);
  }

  rateLimit(): Promise<unknown> | unknown {
    return this.runtime.evaluateRateLimit(this.providerName);
  }

  retry(context: ProviderRetryContext): Promise<ProviderRetryContext> | ProviderRetryContext {
    return this.runtime.retry(context);
  }

  syncRelease(context: ProviderUploadContext): ProviderStatusSnapshot {
    return this.runtime.trackStatus(this, context) as ProviderStatusSnapshot;
  }

  checkStatus(context: ProviderStatusSnapshot | ProviderUploadContext): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    return this.runtime.trackStatus(this, context);
  }

  bindSession(session: ProviderSession, credentials: ProviderCredentials | null): void {
    this.sessionValue = session;
    if (credentials) {
      this.credentialsValue = credentials;
    }
  }

  bindCredentials(credentials: ProviderCredentials): void {
    this.credentialsValue = credentials;
  }

  bindHealth(health: ProviderHealthSnapshot): void {
    this.healthValue = health;
  }

  bindLifecycle(lifecycle: ProviderLifecycle): void {
    this.lifecycleValue = lifecycle;
  }
}

export class TrackSyraDspRegistry implements ProviderRegistry {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  register(integration: ProviderIntegration): void {
    this.runtime.registerIntegration(integration as TrackSyraDspIntegration);
  }

  resolve(providerName: string): ProviderIntegration | null {
    return this.runtime.resolveIntegration(providerName);
  }

  list(): readonly ProviderIntegration[] {
    return Object.freeze(this.runtime.listIntegrations());
  }
}

export class TrackSyraDspIntegrationRegistryFacade {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  register(entry: ProviderIntegrationRegistryEntry): void {
    this.runtime.registerIntegration(entry.integration as TrackSyraDspIntegration);
  }

  resolve(providerName: string): ProviderIntegration | null {
    return this.runtime.resolveIntegration(providerName);
  }

  get(providerName: string): ProviderIntegrationRegistryEntry | null {
    return this.runtime.getEntry(providerName);
  }

  list(): readonly ProviderIntegrationRegistryEntry[] {
    return this.runtime.listEntries();
  }
}

export class TrackSyraDspFactory implements ProviderFactory, ProviderIntegrationFactoryPort {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  create(configuration: ProviderConfiguration): ProviderIntegration {
    return this.runtime.createIntegration(configuration);
  }
}

export class TrackSyraDspResolver implements ProviderResolver, ProviderIntegrationResolverPort {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  resolve(providerName: string): ProviderIntegration | null {
    return this.runtime.resolveIntegration(providerName);
  }

  resolveAdapter(adapterName: string): ProviderAdapter | null {
    const integration = this.runtime.listIntegrations().find((entry) => entry.adapterName === adapterName);
    return integration?.adapter ?? null;
  }

  resolveByAdapter(adapterName: string): ProviderIntegration | null {
    return this.runtime.listIntegrations().find((entry) => entry.adapterName === adapterName) ?? null;
  }
}

export class TrackSyraDspRouter implements ProviderRouter, ProviderIntegrationRouter {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  route(providerName: string, adapterName?: string | null): ProviderIntegration | null {
    return this.runtime.resolveIntegration(providerName, adapterName ?? null);
  }
}

export class TrackSyraDspLifecycleManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  snapshot(providerName: string): ProviderLifecycle | null {
    const integration = this.runtime.resolveIntegration(providerName);
    if (!integration) return null;
    return integration.lifecycle;
  }

  create(configuration: ProviderConfiguration): ProviderLifecycle {
    const integration = (this.runtime.resolveIntegration(configuration.providerName, configuration.adapterName) ?? this.runtime.createIntegration(configuration)) as TrackSyraDspIntegration;
    return integration.lifecycle;
  }

  transition(providerName: string, stage: ProviderLifecycleStage, reason?: string | null): ProviderLifecycle {
    const integration = this.runtime.resolveIntegration(providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    const next = createLifecycle(integration.providerName, integration.adapterName, stage, integration.lifecycle.history, reason ?? null);
    integration.bindLifecycle(next);
    return next;
  }
}

export class TrackSyraDspAuthenticationManager implements AuthenticationManager, ProviderAuthenticationGateway {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  authenticate(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession {
    return this.runtime.authenticateIntegration(integration as TrackSyraDspIntegration);
  }

  refresh(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials {
    return this.runtime.refreshCredentials(integration as TrackSyraDspIntegration);
  }
}

export class TrackSyraDspSessionManager implements SessionManager, ProviderSessionGateway {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  start(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession {
    return this.runtime.startSession(integration as TrackSyraDspIntegration);
  }

  renew(session: ProviderSession): Promise<ProviderSession> | ProviderSession {
    return this.runtime.renewSession(session);
  }

  end(session: ProviderSession): Promise<boolean> | boolean {
    return this.runtime.endSession(session);
  }
}

export class TrackSyraDspCredentialManager implements CredentialManager, ProviderCredentialStore {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  issue(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials {
    return this.runtime.issueCredentials(integration as TrackSyraDspIntegration);
  }

  rotate(credentials: ProviderCredentials): Promise<ProviderCredentials> | ProviderCredentials {
    const integration = this.runtime.resolveIntegration(credentials.providerName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${credentials.providerName}`,
        provider: credentials.providerName,
        retryable: false,
      });
    }
    return this.runtime.refreshCredentials(integration);
  }

  revoke(credentials: ProviderCredentials): Promise<boolean> | boolean {
    const integration = this.runtime.resolveIntegration(credentials.providerName);
    if (!integration) {
      return false;
    }
    integration.bindCredentials(null as never);
    return true;
  }
}

export class TrackSyraDspCapabilityResolver implements CapabilityResolver, ProviderCapabilityRegistry {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  resolve(integration: ProviderIntegration): Promise<ProviderCapabilitySet> | ProviderCapabilitySet {
    const resolved = this.runtime.resolveCapabilities(integration as TrackSyraDspIntegration);
    return resolved;
  }
}

export class TrackSyraDspSelector implements ProviderSelector, ProviderSelectionService {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  select(providerName: string): Promise<ProviderSelectionResult> | ProviderSelectionResult {
    return this.runtime.selectProvider(providerName);
  }

  resolve(integration: ProviderIntegration): Promise<ProviderSelectionResult> | ProviderSelectionResult {
    return this.runtime.selectIntegrationByInstance(integration as TrackSyraDspIntegration);
  }
}

export class TrackSyraDspHealthManager implements HealthManager, ProviderHealthManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  check(integration: ProviderIntegration): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot {
    return this.runtime.healthForIntegration(integration as TrackSyraDspIntegration);
  }

  snapshot(providerName: string): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot {
    return this.runtime.snapshotHealth(providerName);
  }
}

export class TrackSyraDspUploadManager implements UploadManager, ProviderUploadManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  upload(context: ProviderUploadContext, integration?: TrackSyraDspIntegration): Promise<ProviderUploadResult> | ProviderUploadResult {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.upload(resolved, context);
  }
}

export class TrackSyraDspAssetManager implements ProviderAssetManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  uploadAssets(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult {
    const integration = this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!integration) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.upload(integration, context);
  }
}

export class TrackSyraDspMetadataManager implements MetadataManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  submitMetadata(context: ProviderUploadContext, integration?: TrackSyraDspIntegration): Promise<ProviderUploadResult> | ProviderUploadResult {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.submitMetadata(resolved, context);
  }
}

export class TrackSyraDspCatalogManager implements CatalogManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  createRelease(context: ProviderUploadContext, integration?: TrackSyraDspIntegration): Promise<ProviderUploadResult> | ProviderUploadResult {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.createRelease(resolved, context);
  }

  updateRelease(context: ProviderUploadContext, integration?: TrackSyraDspIntegration): Promise<ProviderUploadResult> | ProviderUploadResult {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.updateRelease(resolved, context);
  }
}

export class TrackSyraDspStatusManager implements StatusManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  trackStatus(context: ProviderStatusSnapshot | ProviderUploadContext, integration?: TrackSyraDspIntegration): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, "adapterName" in context ? context.adapterName : null);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.trackStatus(resolved, context);
  }

  reconcile(snapshot: ProviderStatusSnapshot): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    const integration = this.runtime.resolveIntegration(snapshot.providerName);
    if (!integration) {
      return snapshot;
    }
    return this.runtime.reconcileStatus(integration, snapshot);
  }

  syncRelease(context: ProviderUploadContext, integration?: TrackSyraDspIntegration): ProviderStatusSnapshot {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.trackStatus(resolved, context) as ProviderStatusSnapshot;
  }
}

export class TrackSyraDspWebhookManager implements WebhookManager, ProviderWebhookManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  receiveWebhook(event: ProviderWebhookEnvelope, integration?: TrackSyraDspIntegration): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot {
    const resolved = integration ?? this.runtime.resolveIntegration(event.providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${event.providerName}`,
        provider: event.providerName,
        retryable: false,
      });
    }
    return this.runtime.receiveWebhook(resolved, event);
  }
}

export class TrackSyraDspPollingManager implements PollingManager, ProviderPollingManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  poll(providerName: string, integration?: TrackSyraDspIntegration): Promise<ProviderPollingResult> | ProviderPollingResult {
    const resolved = integration ?? this.runtime.resolveIntegration(providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    return this.runtime.poll(resolved.providerName);
  }
}

export class TrackSyraDspRoyaltyManager implements RoyaltyManager, ProviderRoyaltyManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  importRoyalties(batch: ProviderRoyaltyBatch, integration?: TrackSyraDspIntegration): Promise<ProviderRoyaltyBatch> | ProviderRoyaltyBatch {
    const resolved = integration ?? this.runtime.resolveIntegration(batch.providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${batch.providerName}`,
        provider: batch.providerName,
        retryable: false,
      });
    }
    return this.runtime.importRoyalties(batch);
  }
}

export class TrackSyraDspReportManager implements ReportManager, ProviderReportManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  generateReports(batch: ProviderReportBatch, integration?: TrackSyraDspIntegration): Promise<ProviderReportBatch> | ProviderReportBatch {
    const resolved = integration ?? this.runtime.resolveIntegration(batch.providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${batch.providerName}`,
        provider: batch.providerName,
        retryable: false,
      });
    }
    return this.runtime.generateReports(batch);
  }
}

export class TrackSyraDspTakedownManager implements TakedownManager, ProviderTakedownManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  takedown(providerName: string, integration?: TrackSyraDspIntegration): Promise<ProviderUploadResult> | ProviderUploadResult {
    const resolved = integration ?? this.runtime.resolveIntegration(providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
        retryable: false,
      });
    }
    return this.runtime.takedown(resolved.providerName);
  }
}

export class TrackSyraDspRateLimitManager implements RateLimitManager, ProviderRateLimitManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  evaluate(providerName: string): Promise<unknown> | unknown {
    return this.runtime.evaluateRateLimit(providerName);
  }
}

export class TrackSyraDspRetryManager implements RetryManager, ProviderRetryManager {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  retry(context: ProviderRetryContext, integration?: TrackSyraDspIntegration): Promise<ProviderRetryContext> | ProviderRetryContext {
    const resolved = integration ?? this.runtime.resolveIntegration(context.providerName);
    if (!resolved) {
      throw new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${context.providerName}`,
        provider: context.providerName,
        retryable: false,
      });
    }
    return this.runtime.retry(context);
  }
}

export class TrackSyraDspMetricsCollector implements MetricsCollector, ProviderIntegrationMetrics {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  increment(metric: string, value = 1, tags: RuntimeTags = {}): void {
    this.runtime.recordMetric(metric, value, tags);
  }

  observe(metric: string, value: number, tags: RuntimeTags = {}): void {
    this.runtime.observeMetric(metric, value, tags);
  }

  gauge(metric: string, value: number, tags: RuntimeTags = {}): void {
    this.runtime.setGauge(metric, value, tags);
  }
}

export class TrackSyraDspLogger implements ProviderIntegrationLogger {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.recordLog("debug", message, context ?? {});
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.recordLog("info", message, context ?? {});
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.recordLog("warn", message, context ?? {});
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.recordLog("error", message, context ?? {});
  }
}

export class TrackSyraDspConfigurationProvider implements ConfigurationProvider, ProviderIntegrationConfigurationProvider {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  load(providerName: string): Promise<ProviderConfiguration | null> | ProviderConfiguration | null {
    return this.runtime.loadConfiguration(providerName);
  }

  save(configuration: ProviderConfiguration): Promise<void> | void {
    this.runtime.saveConfiguration(configuration);
  }

  list(): Promise<readonly ProviderConfiguration[]> | readonly ProviderConfiguration[] {
    return this.runtime.listConfigurations();
  }
}

export class TrackSyraDspEventPublisher {
  constructor(private readonly runtime: TrackSyraDspRuntimeEngine) {}

  publish(type: ProviderIntegrationEventType, providerName: string, adapterName: string, payload: Readonly<Record<string, unknown>> = {}): ProviderIntegrationEvent {
    return this.runtime.publishEvent(type, providerName, adapterName, payload);
  }

  list(providerName?: string): readonly ProviderIntegrationEvent[] {
    return this.runtime.listEvents(providerName);
  }
}
