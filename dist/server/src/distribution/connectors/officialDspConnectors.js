import { ConnectorCapabilities } from "./capabilities/connectorCapabilities.js";
import { ConnectorCredentials } from "./configuration/connectorConfiguration.js";
import { ConnectorDelivery } from "./delivery/connectorDelivery.js";
import { ConnectorError } from "./errors/connectorError.js";
import { ConnectorHealth } from "./health/connectorHealth.js";
import { ConnectorMetadata } from "./metadata/connectorMetadata.js";
import { ConnectorPolling } from "./polling/connectorPolling.js";
import { ConnectorReport } from "./reports/connectorReport.js";
import { ConnectorRetry } from "./retry/connectorRetry.js";
import { ConnectorRoyalty } from "./royalties/connectorRoyalty.js";
import { ConnectorStatus } from "./status/connectorStatus.js";
import { ConnectorTakedown } from "./takedown/connectorTakedown.js";
import { ConnectorWebhook } from "./webhooks/connectorWebhook.js";
import { ProviderUploadContext, ProviderRoyaltyBatch, ProviderReportBatch } from "../provider-integration/types/providerIntegrationTypes.js";
import { ProviderStatus } from "../providers/providerStatus.js";
import { DistributionStatus } from "../core/distributionStatus.js";
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
]);
function nowIso() {
    return new Date().toISOString();
}
function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
function freezeHeaders(value) {
    return Object.freeze({ ...value });
}
function freezeAttributes(value) {
    return Object.freeze({ ...value });
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function buildConnectorEventType(operation) {
    if (operation.includes("health"))
        return "HealthChanged";
    if (operation.includes("report"))
        return "ReportGenerated";
    if (operation.includes("royalt"))
        return "RoyaltyImported";
    if (operation.includes("auth"))
        return "ConnectorAuthenticated";
    if (operation.includes("upload") || operation.includes("submit"))
        return "UploadCompleted";
    if (operation.includes("status"))
        return "StatusChanged";
    return "ConnectorRegistered";
}
function mapConnectorStatusCategory(status) {
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
function supportedCategoriesForConnector(connectorId) {
    switch (connectorId) {
        case "TikTok":
        case "Meta":
        case "YouTubeMusic":
            return Object.freeze(["Music", "Video", "Territories", "Languages", "Monetization", "Royalty Reporting"]);
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
            return Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting"]);
    }
}
function supportedUploadModes() {
    return Object.freeze(["Single Upload", "Multipart Upload", "Chunk Upload", "Resumable Upload", "Streaming Upload"]);
}
function defaultFeatures() {
    return Object.freeze(["metadata-validation", "asset-validation", "status-sync", "retry", "rate-limit"]);
}
function rateLimitFromSettings(settings) {
    const limit = typeof settings.rateLimit === "number" && Number.isFinite(settings.rateLimit) ? Math.max(1, Math.floor(settings.rateLimit)) : 100;
    const remaining = typeof settings.rateLimitRemaining === "number" && Number.isFinite(settings.rateLimitRemaining)
        ? Math.max(0, Math.floor(settings.rateLimitRemaining))
        : limit;
    const resetAt = typeof settings.rateLimitResetAt === "string" ? settings.rateLimitResetAt : null;
    return Object.freeze({ limit, remaining, resetAt });
}
function createCredentials(connectorId, authenticationType, session, fallbackMetadata = {}) {
    const authentication = session?.credentials && typeof session.credentials === "object" && "authentication" in session.credentials
        ? session.credentials.authentication
        : null;
    const frameworkValue = session?.credentials && typeof session.credentials === "object" && "secret" in session.credentials
        ? session.credentials
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
function createCapabilities(connectorId, configuration, integrationCapabilities) {
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
function createConnectorStatus(connectorId, releaseId, status, providerStatus, metadata = {}) {
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
function createHealth(connectorId, healthy, latencyMs, details = {}) {
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
function createPolling(connectorId, releaseId, payload = {}) {
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
function createReport(connectorId, releaseId, reportType, payload = {}) {
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
function createRoyalty(connectorId, releaseId, features, reportPeriod, metadata = {}) {
    return new ConnectorRoyalty({
        connectorId,
        releaseId,
        features,
        reportPeriod,
        importedAt: nowIso(),
        metadata: freezeMetadata({ connectorId, releaseId, reportPeriod, ...metadata }),
    });
}
function createTakedown(connectorId, releaseId, metadata = {}) {
    return new ConnectorTakedown({
        takedownId: `${connectorId}:takedown:${releaseId}:${Date.now().toString(36)}`,
        connectorId,
        releaseId,
        requestedAt: nowIso(),
        completedAt: nowIso(),
        metadata: freezeMetadata({ connectorId, releaseId, ...metadata }),
    });
}
function createMetadata(connectorId, releaseId, payload, context) {
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
function createDelivery(connectorId, releaseId, assets, payload = {}) {
    return new ConnectorDelivery({
        deliveryId: `${connectorId}:delivery:${releaseId}:${Date.now().toString(36)}`,
        connectorId,
        releaseId,
        assets,
        submittedAt: nowIso(),
        metadata: freezeMetadata({ connectorId, releaseId, ...payload }),
    });
}
function createWebhook(connectorId, releaseId, eventType, headers, payload, signatureValid) {
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
function createRetry(connectorId, releaseId, retryCount, metadata = {}) {
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
function createSubmissionFromContext(context, metadata = {}) {
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
function createPlaceholderResponse(connectorId, payload, operation, metadata = {}) {
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
function createSuccessResponse(connectorId, payload, operation, metadata = {}) {
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
function createFailureError(connectorId, operation, message, metadata = {}, retryable = false) {
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
export class OfficialDspConnectorBase {
    dependencies;
    connectorId;
    version;
    configuration;
    credentialValue = null;
    lifecycleStage = "Created";
    lifecycleHistory = [];
    auditTrail = [];
    rateLimitState = new Map();
    constructor(connectorId, context, dependencies) {
        this.dependencies = dependencies;
        if (context.connectorId !== connectorId) {
            throw new Error(`ConnectorContext.connectorId must match ${connectorId}`);
        }
        this.connectorId = connectorId;
        this.version = ensure(context.connectorVersion, "connectorVersion");
        this.configuration = context.configuration;
        this.advanceLifecycle("Configured", "Connector instantiated");
        this.log("info", "official connector instantiated", { connectorId, version: this.version, releaseId: context.releaseId });
    }
    get credentials() {
        return this.credentialValue;
    }
    get lifecycle() {
        return Object.freeze({
            stage: this.lifecycleStage,
            history: Object.freeze([...this.lifecycleHistory]),
            updatedAt: this.lifecycleHistory.length ? this.lifecycleHistory[this.lifecycleHistory.length - 1].transitionedAt : nowIso(),
        });
    }
    get logger() {
        return this.dependencies.logger ?? {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        };
    }
    get metrics() {
        return this.dependencies.metrics ?? {
            increment: () => undefined,
            observe: () => undefined,
            gauge: () => undefined,
        };
    }
    resolveIntegration() {
        const activationGate = this.dependencies.activationGate;
        const partnerName = this.connectorId;
        if (!activationGate || !activationGate.isPartnerActive(partnerName)) {
            return null;
        }
        return this.dependencies.providerResolver.resolve(partnerName);
    }
    operationContext(context, metadata = {}) {
        return freezeMetadata({
            connectorId: this.connectorId,
            version: this.version,
            releaseId: context.releaseId,
            executionId: context.executionId,
            providerReference: context.providerReference,
            ...metadata,
        });
    }
    emitEvent(type, releaseId, payload = {}) {
        this.auditTrail.push(type);
        this.logger.debug(`connector event ${type}`, freezeMetadata({ connectorId: this.connectorId, releaseId, ...payload }));
    }
    advanceLifecycle(stage, reason = null) {
        this.lifecycleStage = stage;
        this.lifecycleHistory.push(Object.freeze({ stage, reason, transitionedAt: nowIso() }));
    }
    async resolveProviderHealth(integration, releaseId) {
        if (!integration) {
            return createHealth(this.connectorId, false, null, {
                releaseId,
                source: "spec-boundary",
                message: "Official partner specification required",
            });
        }
        const health = await integration.health();
        const details = health.health;
        return createHealth(this.connectorId, Boolean(health.healthy), typeof health.latencyMs === "number" ? health.latencyMs : null, {
            releaseId,
            provider: health.providerName,
            adapter: integration.adapterName,
            status: String(details.status ?? "READY"),
            message: String(details.message ?? "Healthy"),
            officialPartnerSpecRequired: false,
        });
    }
    buildCapabilities(integration, context) {
        const providerCapabilities = integration ? integration.adapter.resolveCapabilities() : null;
        const resolved = providerCapabilities && typeof providerCapabilities === "object" ? providerCapabilities : null;
        return createCapabilities(this.connectorId, this.configuration, resolved);
    }
    resolveCredentials(session) {
        return createCredentials(this.connectorId, this.configuration.authenticationType, session, this.operationContextFromSession(session));
    }
    operationContextFromSession(session) {
        return freezeMetadata({
            sessionId: session?.sessionId ?? null,
            providerName: session?.providerName ?? this.connectorId,
            providerVersion: session?.providerVersion ?? this.version,
            authenticated: session?.authenticated ?? false,
        });
    }
    resolveReleaseId(releaseId) {
        return ensure(releaseId, "releaseId");
    }
    resolveConnectorStatus(releaseId, status, providerStatus, metadata = {}) {
        return createConnectorStatus(this.connectorId, releaseId, status, providerStatus, metadata);
    }
    resolvePolling(releaseId, payload = {}) {
        return createPolling(this.connectorId, releaseId, payload);
    }
    resolveReport(releaseId, reportType, payload = {}) {
        return createReport(this.connectorId, releaseId, reportType, payload);
    }
    resolveRoyalty(releaseId, features, reportPeriod, metadata = {}) {
        return createRoyalty(this.connectorId, releaseId, features, reportPeriod, metadata);
    }
    resolveTakedown(releaseId, metadata = {}) {
        return createTakedown(this.connectorId, releaseId, metadata);
    }
    resolveMetadata(releaseId, payload, context) {
        return createMetadata(this.connectorId, releaseId, payload, context);
    }
    resolveDelivery(releaseId, assets, payload = {}) {
        return createDelivery(this.connectorId, releaseId, assets, payload);
    }
    resolveWebhook(releaseId, eventType, headers, payload, signatureValid) {
        return createWebhook(this.connectorId, releaseId, eventType, headers, payload, signatureValid);
    }
    resolveRetry(releaseId, retryCount, metadata = {}) {
        return createRetry(this.connectorId, releaseId, retryCount, metadata);
    }
    getRateLimit() {
        const current = this.rateLimitState.get(this.connectorId) ?? rateLimitFromSettings(this.configuration.settings);
        this.rateLimitState.set(this.connectorId, current);
        return current;
    }
    consumeRateLimit(amount = 1) {
        const current = this.getRateLimit();
        this.rateLimitState.set(this.connectorId, {
            limit: current.limit,
            remaining: Math.max(0, current.remaining - Math.max(1, Math.floor(amount))),
            resetAt: current.resetAt,
        });
    }
    evaluateShouldRetry(error, attempt) {
        if (attempt >= 5) {
            return false;
        }
        if (error instanceof ConnectorError) {
            return error.retryable;
        }
        return true;
    }
    computeNextRetryAt(_error, attempt) {
        const delayMs = Math.min(30 * 60_000, 1_000 * Math.pow(2, Math.max(0, attempt)));
        return new Date(Date.now() + delayMs).toISOString();
    }
    log(level, message, context = {}) {
        this.logger[level](message, freezeMetadata({ connectorId: this.connectorId, version: this.version, ...context }));
    }
    recordMetric(metric, value = 1, tags = {}) {
        this.metrics.increment(metric, value, tags);
    }
    placeholder(operation, payload, metadata = {}) {
        this.log("warn", `${this.connectorId}.${operation} is awaiting official DSP partner specification`, metadata);
        this.recordMetric(`connector.${this.connectorId}.${operation}.placeholder`, 1, { connectorId: this.connectorId, operation });
        this.advanceLifecycle("Failed", `Official DSP partner specification required for ${operation}`);
        return createPlaceholderResponse(this.connectorId, payload, operation, metadata);
    }
    success(operation, payload, metadata = {}) {
        this.log("info", `${this.connectorId}.${operation} completed`, metadata);
        this.recordMetric(`connector.${this.connectorId}.${operation}.success`, 1, { connectorId: this.connectorId, operation });
        return createSuccessResponse(this.connectorId, payload, operation, metadata);
    }
    async authenticate(context) {
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
    async validateCapabilities(context, capabilities) {
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
    async uploadAssets(context, assets) {
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
            capabilities: integration.adapter.resolveCapabilities(),
            metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
            connectorPayload: freezeMetadata({ assetCount: assets.length, assets: assets.map((asset) => asset.assetId) }),
            createdAt: context.createdAt,
            metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
        });
        const result = await Promise.resolve(integration.adapter.upload(providerContext));
        const payload = result.success ? assets : assets;
        return this.success("uploadAssets", payload, this.operationContext(context, { uploadId: result.uploadId, providerUploadId: result.uploadId, success: result.success }));
    }
    async submitMetadata(context, metadata) {
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
            capabilities: integration.adapter.resolveCapabilities(),
            metadataMap: freezeMetadata({ ...context.configuration.settings, ...metadata.payload }),
            connectorPayload: freezeMetadata({ metadata: metadata.payload }),
            createdAt: context.createdAt,
            metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
        });
        await Promise.resolve(integration.adapter.submitMetadata(providerContext));
        return this.success("submitMetadata", metadata, this.operationContext(context, { releaseId: metadata.releaseId, language: metadata.language, territories: metadata.territories }));
    }
    async createRelease(context, submission) {
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
            capabilities: integration.adapter.resolveCapabilities(),
            metadataMap: freezeMetadata({ ...context.configuration.settings, ...submission.metadata }),
            connectorPayload: freezeMetadata({ submissionId: submission.submissionId, releaseId: submission.releaseId }),
            createdAt: context.createdAt,
            metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
        });
        await Promise.resolve(integration.adapter.createRelease(providerContext));
        return this.success("createRelease", submission, this.operationContext(context, { submissionId: submission.submissionId, accepted: submission.accepted }));
    }
    async trackProcessing(context) {
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
            capabilities: integration.adapter.resolveCapabilities(),
            metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
            connectorPayload: freezeMetadata({ releaseId: context.releaseId, phase: "processing" }),
            createdAt: context.createdAt,
            metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
        });
        const snapshot = await Promise.resolve(integration.adapter.trackStatus(providerContext));
        const status = this.statusFromProviderSnapshot(snapshot, context.releaseId);
        return this.success("trackProcessing", status, this.operationContext(context, { providerSnapshotId: snapshot.snapshotId, providerStatus: String(snapshot.status), healthy: snapshot.healthy }));
    }
    async trackLiveStatus(context) {
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
            capabilities: integration.adapter.resolveCapabilities(),
            metadataMap: freezeMetadata({ ...context.configuration.settings, ...context.metadata }),
            connectorPayload: freezeMetadata({ releaseId: context.releaseId, phase: "live" }),
            createdAt: context.createdAt,
            metadata: freezeMetadata({ connectorId: this.connectorId, releaseId: context.releaseId, executionId: context.executionId }),
        });
        const snapshot = await Promise.resolve(integration.adapter.trackStatus(providerContext));
        const status = this.statusFromProviderSnapshot(snapshot, context.releaseId);
        return this.success("trackLiveStatus", status, this.operationContext(context, { providerSnapshotId: snapshot.snapshotId, providerStatus: String(snapshot.status), healthy: snapshot.healthy }));
    }
    async importRoyalties(context) {
        const integration = this.resolveIntegration();
        this.advanceLifecycle("Reported", "Royalty import requested");
        const reportPeriod = context.attributes.reportPeriod ? String(context.attributes.reportPeriod) : "unknown";
        const features = Object.freeze([
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
    async generateReport(context) {
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
    async takedownRelease(context) {
        const integration = this.resolveIntegration();
        this.advanceLifecycle("Takedown", "Takedown requested");
        if (!integration) {
            return this.placeholder("takedownRelease", createTakedown(this.connectorId, context.releaseId, this.operationContext(context)), this.operationContext(context));
        }
        await Promise.resolve(integration.adapter.takedown());
        return this.success("takedownRelease", createTakedown(this.connectorId, context.releaseId, this.operationContext(context)), this.operationContext(context));
    }
    async checkHealth(context) {
        const integration = this.resolveIntegration();
        const start = Date.now();
        if (!integration) {
            const health = createHealth(this.connectorId, false, null, this.operationContext(context, { message: "Official partner specification required" }));
            this.advanceLifecycle("Degraded", "Connector health unavailable");
            return this.placeholder("checkHealth", health, this.operationContext(context));
        }
        const providerHealth = await integration.health();
        const providerHealthDetails = providerHealth.health;
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
    async refreshCredentials(context) {
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
    async resolveCapabilities(context) {
        const integration = this.resolveIntegration();
        return this.buildCapabilities(integration, context);
    }
    getCapabilities(context) {
        return this.resolveCapabilities(context);
    }
    async uploadSingle(asset) {
        return asset;
    }
    async uploadMultipart(assets) {
        return assets;
    }
    async uploadChunk(asset, _chunk) {
        return asset;
    }
    async uploadResumable(asset) {
        return asset;
    }
    async uploadStreaming(asset) {
        return asset;
    }
    async submitMetadataPayload(metadata) {
        return metadata;
    }
    async createReleasePayload(submission) {
        return submission;
    }
    async updateReleasePayload(submission) {
        return submission;
    }
    async getStatus(releaseId) {
        return createConnectorStatus(this.connectorId, releaseId, "Processing", "OFFICIAL_DSP_SPEC_REQUIRED");
    }
    async pollReleaseStatus(releaseId) {
        return createPolling(this.connectorId, releaseId);
    }
    async validateSignature(webhook) {
        return Boolean(webhook.signatureValid);
    }
    async parseWebhook(webhook) {
        return webhook;
    }
    async receiveWebhook(event) {
        return this.parseWebhook(event);
    }
    async importRoyaltiesById(releaseId) {
        return createRoyalty(this.connectorId, releaseId, Object.freeze(["Streaming Reports"]), "unknown");
    }
    async generateConnectorReportById(releaseId) {
        return createReport(this.connectorId, releaseId, "delivery");
    }
    async takedownReleaseById(releaseId) {
        return createTakedown(this.connectorId, releaseId);
    }
    checkHealthById(connectorId) {
        return createHealth(connectorId, true, 0);
    }
    getLimitFor(_connectorId) {
        return this.getRateLimit().limit;
    }
    getRemainingFor(_connectorId) {
        return this.getRateLimit().remaining;
    }
    consumeFor(_connectorId, amount = 1) {
        this.consumeRateLimit(amount);
    }
    shouldRetry(error, attempt) {
        return this.evaluateShouldRetry(error, attempt);
    }
    nextRetryAt(error, attempt) {
        return this.computeNextRetryAt(error, attempt);
    }
    async upload(context, assets) {
        return this.uploadAssets(context, assets);
    }
    async submit(context, submission) {
        return this.createRelease(context, submission);
    }
    async status(context) {
        return this.trackProcessing(context);
    }
    async webhook(event) {
        const valid = await this.validateSignature(event);
        const parsed = await this.parseWebhook(event);
        const response = valid
            ? this.success("webhook", parsed, freezeMetadata({ connectorId: this.connectorId, releaseId: parsed.releaseId, eventType: parsed.eventType, signatureValid: true }))
            : this.placeholder("webhook", parsed, freezeMetadata({ connectorId: this.connectorId, releaseId: parsed.releaseId, eventType: parsed.eventType, signatureValid: false }));
        return response;
    }
    async poll(context) {
        const polling = createPolling(this.connectorId, context.releaseId, this.operationContext(context));
        return this.success("poll", polling, this.operationContext(context));
    }
    async royalties(context) {
        return this.importRoyalties(context);
    }
    async reports(context) {
        return this.generateReport(context);
    }
    async takedown(context) {
        return this.takedownRelease(context);
    }
    async health(context) {
        return this.checkHealth(context);
    }
    async capabilities(context) {
        const capabilities = await Promise.resolve(this.buildCapabilities(this.resolveIntegration(), context));
        return this.success("capabilities", capabilities, this.operationContext(context));
    }
    async validateMetadata(context, metadata) {
        return this.submitMetadata(context, metadata);
    }
    async validateAssets(context, assets) {
        return this.uploadAssets(context, assets);
    }
    async createReleasePackage(context, submission, assets = []) {
        const delivery = createDelivery(this.connectorId, context.releaseId, assets, this.operationContext(context, { submissionId: submission.submissionId }));
        return this.success("createReleasePackage", delivery, this.operationContext(context));
    }
    async uploadAudio(context, asset) {
        return this.success("uploadAudio", asset, this.operationContext(context, { assetId: asset.assetId, kind: asset.kind }));
    }
    async uploadArtwork(context, asset) {
        return this.success("uploadArtwork", asset, this.operationContext(context, { assetId: asset.assetId, kind: asset.kind }));
    }
    async uploadMetadata(context, metadata) {
        return this.submitMetadata(context, metadata);
    }
    async submitRelease(context, submission) {
        return this.createRelease(context, submission);
    }
    async updateRelease(context, submission) {
        return this.success("updateRelease", submission, this.operationContext(context));
    }
    async scheduleRelease(context, submission) {
        return this.success("scheduleRelease", submission, this.operationContext(context, { scheduledAt: submission.submittedAt }));
    }
    async fetchDeliveryStatus(context) {
        return this.trackProcessing(context);
    }
    async fetchReleaseStatus(context) {
        return this.trackLiveStatus(context);
    }
    async importReports(context) {
        return this.generateReport(context);
    }
    async discoverCapabilities(context) {
        return Promise.resolve(this.resolveCapabilities(context)).then((capabilities) => this.validateCapabilities(context, capabilities));
    }
    async fetchDeliveryAcknowledgement(context, submission) {
        return this.createReleasePackage(context, submission);
    }
    async retryOperation(context, retryCount = 0) {
        const retry = this.resolveRetry(context.releaseId, retryCount, this.operationContext(context));
        return this.success("retryOperation", retry, this.operationContext(context, { retryCount }));
    }
    async rateLimitSnapshot(context) {
        return this.success("rateLimitSnapshot", this.getRateLimit(), this.operationContext(context));
    }
    statusFromProviderSnapshot(snapshot, releaseId) {
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
    constructor(context, dependencies) {
        super("Spotify", context, dependencies);
    }
}
class AppleMusicConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("AppleMusic", context, dependencies);
    }
}
class YouTubeMusicConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("YouTubeMusic", context, dependencies);
    }
}
class AmazonMusicConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("AmazonMusic", context, dependencies);
    }
}
class DeezerConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Deezer", context, dependencies);
    }
}
class TikTokConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("TikTok", context, dependencies);
    }
}
class MetaConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Meta", context, dependencies);
    }
}
class JioSaavnConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("JioSaavn", context, dependencies);
    }
}
class GaanaConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Gaana", context, dependencies);
    }
}
class WynkConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Wynk", context, dependencies);
    }
}
class BoomplayConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Boomplay", context, dependencies);
    }
}
class AnghamiConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Anghami", context, dependencies);
    }
}
class TidalConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("Tidal", context, dependencies);
    }
}
class KKBOXConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("KKBOX", context, dependencies);
    }
}
class LineMusicConnector extends OfficialDspConnectorBase {
    constructor(context, dependencies) {
        super("LineMusic", context, dependencies);
    }
}
export class OfficialDspConnectorFactory {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    create(context) {
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
export { OFFICIAL_DSP_CONNECTORS, SpotifyConnector, AppleMusicConnector, YouTubeMusicConnector, AmazonMusicConnector, DeezerConnector, TikTokConnector, MetaConnector, JioSaavnConnector, GaanaConnector, WynkConnector, BoomplayConnector, AnghamiConnector, TidalConnector, KKBOXConnector, LineMusicConnector, };
