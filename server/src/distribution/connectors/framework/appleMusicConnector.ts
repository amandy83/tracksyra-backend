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
import { ConnectorRetry } from "../retry/connectorRetry";

export type AppleMusicConnectorConfiguration = Readonly<{
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

export type AppleMusicConnectorDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: ReleaseDeliveryEngineLike;
  capabilityMatrix: Readonly<Record<string, DSPCapabilities>>;
  logger: Logger | null;
  retryPolicy: DSPRetryPolicy;
  configuration: AppleMusicConnectorConfiguration;
  fetchImpl?: typeof fetch;
}>;

interface ReleaseDeliveryEngineLike {
  validateRelease(release: Release): unknown;
  buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

type MutableAppleMusicConnector = AppleMusicConnector & {
  readonly capabilities: DSPCapabilities;
  readonly configuration: ConnectorContext["configuration"];
  readonly connectorId: string;
  readonly version: string;
};

type AppleMusicEnterpriseDependencies = Readonly<{
  connector: AppleMusicConnector;
  logger?: Logger | null;
  clock?: () => string;
}>;

type AppleMusicAuditRecord = Readonly<{
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

function buildContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, connector: MutableAppleMusicConnector): ConnectorContext {
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

export class AppleMusicConnector extends DSPConnectorShell {
  constructor(dependencies: DSPConnectorDependencies) {
    super(dependencies, "AppleMusic");
  }
}

export class AppleMusicAuthentication {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  async authenticate(job: DSPDeliveryJob) {
    const packageModel = await this.dependencies.connector.buildPackage(job);
    const context = buildContext(job, packageModel, this.dependencies.connector as MutableAppleMusicConnector);
    return this.dependencies.connector.authenticate(context);
  }
}

export class AppleMusicPackageBuilder {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  build(job: DSPDeliveryJob) {
    return this.dependencies.connector.buildPackage(job);
  }
}

export class AppleMusicMetadataNormalizer {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    return this.dependencies.connector.normalizeMetadata(job);
  }
}

export class AppleMusicArtworkNormalizer {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    return this.dependencies.connector.normalizeArtwork(job);
  }
}

export class AppleMusicAudioNormalizer {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    return this.dependencies.connector.normalizeAudio(job);
  }
}

export class AppleMusicDeliveryService {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.dependencies.connector.deliver(job);
  }
}

export class AppleMusicPollingService {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  poll(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.dependencies.connector.pollStatus(job);
  }
}

export class AppleMusicWebhookService {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  validate(event: DSPWebhookEvent): boolean | Promise<boolean> {
    return this.dependencies.connector.validateWebhook(event);
  }

  parse(event: DSPWebhookEvent): DSPWebhookEvent | Promise<DSPWebhookEvent> {
    return this.dependencies.connector.parseWebhook(event);
  }

  async handle(event: DSPWebhookEvent): Promise<{ valid: boolean; event: DSPWebhookEvent; audit: AppleMusicAuditRecord | null }> {
    const valid = await Promise.resolve(this.validate(event));
    const parsed = await Promise.resolve(this.parse(event));
    const audit = new AppleMusicDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
    return { valid, event: parsed, audit };
  }
}

export class AppleMusicWithdrawalService {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  withdraw(job: DSPDeliveryJob) {
    return this.dependencies.connector.withdraw(job);
  }
}

export class AppleMusicRestoreService {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  restore(job: DSPDeliveryJob) {
    return this.dependencies.connector.restore(job);
  }
}

export class AppleMusicRetryPolicy {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.connector.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.connector.nextRetryAt(error, attempt, job);
  }
}

export class AppleMusicHealthCheck {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.dependencies.connector.healthCheck(job);
  }
}

export class AppleMusicCapabilityResolver {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  resolve(connectorId = "AppleMusic"): DSPCapabilities {
    void connectorId;
    return (this.dependencies.connector as MutableAppleMusicConnector).capabilities;
  }
}

export class AppleMusicErrorTranslator {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  translate(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">): ConnectorError {
    if (error instanceof ConnectorError) return error;
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Apple Music operation failed";
    const stack = error instanceof Error ? error.stack ?? null : null;
    const lowered = message.toLowerCase();
    const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
    const code =
      /auth|unauthoriz|forbidden|token/i.test(message) ? "APPLE_MUSIC_AUTH_FAILED"
        : /webhook|signature/i.test(message) ? "APPLE_MUSIC_WEBHOOK_INVALID"
        : /withdraw/i.test(message) ? "APPLE_MUSIC_WITHDRAWAL_FAILED"
        : /restore/i.test(message) ? "APPLE_MUSIC_RESTORE_FAILED"
        : /health/i.test(message) ? "APPLE_MUSIC_HEALTH_CHECK_FAILED"
        : retryable ? "APPLE_MUSIC_RETRYABLE_ERROR"
        : "APPLE_MUSIC_OPERATION_FAILED";

    return new ConnectorError({
      connectorId: "AppleMusic",
      code,
      message,
      retryable,
      metadata: freeze({
        connectorId: "AppleMusic",
        releaseId: job.releaseId,
        jobId: job.jobId,
        target: job.target.partnerName,
        stack,
      }),
    });
  }
}

export class AppleMusicDeliveryAudit {
  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {}

  record(reportType: string, payload: Readonly<Record<string, unknown>>): AppleMusicAuditRecord {
    const audit = Object.freeze({
      auditId: `apple-music:${reportType}:${nowIso(this.dependencies.clock)}`,
      reportType,
      recordedAt: nowIso(this.dependencies.clock),
      payload: freeze({ ...payload }),
    });
    this.dependencies.logger?.info?.("apple music audit record generated", { component: "apple-music-connector", reportType, payload: audit.payload });
    return audit;
  }

  recordWebhook(event: DSPWebhookEvent, valid: boolean): AppleMusicAuditRecord {
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
    const capabilities = (this.dependencies.connector as MutableAppleMusicConnector).capabilities;
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
      reportId: `apple-music-metadata:${job.releaseId}`,
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
      localMidnightRelease: Boolean(metadata.localMidnightRelease ?? false),
      scheduledFor: typeof metadata.scheduledFor === "string" ? metadata.scheduledFor : null,
      appleMusicArtistId: safeText(metadata.appleMusicArtistId ?? null),
      dspMetadataMapping: freeze({
        title: release.title,
        artist: release.primaryArtist,
        label: release.label,
        territoryCount: job.target.territories.length,
      }),
    });
  }

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new ConnectorError({
        connectorId: "AppleMusic",
        code: "APPLE_MUSIC_RELEASE_REQUIRED",
        message: "Apple Music delivery requires a release payload.",
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

export class AppleMusicEnterpriseService {
  readonly authentication: AppleMusicAuthentication;
  readonly packageBuilder: AppleMusicPackageBuilder;
  readonly metadataNormalizer: AppleMusicMetadataNormalizer;
  readonly artworkNormalizer: AppleMusicArtworkNormalizer;
  readonly audioNormalizer: AppleMusicAudioNormalizer;
  readonly deliveryService: AppleMusicDeliveryService;
  readonly pollingService: AppleMusicPollingService;
  readonly webhookService: AppleMusicWebhookService;
  readonly withdrawalService: AppleMusicWithdrawalService;
  readonly restoreService: AppleMusicRestoreService;
  readonly retryPolicy: AppleMusicRetryPolicy;
  readonly healthChecker: AppleMusicHealthCheck;
  readonly capabilityResolver: AppleMusicCapabilityResolver;
  readonly errorTranslator: AppleMusicErrorTranslator;
  readonly deliveryAudit: AppleMusicDeliveryAudit;

  constructor(private readonly dependencies: AppleMusicEnterpriseDependencies) {
    this.authentication = new AppleMusicAuthentication(dependencies);
    this.packageBuilder = new AppleMusicPackageBuilder(dependencies);
    this.metadataNormalizer = new AppleMusicMetadataNormalizer(dependencies);
    this.artworkNormalizer = new AppleMusicArtworkNormalizer(dependencies);
    this.audioNormalizer = new AppleMusicAudioNormalizer(dependencies);
    this.deliveryService = new AppleMusicDeliveryService(dependencies);
    this.pollingService = new AppleMusicPollingService(dependencies);
    this.webhookService = new AppleMusicWebhookService(dependencies);
    this.withdrawalService = new AppleMusicWithdrawalService(dependencies);
    this.restoreService = new AppleMusicRestoreService(dependencies);
    this.retryPolicy = new AppleMusicRetryPolicy(dependencies);
    this.healthChecker = new AppleMusicHealthCheck(dependencies);
    this.capabilityResolver = new AppleMusicCapabilityResolver(dependencies);
    this.errorTranslator = new AppleMusicErrorTranslator(dependencies);
    this.deliveryAudit = new AppleMusicDeliveryAudit(dependencies);
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

  resolveCapabilities(connectorId = "AppleMusic") {
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
}

export function createAppleMusicConnectorFrameworkDefaults() {
  return createConnectorCapabilityMatrix();
}
