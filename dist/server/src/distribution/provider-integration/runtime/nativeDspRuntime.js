import { ConnectorPolling } from "../../connectors/polling/connectorPolling.js";
import { ConnectorReport } from "../../connectors/reports/connectorReport.js";
import { ConnectorRoyalty } from "../../connectors/royalties/connectorRoyalty.js";
import { ConnectorStatus } from "../../connectors/status/connectorStatus.js";
import { createProviderResult } from "../../providers/providerResult.js";
import { ProviderError } from "../../providers/providerError.js";
import { ProviderStatus as FrameworkProviderStatus } from "../../providers/providerStatus.js";
import { ProviderLifecycleStage } from "../../providers/providerStatus.js";
import { DistributionStatus } from "../../core/distributionStatus.js";
import { ProviderIntegrationEvent } from "../events/providerEvents.js";
import { ProviderIntegrationRegistryEntry } from "../registry/providerRegistry.js";
import { ProviderCredentials, ProviderHealthSnapshot, ProviderSelectionResult, ProviderSession, ProviderUploadResult, ProviderStatusSnapshot, ProviderPollingResult, ProviderRoyaltyBatch, ProviderReportBatch, ProviderRetryContext, ProviderCapabilitySet } from "../types/providerIntegrationTypes.js";
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function trimOrThrow(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function timestamp() {
    return new Date().toISOString();
}
function nextId(prefix, providerName, adapterName, sequence) {
    return `${prefix}:${providerName}:${adapterName}:${sequence.toString(36)}:${Date.now().toString(36)}`;
}
function buildIntegrationId(providerName, adapterName, configurationId) {
    return `${providerName}:${adapterName}:${configurationId}`;
}
function hashText(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(31, hash) + value.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}
function cloneMetadata(metadata) {
    return freezeRecord(metadata);
}
function createFrameworkAuthentication(providerName, adapterName, accessToken, refreshToken, expiresInMs) {
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
function createFrameworkCredentials(providerName, adapterName, sequence) {
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
function createProviderCapabilities(configuration) {
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
    ]);
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
function createProviderHealth(record, options = {
    healthy: true,
    latencyMs: 0,
}) {
    const health = Object.freeze({
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
function createLifecycle(providerName, adapterName, stage, history = [], reason) {
    const nextHistory = [...history, { stage, transitionedAt: new Date(), reason: reason ?? null }];
    return Object.freeze({
        provider: providerName,
        version: adapterName,
        stage,
        createdAt: history.length ? history[0].transitionedAt : new Date(),
        lastTransitionAt: nextHistory[nextHistory.length - 1].transitionedAt,
        history: Object.freeze(nextHistory.map((entry) => Object.freeze({ ...entry }))),
        metadata: Object.freeze({
            providerName,
            adapterName,
            reason: reason ?? null,
        }),
    });
}
function createStatusSnapshot(record, statusMapper, input) {
    const providerResult = createProviderResult({
        provider: record.providerName,
        version: record.adapterName,
        operation: input.resultOperation,
        status: FrameworkProviderStatus.READY,
        distributionStatus: statusMapper.toDistributionStatus(typeof input.status === "string" ? input.providerStatus : input.status.status),
        referenceId: `${record.providerName}:${record.adapterName}:${input.releaseId}`,
        completedAt: new Date(),
        payload: Object.freeze({
            releaseId: input.releaseId,
            providerStatus: input.providerStatus,
            status: input.status,
        }),
        health: record.healthSnapshot.health ?? null,
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
function createUploadResult(record, operation, releaseId, statusCategory, success, metadata = {}) {
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
        health: record.healthSnapshot.health,
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
function mapConnectorStatusToDistributionStatus(status) {
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
function mapWebhookToConnectorStatus(event) {
    const eventType = event.payload.eventType.toLowerCase();
    if (event.payload.signatureValid === false)
        return "Failed";
    if (eventType.includes("reject"))
        return "Rejected";
    if (eventType.includes("remove") || eventType.includes("takedown"))
        return "Removed";
    if (eventType.includes("live") || eventType.includes("published"))
        return "Live";
    if (eventType.includes("accept"))
        return "Accepted";
    if (eventType.includes("schedule"))
        return "Scheduled";
    if (eventType.includes("pending"))
        return "Pending";
    return "Processing";
}
function resolveReleaseId(context) {
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
    repositories;
    constructor(repositories) {
        this.repositories = repositories;
    }
    logs = [];
    events = [];
    sequence = 0;
    configSequence = 0;
    saveConfiguration(configuration) {
        const normalized = Object.freeze({
            ...configuration,
            featureFlags: freezeRecord(configuration.featureFlags),
            metadata: cloneMetadata(configuration.metadata),
        });
        this.repositories.configurations.set(normalized.configurationId, {
            configuration: normalized,
            savedAt: timestamp(),
            order: ++this.configSequence,
        });
        return normalized;
    }
    loadConfiguration(providerName) {
        const matches = [...this.repositories.configurations.values()]
            .filter((entry) => entry.configuration.providerName === providerName)
            .sort((left, right) => {
            if (left.configuration.enabled !== right.configuration.enabled)
                return left.configuration.enabled ? -1 : 1;
            if (left.configuration.priority !== right.configuration.priority)
                return right.configuration.priority - left.configuration.priority;
            return right.order - left.order;
        });
        return matches[0]?.configuration ?? null;
    }
    listConfigurations() {
        return Object.freeze([...this.repositories.configurations.values()]
            .sort((left, right) => left.order - right.order)
            .map((entry) => entry.configuration));
    }
    ensureRecord(configuration) {
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
    createRecord(configuration) {
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
        const healthSnapshot = createProviderHealth({
            integrationId: configuration.configurationId,
            providerName: configuration.providerName,
            adapterName: configuration.adapterName,
            configuration,
            integration: null,
            credentials: null,
            session: null,
            capabilitySet,
            healthSnapshot: null,
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
            uploads: new Map(),
            statuses: new Map(),
            webhooks: new Map(),
            polling: new Map(),
            royalties: new Map(),
            reports: new Map(),
            retries: new Map(),
        }, {
            healthy: false,
            latencyMs: 0,
            message: "Integration not yet authenticated",
        });
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
            uploads: new Map(),
            statuses: new Map(),
            webhooks: new Map(),
            polling: new Map(),
            royalties: new Map(),
            reports: new Map(),
            retries: new Map(),
        };
    }
    mergeRecord(record, patch) {
        const merged = {
            ...record,
            ...patch,
            updatedAt: timestamp(),
        };
        return merged;
    }
    getRecord(providerName, adapterName) {
        const records = [...this.repositories.records.values()].filter((record) => record.providerName === providerName && (!adapterName || record.adapterName === adapterName));
        records.sort((left, right) => {
            if (left.configuration.enabled !== right.configuration.enabled)
                return left.configuration.enabled ? -1 : 1;
            if (left.healthSnapshot.healthy !== right.healthSnapshot.healthy)
                return left.healthSnapshot.healthy ? -1 : 1;
            if (left.configuration.priority !== right.configuration.priority)
                return right.configuration.priority - left.configuration.priority;
            if (left.selectionResult?.score !== right.selectionResult?.score)
                return (right.selectionResult?.score ?? 0) - (left.selectionResult?.score ?? 0);
            return right.createdAt.localeCompare(left.createdAt);
        });
        return records[0] ?? null;
    }
    getRecordByIntegrationId(integrationId) {
        return this.repositories.records.get(integrationId) ?? null;
    }
    listRecords() {
        return Object.freeze([...this.repositories.records.values()]);
    }
    upsertIntegration(integration) {
        const record = this.ensureRecord(integration.configuration);
        const next = this.mergeRecord(record, { integration });
        this.repositories.records.set(record.integrationId, next);
        return next;
    }
    registerIntegration(integration) {
        const record = this.upsertIntegration(integration);
        this.repositories.entries.set(integration.providerName, new ProviderIntegrationRegistryEntry({
            providerName: integration.providerName,
            adapterName: integration.adapterName,
            integration,
            registeredAt: timestamp(),
        }));
        this.publishEvent("ProviderIntegrationRegistered", integration.providerName, integration.adapterName, {
            configurationId: integration.configuration.configurationId,
        });
        return record;
    }
    getEntry(providerName) {
        return this.repositories.entries.get(providerName) ?? null;
    }
    listEntries() {
        return Object.freeze([...this.repositories.entries.values()]);
    }
    removeEntry(providerName) {
        this.repositories.entries.delete(providerName);
    }
    publishEvent(type, providerName, adapterName, payload = {}) {
        const event = new ProviderIntegrationEvent({
            type,
            providerName,
            adapterName,
            payload: cloneMetadata(payload),
        });
        this.events.push(event);
        return event;
    }
    listEvents(providerName) {
        return Object.freeze(providerName ? this.events.filter((event) => event.providerName === providerName) : [...this.events]);
    }
    recordLog(level, message, context = {}) {
        const entry = Object.freeze({
            level,
            message,
            context: cloneMetadata(context),
            recordedAt: timestamp(),
        });
        this.logs.push(entry);
        return entry;
    }
    listLogs() {
        return Object.freeze([...this.logs]);
    }
    recordMetric(metric, value, tags = {}) {
        const sample = Object.freeze({
            value,
            recordedAt: timestamp(),
            tags: freezeRecord(tags),
        });
        const existing = this.repositories.metrics.get(metric) ?? { total: 0, samples: [] };
        this.repositories.metrics.set(metric, {
            total: existing.total + value,
            samples: Object.freeze([...existing.samples, sample]),
        });
    }
    observeMetric(metric, value, tags = {}) {
        const sample = Object.freeze({
            value,
            recordedAt: timestamp(),
            tags: freezeRecord(tags),
        });
        const existing = this.repositories.metrics.get(metric) ?? { total: 0, samples: [] };
        this.repositories.metrics.set(metric, {
            total: existing.total + value,
            samples: Object.freeze([...existing.samples, sample]),
        });
    }
    setGauge(metric, value, tags = {}) {
        const key = `${metric}:${JSON.stringify(tags)}`;
        this.repositories.metrics.set(key, {
            total: value,
            samples: [Object.freeze({ value, recordedAt: timestamp(), tags: freezeRecord(tags) })],
        });
    }
    snapshotMetrics() {
        const snapshot = {};
        for (const [metric, value] of this.repositories.metrics.entries()) {
            snapshot[metric] = Object.freeze({
                total: value.total,
                samples: Object.freeze([...value.samples]),
            });
        }
        return freezeRecord(snapshot);
    }
    nextSequence() {
        this.sequence += 1;
        return this.sequence;
    }
    withTelemetry(operation, integration, action) {
        const startedAt = Date.now();
        try {
            return action();
        }
        finally {
            this.recordMetric("provider.runtime.operation", Date.now() - startedAt, {
                providerName: integration.providerName,
                adapterName: integration.adapterName,
                operation,
            });
        }
    }
}
export class TrackSyraDspRuntimeEngine {
    store;
    statusMapper;
    retryStrategy;
    credentialResolver;
    constructor(dependencies) {
        this.store = dependencies.store;
        this.statusMapper = dependencies.statusMapper;
        this.retryStrategy = dependencies.retryStrategy;
        this.credentialResolver = dependencies.credentialResolver;
        for (const configuration of dependencies.initialConfigurations) {
            this.registerConfiguration(configuration);
        }
    }
    withTelemetry(operation, integration, action) {
        const startedAt = Date.now();
        try {
            return action();
        }
        finally {
            this.store.recordMetric("provider.runtime.operation", Date.now() - startedAt, {
                providerName: integration.providerName,
                adapterName: integration.adapterName,
                operation,
            });
        }
    }
    registerConfiguration(configuration) {
        const saved = this.store.saveConfiguration(configuration);
        return this.createIntegration(saved);
    }
    createIntegration(configuration) {
        const saved = this.store.saveConfiguration(configuration);
        return new TrackSyraDspIntegration(this, saved);
    }
    registerIntegration(integration) {
        this.store.registerIntegration(integration);
        return integration;
    }
    resolveIntegration(providerName, adapterName) {
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
    resolveAdapter(providerName, adapterName) {
        return this.resolveIntegration(providerName, adapterName)?.adapter ?? null;
    }
    listIntegrations() {
        return Object.freeze(this.store.listRecords().map((record) => record.integration).filter((integration) => Boolean(integration)));
    }
    selectIntegration(providerName) {
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
    selectIntegrationByInstance(integration) {
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
    authenticateIntegration(integration) {
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
    refreshCredentials(integration) {
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
    resolveAuthenticationSnapshot(providerName) {
        return (this.credentialResolver?.resolve(providerName) ?? null);
    }
    issueCredentials(integration) {
        return this.refreshCredentials(integration);
    }
    startSession(integration) {
        return this.authenticateIntegration(integration);
    }
    renewSession(session) {
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
    endSession(session) {
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
    resolveCapabilities(integration) {
        const record = this.store.ensureRecord(integration.configuration);
        return record.capabilitySet;
    }
    selectProvider(providerName) {
        return this.selectIntegration(providerName);
    }
    healthForIntegration(integration) {
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
    snapshotHealth(providerName) {
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
    upload(integration, context) {
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
    uploadAssets(integration, context) {
        return this.upload(integration, context);
    }
    submitMetadata(integration, context) {
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
    createRelease(integration, context) {
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
    updateRelease(integration, context) {
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
    syncRelease(integration, context) {
        return this.trackStatus(integration, context);
    }
    trackStatus(integration, context) {
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
    reconcileStatus(integration, snapshot) {
        return this.withTelemetry("syncRelease", integration, () => {
            const record = this.store.ensureRecord(integration.configuration);
            const normalized = this.normalizeStatusSnapshot(record, snapshot);
            record.statuses.set(normalized.snapshotId, normalized);
            return normalized;
        });
    }
    receiveWebhook(integration, event) {
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
    poll(providerName) {
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
    importRoyalties(batch) {
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
    generateReports(batch) {
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
    takedown(providerName) {
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
    checkHealth(integration) {
        return this.healthForIntegration(integration);
    }
    healthSnapshot(providerName) {
        return this.snapshotHealth(providerName);
    }
    rateLimit(providerName) {
        return this.evaluateRateLimit(providerName);
    }
    evaluateRateLimit(providerName) {
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
    retry(context) {
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
            const error = ProviderError.fromUnknown(context.lastError ?? "Retry requested", context.providerName, integration.adapterName, {
                code: "UNEXPECTED_ERROR",
                message: context.lastError ?? "Retry requested",
                retryable: true,
            });
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
    deliverBatch(contexts) {
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
    submitBatch(contexts) {
        return this.deliverBatch(contexts);
    }
    recordAuditTrail(providerName) {
        return this.store.listEvents(providerName);
    }
    snapshotMetrics() {
        return this.store.snapshotMetrics();
    }
    listLogs() {
        return this.store.listLogs();
    }
    recordMetric(metric, value, tags = {}) {
        this.store.recordMetric(metric, value, tags);
    }
    observeMetric(metric, value, tags = {}) {
        this.store.observeMetric(metric, value, tags);
    }
    setGauge(metric, value, tags = {}) {
        this.store.setGauge(metric, value, tags);
    }
    recordLog(level, message, context = {}) {
        return this.store.recordLog(level, message, context);
    }
    loadConfiguration(providerName) {
        return this.store.loadConfiguration(providerName);
    }
    saveConfiguration(configuration) {
        return this.store.saveConfiguration(configuration);
    }
    listConfigurations() {
        return this.store.listConfigurations();
    }
    publishEvent(type, providerName, adapterName, payload = {}) {
        return this.store.publishEvent(type, providerName, adapterName, payload);
    }
    listEvents(providerName) {
        return this.store.listEvents(providerName);
    }
    getEntry(providerName) {
        return this.store.getEntry(providerName);
    }
    listEntries() {
        return this.store.listEntries();
    }
    computeSelectionScore(record, health) {
        const enabledScore = record.configuration.enabled ? 100 : 0;
        const healthScore = health.healthy ? 50 : 0;
        const priorityScore = Math.max(0, record.configuration.priority * 10);
        const credentialsScore = record.credentials ? 10 : 0;
        const sessionScore = record.session?.authenticated ? 10 : 0;
        return enabledScore + healthScore + priorityScore + credentialsScore + sessionScore;
    }
    resolveLatestStatus(record, releaseId) {
        for (const status of [...record.statuses.values()].reverse()) {
            if (status.metadata.releaseId === releaseId || (typeof status.result?.referenceId === "string" && status.result.referenceId.includes(releaseId))) {
                return status;
            }
        }
        return record.statuses.values().next().value ?? null;
    }
    normalizeStatusSnapshot(record, snapshot) {
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
    applySession(integration, session, credentials) {
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
    applyCredentials(integration, credentials) {
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
    applyHealth(integration, health) {
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
    applyLifecycle(integration, lifecycle) {
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
export class TrackSyraDspIntegration {
    runtime;
    integrationId;
    providerName;
    adapterName;
    configuration;
    adapter;
    sessionValue = null;
    credentialsValue = null;
    healthValue = null;
    lifecycleValue;
    constructor(runtime, configuration) {
        this.runtime = runtime;
        this.configuration = Object.freeze({
            ...configuration,
            featureFlags: freezeRecord(configuration.featureFlags),
            metadata: cloneMetadata(configuration.metadata),
        });
        this.providerName = trimOrThrow(configuration.providerName, "ProviderConfiguration.providerName");
        this.adapterName = trimOrThrow(configuration.adapterName, "ProviderConfiguration.adapterName");
        this.integrationId = buildIntegrationId(this.providerName, this.adapterName, trimOrThrow(configuration.configurationId, "ProviderConfiguration.configurationId"));
        this.adapter = Object.freeze({
            name: this.adapterName,
            version: this.adapterName,
            configuration: this.configuration,
            credentials: this.credentials,
            authenticate: () => this.authenticate(),
            refreshCredentials: () => this.refreshCredentials(),
            resolveCapabilities: () => this.resolveCapabilities(),
            upload: (context) => this.upload(context),
            submitMetadata: (context) => this.submitMetadata(context),
            createRelease: (context) => this.createRelease(context),
            trackStatus: (context) => this.trackStatus(context),
            receiveWebhook: (event) => this.receiveWebhook(event),
            poll: (context) => this.poll(context),
            importRoyalties: (batch) => this.importRoyalties(batch),
            generateReports: (batch) => this.generateReports(batch),
            takedown: () => this.takedown(),
            health: () => this.health(),
            rateLimit: () => this.rateLimit(),
            retry: (context) => this.retry(context),
        });
        this.lifecycleValue = createLifecycle(this.providerName, this.adapterName, ProviderLifecycleStage.CREATED, [], "Integration created");
        this.runtime.registerIntegration(this);
    }
    get session() {
        return this.sessionValue;
    }
    get credentials() {
        return this.credentialsValue;
    }
    get lifecycle() {
        return this.lifecycleValue;
    }
    authenticate() {
        return this.runtime.authenticateIntegration(this);
    }
    refreshCredentials() {
        return this.runtime.issueCredentials(this);
    }
    select() {
        return this.runtime.selectIntegrationByInstance(this);
    }
    health() {
        return this.runtime.healthForIntegration(this);
    }
    resolveCapabilities() {
        const capabilitySet = this.runtime.resolveCapabilities(this);
        return capabilitySet.capabilities;
    }
    upload(context) {
        return this.runtime.upload(this, context);
    }
    submitMetadata(context) {
        return this.runtime.submitMetadata(this, context);
    }
    createRelease(context) {
        return this.runtime.createRelease(this, context);
    }
    updateRelease(context) {
        return this.runtime.updateRelease(this, context);
    }
    trackStatus(context) {
        return this.runtime.trackStatus(this, context);
    }
    receiveWebhook(event) {
        return this.runtime.receiveWebhook(this, event);
    }
    poll(context) {
        return this.runtime.poll(context.providerName);
    }
    importRoyalties(batch) {
        return this.runtime.importRoyalties(batch);
    }
    generateReports(batch) {
        return this.runtime.generateReports(batch);
    }
    takedown() {
        return this.runtime.takedown(this.providerName);
    }
    rateLimit() {
        return this.runtime.evaluateRateLimit(this.providerName);
    }
    retry(context) {
        return this.runtime.retry(context);
    }
    syncRelease(context) {
        return this.runtime.trackStatus(this, context);
    }
    checkStatus(context) {
        return this.runtime.trackStatus(this, context);
    }
    bindSession(session, credentials) {
        this.sessionValue = session;
        if (credentials) {
            this.credentialsValue = credentials;
        }
    }
    bindCredentials(credentials) {
        this.credentialsValue = credentials;
    }
    bindHealth(health) {
        this.healthValue = health;
    }
    bindLifecycle(lifecycle) {
        this.lifecycleValue = lifecycle;
    }
}
export class TrackSyraDspRegistry {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    register(integration) {
        this.runtime.registerIntegration(integration);
    }
    resolve(providerName) {
        return this.runtime.resolveIntegration(providerName);
    }
    list() {
        return Object.freeze(this.runtime.listIntegrations());
    }
}
export class TrackSyraDspIntegrationRegistryFacade {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    register(entry) {
        this.runtime.registerIntegration(entry.integration);
    }
    resolve(providerName) {
        return this.runtime.resolveIntegration(providerName);
    }
    get(providerName) {
        return this.runtime.getEntry(providerName);
    }
    list() {
        return this.runtime.listEntries();
    }
}
export class TrackSyraDspFactory {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    create(configuration) {
        return this.runtime.createIntegration(configuration);
    }
}
export class TrackSyraDspResolver {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    resolve(providerName) {
        return this.runtime.resolveIntegration(providerName);
    }
    resolveAdapter(adapterName) {
        const integration = this.runtime.listIntegrations().find((entry) => entry.adapterName === adapterName);
        return integration?.adapter ?? null;
    }
    resolveByAdapter(adapterName) {
        return this.runtime.listIntegrations().find((entry) => entry.adapterName === adapterName) ?? null;
    }
}
export class TrackSyraDspRouter {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    route(providerName, adapterName) {
        return this.runtime.resolveIntegration(providerName, adapterName ?? null);
    }
}
export class TrackSyraDspLifecycleManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    snapshot(providerName) {
        const integration = this.runtime.resolveIntegration(providerName);
        if (!integration)
            return null;
        return integration.lifecycle;
    }
    create(configuration) {
        const integration = (this.runtime.resolveIntegration(configuration.providerName, configuration.adapterName) ?? this.runtime.createIntegration(configuration));
        return integration.lifecycle;
    }
    transition(providerName, stage, reason) {
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
export class TrackSyraDspAuthenticationManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    authenticate(integration) {
        return this.runtime.authenticateIntegration(integration);
    }
    refresh(integration) {
        return this.runtime.refreshCredentials(integration);
    }
}
export class TrackSyraDspSessionManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    start(integration) {
        return this.runtime.startSession(integration);
    }
    renew(session) {
        return this.runtime.renewSession(session);
    }
    end(session) {
        return this.runtime.endSession(session);
    }
}
export class TrackSyraDspCredentialManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    issue(integration) {
        return this.runtime.issueCredentials(integration);
    }
    rotate(credentials) {
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
    revoke(credentials) {
        const integration = this.runtime.resolveIntegration(credentials.providerName);
        if (!integration) {
            return false;
        }
        integration.bindCredentials(null);
        return true;
    }
}
export class TrackSyraDspCapabilityResolver {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    resolve(integration) {
        const resolved = this.runtime.resolveCapabilities(integration);
        return resolved;
    }
}
export class TrackSyraDspSelector {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    select(providerName) {
        return this.runtime.selectProvider(providerName);
    }
    resolve(integration) {
        return this.runtime.selectIntegrationByInstance(integration);
    }
}
export class TrackSyraDspHealthManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    check(integration) {
        return this.runtime.healthForIntegration(integration);
    }
    snapshot(providerName) {
        return this.runtime.snapshotHealth(providerName);
    }
}
export class TrackSyraDspUploadManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    upload(context, integration) {
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
export class TrackSyraDspAssetManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    uploadAssets(context) {
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
export class TrackSyraDspMetadataManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    submitMetadata(context, integration) {
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
export class TrackSyraDspCatalogManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    createRelease(context, integration) {
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
    updateRelease(context, integration) {
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
export class TrackSyraDspStatusManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    trackStatus(context, integration) {
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
    reconcile(snapshot) {
        const integration = this.runtime.resolveIntegration(snapshot.providerName);
        if (!integration) {
            return snapshot;
        }
        return this.runtime.reconcileStatus(integration, snapshot);
    }
    syncRelease(context, integration) {
        const resolved = integration ?? this.runtime.resolveIntegration(context.providerName, context.adapterName);
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
}
export class TrackSyraDspWebhookManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    receiveWebhook(event, integration) {
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
export class TrackSyraDspPollingManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    poll(providerName, integration) {
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
export class TrackSyraDspRoyaltyManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    importRoyalties(batch, integration) {
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
export class TrackSyraDspReportManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    generateReports(batch, integration) {
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
export class TrackSyraDspTakedownManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    takedown(providerName, integration) {
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
export class TrackSyraDspRateLimitManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    evaluate(providerName) {
        return this.runtime.evaluateRateLimit(providerName);
    }
}
export class TrackSyraDspRetryManager {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    retry(context, integration) {
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
export class TrackSyraDspMetricsCollector {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    increment(metric, value = 1, tags = {}) {
        this.runtime.recordMetric(metric, value, tags);
    }
    observe(metric, value, tags = {}) {
        this.runtime.observeMetric(metric, value, tags);
    }
    gauge(metric, value, tags = {}) {
        this.runtime.setGauge(metric, value, tags);
    }
}
export class TrackSyraDspLogger {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    debug(message, context) {
        this.runtime.recordLog("debug", message, context ?? {});
    }
    info(message, context) {
        this.runtime.recordLog("info", message, context ?? {});
    }
    warn(message, context) {
        this.runtime.recordLog("warn", message, context ?? {});
    }
    error(message, context) {
        this.runtime.recordLog("error", message, context ?? {});
    }
}
export class TrackSyraDspConfigurationProvider {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    load(providerName) {
        return this.runtime.loadConfiguration(providerName);
    }
    save(configuration) {
        this.runtime.saveConfiguration(configuration);
    }
    list() {
        return this.runtime.listConfigurations();
    }
}
export class TrackSyraDspEventPublisher {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    publish(type, providerName, adapterName, payload = {}) {
        return this.runtime.publishEvent(type, providerName, adapterName, payload);
    }
    list(providerName) {
        return this.runtime.listEvents(providerName);
    }
}
