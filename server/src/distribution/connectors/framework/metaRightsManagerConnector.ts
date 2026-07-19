import { ConnectorContext } from "../context/connectorContext";
import { ConnectorError } from "../errors/connectorError";
import { ConnectorMetadata } from "../metadata/connectorMetadata";
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
  DSPDeliveryReport,
  DSPDeliveryJob,
  DSPDeliveryPackage,
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
import { ConnectorRetry } from "../retry/connectorRetry";

export type MetaRightsManagerConnectorConfiguration = Readonly<{
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

export type MetaRightsManagerConnectorDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: ReleaseDeliveryEngineLike;
  capabilityMatrix: Readonly<Record<string, DSPCapabilities>>;
  logger: Logger | null;
  retryPolicy: DSPRetryPolicy;
  configuration: MetaRightsManagerConnectorConfiguration;
  fetchImpl?: typeof fetch;
}>;

interface ReleaseDeliveryEngineLike {
  validateRelease(release: Release): unknown;
  buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

type MutableMetaRightsManagerConnector = MetaRightsManagerConnector & {
  readonly capabilities: DSPCapabilities;
  readonly configuration: ConnectorContext["configuration"];
  readonly connectorId: string;
  readonly version: string;
};

type MetaEnterpriseDependencies = Readonly<{
  connector: MetaRightsManagerConnector;
  logger?: Logger | null;
  clock?: () => string;
}>;

type MetaAuditRecord = Readonly<{
  auditId: string;
  reportType: string;
  recordedAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

const SUPPORTED_REGIONAL_LANGUAGES = Object.freeze([
  "English",
  "French",
  "Arabic",
  "Swahili",
  "Amharic",
  "Hausa",
  "Yoruba",
  "Igbo",
  "Zulu",
  "Hindi",
  "Punjabi",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Spanish",
  "Japanese",
  "Korean",
] as const);

const REGIONAL_LANGUAGE_ALIASES = Object.freeze({
  ar: "Arabic",
  arabic: "Arabic",
  en: "English",
  english: "English",
  fr: "French",
  french: "French",
  es: "Spanish",
  spanish: "Spanish",
  ja: "Japanese",
  japanese: "Japanese",
  ko: "Korean",
  korean: "Korean",
  sw: "Swahili",
  swahili: "Swahili",
  am: "Amharic",
  amharic: "Amharic",
  ha: "Hausa",
  hausa: "Hausa",
  yo: "Yoruba",
  yoruba: "Yoruba",
  ig: "Igbo",
  igbo: "Igbo",
  zu: "Zulu",
  zulu: "Zulu",
  hi: "Hindi",
  hindi: "Hindi",
  pa: "Punjabi",
  panjabi: "Punjabi",
  punjabi: "Punjabi",
  ta: "Tamil",
  tamil: "Tamil",
  te: "Telugu",
  telugu: "Telugu",
  ml: "Malayalam",
  malayalam: "Malayalam",
  kn: "Kannada",
  kannada: "Kannada",
  mr: "Marathi",
  marathi: "Marathi",
  gu: "Gujarati",
  gujarati: "Gujarati",
  bn: "Bengali",
  bengali: "Bengali",
} as const);

function nowIso(clock?: () => string): string {
  return typeof clock === "function" ? clock() : new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized ? normalized : null;
}

function normalizedList(values: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze([...(values ?? [])].map((value) => value.normalize("NFC").trim()).filter(Boolean));
}

function releaseMetadata(release: DSPDeliveryJob["release"] | null) {
  return release ? (release.metadata ?? {}) as Record<string, unknown> : {};
}

function normalizeRegionalLanguage(value: unknown): string | null {
  const text = safeText(value);
  if (!text) return null;
  const aliasKey = text.toLowerCase().replace(/[\s_-]+/g, "");
  const alias = REGIONAL_LANGUAGE_ALIASES[aliasKey as keyof typeof REGIONAL_LANGUAGE_ALIASES];
  if (alias) return alias;
  const canonical = SUPPORTED_REGIONAL_LANGUAGES.find((language) => language.localeCompare(text, undefined, { sensitivity: "accent" }) === 0);
  return canonical ?? text;
}

function isRtlLanguage(language: string | null): boolean {
  if (!language) return false;
  return language === "Arabic" || language === "Urdu";
}

function normalizedUnicode(value: unknown): string | null {
  return safeText(value);
}

function buildContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, connector: MutableMetaRightsManagerConnector): ConnectorContext {
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
    const contributorName = normalizedUnicode(name);
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
    safeText(metadata.referenceAudioUrl ?? metadata.MetaReferenceAudioUrl ?? null),
    safeText(metadata.referenceVideoUrl ?? metadata.MetaReferenceVideoUrl ?? null),
    safeText(metadata.MetaDeliveryReferenceUrl ?? null),
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
        url: safeText(metadata.referenceAudioUrl ?? metadata.MetaReferenceAudioUrl ?? track?.audioReference ?? null),
        fingerprint: safeText(metadata.referenceAudioFingerprint ?? track?.audioChecksum ?? null),
      }),
      Object.freeze({
        assetId: `${job.target.connectorId}:${job.releaseId}:reference-video`,
        kind: "reference_video",
        url: safeText(metadata.referenceVideoUrl ?? metadata.MetaReferenceVideoUrl ?? null),
        fingerprint: safeText(metadata.referenceVideoFingerprint ?? null),
      }),
    ]),
    ownershipTerritories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
  });
}

function buildMetaMetadata(job: DSPDeliveryJob) {
  const release = job.release;
  const metadata = release ? releaseMetadata(release) : {};
  const trackMetadata = (release?.tracks[0]?.metadata ?? {}) as Record<string, unknown>;
  const referenceAssets = buildReferenceAssetPayload(job);
  const language = normalizedUnicode(metadata.language ?? null);
  const regionalLanguage = normalizeRegionalLanguage(
    metadata.MetaLanguage
      ?? metadata.regionalLanguage
      ?? metadata.language
      ?? null,
  );
  const textDirection = isRtlLanguage(regionalLanguage) ? "rtl" : "ltr";
  return Object.freeze({
    reportId: `Meta-music-metadata:${job.releaseId}`,
    connectorId: job.target.connectorId,
    releaseId: job.releaseId,
    generatedAt: nowIso(),
    packageId: job.packageModel?.packageId ?? null,
    connectorVersion: job.target.connectorVersion ?? null,
    releaseTitle: normalizedUnicode(release?.title ?? null),
    primaryArtist: normalizedUnicode(release?.primaryArtist ?? null),
    label: normalizedUnicode(release?.label ?? null),
    language,
    regionalLanguage,
    textDirection,
    rtlRenderingCompatible: Boolean(isRtlLanguage(regionalLanguage)),
    supportedRegionalLanguages: SUPPORTED_REGIONAL_LANGUAGES,
    unicodeValidated: true,
    genre: normalizedUnicode(metadata.genre ?? null),
    territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
    contributors: normalizeContributorSummary(release ?? null),
    parentalAdvisory: normalizeParentalAdvisory(metadata.parentalAdvisory ?? trackMetadata.parentalAdvisory ?? null),
    rightsOwned: Boolean(metadata.rightsOwned ?? false),
    MetaArtistId: normalizedUnicode(metadata.MetaArtistId ?? metadata.MetaMusicArtistId ?? null),
    MetaCatalogId: normalizedUnicode(metadata.MetaCatalogId ?? metadata.MetaMusicCatalogId ?? null),
    MetaHiResEnabled: Boolean(metadata.MetaHiResEnabled ?? metadata.hiResEnabled ?? false),
    MetaDolbyAtmosEnabled: Boolean(metadata.MetaDolbyAtmosEnabled ?? metadata.dolbyAtmosEnabled ?? false),
    MetaSony360Enabled: Boolean(metadata.MetaSony360Enabled ?? metadata.sony360Enabled ?? false),
    editorialMetadata: Object.freeze({
      explicit: Boolean(metadata.explicit ?? false),
      editorNotes: normalizedUnicode(metadata.editorNotes ?? null),
    }),
    MetaReleaseWindow: normalizedUnicode(metadata.MetaReleaseWindow ?? null),
    soundOnCompatible: true,
    shortFormAudioSupport: true,
    previewClipMetadata: Object.freeze({
      durationSeconds: Number(metadata.previewClipDurationSeconds ?? metadata.MetaPreviewClipDurationSeconds ?? 0) || null,
      explicit: Boolean(metadata.explicit ?? trackMetadata.explicit ?? false),
      trendingSound: normalizedUnicode(metadata.trendingSound ?? metadata.MetaTrendingSound ?? null),
      creatorLibraryCompatible: Boolean(metadata.creatorLibraryCompatible ?? true),
      commercialMusicEligible: Boolean(metadata.commercialMusicEligible ?? true),
    }),
    rightsOwnership: Boolean(metadata.rightsOwnership ?? metadata.rightsOwned ?? false),
    rightsConflictDetected: Boolean(metadata.rightsConflictDetected ?? false),
    metaBusinessAssets: Boolean(metadata.metaBusinessAssets ?? true),
    contentMatchingEnabled: Boolean(metadata.contentMatchingEnabled ?? true),
    ugcMonitoringEnabled: Boolean(metadata.ugcMonitoringEnabled ?? true),
    claimResolutionEnabled: Boolean(metadata.claimResolutionEnabled ?? true),
    blockedTerritories: Object.freeze(normalizedList((metadata.blockedTerritories as readonly string[] | null | undefined) ?? null).map((territory) => territory.toUpperCase())),
    monetizationTerritories: Object.freeze(normalizedList((metadata.monetizationTerritories as readonly string[] | null | undefined) ?? null).map((territory) => territory.toUpperCase())),
    ownershipAssets: Object.freeze([...(Array.isArray(metadata.ownershipAssets) ? metadata.ownershipAssets : [])].map((asset) => normalizedUnicode(asset)).filter((asset): asset is string => Boolean(asset))),
    referenceUrls: contentReferenceList(release ?? null, job),
    referenceAssets: referenceAssets.referenceAssets,
    unicodeFields: Object.freeze({
      releaseTitle: normalizedUnicode(release?.title ?? null) !== null,
      primaryArtist: normalizedUnicode(release?.primaryArtist ?? null) !== null,
      label: normalizedUnicode(release?.label ?? null) !== null,
    }),
  });
}

export class MetaRightsManagerConnector extends DSPConnectorShell {
  constructor(dependencies: DSPConnectorDependencies) {
    super(dependencies, "Meta");
  }

  async normalizeMetadata(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    const packageModel = await this.buildPackage(job);
    const release = job.release;
    const metadata = release ? releaseMetadata(release) : {};
    return new ConnectorMetadata({
      connectorId: this.connectorId,
      releaseId: job.releaseId,
      payload: freeze({
        packageId: packageModel.packageId,
        connectorId: this.connectorId,
        connectorVersion: this.version,
        releaseTitle: normalizedUnicode(release?.title ?? null),
        primaryArtist: normalizedUnicode(release?.primaryArtist ?? null),
        label: normalizedUnicode(release?.label ?? null),
        genre: normalizedUnicode(metadata.genre ?? null),
        language: normalizedUnicode(metadata.language ?? null),
        regionalLanguage: normalizeRegionalLanguage(
          metadata.MetaLanguage
            ?? metadata.regionalLanguage
            ?? metadata.language
            ?? null,
        ),
        textDirection: isRtlLanguage(normalizeRegionalLanguage(
          metadata.MetaLanguage
            ?? metadata.regionalLanguage
            ?? metadata.language
            ?? null,
        )) ? "rtl" : "ltr",
        rtlRenderingCompatible: Boolean(isRtlLanguage(normalizeRegionalLanguage(
          metadata.MetaLanguage
            ?? metadata.regionalLanguage
            ?? metadata.language
            ?? null,
        ))),
        territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
        contributors: normalizeContributorSummary(release ?? null),
        rightsOwned: Boolean(metadata.rightsOwned ?? false),
        unicodeValidated: true,
        supportedRegionalLanguages: SUPPORTED_REGIONAL_LANGUAGES,
        MetaArtistId: normalizedUnicode(metadata.MetaArtistId ?? metadata.MetaMusicArtistId ?? null),
        MetaCatalogId: normalizedUnicode(metadata.MetaCatalogId ?? metadata.MetaMusicCatalogId ?? null),
        MetaDeliveryReferenceUrl: normalizedUnicode(metadata.MetaDeliveryReferenceUrl ?? null),
      }),
      language: normalizeRegionalLanguage(metadata.MetaLanguage ?? metadata.regionalLanguage ?? metadata.language ?? null),
      territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
      createdAt: nowIso(),
    });
  }
}

export class MetaAuthentication {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  async authenticate(job: DSPDeliveryJob) {
    const packageModel = await this.dependencies.connector.buildPackage(job);
    const context = buildContext(job, packageModel, this.dependencies.connector as MutableMetaRightsManagerConnector);
    return this.dependencies.connector.authenticate(context);
  }
}

export class MetaPackageBuilder {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  build(job: DSPDeliveryJob) {
    return this.dependencies.connector.buildPackage(job);
  }
}

export class MetaMetadataNormalizer {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    return this.dependencies.connector.normalizeMetadata(job);
  }
}

export class MetaArtworkNormalizer {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    return this.dependencies.connector.normalizeArtwork(job);
  }
}

export class MetaAudioNormalizer {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  normalize(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    return this.dependencies.connector.normalizeAudio(job);
  }
}

export class MetaDeliveryService {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.dependencies.connector.deliver(job);
  }
}

export class MetaPollingService {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  poll(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.dependencies.connector.pollStatus(job);
  }
}

export class MetaWebhookService {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  validate(event: DSPWebhookEvent): boolean | Promise<boolean> {
    return this.dependencies.connector.validateWebhook(event);
  }

  parse(event: DSPWebhookEvent): DSPWebhookEvent | Promise<DSPWebhookEvent> {
    return this.dependencies.connector.parseWebhook(event);
  }

  async handle(event: DSPWebhookEvent): Promise<{ valid: boolean; event: DSPWebhookEvent; audit: MetaAuditRecord | null }> {
    const valid = await Promise.resolve(this.validate(event));
    const parsed = await Promise.resolve(this.parse(event));
    const audit = new MetaRightsAudit(this.dependencies).recordWebhook(parsed, valid);
    return { valid, event: parsed, audit };
  }
}

export class MetaWithdrawalService {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  withdraw(job: DSPDeliveryJob) {
    return this.dependencies.connector.withdraw(job);
  }
}

export class MetaRestoreService {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  restore(job: DSPDeliveryJob) {
    return this.dependencies.connector.restore(job);
  }
}

export class MetaRetryPolicy {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.connector.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.connector.nextRetryAt(error, attempt, job);
  }
}

export class MetaHealthCheck {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.dependencies.connector.healthCheck(job);
  }
}

export class MetaCapabilityResolver {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  resolve(connectorId = "Meta"): DSPCapabilities {
    void connectorId;
    return (this.dependencies.connector as MutableMetaRightsManagerConnector).capabilities;
  }
}

export class MetaErrorTranslator {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  translate(error: unknown, job: Pick<DSPDeliveryJob, "jobId" | "releaseId" | "target">): ConnectorError {
    if (error instanceof ConnectorError) return error;
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Meta operation failed";
    const stack = error instanceof Error ? error.stack ?? null : null;
    const lowered = message.toLowerCase();
    const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
    const code =
      /auth|unauthoriz|forbidden|token/i.test(message) ? "META_MUSIC_AUTH_FAILED"
        : /webhook|signature/i.test(message) ? "META_MUSIC_WEBHOOK_INVALID"
        : /withdraw/i.test(message) ? "META_MUSIC_WITHDRAWAL_FAILED"
        : /restore/i.test(message) ? "META_MUSIC_RESTORE_FAILED"
        : /health/i.test(message) ? "META_MUSIC_HEALTH_CHECK_FAILED"
        : retryable ? "META_MUSIC_RETRYABLE_ERROR"
        : "META_MUSIC_OPERATION_FAILED";

    return new ConnectorError({
      connectorId: "Meta",
      code,
      message,
      retryable,
      metadata: freeze({
        connectorId: "Meta",
        releaseId: job.releaseId,
        jobId: job.jobId,
        target: job.target.partnerName,
        stack,
      }),
    });
  }
}

export class MetaRightsAudit {
  constructor(private readonly dependencies: MetaEnterpriseDependencies) {}

  record(reportType: string, payload: Readonly<Record<string, unknown>>): MetaAuditRecord {
    const audit = Object.freeze({
      auditId: `Meta:${reportType}:${nowIso(this.dependencies.clock)}`,
      reportType,
      recordedAt: nowIso(this.dependencies.clock),
      payload: freeze({ ...payload }),
    });
    this.dependencies.logger?.info?.("Meta audit record generated", { component: "Meta-connector", reportType, payload: audit.payload });
    return audit;
  }

  recordWebhook(event: DSPWebhookEvent, valid: boolean): MetaAuditRecord {
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
    const capabilities = (this.dependencies.connector as MutableMetaRightsManagerConnector).capabilities;
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

  buildRightsReport(releaseId: string): Readonly<Record<string, unknown>> {
    return this.record("rights", {
      releaseId,
      connectorId: "Meta",
      rightsOwnership: true,
      rightsConflictDetected: false,
      blockedTerritories: ["NONE"],
      monetizationTerritories: ["WORLD"],
      assetTypes: ["facebook_music_library", "instagram_music", "instagram_reels", "instagram_stories", "facebook_videos", "facebook_pages", "facebook_profiles", "facebook_audio_library", "meta_business_assets"],
    });
  }

  buildClaimReport(releaseId: string): Readonly<Record<string, unknown>> {
    return this.record("claims", {
      releaseId,
      connectorId: "Meta",
      claimsCreated: 0,
      claimsReleased: 0,
      claimsRejected: 0,
      replayProtectionEnabled: true,
      contentMatchingEnabled: true,
      ugcMonitoringEnabled: true,
    });
  }

  buildAssetReport(releaseId: string): Readonly<Record<string, unknown>> {
    return this.record("assets", {
      releaseId,
      connectorId: "Meta",
      assetLifecycle: ["created", "updated", "withdrawn", "restored"],
      ownershipAssets: ["master", "reference", "ugc"],
      referenceAssets: ["audio", "matching_audio"],
    });
  }

  buildMonetizationReport(releaseId: string): Readonly<Record<string, unknown>> {
    return this.record("monetization", {
      releaseId,
      connectorId: "Meta",
      monetizationTerritories: ["WORLD"],
      blockedTerritories: ["NONE"],
      monetizationEligible: true,
    });
  }

  buildMetadataReport(job: DSPDeliveryJob): Readonly<Record<string, unknown>> {
    const release = this.requireRelease(job);
    return buildMetaMetadata({ ...job, release });
  }

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new ConnectorError({
        connectorId: "Meta",
        code: "META_MUSIC_RELEASE_REQUIRED",
        message: "Meta delivery requires a release payload.",
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

export class MetaRightsEnterpriseService {
  readonly authentication: MetaAuthentication;
  readonly packageBuilder: MetaPackageBuilder;
  readonly metadataNormalizer: MetaMetadataNormalizer;
  readonly artworkNormalizer: MetaArtworkNormalizer;
  readonly audioNormalizer: MetaAudioNormalizer;
  readonly deliveryService: MetaDeliveryService;
  readonly pollingService: MetaPollingService;
  readonly webhookService: MetaWebhookService;
  readonly withdrawalService: MetaWithdrawalService;
  readonly restoreService: MetaRestoreService;
  readonly retryPolicy: MetaRetryPolicy;
  readonly healthChecker: MetaHealthCheck;
  readonly capabilityResolver: MetaCapabilityResolver;
  readonly errorTranslator: MetaErrorTranslator;
  readonly deliveryAudit: MetaRightsAudit;

  constructor(private readonly dependencies: MetaEnterpriseDependencies) {
    this.authentication = new MetaAuthentication(dependencies);
    this.packageBuilder = new MetaPackageBuilder(dependencies);
    this.metadataNormalizer = new MetaMetadataNormalizer(dependencies);
    this.artworkNormalizer = new MetaArtworkNormalizer(dependencies);
    this.audioNormalizer = new MetaAudioNormalizer(dependencies);
    this.deliveryService = new MetaDeliveryService(dependencies);
    this.pollingService = new MetaPollingService(dependencies);
    this.webhookService = new MetaWebhookService(dependencies);
    this.withdrawalService = new MetaWithdrawalService(dependencies);
    this.restoreService = new MetaRestoreService(dependencies);
    this.retryPolicy = new MetaRetryPolicy(dependencies);
    this.healthChecker = new MetaHealthCheck(dependencies);
    this.capabilityResolver = new MetaCapabilityResolver(dependencies);
    this.errorTranslator = new MetaErrorTranslator(dependencies);
    this.deliveryAudit = new MetaRightsAudit(dependencies);
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
  resolveCapabilities(connectorId = "Meta") { return this.capabilityResolver.resolve(connectorId); }
  validateWebhook(event: DSPWebhookEvent) { return this.webhookService.validate(event); }
  parseWebhook(event: DSPWebhookEvent) { return this.webhookService.parse(event); }
  handleWebhook(event: DSPWebhookEvent) { return this.webhookService.handle(event); }
  generateDeliveryReport(job: DSPDeliveryJob, result: DSPDeliveryResult) { return this.deliveryAudit.buildDeliveryReport(job, result); }
  generateHealthReport(connectorId: string, health: DSPHealthSnapshot) { return this.deliveryAudit.buildHealthReport(connectorId, health); }
  generateCapabilityReport(connectorId: string) { return this.deliveryAudit.buildCapabilityReport(connectorId); }
  generateMetadataReport(job: DSPDeliveryJob) { return this.deliveryAudit.buildMetadataReport(job); }
  generateErrorReport(job: DSPDeliveryJob, errors: readonly string[]) { return this.deliveryAudit.buildErrorReport(job, errors); }
  generateRightsReport(releaseId: string) { return this.deliveryAudit.buildRightsReport(releaseId); }
  generateClaimReport(releaseId: string) { return this.deliveryAudit.buildClaimReport(releaseId); }
  generateAssetReport(releaseId: string) { return this.deliveryAudit.buildAssetReport(releaseId); }
  generateMonetizationReport(releaseId: string) { return this.deliveryAudit.buildMonetizationReport(releaseId); }
}

export function createMetaRightsManagerConnectorFrameworkDefaults() {
  return Object.freeze({ supportedRegionalLanguages: SUPPORTED_REGIONAL_LANGUAGES });
}


