import { ConnectorContext } from "../context/connectorContext.js";
import { ConnectorError } from "../errors/connectorError.js";
import { DSPConnectorShell } from "./spotifyConnector.js";
import { createConnectorCapabilityMatrix } from "./connectorCapabilityMatrix.js";
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
function releaseMetadata(release) {
    return release ? (release.metadata ?? {}) : {};
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
function contentIdReferenceList(release, job) {
    const metadata = release ? releaseMetadata(release) : {};
    const references = [
        safeText(metadata.referenceAudioUrl ?? metadata.youtubeReferenceAudioUrl ?? null),
        safeText(metadata.referenceVideoUrl ?? metadata.youtubeReferenceVideoUrl ?? null),
        safeText(metadata.youtubeContentIdReferenceUrl ?? null),
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
function buildContentIdMetadata(job) {
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
    constructor(dependencies) {
        super(dependencies, "YouTubeMusic");
    }
}
export class YouTubeAuthentication {
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
export class YouTubePackageBuilder {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    build(job) {
        return this.dependencies.connector.buildPackage(job);
    }
}
export class YouTubeMetadataNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeMetadata(job);
    }
}
export class YouTubeArtworkNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeArtwork(job);
    }
}
export class YouTubeAudioNormalizer {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    normalize(job) {
        return this.dependencies.connector.normalizeAudio(job);
    }
}
export class YouTubeDeliveryService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    deliver(job) {
        return this.dependencies.connector.deliver(job);
    }
}
export class YouTubePollingService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    poll(job) {
        return this.dependencies.connector.pollStatus(job);
    }
}
export class YouTubeWebhookService {
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
        const audit = new YouTubeDeliveryAudit(this.dependencies).recordWebhook(parsed, valid);
        return { valid, event: parsed, audit };
    }
}
export class YouTubeWithdrawalService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    withdraw(job) {
        return this.dependencies.connector.withdraw(job);
    }
}
export class YouTubeRestoreService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    restore(job) {
        return this.dependencies.connector.restore(job);
    }
}
export class YouTubeRetryPolicy {
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
export class YouTubeHealthCheck {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    healthCheck(job) {
        return this.dependencies.connector.healthCheck(job);
    }
}
export class YouTubeCapabilityResolver {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    resolve(connectorId = "YouTubeMusic") {
        void connectorId;
        return this.dependencies.connector.capabilities;
    }
}
export class YouTubeErrorTranslator {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    translate(error, job) {
        if (error instanceof ConnectorError)
            return error;
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "YouTube Music operation failed";
        const stack = error instanceof Error ? error.stack ?? null : null;
        const lowered = message.toLowerCase();
        const retryable = /timeout|temporar|rate limit|429|5\d\d|unavailable|network|econnreset|etimedout/.test(lowered);
        const code = /auth|unauthoriz|forbidden|token/i.test(message) ? "YOUTUBE_MUSIC_AUTH_FAILED"
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
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    record(reportType, payload) {
        const audit = Object.freeze({
            auditId: `youtube-music:${reportType}:${nowIso(this.dependencies.clock)}`,
            reportType,
            recordedAt: nowIso(this.dependencies.clock),
            payload: freeze({ ...payload }),
        });
        this.dependencies.logger?.info?.("youtube music audit record generated", { component: "youtube-music-connector", reportType, payload: audit.payload });
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
    buildContentIdReport(job) {
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
    requireRelease(job) {
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
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    generate(job) {
        return new YouTubeDeliveryAudit(this.dependencies).buildContentIdReport(job);
    }
}
export class YouTubeEnterpriseService {
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
    contentIdService;
    constructor(dependencies) {
        this.dependencies = dependencies;
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
    retry(error, attempt, job) {
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
        });
    }
    healthCheck(job) {
        return this.healthChecker.healthCheck(job);
    }
    translateError(error, job) {
        return this.errorTranslator.translate(error, job);
    }
    resolveCapabilities(connectorId = "YouTubeMusic") {
        return this.capabilityResolver.resolve(connectorId);
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
    generateDeliveryReport(job, result) {
        return this.deliveryAudit.buildDeliveryReport(job, result);
    }
    generateHealthReport(connectorId, health) {
        return this.deliveryAudit.buildHealthReport(connectorId, health);
    }
    generateCapabilityReport(connectorId) {
        return this.deliveryAudit.buildCapabilityReport(connectorId);
    }
    generateMetadataReport(job) {
        return this.deliveryAudit.buildMetadataReport(job);
    }
    generateErrorReport(job, errors) {
        return this.deliveryAudit.buildErrorReport(job, errors);
    }
    generateContentIdReport(job) {
        return this.contentIdService.generate(job);
    }
}
export function createYouTubeMusicConnectorFrameworkDefaults() {
    return createConnectorCapabilityMatrix();
}
