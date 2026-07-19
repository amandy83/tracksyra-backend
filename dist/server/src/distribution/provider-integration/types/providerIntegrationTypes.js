function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
export class ProviderSession {
    sessionId;
    providerName;
    providerVersion;
    authenticated;
    startedAt;
    expiresAt;
    credentials;
    authentication;
    metadata;
    constructor(input) {
        this.sessionId = input.sessionId.trim();
        this.providerName = input.providerName.trim();
        this.providerVersion = input.providerVersion.trim();
        this.authenticated = input.authenticated ?? false;
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt ?? null;
        this.credentials = input.credentials ?? null;
        this.authentication = input.authentication ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.sessionId || !this.providerName || !this.providerVersion) {
            throw new Error("ProviderSession requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderCredentials {
    credentialId;
    providerName;
    type;
    value;
    authentication;
    issuedAt;
    expiresAt;
    rotatedAt;
    metadata;
    constructor(input) {
        this.credentialId = input.credentialId.trim();
        this.providerName = input.providerName.trim();
        this.type = input.type.trim();
        this.value = input.value ?? null;
        this.authentication = input.authentication ?? null;
        this.issuedAt = input.issuedAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt ?? null;
        this.rotatedAt = input.rotatedAt ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.credentialId || !this.providerName || !this.type) {
            throw new Error("ProviderCredentials requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderCapabilitySet {
    capabilityId;
    providerName;
    capabilities;
    enabled;
    version;
    updatedAt;
    metadata;
    constructor(input) {
        this.capabilityId = input.capabilityId.trim();
        this.providerName = input.providerName.trim();
        this.capabilities = input.capabilities;
        this.enabled = input.enabled ?? true;
        this.version = input.version ?? null;
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.capabilityId || !this.providerName) {
            throw new Error("ProviderCapabilitySet requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderHealthSnapshot {
    snapshotId;
    providerName;
    health;
    healthy;
    observedAt;
    latencyMs;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.providerName = input.providerName.trim();
        this.health = input.health;
        this.healthy = input.healthy;
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.latencyMs = input.latencyMs ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.snapshotId || !this.providerName) {
            throw new Error("ProviderHealthSnapshot requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderSelectionResult {
    selectionId;
    providerName;
    adapterName;
    priority;
    score;
    selectedAt;
    featureFlags;
    healthSnapshot;
    metadata;
    constructor(input) {
        this.selectionId = input.selectionId.trim();
        this.providerName = input.providerName.trim();
        this.adapterName = input.adapterName.trim();
        this.priority = input.priority ?? 0;
        this.score = input.score ?? 0;
        this.selectedAt = input.selectedAt ?? new Date().toISOString();
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.healthSnapshot = input.healthSnapshot ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.selectionId || !this.providerName || !this.adapterName) {
            throw new Error("ProviderSelectionResult requires non-empty identifiers");
        }
        if (!Number.isFinite(this.priority) || this.priority < 0) {
            throw new Error("ProviderSelectionResult.priority must be non-negative");
        }
        if (!Number.isFinite(this.score) || this.score < 0) {
            throw new Error("ProviderSelectionResult.score must be non-negative");
        }
        Object.freeze(this);
    }
}
export class ProviderUploadContext {
    uploadId;
    providerName;
    adapterName;
    session;
    capabilities;
    metadataMap;
    connectorPayload;
    authentication;
    createdAt;
    metadata;
    constructor(input) {
        this.uploadId = input.uploadId.trim();
        this.providerName = input.providerName.trim();
        this.adapterName = input.adapterName.trim();
        this.session = input.session ?? null;
        this.capabilities = input.capabilities ?? null;
        this.metadataMap = input.metadataMap ?? null;
        this.connectorPayload = input.connectorPayload ?? null;
        this.authentication = input.authentication ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.uploadId || !this.providerName || !this.adapterName) {
            throw new Error("ProviderUploadContext requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderUploadResult {
    uploadId;
    providerName;
    success;
    failure;
    connectorStatus;
    result;
    completedAt;
    metadata;
    constructor(input) {
        this.uploadId = input.uploadId.trim();
        this.providerName = input.providerName.trim();
        this.success = input.success;
        this.failure = input.failure;
        this.connectorStatus = input.connectorStatus ?? null;
        this.result = input.result ?? null;
        this.completedAt = input.completedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.uploadId || !this.providerName) {
            throw new Error("ProviderUploadResult requires non-empty identifiers");
        }
        if (!this.success && !this.failure) {
            throw new Error("ProviderUploadResult must be success or failure");
        }
        if (this.success && this.failure) {
            throw new Error("ProviderUploadResult cannot be both success and failure");
        }
        Object.freeze(this);
    }
}
export class ProviderStatusSnapshot {
    snapshotId;
    providerName;
    status;
    observedAt;
    healthy;
    result;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.providerName = input.providerName.trim();
        this.status = input.status;
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.healthy = input.healthy ?? true;
        this.result = input.result ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.snapshotId || !this.providerName) {
            throw new Error("ProviderStatusSnapshot requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderWebhookEnvelope {
    eventId;
    providerName;
    payload;
    receivedAt;
    signature;
    metadata;
    constructor(input) {
        this.eventId = input.eventId.trim();
        this.providerName = input.providerName.trim();
        this.payload = input.payload;
        this.receivedAt = input.receivedAt ?? new Date().toISOString();
        this.signature = input.signature ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.eventId || !this.providerName) {
            throw new Error("ProviderWebhookEnvelope requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderPollingResult {
    pollingId;
    providerName;
    status;
    snapshot;
    polledAt;
    metadata;
    constructor(input) {
        this.pollingId = input.pollingId.trim();
        this.providerName = input.providerName.trim();
        this.status = input.status ?? null;
        this.snapshot = input.snapshot ?? null;
        this.polledAt = input.polledAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.pollingId || !this.providerName) {
            throw new Error("ProviderPollingResult requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderRoyaltyBatch {
    batchId;
    providerName;
    royalties;
    createdAt;
    metadata;
    constructor(input) {
        this.batchId = input.batchId.trim();
        this.providerName = input.providerName.trim();
        this.royalties = input.royalties ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.batchId || !this.providerName) {
            throw new Error("ProviderRoyaltyBatch requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderReportBatch {
    batchId;
    providerName;
    reports;
    createdAt;
    metadata;
    constructor(input) {
        this.batchId = input.batchId.trim();
        this.providerName = input.providerName.trim();
        this.reports = input.reports ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.batchId || !this.providerName) {
            throw new Error("ProviderReportBatch requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ProviderRetryContext {
    retryId;
    providerName;
    attempt;
    maxAttempts;
    nextRetryAt;
    lastError;
    policy;
    metadata;
    constructor(input) {
        this.retryId = input.retryId.trim();
        this.providerName = input.providerName.trim();
        this.attempt = input.attempt;
        this.maxAttempts = input.maxAttempts;
        this.nextRetryAt = input.nextRetryAt ?? null;
        this.lastError = input.lastError ?? null;
        this.policy = input.policy ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.retryId || !this.providerName) {
            throw new Error("ProviderRetryContext requires non-empty identifiers");
        }
        if (!Number.isInteger(this.attempt) || this.attempt < 0) {
            throw new Error("ProviderRetryContext.attempt must be a non-negative integer");
        }
        if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 0) {
            throw new Error("ProviderRetryContext.maxAttempts must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class ProviderConfiguration {
    configurationId;
    providerName;
    adapterName;
    enabled;
    priority;
    featureFlags;
    region;
    retryPolicy;
    rateLimitPolicy;
    source;
    metadata;
    constructor(input) {
        this.configurationId = input.configurationId.trim();
        this.providerName = input.providerName.trim();
        this.adapterName = input.adapterName.trim();
        this.enabled = input.enabled ?? true;
        this.priority = input.priority ?? 0;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.region = input.region ?? null;
        this.retryPolicy = input.retryPolicy ?? null;
        this.rateLimitPolicy = input.rateLimitPolicy ?? null;
        this.source = input.source ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.configurationId || !this.providerName || !this.adapterName) {
            throw new Error("ProviderConfiguration requires non-empty identifiers");
        }
        if (!Number.isFinite(this.priority) || this.priority < 0) {
            throw new Error("ProviderConfiguration.priority must be non-negative");
        }
        Object.freeze(this);
    }
}
