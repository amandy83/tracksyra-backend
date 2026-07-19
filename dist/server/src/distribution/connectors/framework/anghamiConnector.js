import { ConnectorContext } from "../context/connectorContext.js";
import { ConnectorError } from "../errors/connectorError.js";
import { ConnectorMetadata } from "../metadata/connectorMetadata.js";
import { DSPConnectorShell } from "./spotifyConnector.js";
const SUPPORTED_REGIONAL_LANGUAGES = Object.freeze([
    "Arabic",
    "English",
    "French",
    "Hindi",
    "Punjabi",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Kannada",
    "Marathi",
    "Gujarati",
    "Bengali",
    "Urdu",
    "Bhojpuri",
    "Haryanvi",
    "Rajasthani",
    "Odia",
    "Assamese",
    "Konkani",
    "Sanskrit",
]);
const REGIONAL_LANGUAGE_ALIASES = Object.freeze({
    ar: "Arabic",
    arabic: "Arabic",
    en: "English",
    english: "English",
    fr: "French",
    french: "French",
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
    ur: "Urdu",
    urdu: "Urdu",
    bho: "Bhojpuri",
    bhojpuri: "Bhojpuri",
    haryanvi: "Haryanvi",
    rajasthani: "Rajasthani",
    or: "Odia",
    odia: "Odia",
    as: "Assamese",
    assamese: "Assamese",
    kok: "Konkani",
    konkani: "Konkani",
    sa: "Sanskrit",
    sanskrit: "Sanskrit",
});
function nowIso(clock) {
    return typeof clock === "function" ? clock() : new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function safeText(value) {
    if (typeof value !== "string")
        return null;
    const normalized = value.normalize("NFC").trim();
    return normalized ? normalized : null;
}
function normalizedList(values) {
    return Object.freeze([...(values ?? [])].map((value) => value.normalize("NFC").trim()).filter(Boolean));
}
function releaseMetadata(release) {
    return release ? (release.metadata ?? {}) : {};
}
function normalizeRegionalLanguage(value) {
    const text = safeText(value);
    if (!text)
        return null;
    const aliasKey = text.toLowerCase().replace(/[\s_-]+/g, "");
    const alias = REGIONAL_LANGUAGE_ALIASES[aliasKey];
    if (alias)
        return alias;
    const canonical = SUPPORTED_REGIONAL_LANGUAGES.find((language) => language.localeCompare(text, undefined, { sensitivity: "accent" }) === 0);
    return canonical ?? text;
}
function isRtlLanguage(language) {
    if (!language)
        return false;
    return language === "Arabic" || language === "Urdu";
}
function normalizedUnicode(value) {
    return safeText(value);
}
function buildContext(job, packageModel, connector) {
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
function normalizeContributorSummary(release) {
    const contributors = new Map();
    const add = (name, role) => {
        const contributorName = normalizedUnicode(name);
        if (!contributorName)
            return;
        const current = contributors.get(contributorName) ?? [];
        if (!current.includes(role))
            contributors.set(contributorName, Object.freeze([...current, role]));
    };
    if (!release)
        return Object.freeze([]);
    add(release.primaryArtist, "primary_artist");
    for (const contributor of release.contributors ?? []) {
        for (const role of contributor.roles ?? [])
            add(contributor.name, role);
    }
    for (const track of release.tracks ?? []) {
        for (const contributor of track.contributors ?? []) {
            for (const role of contributor.roles ?? [])
                add(contributor.name, role);
        }
    }
    return Object.freeze([...contributors.entries()].map(([name, roles]) => Object.freeze({ name, roles })));
}
function normalizeParentalAdvisory(value) {
    const text = safeText(value);
    if (!text)
        return "none";
    const lowered = text.toLowerCase();
    return lowered === "explicit" || lowered === "clean" || lowered === "none" ? lowered : "none";
}
function contentReferenceList(release, job) {
    const metadata = release ? releaseMetadata(release) : {};
    const references = [
        safeText(metadata.referenceAudioUrl ?? metadata.AnghamiReferenceAudioUrl ?? null),
        safeText(metadata.referenceVideoUrl ?? metadata.AnghamiReferenceVideoUrl ?? null),
        safeText(metadata.AnghamiDeliveryReferenceUrl ?? null),
        safeText(job.target.endpointUrl ?? null),
    ].filter((value) => Boolean(value));
    return Object.freeze([...new Set(references)]);
}
function buildReferenceAssetPayload(job) {
    const release = job.release;
    const metadata = release ? releaseMetadata(release) : {};
    const track = release?.tracks[0] ?? null;
    return Object.freeze({
        releaseId: job.releaseId,
        referenceAssets: Object.freeze([
            Object.freeze({
                assetId: `${job.target.connectorId}:${job.releaseId}:reference-audio`,
                kind: "reference_audio",
                url: safeText(metadata.referenceAudioUrl ?? metadata.AnghamiReferenceAudioUrl ?? track?.audioReference ?? null),
                fingerprint: safeText(metadata.referenceAudioFingerprint ?? track?.audioChecksum ?? null),
            }),
            Object.freeze({
                assetId: `${job.target.connectorId}:${job.releaseId}:reference-video`,
                kind: "reference_video",
                url: safeText(metadata.referenceVideoUrl ?? metadata.AnghamiReferenceVideoUrl ?? null),
                fingerprint: safeText(metadata.referenceVideoFingerprint ?? null),
            }),
        ]),
        ownershipTerritories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
    });
}
function buildAnghamiMetadata(job) {
    const release = job.release;
    const metadata = release ? releaseMetadata(release) : {};
    const trackMetadata = (release?.tracks[0]?.metadata ?? {});
    const referenceAssets = buildReferenceAssetPayload(job);
    const language = normalizedUnicode(metadata.language ?? null);
    const regionalLanguage = normalizeRegionalLanguage(metadata.AnghamiLanguage
        ?? metadata.regionalLanguage
        ?? metadata.language
        ?? null);
    const textDirection = isRtlLanguage(regionalLanguage) ? "rtl" : "ltr";
    return Object.freeze({
        reportId: `Anghami-music-metadata:${job.releaseId}`,
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
        AnghamiArtistId: normalizedUnicode(metadata.AnghamiArtistId ?? metadata.AnghamiMusicArtistId ?? null),
        AnghamiCatalogId: normalizedUnicode(metadata.AnghamiCatalogId ?? metadata.AnghamiMusicCatalogId ?? null),
        AnghamiHiResEnabled: Boolean(metadata.AnghamiHiResEnabled ?? metadata.hiResEnabled ?? false),
        AnghamiDolbyAtmosEnabled: Boolean(metadata.AnghamiDolbyAtmosEnabled ?? metadata.dolbyAtmosEnabled ?? false),
        AnghamiSony360Enabled: Boolean(metadata.AnghamiSony360Enabled ?? metadata.sony360Enabled ?? false),
        editorialMetadata: Object.freeze({
            explicit: Boolean(metadata.explicit ?? false),
            editorNotes: normalizedUnicode(metadata.editorNotes ?? null),
        }),
        AnghamiReleaseWindow: normalizedUnicode(metadata.AnghamiReleaseWindow ?? null),
        referenceUrls: contentReferenceList(release ?? null, job),
        referenceAssets: referenceAssets.referenceAssets,
        unicodeFields: Object.freeze({
            releaseTitle: normalizedUnicode(release?.title ?? null) !== null,
            primaryArtist: normalizedUnicode(release?.primaryArtist ?? null) !== null,
            label: normalizedUnicode(release?.label ?? null) !== null,
        }),
    });
}
export class AnghamiConnector extends DSPConnectorShell {
    constructor(dependencies) {
        super(dependencies, "Anghami");
    }
    async normalizeMetadata(job) {
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
                regionalLanguage: normalizeRegionalLanguage(metadata.AnghamiLanguage
                    ?? metadata.regionalLanguage
                    ?? metadata.language
                    ?? null),
                textDirection: isRtlLanguage(normalizeRegionalLanguage(metadata.AnghamiLanguage
                    ?? metadata.regionalLanguage
                    ?? metadata.language
                    ?? null)) ? "rtl" : "ltr",
                rtlRenderingCompatible: Boolean(isRtlLanguage(normalizeRegionalLanguage(metadata.AnghamiLanguage
                    ?? metadata.regionalLanguage
                    ?? metadata.language
                    ?? null))),
                territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
                contributors: normalizeContributorSummary(release ?? null),
                rightsOwned: Boolean(metadata.rightsOwned ?? false),
                unicodeValidated: true,
                supportedRegionalLanguages: SUPPORTED_REGIONAL_LANGUAGES,
                AnghamiArtistId: normalizedUnicode(metadata.AnghamiArtistId ?? metadata.AnghamiMusicArtistId ?? null),
                AnghamiCatalogId: normalizedUnicode(metadata.AnghamiCatalogId ?? metadata.AnghamiMusicCatalogId ?? null),
                AnghamiDeliveryReferenceUrl: normalizedUnicode(metadata.AnghamiDeliveryReferenceUrl ?? null),
            }),
            language: normalizeRegionalLanguage(metadata.AnghamiLanguage ?? metadata.regionalLanguage ?? metadata.language ?? null),
            territories: normalizedList(job.target.territories).map((territory) => territory.toUpperCase()),
            createdAt: nowIso(),
        });
    }
}
export class AnghamiAuthentication {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async authenticate(job) {
        const packageModel = await this.dependencies.connector.buildPackage(job);
        const context = buildContext(job, packageModel, this.dependencies.connector);
        return this.dependencies.connector.authenticate(context);
    }
}
export class AnghamiPackageBuilder {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    build(job) {
        return this.dependencies.connector.buildPackage(job);
    }
}
export class AnghamiMetadataNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeMetadata(job);
    }
}
export class AnghamiArtworkNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeArtwork(job);
    }
}
export class AnghamiAudioNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeAudio(job);
    }
}
export class AnghamiDeliveryService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    deliver(job) {
        return this.dependencies.connector.deliver(job);
    }
}
export class AnghamiPollingService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    poll(job) {
        return this.dependencies.connector.pollStatus(job);
    }
}
export class AnghamiWebhookService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    validate(event) {
        return this.dependencies.connector.validateWebhook(event);
    }
    parse(event) {
        return this.dependencies.connector.parseWebhook(event);
    }
    async handle(event) {
        const valid = await Promise.resolve(this.validate(event));
        const parsed = await Promise.resolve(this.parse(event));
        const audit = new AnghamiDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
        return { valid, event: parsed, audit };
    }
}
export class AnghamiWithdrawalService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    withdraw(job) {
        return this.dependencies.connector.withdraw(job);
    }
}
export class AnghamiRestoreService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    restore(job) {
        return this.dependencies.connector.restore(job);
    }
}
export class AnghamiRetryPolicy {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    shouldRetry(error, attempt, job) {
        return this.dependencies.connector.shouldRetry(error, attempt, job);
    }
    nextRetryAt(error, attempt, job) {
        return this.dependencies.connector.nextRetryAt(error, attempt, job);
    }
}
export class AnghamiHealthCheck {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    healthCheck(job) {
        return this.dependencies.connector.healthCheck(job);
    }
}
export class AnghamiCapabilityResolver {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    resolve(connectorId = "Anghami") {
        void connectorId;
        return this.dependencies.connector.capabilities;
    }
}
export class AnghamiErrorTranslator {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    translate(error, job) {
        if (error instanceof ConnectorError)
            return error;
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Anghami operation failed";
        const stack = error instanceof Error ? error.stack ?? null : null;
        const lowered = message.toLowerCase();
        const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
        const code = /auth|unauthoriz|forbidden|token/i.test(message) ? "ANGHAMI_MUSIC_AUTH_FAILED"
            : /webhook|signature/i.test(message) ? "ANGHAMI_MUSIC_WEBHOOK_INVALID"
                : /withdraw/i.test(message) ? "ANGHAMI_MUSIC_WITHDRAWAL_FAILED"
                    : /restore/i.test(message) ? "ANGHAMI_MUSIC_RESTORE_FAILED"
                        : /health/i.test(message) ? "ANGHAMI_MUSIC_HEALTH_CHECK_FAILED"
                            : retryable ? "ANGHAMI_MUSIC_RETRYABLE_ERROR"
                                : "ANGHAMI_MUSIC_OPERATION_FAILED";
        return new ConnectorError({
            connectorId: "Anghami",
            code,
            message,
            retryable,
            metadata: freeze({
                connectorId: "Anghami",
                releaseId: job.releaseId,
                jobId: job.jobId,
                target: job.target.partnerName,
                stack,
            }),
        });
    }
}
export class AnghamiDeliveryAudit {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    record(reportType, payload) {
        const audit = Object.freeze({
            auditId: `Anghami:${reportType}:${nowIso(this.dependencies.clock)}`,
            reportType,
            recordedAt: nowIso(this.dependencies.clock),
            payload: freeze({ ...payload }),
        });
        this.dependencies.logger?.info?.("Anghami audit record generated", { component: "Anghami-connector", reportType, payload: audit.payload });
        return audit;
    }
    recordWebhook(event, valid) {
        return this.record("webhook", {
            webhookId: event.webhookId,
            connectorId: event.connectorId,
            releaseId: event.releaseId,
            eventType: event.eventType,
            receivedAt: event.receivedAt,
            valid,
        });
    }
    buildDeliveryReport(job, result) {
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
    buildHealthReport(connectorId, health) {
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
    buildCapabilityReport(connectorId) {
        const capabilities = this.dependencies.connector.capabilities;
        return Object.freeze({
            connectorId,
            generatedAt: nowIso(this.dependencies.clock),
            capabilities,
        });
    }
    buildErrorReport(job, errors) {
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
    buildMetadataReport(job) {
        const release = this.requireRelease(job);
        return buildAnghamiMetadata({ ...job, release });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new ConnectorError({
                connectorId: "Anghami",
                code: "ANGHAMI_MUSIC_RELEASE_REQUIRED",
                message: "Anghami delivery requires a release payload.",
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
export class AnghamiEnterpriseService {
    dependencies;
    authentication;
    packageBuilder;
    metadataNormalizer;
    artworkNormalizer;
    audioNormalizer;
    deliveryService;
    pollingService;
    webhookService;
    withdrawalService;
    restoreService;
    retryPolicy;
    healthChecker;
    capabilityResolver;
    errorTranslator;
    deliveryAudit;
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.authentication = new AnghamiAuthentication(dependencies);
        this.packageBuilder = new AnghamiPackageBuilder(dependencies);
        this.metadataNormalizer = new AnghamiMetadataNormalizer(dependencies);
        this.artworkNormalizer = new AnghamiArtworkNormalizer(dependencies);
        this.audioNormalizer = new AnghamiAudioNormalizer(dependencies);
        this.deliveryService = new AnghamiDeliveryService(dependencies);
        this.pollingService = new AnghamiPollingService(dependencies);
        this.webhookService = new AnghamiWebhookService(dependencies);
        this.withdrawalService = new AnghamiWithdrawalService(dependencies);
        this.restoreService = new AnghamiRestoreService(dependencies);
        this.retryPolicy = new AnghamiRetryPolicy(dependencies);
        this.healthChecker = new AnghamiHealthCheck(dependencies);
        this.capabilityResolver = new AnghamiCapabilityResolver(dependencies);
        this.errorTranslator = new AnghamiErrorTranslator(dependencies);
        this.deliveryAudit = new AnghamiDeliveryAudit(dependencies);
    }
    authenticate(job) { return this.authentication.authenticate(job); }
    buildPackage(job) { return this.packageBuilder.build(job); }
    normalizeMetadata(job) { return this.metadataNormalizer.normalize(job); }
    normalizeArtwork(job) { return this.artworkNormalizer.normalize(job); }
    normalizeAudio(job) { return this.audioNormalizer.normalize(job); }
    deliver(job) { return this.deliveryService.deliver(job); }
    pollStatus(job) { return this.pollingService.poll(job); }
    withdraw(job) { return this.withdrawalService.withdraw(job); }
    restore(job) { return this.restoreService.restore(job); }
    retry(error, attempt, job) {
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
        });
    }
    healthCheck(job) { return this.healthChecker.healthCheck(job); }
    translateError(error, job) { return this.errorTranslator.translate(error, job); }
    resolveCapabilities(connectorId = "Anghami") { return this.capabilityResolver.resolve(connectorId); }
    validateWebhook(event) { return this.webhookService.validate(event); }
    parseWebhook(event) { return this.webhookService.parse(event); }
    handleWebhook(event) { return this.webhookService.handle(event); }
    generateDeliveryReport(job, result) { return this.deliveryAudit.buildDeliveryReport(job, result); }
    generateHealthReport(connectorId, health) { return this.deliveryAudit.buildHealthReport(connectorId, health); }
    generateCapabilityReport(connectorId) { return this.deliveryAudit.buildCapabilityReport(connectorId); }
    generateMetadataReport(job) { return this.deliveryAudit.buildMetadataReport(job); }
    generateErrorReport(job, errors) { return this.deliveryAudit.buildErrorReport(job, errors); }
}
export function createAnghamiConnectorFrameworkDefaults() {
    return Object.freeze({ supportedRegionalLanguages: SUPPORTED_REGIONAL_LANGUAGES });
}
