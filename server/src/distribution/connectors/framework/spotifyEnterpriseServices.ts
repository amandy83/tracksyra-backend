import { ConnectorContext } from "../context/connectorContext";
import { ConnectorError } from "../errors/connectorError";
import type { Logger } from "../../observability/contracts/observabilityContracts";
import type { Release } from "../../domain";
import type {
  DSPCapabilities,
  DSPConnectorCapabilityReport,
  DSPConnectorHealthReport,
  DSPDeliveryErrorReport,
  DSPDeliveryJob,
  DSPDeliveryPackage,
  DSPDeliveryReport,
  DSPDeliveryResult,
  DSPHealthSnapshot,
  DSPNormalizedAudio,
  DSPNormalizedArtwork,
  DSPNormalizedMetadata,
  DSPStatusSnapshot,
  DSPWebhookEvent,
} from "./connectorFrameworkTypes";
import type { SpotifyConnector } from "./spotifyConnector";

type MutableSpotifyConnector = SpotifyConnector & {
  readonly capabilities: DSPCapabilities;
  readonly configuration: ConnectorContext["configuration"];
  readonly connectorId: string;
  readonly version: string;
};

type SpotifyEnterpriseDependencies = Readonly<{
  connector: SpotifyConnector;
  logger?: Logger | null;
  clock?: () => string;
}>;

type SpotifyAuditRecord = Readonly<{
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

function createContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, connector: MutableSpotifyConnector): ConnectorContext {
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

function releaseMetadata(release: DSPDeliveryJob["release"] | null) {
  return release ? (release.metadata ?? {}) as Record<string, unknown> : {};
}

export class SpotifyAuthentication {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  async authenticate(job: DSPDeliveryJob) {
    const packageModel = await this.dependencies.connector.buildPackage(job);
    const context = createContext(job, packageModel, this.dependencies.connector as MutableSpotifyConnector);
    return this.dependencies.connector.authenticate(context);
  }
}

export class SpotifyPackageBuilder {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  build(job: DSPDeliveryJob) {
    return this.dependencies.connector.buildPackage(job);
  }
}

export class SpotifyMetadataNormalizer {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    return this.dependencies.connector.normalizeMetadata(job);
  }
}

export class SpotifyArtworkNormalizer {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    return this.dependencies.connector.normalizeArtwork(job);
  }
}

export class SpotifyAudioNormalizer {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    return this.dependencies.connector.normalizeAudio(job);
  }
}

export class SpotifyDeliveryService {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.dependencies.connector.deliver(job);
  }
}

export class SpotifyPollingService {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  poll(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.dependencies.connector.pollStatus(job);
  }
}

export class SpotifyWebhookService {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  validate(event: DSPWebhookEvent): boolean | Promise<boolean> {
    return this.dependencies.connector.validateWebhook(event);
  }

  parse(event: DSPWebhookEvent): DSPWebhookEvent | Promise<DSPWebhookEvent> {
    return this.dependencies.connector.parseWebhook(event);
  }

  async handle(event: DSPWebhookEvent): Promise<{ valid: boolean; event: DSPWebhookEvent; audit: SpotifyAuditRecord | null }> {
    const valid = await Promise.resolve(this.validate(event));
    const parsed = await Promise.resolve(this.parse(event));
    const audit = new SpotifyDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
    return { valid, event: parsed, audit };
  }
}

export class SpotifyWithdrawalService {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  withdraw(job: DSPDeliveryJob) {
    return this.dependencies.connector.withdraw(job);
  }
}

export class SpotifyRestoreService {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  restore(job: DSPDeliveryJob) {
    return this.dependencies.connector.restore(job);
  }
}

export class SpotifyRetryPolicy {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.connector.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.connector.nextRetryAt(error, attempt, job);
  }
}

export class SpotifyHealthCheck {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.dependencies.connector.healthCheck(job);
  }
}

export class SpotifyCapabilityResolver {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  resolve(connectorId = "Spotify"): DSPCapabilities {
    void connectorId;
    return (this.dependencies.connector as MutableSpotifyConnector).capabilities;
  }
}

export class SpotifyErrorTranslator {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  translate(error: unknown, job: Pick<DSPDeliveryJob, "releaseId" | "jobId" | "target">): ConnectorError {
    if (error instanceof ConnectorError) return error;

    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Spotify operation failed";
    const stack = error instanceof Error ? error.stack ?? null : null;
    const lowered = message.toLowerCase();
    const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
    const code =
      /auth|unauthoriz|forbidden|token/i.test(message) ? "SPOTIFY_AUTH_FAILED"
        : /webhook|signature/i.test(message) ? "SPOTIFY_WEBHOOK_INVALID"
        : /withdraw/i.test(message) ? "SPOTIFY_WITHDRAWAL_FAILED"
        : /restore/i.test(message) ? "SPOTIFY_RESTORE_FAILED"
        : /health/i.test(message) ? "SPOTIFY_HEALTH_CHECK_FAILED"
        : retryable ? "SPOTIFY_RETRYABLE_ERROR"
        : "SPOTIFY_OPERATION_FAILED";

    return new ConnectorError({
      connectorId: "Spotify",
      code,
      message,
      retryable,
      metadata: freeze({
        connectorId: "Spotify",
        releaseId: job.releaseId,
        jobId: job.jobId,
        target: job.target.partnerName,
        stack,
      }),
    });
  }
}

export class SpotifyDeliveryAudit {
  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {}

  record(reportType: string, payload: Readonly<Record<string, unknown>>): SpotifyAuditRecord {
    const audit = Object.freeze({
      auditId: `spotify:${reportType}:${nowIso(this.dependencies.clock)}`,
      reportType,
      recordedAt: nowIso(this.dependencies.clock),
      payload: freeze({ ...payload }),
    });
    this.dependencies.logger?.info?.("spotify audit record generated", { component: "spotify-connector", reportType, payload: audit.payload });
    return audit;
  }

  recordWebhook(event: DSPWebhookEvent, valid: boolean): SpotifyAuditRecord {
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
    const capabilities = (this.dependencies.connector as MutableSpotifyConnector).capabilities;
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
      reportId: `spotify-metadata:${job.releaseId}`,
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
      canvasSupport: (this.dependencies.connector as MutableSpotifyConnector).capabilities.canvasSupport,
    });
  }

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new ConnectorError({
        connectorId: "Spotify",
        code: "SPOTIFY_RELEASE_REQUIRED",
        message: "Spotify delivery requires a release payload.",
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

export class SpotifyEnterpriseService {
  readonly authentication: SpotifyAuthentication;
  readonly packageBuilder: SpotifyPackageBuilder;
  readonly metadataNormalizer: SpotifyMetadataNormalizer;
  readonly artworkNormalizer: SpotifyArtworkNormalizer;
  readonly audioNormalizer: SpotifyAudioNormalizer;
  readonly deliveryService: SpotifyDeliveryService;
  readonly pollingService: SpotifyPollingService;
  readonly webhookService: SpotifyWebhookService;
  readonly withdrawalService: SpotifyWithdrawalService;
  readonly restoreService: SpotifyRestoreService;
  readonly retryPolicy: SpotifyRetryPolicy;
  readonly healthChecker: SpotifyHealthCheck;
  readonly capabilityResolver: SpotifyCapabilityResolver;
  readonly errorTranslator: SpotifyErrorTranslator;
  readonly deliveryAudit: SpotifyDeliveryAudit;

  constructor(private readonly dependencies: SpotifyEnterpriseDependencies) {
    this.authentication = new SpotifyAuthentication(dependencies);
    this.packageBuilder = new SpotifyPackageBuilder(dependencies);
    this.metadataNormalizer = new SpotifyMetadataNormalizer(dependencies);
    this.artworkNormalizer = new SpotifyArtworkNormalizer(dependencies);
    this.audioNormalizer = new SpotifyAudioNormalizer(dependencies);
    this.deliveryService = new SpotifyDeliveryService(dependencies);
    this.pollingService = new SpotifyPollingService(dependencies);
    this.webhookService = new SpotifyWebhookService(dependencies);
    this.withdrawalService = new SpotifyWithdrawalService(dependencies);
    this.restoreService = new SpotifyRestoreService(dependencies);
    this.retryPolicy = new SpotifyRetryPolicy(dependencies);
    this.healthChecker = new SpotifyHealthCheck(dependencies);
    this.capabilityResolver = new SpotifyCapabilityResolver(dependencies);
    this.errorTranslator = new SpotifyErrorTranslator(dependencies);
    this.deliveryAudit = new SpotifyDeliveryAudit(dependencies);
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

  checkHealth(job: DSPDeliveryJob) {
    return this.healthChecker.healthCheck(job);
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

  generateErrorReport(job: DSPDeliveryJob, errors: readonly string[]) {
    return this.deliveryAudit.buildErrorReport(job, errors);
  }

  generateMetadataReport(job: DSPDeliveryJob) {
    return this.deliveryAudit.buildMetadataReport(job);
  }

  translateError(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">) {
    return this.errorTranslator.translate(error, job);
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
}
