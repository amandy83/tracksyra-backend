import { ConnectorContext } from "../context/connectorContext.js";
import { ConnectorError } from "../errors/connectorError.js";
function nowIso(clock) {
    return typeof clock === "function" ? clock() : new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function safeText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function normalizedList(values) {
    return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}
function createContext(job, packageModel, connector) {
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
        const contributorName = safeText(name);
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
function releaseMetadata(release) {
    return release ? (release.metadata ?? {}) : {};
}
export class SpotifyAuthentication {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async authenticate(job) {
        const packageModel = await this.dependencies.connector.buildPackage(job);
        const context = createContext(job, packageModel, this.dependencies.connector);
        return this.dependencies.connector.authenticate(context);
    }
}
export class SpotifyPackageBuilder {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    build(job) {
        return this.dependencies.connector.buildPackage(job);
    }
}
export class SpotifyMetadataNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeMetadata(job);
    }
}
export class SpotifyArtworkNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeArtwork(job);
    }
}
export class SpotifyAudioNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeAudio(job);
    }
}
export class SpotifyDeliveryService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    deliver(job) {
        return this.dependencies.connector.deliver(job);
    }
}
export class SpotifyPollingService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    poll(job) {
        return this.dependencies.connector.pollStatus(job);
    }
}
export class SpotifyWebhookService {
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
        const audit = new SpotifyDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
        return { valid, event: parsed, audit };
    }
}
export class SpotifyWithdrawalService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    withdraw(job) {
        return this.dependencies.connector.withdraw(job);
    }
}
export class SpotifyRestoreService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    restore(job) {
        return this.dependencies.connector.restore(job);
    }
}
export class SpotifyRetryPolicy {
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
export class SpotifyHealthCheck {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    healthCheck(job) {
        return this.dependencies.connector.healthCheck(job);
    }
}
export class SpotifyCapabilityResolver {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    resolve(connectorId = "Spotify") {
        void connectorId;
        return this.dependencies.connector.capabilities;
    }
}
export class SpotifyErrorTranslator {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    translate(error, job) {
        if (error instanceof ConnectorError)
            return error;
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Spotify operation failed";
        const stack = error instanceof Error ? error.stack ?? null : null;
        const lowered = message.toLowerCase();
        const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
        const code = /auth|unauthoriz|forbidden|token/i.test(message) ? "SPOTIFY_AUTH_FAILED"
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
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    record(reportType, payload) {
        const audit = Object.freeze({
            auditId: `spotify:${reportType}:${nowIso(this.dependencies.clock)}`,
            reportType,
            recordedAt: nowIso(this.dependencies.clock),
            payload: freeze({ ...payload }),
        });
        this.dependencies.logger?.info?.("spotify audit record generated", { component: "spotify-connector", reportType, payload: audit.payload });
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
        const metadata = releaseMetadata(release);
        const trackMetadata = (release.tracks[0]?.metadata ?? {});
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
            canvasSupport: this.dependencies.connector.capabilities.canvasSupport,
        });
    }
    requireRelease(job) {
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
    authenticate(job) {
        return this.authentication.authenticate(job);
    }
    buildPackage(job) {
        return this.packageBuilder.build(job);
    }
    normalizeMetadata(job) {
        return this.metadataNormalizer.normalize(job);
    }
    normalizeArtwork(job) {
        return this.artworkNormalizer.normalize(job);
    }
    normalizeAudio(job) {
        return this.audioNormalizer.normalize(job);
    }
    deliver(job) {
        return this.deliveryService.deliver(job);
    }
    pollStatus(job) {
        return this.pollingService.poll(job);
    }
    withdraw(job) {
        return this.withdrawalService.withdraw(job);
    }
    restore(job) {
        return this.restoreService.restore(job);
    }
    checkHealth(job) {
        return this.healthChecker.healthCheck(job);
    }
    generateDeliveryReport(job, result) {
        return this.deliveryAudit.buildDeliveryReport(job, result);
    }
    generateHealthReport(connectorId, health) {
        return this.deliveryAudit.buildHealthReport(connectorId, health);
    }
    generateCapabilityReport(connectorId) {
        return this.deliveryAudit.buildCapabilityReport(connectorId);
    }
    generateErrorReport(job, errors) {
        return this.deliveryAudit.buildErrorReport(job, errors);
    }
    generateMetadataReport(job) {
        return this.deliveryAudit.buildMetadataReport(job);
    }
    translateError(error, job) {
        return this.errorTranslator.translate(error, job);
    }
    validateWebhook(event) {
        return this.webhookService.validate(event);
    }
    parseWebhook(event) {
        return this.webhookService.parse(event);
    }
    handleWebhook(event) {
        return this.webhookService.handle(event);
    }
}
