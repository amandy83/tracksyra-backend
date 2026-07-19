import { ConnectorConfiguration } from "../configuration/connectorConfiguration";
import { ConnectorContext } from "../context/connectorContext";
import { ConnectorError } from "../errors/connectorError";
import { ConnectorWebhook } from "../webhooks/connectorWebhook";
import type { ConnectorFactory } from "../contracts/connectorContracts";
import type { Logger } from "../../observability/contracts/observabilityContracts";
import type { Release } from "../../domain";
import type { ReleaseDeliveryBuildOptions, ReleaseDeliveryEngine } from "../../core/releaseDeliveryEngine";
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
import { ConnectorMetadata } from "../metadata/connectorMetadata";
import { ConnectorTakedown } from "../takedown/connectorTakedown";
import { ConnectorRetry } from "../retry/connectorRetry";

export type YouTubeMusicConnectorConfiguration = Readonly<{
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

export type YouTubeMusicConnectorDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: ReleaseDeliveryEngineLike;
  capabilityMatrix: Readonly<Record<string, DSPCapabilities>>;
  logger: Logger | null;
  retryPolicy: DSPRetryPolicy;
  configuration: YouTubeMusicConnectorConfiguration;
  fetchImpl?: typeof fetch;
}>;

interface ReleaseDeliveryEngineLike {
  validateRelease(release: Release): unknown;
  buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

type MutableYouTubeMusicConnector = YouTubeMusicConnector & {
  readonly capabilities: DSPCapabilities;
  readonly configuration: ConnectorContext["configuration"];
  readonly connectorId: string;
  readonly version: string;
};

type YouTubeEnterpriseDependencies = Readonly<{
  connector: YouTubeMusicConnector;
  logger?: Logger | null;
  clock?: () => string;
}>;

type YouTubeAuditRecord = Readonly<{
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

function buildContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, connector: MutableYouTubeMusicConnector): ConnectorContext {
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

function contentIdReferenceList(release: Release | null, job: DSPDeliveryJob) {
  const metadata = release ? releaseMetadata(release) : {};
  const references = [
    safeText(metadata.referenceAudioUrl ?? metadata.youtubeReferenceAudioUrl ?? null),
    safeText(metadata.referenceVideoUrl ?? metadata.youtubeReferenceVideoUrl ?? null),
    safeText(metadata.youtubeContentIdReferenceUrl ?? null),
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
    contentIdEnabled: Boolean(metadata.contentIdEnabled ?? metadata.youtubeContentIdEnabled ?? true),
    referenceAssets: Object.freeze([
      Object.freeze({
        assetId: `${job.target.connectorId}:${job.releaseId}:reference-audio`,
        kind: "reference_audio",
        url: safeText(metadata.referenceAudioUrl ?? metadata.youtubeReferenceAudioUrl ?? track?.audioReference ?? null),
        fingerprint: safeText(metadata.referenceAudioFingerprint ?? track?.audioChecksum ?? null),
      }),
      Object.freeze({
        assetId: `${job.target.connectorId}:${job.releaseId}:reference-video`,
        kind: "reference_video",
        url: safeText(metadata.referenceVideoUrl ?? metadata.youtubeReferenceVideoUrl ?? null),
        fingerprint: safeText(metadata.referenceVideoFingerprint ?? null),
      }),
    ]),
    ownershipTerritories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
    contentClaims: Object.freeze([
      Object.freeze({
        claimId: safeText(metadata.youtubeClaimId ?? null),
        policyId: safeText(metadata.youtubePolicyId ?? null),
        status: safeText(metadata.youtubeClaimStatus ?? null) ?? "unknown",
      }),
    ]),
    policyAssignments: Object.freeze([
      Object.freeze({
        policyId: safeText(metadata.youtubePolicyId ?? null),
        territoryCount: job.target.territories.length,
      }),
    ]),
    assetRelationships: Object.freeze([
      Object.freeze({
        parentAssetId: safeText(metadata.youtubeParentAssetId ?? null),
        childAssetId: safeText(metadata.youtubeChildAssetId ?? null),
        relationshipType: safeText(metadata.youtubeAssetRelationshipType ?? null) ?? "reference",
      }),
    ]),
    assetUpdates: Object.freeze([
      Object.freeze({
        assetId: safeText(metadata.youtubeAssetId ?? null),
        updateType: safeText(metadata.youtubeAssetUpdateType ?? null) ?? "metadata_sync",
      }),
    ]),
    withdrawals: Object.freeze([
      Object.freeze({
        withdrawalId: safeText(metadata.youtubeWithdrawalId ?? null),
        status: safeText(metadata.youtubeWithdrawalStatus ?? null) ?? "not-requested",
      }),
    ]),
    restores: Object.freeze([
      Object.freeze({
        restoreId: safeText(metadata.youtubeRestoreId ?? null),
        status: safeText(metadata.youtubeRestoreStatus ?? null) ?? "not-requested",
      }),
    ]),
  });
}

function buildContentIdMetadata(job: DSPDeliveryJob) {
  const release = job.release;
  const metadata = release ? releaseMetadata(release) : {};
  return Object.freeze({
    releaseId: job.releaseId,
    channelId: safeText(metadata.youtubeChannelId ?? metadata.contentIdChannelId ?? null),
    assetId: safeText(metadata.youtubeAssetId ?? null),
    claimId: safeText(metadata.youtubeClaimId ?? null),
    policyId: safeText(metadata.youtubePolicyId ?? null),
    referenceUrls: contentIdReferenceList(release, job),
    territories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
  });
}

export class YouTubeMusicConnector extends DSPConnectorShell {
  constructor(dependencies: DSPConnectorDependencies) {
    super(dependencies, "YouTubeMusic");
  }
}

export class YouTubeAuthentication {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  async authenticate(job: DSPDeliveryJob) {
    const packageModel = await this.dependencies.connector.buildPackage(job);
    const context = buildContext(job, packageModel, this.dependencies.connector as MutableYouTubeMusicConnector);
    return this.dependencies.connector.authenticate(context);
  }
}

export class YouTubePackageBuilder {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  build(job: DSPDeliveryJob) {
    return this.dependencies.connector.buildPackage(job);
  }
}

export class YouTubeMetadataNormalizer {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    return this.dependencies.connector.normalizeMetadata(job);
  }
}

export class YouTubeArtworkNormalizer {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    return this.dependencies.connector.normalizeArtwork(job);
  }
}

export class YouTubeAudioNormalizer {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    return this.dependencies.connector.normalizeAudio(job);
  }
}

export class YouTubeDeliveryService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.dependencies.connector.deliver(job);
  }
}

export class YouTubePollingService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  poll(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.dependencies.connector.pollStatus(job);
  }
}

export class YouTubeWebhookService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  validate(event: DSPWebhookEvent): boolean | Promise<boolean> {
    return this.dependencies.connector.validateWebhook(event);
  }

  parse(event: DSPWebhookEvent): DSPWebhookEvent | Promise<DSPWebhookEvent> {
    return this.dependencies.connector.parseWebhook(event);
  }

  async handle(event: DSPWebhookEvent): Promise<{ valid: boolean; event: DSPWebhookEvent; audit: YouTubeAuditRecord | null }> {
    const valid = await Promise.resolve(this.validate(event));
    const parsed = await Promise.resolve(this.parse(event));
    const audit = new YouTubeDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
    return { valid, event: parsed, audit };
  }
}

export class YouTubeWithdrawalService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  withdraw(job: DSPDeliveryJob) {
    return this.dependencies.connector.withdraw(job);
  }
}

export class YouTubeRestoreService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  restore(job: DSPDeliveryJob) {
    return this.dependencies.connector.restore(job);
  }
}

export class YouTubeRetryPolicy {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.connector.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.connector.nextRetryAt(error, attempt, job);
  }
}

export class YouTubeHealthCheck {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.dependencies.connector.healthCheck(job);
  }
}

export class YouTubeCapabilityResolver {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  resolve(connectorId = "YouTubeMusic"): DSPCapabilities {
    void connectorId;
    return (this.dependencies.connector as MutableYouTubeMusicConnector).capabilities;
  }
}

export class YouTubeErrorTranslator {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  translate(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">): ConnectorError {
    if (error instanceof ConnectorError) return error;
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "YouTube Music operation failed";
    const stack = error instanceof Error ? error.stack ?? null : null;
    const lowered = message.toLowerCase();
    const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
    const code =
      /auth|unauthoriz|forbidden|token/i.test(message) ? "YOUTUBE_MUSIC_AUTH_FAILED"
        : /webhook|signature/i.test(message) ? "YOUTUBE_MUSIC_WEBHOOK_INVALID"
        : /content id|claim/i.test(message) ? "YOUTUBE_MUSIC_CONTENT_ID_FAILED"
        : /withdraw/i.test(message) ? "YOUTUBE_MUSIC_WITHDRAWAL_FAILED"
        : /restore/i.test(message) ? "YOUTUBE_MUSIC_RESTORE_FAILED"
        : /health/i.test(message) ? "YOUTUBE_MUSIC_HEALTH_CHECK_FAILED"
        : retryable ? "YOUTUBE_MUSIC_RETRYABLE_ERROR"
        : "YOUTUBE_MUSIC_OPERATION_FAILED";

    return new ConnectorError({
      connectorId: "YouTubeMusic",
      code,
      message,
      retryable,
      metadata: freeze({
        connectorId: "YouTubeMusic",
        releaseId: job.releaseId,
        jobId: job.jobId,
        target: job.target.partnerName,
        stack,
      }),
    });
  }
}

export class YouTubeDeliveryAudit {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  record(reportType: string, payload: Readonly<Record<string, unknown>>): YouTubeAuditRecord {
    const audit = Object.freeze({
      auditId: `youtube-music:${reportType}:${nowIso(this.dependencies.clock)}`,
      reportType,
      recordedAt: nowIso(this.dependencies.clock),
      payload: freeze({ ...payload }),
    });
    this.dependencies.logger?.info?.("youtube music audit record generated", { component: "youtube-music-connector", reportType, payload: audit.payload });
    return audit;
  }

  recordWebhook(event: DSPWebhookEvent, valid: boolean): YouTubeAuditRecord {
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
    const capabilities = (this.dependencies.connector as MutableYouTubeMusicConnector).capabilities;
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
    const metadata = releaseMetadata(release);
    const trackMetadata = (release.tracks[0]?.metadata ?? {}) as Record<string, unknown>;
    return Object.freeze({
      reportId: `youtube-music-metadata:${job.releaseId}`,
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      generatedAt: nowIso(this.dependencies.clock),
      releaseTitle: release.title,
      primaryArtist: release.primaryArtist,
      label: release.label,
      language: safeText(metadata.language ?? null),
      genre: safeText(metadata.genre ?? null),
      territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
      contributors: normalizeContributorSummary(release),
      parentalAdvisory: normalizeParentalAdvisory(metadata.parentalAdvisory ?? trackMetadata.parentalAdvisory ?? null),
      rightsOwned: Boolean(metadata.rightsOwned ?? false),
      youtubeChannelId: safeText(metadata.youtubeChannelId ?? metadata.contentIdChannelId ?? null),
      contentIdEnabled: Boolean(metadata.contentIdEnabled ?? metadata.youtubeContentIdEnabled ?? true),
      referenceUrls: contentIdReferenceList(release, job),
    });
  }

  buildContentIdReport(job: DSPDeliveryJob): Readonly<Record<string, unknown>> {
    this.requireRelease(job);
    const referenceAssets = buildReferenceAssetPayload(job);
    const metadata = buildContentIdMetadata(job);
    return Object.freeze({
      reportId: `youtube-music-content-id:${job.releaseId}`,
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      generatedAt: nowIso(this.dependencies.clock),
      contentIdEnabled: referenceAssets.contentIdEnabled,
      referenceAssets: referenceAssets.referenceAssets,
      ownershipTerritories: referenceAssets.ownershipTerritories,
      contentClaims: referenceAssets.contentClaims,
      policyAssignments: referenceAssets.policyAssignments,
      assetRelationships: referenceAssets.assetRelationships,
      assetUpdates: referenceAssets.assetUpdates,
      withdrawals: referenceAssets.withdrawals,
      restores: referenceAssets.restores,
      metadata,
    });
  }

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new ConnectorError({
        connectorId: "YouTubeMusic",
        code: "YOUTUBE_MUSIC_RELEASE_REQUIRED",
        message: "YouTube Music delivery requires a release payload.",
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

export class YouTubeContentIdService {
  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {}

  generate(job: DSPDeliveryJob) {
    return new YouTubeDeliveryAudit(this.dependencies).buildContentIdReport(job);
  }
}

export class YouTubeEnterpriseService {
  readonly authentication: YouTubeAuthentication;
  readonly packageBuilder: YouTubePackageBuilder;
  readonly metadataNormalizer: YouTubeMetadataNormalizer;
  readonly artworkNormalizer: YouTubeArtworkNormalizer;
  readonly audioNormalizer: YouTubeAudioNormalizer;
  readonly deliveryService: YouTubeDeliveryService;
  readonly pollingService: YouTubePollingService;
  readonly webhookService: YouTubeWebhookService;
  readonly withdrawalService: YouTubeWithdrawalService;
  readonly restoreService: YouTubeRestoreService;
  readonly retryPolicy: YouTubeRetryPolicy;
  readonly healthChecker: YouTubeHealthCheck;
  readonly capabilityResolver: YouTubeCapabilityResolver;
  readonly errorTranslator: YouTubeErrorTranslator;
  readonly deliveryAudit: YouTubeDeliveryAudit;
  readonly contentIdService: YouTubeContentIdService;

  constructor(private readonly dependencies: YouTubeEnterpriseDependencies) {
    this.authentication = new YouTubeAuthentication(dependencies);
    this.packageBuilder = new YouTubePackageBuilder(dependencies);
    this.metadataNormalizer = new YouTubeMetadataNormalizer(dependencies);
    this.artworkNormalizer = new YouTubeArtworkNormalizer(dependencies);
    this.audioNormalizer = new YouTubeAudioNormalizer(dependencies);
    this.deliveryService = new YouTubeDeliveryService(dependencies);
    this.pollingService = new YouTubePollingService(dependencies);
    this.webhookService = new YouTubeWebhookService(dependencies);
    this.withdrawalService = new YouTubeWithdrawalService(dependencies);
    this.restoreService = new YouTubeRestoreService(dependencies);
    this.retryPolicy = new YouTubeRetryPolicy(dependencies);
    this.healthChecker = new YouTubeHealthCheck(dependencies);
    this.capabilityResolver = new YouTubeCapabilityResolver(dependencies);
    this.errorTranslator = new YouTubeErrorTranslator(dependencies);
    this.deliveryAudit = new YouTubeDeliveryAudit(dependencies);
    this.contentIdService = new YouTubeContentIdService(dependencies);
  }

  authenticate(job: DSPDeliveryJob) {
    return this.authentication.authenticate(job);
  }

  buildPackage(job: DSPDeliveryJob) {
    return this.packageBuilder.build(job);
  }

  normalizeMetadata(job: DSPDeliveryJob) {
    return this.metadataNormalizer.normalize(job);
  }

  normalizeArtwork(job: DSPDeliveryJob) {
    return this.artworkNormalizer.normalize(job);
  }

  normalizeAudio(job: DSPDeliveryJob) {
    return this.audioNormalizer.normalize(job);
  }

  deliver(job: DSPDeliveryJob) {
    return this.deliveryService.deliver(job);
  }

  pollStatus(job: DSPDeliveryJob) {
    return this.pollingService.poll(job);
  }

  withdraw(job: DSPDeliveryJob) {
    return this.withdrawalService.withdraw(job);
  }

  restore(job: DSPDeliveryJob) {
    return this.restoreService.restore(job);
  }

  retry(error: unknown, attempt: number, job: DSPDeliveryJob): ConnectorRetry {
    return Object.freeze({
      connectorId: job.target.connectorId,
      releaseId: job.releaseId,
      retryCount: this.retryPolicy.shouldRetry(error, attempt, job) ? attempt + 1 : attempt,
      lastAttemptAt: nowIso(this.dependencies.clock),
      nextAttemptAt: this.retryPolicy.nextRetryAt(error, attempt, job),
      metadata: freeze({
        connectorId: job.target.connectorId,
        releaseId: job.releaseId,
        retryable: this.retryPolicy.shouldRetry(error, attempt, job),
      }),
    }) as ConnectorRetry;
  }

  healthCheck(job: DSPDeliveryJob) {
    return this.healthChecker.healthCheck(job);
  }

  translateError(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">) {
    return this.errorTranslator.translate(error, job);
  }

  resolveCapabilities(connectorId = "YouTubeMusic") {
    return this.capabilityResolver.resolve(connectorId);
  }

  validateWebhook(event: DSPWebhookEvent) {
    return this.webhookService.validate(event);
  }

  parseWebhook(event: DSPWebhookEvent) {
    return this.webhookService.parse(event);
  }

  handleWebhook(event: DSPWebhookEvent) {
    return this.webhookService.handle(event);
  }

  generateDeliveryReport(job: DSPDeliveryJob, result: DSPDeliveryResult) {
    return this.deliveryAudit.buildDeliveryReport(job, result);
  }

  generateHealthReport(connectorId: string, health: DSPHealthSnapshot) {
    return this.deliveryAudit.buildHealthReport(connectorId, health);
  }

  generateCapabilityReport(connectorId: string) {
    return this.deliveryAudit.buildCapabilityReport(connectorId);
  }

  generateMetadataReport(job: DSPDeliveryJob) {
    return this.deliveryAudit.buildMetadataReport(job);
  }

  generateErrorReport(job: DSPDeliveryJob, errors: readonly string[]) {
    return this.deliveryAudit.buildErrorReport(job, errors);
  }

  generateContentIdReport(job: DSPDeliveryJob) {
    return this.contentIdService.generate(job);
  }
}

export function createYouTubeMusicConnectorFrameworkDefaults() {
  return createConnectorCapabilityMatrix();
}
