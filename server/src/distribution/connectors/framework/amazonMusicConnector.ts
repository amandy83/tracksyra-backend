import { ConnectorConfiguration } from "../configuration/connectorConfiguration";
import { ConnectorContext } from "../context/connectorContext";
import { ConnectorError } from "../errors/connectorError";
import type { ConnectorFactory } from "../contracts/connectorContracts";
import type { Logger } from "../../observability/contracts/observabilityContracts";
import type { Release } from "../../domain";
import type { ReleaseDeliveryBuildOptions } from "../../core/releaseDeliveryEngine";
import type {
  DSPAuthentication,
  DSPCapabilities,
  DSPConnectorCapabilityReport,
  DSPConnectorHealthReport,
  DSPDeliveryErrorReport,
  DSPDeliveryJob,
  DSPDeliveryPackage,
  DSPDeliveryReport,
  DSPDeliveryResult,
  DSPHealthCheck,
  DSPHealthSnapshot,
  DSPMetadataTransformer,
  DSPNormalizedAudio,
  DSPNormalizedArtwork,
  DSPNormalizedMetadata,
  DSPPackageBuilder,
  DSPRetryPolicy,
  DSPStatusSnapshot,
  DSPStatusProvider,
  DSPWebhookHandler,
  DSPWebhookEvent,
} from "./connectorFrameworkTypes";
import { DSPConnectorShell, type DSPConnectorDependencies } from "./spotifyConnector";
import { createConnectorCapabilityMatrix } from "./connectorCapabilityMatrix";
import { ConnectorRetry } from "../retry/connectorRetry";

export type AmazonMusicConnectorConfiguration = Readonly<{
  apiVersion: string;
  ingestionBaseUrl: string | null;
  oauthAuthorizeUrl: string | null;
  oauthTokenUrl: string | null;
  deliveryEndpointUrl?: string | null;
  statusEndpointUrl?: string | null;
  withdrawalEndpointUrl?: string | null;
  restoreEndpointUrl?: string | null;
  healthEndpointUrl?: string | null;
  requestTimeoutMs?: number | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  clientId: string | null;
  clientSecret: string | null;
  scopes: readonly string[];
  sandboxMode: boolean;
}>;

export type AmazonMusicConnectorDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: ReleaseDeliveryEngineLike;
  capabilityMatrix: Readonly<Record<string, DSPCapabilities>>;
  logger: Logger | null;
  retryPolicy: DSPRetryPolicy;
  configuration: AmazonMusicConnectorConfiguration;
  fetchImpl?: typeof fetch;
}>;

interface ReleaseDeliveryEngineLike {
  validateRelease(release: Release): unknown;
  buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

type MutableAmazonMusicConnector = AmazonMusicConnector & {
  readonly capabilities: DSPCapabilities;
  readonly configuration: ConnectorContext["configuration"];
  readonly connectorId: string;
  readonly version: string;
};

type AmazonEnterpriseDependencies = Readonly<{
  connector: AmazonMusicConnector;
  logger?: Logger | null;
  clock?: () => string;
}>;

type AmazonAuditRecord = Readonly<{
  auditId: string;
  reportType: string;
  recordedAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

function nowIso(clock?: () => string): string {
  return typeof clock === "function" ? clock() : new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedList(values: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}

function releaseMetadata(release: DSPDeliveryJob["release"] | null) {
  return release ? (release.metadata ?? {}) as Record<string, unknown> : {};
}

function buildContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, connector: MutableAmazonMusicConnector): ConnectorContext {
  return new ConnectorContext({
    connectorId: connector.connectorId,
    connectorVersion: connector.version ?? "1.0.0",
    releaseId: job.releaseId,
    executionId: `${job.jobId}:${connector.connectorId}`,
    providerReference: job.target.endpointUrl ?? `${connector.connectorId}:${packageModel.packageId}`,
    configuration: connector.configuration,
    metadata: freeze({
      jobId: job.jobId,
      packageId: packageModel.packageId,
      releaseId: job.releaseId,
      connectorId: connector.connectorId,
      connectorVersion: connector.version,
      ...job.metadata,
      ...job.target.metadata,
    }),
    attributes: freeze({
      targetTerritoryCount: job.target.territories.length,
      scheduledFor: job.scheduledFor ? String(job.scheduledFor) : null,
    }),
  });
}

function normalizeContributorSummary(release: DSPDeliveryJob["release"] | null) {
  const contributors = new Map<string, readonly string[]>();
  const add = (name: string | null | undefined, role: string) => {
    const contributorName = safeText(name);
    if (!contributorName) return;
    const current = contributors.get(contributorName) ?? [];
    if (!current.includes(role)) contributors.set(contributorName, Object.freeze([...current, role]));
  };

  if (!release) return Object.freeze([] as readonly { name: string; roles: readonly string[] }[]);
  add(release.primaryArtist, "primary_artist");
  for (const contributor of release.contributors ?? []) {
    for (const role of contributor.roles ?? []) add(contributor.name, role);
  }
  for (const track of release.tracks ?? []) {
    for (const contributor of track.contributors ?? []) {
      for (const role of contributor.roles ?? []) add(contributor.name, role);
    }
  }

  return Object.freeze([...contributors.entries()].map(([name, roles]) => Object.freeze({ name, roles })));
}

function normalizeParentalAdvisory(value: unknown): string {
  const text = safeText(value);
  if (!text) return "none";
  const lowered = text.toLowerCase();
  return lowered === "explicit" || lowered === "clean" || lowered === "none" ? lowered : "none";
}

function contentReferenceList(release: Release | null, job: DSPDeliveryJob) {
  const metadata = release ? releaseMetadata(release) : {};
  const references = [
    safeText(metadata.referenceAudioUrl ?? metadata.amazonReferenceAudioUrl ?? null),
    safeText(metadata.referenceVideoUrl ?? metadata.amazonReferenceVideoUrl ?? null),
    safeText(metadata.amazonDeliveryReferenceUrl ?? null),
    safeText(job.target.endpointUrl ?? null),
  ].filter((value): value is string => Boolean(value));
  return Object.freeze([...new Set(references)]);
}

function buildReferenceAssetPayload(job: DSPDeliveryJob) {
  const release = job.release;
  const metadata = release ? releaseMetadata(release) : {};
  const track = release?.tracks[0] ?? null;
  return Object.freeze({
    releaseId: job.releaseId,
    referenceAssets: Object.freeze([
      Object.freeze({
        assetId: `${job.target.connectorId}:${job.releaseId}:reference-audio`,
        kind: "reference_audio",
        url: safeText(metadata.referenceAudioUrl ?? metadata.amazonReferenceAudioUrl ?? track?.audioReference ?? null),
        fingerprint: safeText(metadata.referenceAudioFingerprint ?? track?.audioChecksum ?? null),
      }),
      Object.freeze({
        assetId: `${job.target.connectorId}:${job.releaseId}:reference-video`,
        kind: "reference_video",
        url: safeText(metadata.referenceVideoUrl ?? metadata.amazonReferenceVideoUrl ?? null),
        fingerprint: safeText(metadata.referenceVideoFingerprint ?? null),
      }),
    ]),
    ownershipTerritories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
  });
}

function buildAmazonMetadata(job: DSPDeliveryJob) {
  const release = job.release;
  const metadata = release ? releaseMetadata(release) : {};
  const trackMetadata = (release?.tracks[0]?.metadata ?? {}) as Record<string, unknown>;
  return Object.freeze({
    reportId: `amazon-music-metadata:${job.releaseId}`,
    connectorId: job.target.connectorId,
    releaseId: job.releaseId,
    generatedAt: nowIso(),
    releaseTitle: release?.title ?? null,
    primaryArtist: release?.primaryArtist ?? null,
    label: release?.label ?? null,
    language: safeText(metadata.language ?? null),
    genre: safeText(metadata.genre ?? null),
    territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
    contributors: normalizeContributorSummary(release ?? null),
    parentalAdvisory: normalizeParentalAdvisory(metadata.parentalAdvisory ?? trackMetadata.parentalAdvisory ?? null),
    rightsOwned: Boolean(metadata.rightsOwned ?? false),
    amazonArtistId: safeText(metadata.amazonArtistId ?? metadata.amazonMusicArtistId ?? null),
    amazonCatalogId: safeText(metadata.amazonCatalogId ?? metadata.amazonMusicCatalogId ?? null),
    releaseWindow: safeText(metadata.amazonReleaseWindow ?? null),
    referenceUrls: contentReferenceList(release ?? null, job),
  });
}

export class AmazonMusicConnector extends DSPConnectorShell {
  constructor(dependencies: DSPConnectorDependencies) {
    super(dependencies, "AmazonMusic");
  }
}

export class AmazonMusicAuthentication {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  async authenticate(job: DSPDeliveryJob) {
    const packageModel = await this.dependencies.connector.buildPackage(job);
    const context = buildContext(job, packageModel, this.dependencies.connector as MutableAmazonMusicConnector);
    return this.dependencies.connector.authenticate(context);
  }
}

export class AmazonMusicPackageBuilder {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  build(job: DSPDeliveryJob) {
    return this.dependencies.connector.buildPackage(job);
  }
}

export class AmazonMusicMetadataNormalizer {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    return this.dependencies.connector.normalizeMetadata(job);
  }
}

export class AmazonMusicArtworkNormalizer {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    return this.dependencies.connector.normalizeArtwork(job);
  }
}

export class AmazonMusicAudioNormalizer {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    return this.dependencies.connector.normalizeAudio(job);
  }
}

export class AmazonMusicDeliveryService {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.dependencies.connector.deliver(job);
  }
}

export class AmazonMusicPollingService {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  poll(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.dependencies.connector.pollStatus(job);
  }
}

export class AmazonMusicWebhookService {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  validate(event: DSPWebhookEvent): boolean | Promise<boolean> {
    return this.dependencies.connector.validateWebhook(event);
  }

  parse(event: DSPWebhookEvent): DSPWebhookEvent | Promise<DSPWebhookEvent> {
    return this.dependencies.connector.parseWebhook(event);
  }

  async handle(event: DSPWebhookEvent): Promise<{ valid: boolean; event: DSPWebhookEvent; audit: AmazonAuditRecord | null }> {
    const valid = await Promise.resolve(this.validate(event));
    const parsed = await Promise.resolve(this.parse(event));
    const audit = new AmazonMusicDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
    return { valid, event: parsed, audit };
  }
}

export class AmazonMusicWithdrawalService {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  withdraw(job: DSPDeliveryJob) {
    return this.dependencies.connector.withdraw(job);
  }
}

export class AmazonMusicRestoreService {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  restore(job: DSPDeliveryJob) {
    return this.dependencies.connector.restore(job);
  }
}

export class AmazonMusicRetryPolicy {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.connector.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.connector.nextRetryAt(error, attempt, job);
  }
}

export class AmazonMusicHealthCheck {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.dependencies.connector.healthCheck(job);
  }
}

export class AmazonMusicCapabilityResolver {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  resolve(connectorId = "AmazonMusic"): DSPCapabilities {
    void connectorId;
    return (this.dependencies.connector as MutableAmazonMusicConnector).capabilities;
  }
}

export class AmazonMusicErrorTranslator {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  translate(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">): ConnectorError {
    if (error instanceof ConnectorError) return error;
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Amazon Music operation failed";
    const stack = error instanceof Error ? error.stack ?? null : null;
    const lowered = message.toLowerCase();
    const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
    const code =
      /auth|unauthoriz|forbidden|token/i.test(message) ? "AMAZON_MUSIC_AUTH_FAILED"
        : /webhook|signature/i.test(message) ? "AMAZON_MUSIC_WEBHOOK_INVALID"
        : /withdraw/i.test(message) ? "AMAZON_MUSIC_WITHDRAWAL_FAILED"
        : /restore/i.test(message) ? "AMAZON_MUSIC_RESTORE_FAILED"
        : /health/i.test(message) ? "AMAZON_MUSIC_HEALTH_CHECK_FAILED"
        : retryable ? "AMAZON_MUSIC_RETRYABLE_ERROR"
        : "AMAZON_MUSIC_OPERATION_FAILED";

    return new ConnectorError({
      connectorId: "AmazonMusic",
      code,
      message,
      retryable,
      metadata: freeze({
        connectorId: "AmazonMusic",
        releaseId: job.releaseId,
        jobId: job.jobId,
        target: job.target.partnerName,
        stack,
      }),
    });
  }
}

export class AmazonMusicDeliveryAudit {
  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {}

  record(reportType: string, payload: Readonly<Record<string, unknown>>): AmazonAuditRecord {
    const audit = Object.freeze({
      auditId: `amazon-music:${reportType}:${nowIso(this.dependencies.clock)}`,
      reportType,
      recordedAt: nowIso(this.dependencies.clock),
      payload: freeze({ ...payload }),
    });
    this.dependencies.logger?.info?.("amazon music audit record generated", { component: "amazon-music-connector", reportType, payload: audit.payload });
    return audit;
  }

  recordWebhook(event: DSPWebhookEvent, valid: boolean): AmazonAuditRecord {
    return this.record("webhook", {
      webhookId: event.webhookId,
      connectorId: event.connectorId,
      releaseId: event.releaseId,
      eventType: event.eventType,
      receivedAt: event.receivedAt,
      valid,
    });
  }

  buildDeliveryReport(job: DSPDeliveryJob, result: DSPDeliveryResult): DSPDeliveryReport {
    const resultPackageId = typeof result.metadata.packageId === "string" ? result.metadata.packageId : null;
    return Object.freeze({
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      generatedAt: nowIso(this.dependencies.clock),
      packageId: job.packageModel?.packageId ?? resultPackageId,
      connectorStatus: result.connectorStatus,
      success: result.success,
      errors: result.errors,
      warnings: result.warnings,
      metadata: freeze({
        target: job.target.partnerName,
        connectorVersion: job.target.connectorVersion,
        receipt: result.receipt,
      }),
    });
  }

  buildHealthReport(connectorId: string, health: DSPHealthSnapshot): DSPConnectorHealthReport {
    return Object.freeze({
      connectorId,
      generatedAt: nowIso(this.dependencies.clock),
      healthy: health.healthy,
      latencyMs: health.latencyMs,
      details: freeze({
        ...health.details,
        checkedAt: health.checkedAt,
      }),
    });
  }

  buildCapabilityReport(connectorId: string): DSPConnectorCapabilityReport {
    const capabilities = (this.dependencies.connector as MutableAmazonMusicConnector).capabilities;
    return Object.freeze({
      connectorId,
      generatedAt: nowIso(this.dependencies.clock),
      capabilities,
    });
  }

  buildErrorReport(job: DSPDeliveryJob, errors: readonly string[]): DSPDeliveryErrorReport {
    return Object.freeze({
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      generatedAt: nowIso(this.dependencies.clock),
      errors: Object.freeze([...errors]),
      metadata: freeze({
        packageId: job.packageModel?.packageId ?? null,
        target: job.target.partnerName,
      }),
    });
  }

  buildMetadataReport(job: DSPDeliveryJob): Readonly<Record<string, unknown>> {
    const release = this.requireRelease(job);
    return buildAmazonMetadata({ ...job, release });
  }

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new ConnectorError({
        connectorId: "AmazonMusic",
        code: "AMAZON_MUSIC_RELEASE_REQUIRED",
        message: "Amazon Music delivery requires a release payload.",
        retryable: false,
        metadata: freeze({
          releaseId: job.releaseId,
          jobId: job.jobId,
        }),
      });
    }
    return job.release;
  }
}

export class AmazonMusicEnterpriseService {
  readonly authentication: AmazonMusicAuthentication;
  readonly packageBuilder: AmazonMusicPackageBuilder;
  readonly metadataNormalizer: AmazonMusicMetadataNormalizer;
  readonly artworkNormalizer: AmazonMusicArtworkNormalizer;
  readonly audioNormalizer: AmazonMusicAudioNormalizer;
  readonly deliveryService: AmazonMusicDeliveryService;
  readonly pollingService: AmazonMusicPollingService;
  readonly webhookService: AmazonMusicWebhookService;
  readonly withdrawalService: AmazonMusicWithdrawalService;
  readonly restoreService: AmazonMusicRestoreService;
  readonly retryPolicy: AmazonMusicRetryPolicy;
  readonly healthChecker: AmazonMusicHealthCheck;
  readonly capabilityResolver: AmazonMusicCapabilityResolver;
  readonly errorTranslator: AmazonMusicErrorTranslator;
  readonly deliveryAudit: AmazonMusicDeliveryAudit;

  constructor(private readonly dependencies: AmazonEnterpriseDependencies) {
    this.authentication = new AmazonMusicAuthentication(dependencies);
    this.packageBuilder = new AmazonMusicPackageBuilder(dependencies);
    this.metadataNormalizer = new AmazonMusicMetadataNormalizer(dependencies);
    this.artworkNormalizer = new AmazonMusicArtworkNormalizer(dependencies);
    this.audioNormalizer = new AmazonMusicAudioNormalizer(dependencies);
    this.deliveryService = new AmazonMusicDeliveryService(dependencies);
    this.pollingService = new AmazonMusicPollingService(dependencies);
    this.webhookService = new AmazonMusicWebhookService(dependencies);
    this.withdrawalService = new AmazonMusicWithdrawalService(dependencies);
    this.restoreService = new AmazonMusicRestoreService(dependencies);
    this.retryPolicy = new AmazonMusicRetryPolicy(dependencies);
    this.healthChecker = new AmazonMusicHealthCheck(dependencies);
    this.capabilityResolver = new AmazonMusicCapabilityResolver(dependencies);
    this.errorTranslator = new AmazonMusicErrorTranslator(dependencies);
    this.deliveryAudit = new AmazonMusicDeliveryAudit(dependencies);
  }

  authenticate(job: DSPDeliveryJob) { return this.authentication.authenticate(job); }
  buildPackage(job: DSPDeliveryJob) { return this.packageBuilder.build(job); }
  normalizeMetadata(job: DSPDeliveryJob) { return this.metadataNormalizer.normalize(job); }
  normalizeArtwork(job: DSPDeliveryJob) { return this.artworkNormalizer.normalize(job); }
  normalizeAudio(job: DSPDeliveryJob) { return this.audioNormalizer.normalize(job); }
  deliver(job: DSPDeliveryJob) { return this.deliveryService.deliver(job); }
  pollStatus(job: DSPDeliveryJob) { return this.pollingService.poll(job); }
  withdraw(job: DSPDeliveryJob) { return this.withdrawalService.withdraw(job); }
  restore(job: DSPDeliveryJob) { return this.restoreService.restore(job); }

  retry(error: unknown, attempt: number, job: DSPDeliveryJob): ConnectorRetry {
    const shouldRetry = this.retryPolicy.shouldRetry(error, attempt, job);
    return Object.freeze({
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      retryCount: shouldRetry ? attempt + 1 : attempt,
      lastAttemptAt: nowIso(this.dependencies.clock),
      nextAttemptAt: this.retryPolicy.nextRetryAt(error, attempt, job),
      metadata: freeze({
        connectorId: job.target.connectorId,
        releaseId: job.releaseId,
        retryable: shouldRetry,
      }),
    }) as ConnectorRetry;
  }

  healthCheck(job: DSPDeliveryJob) { return this.healthChecker.healthCheck(job); }
  translateError(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">) { return this.errorTranslator.translate(error, job); }
  resolveCapabilities(connectorId = "AmazonMusic") { return this.capabilityResolver.resolve(connectorId); }
  validateWebhook(event: DSPWebhookEvent) { return this.webhookService.validate(event); }
  parseWebhook(event: DSPWebhookEvent) { return this.webhookService.parse(event); }
  handleWebhook(event: DSPWebhookEvent) { return this.webhookService.handle(event); }
  generateDeliveryReport(job: DSPDeliveryJob, result: DSPDeliveryResult) { return this.deliveryAudit.buildDeliveryReport(job, result); }
  generateHealthReport(connectorId: string, health: DSPHealthSnapshot) { return this.deliveryAudit.buildHealthReport(connectorId, health); }
  generateCapabilityReport(connectorId: string) { return this.deliveryAudit.buildCapabilityReport(connectorId); }
  generateMetadataReport(job: DSPDeliveryJob) { return this.deliveryAudit.buildMetadataReport(job); }
  generateErrorReport(job: DSPDeliveryJob, errors: readonly string[]) { return this.deliveryAudit.buildErrorReport(job, errors); }
}

export function createAmazonMusicConnectorFrameworkDefaults() {
  return createConnectorCapabilityMatrix();
}
