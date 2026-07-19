function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function freezeList(values) {
    return Object.freeze([...values]);
}
export class SpecificationVersion {
    version;
    active;
    releasedAt;
    metadata;
    constructor(input) {
        this.version = ensure(input.version, "version");
        this.active = input.active ?? false;
        this.releasedAt = input.releasedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationMetadata {
    partnerName;
    specificationId;
    name;
    description;
    featureFlags;
    tags;
    source;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.specificationId = ensure(input.specificationId, "specificationId");
        this.name = ensure(input.name, "name");
        this.description = input.description ?? null;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.tags = Object.freeze({ ...(input.tags ?? {}) });
        this.source = input.source ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationCapability {
    capabilityId;
    name;
    enabled;
    metadata;
    constructor(input) {
        this.capabilityId = ensure(input.capabilityId, "capabilityId");
        this.name = ensure(input.name, "name");
        this.enabled = input.enabled ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationEnvironment {
    environment;
    endpoint;
    region;
    metadata;
    constructor(input) {
        this.environment = input.environment;
        this.endpoint = input.endpoint ?? null;
        this.region = input.region ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationTransport {
    transportId;
    mode;
    secure;
    metadata;
    constructor(input) {
        this.transportId = ensure(input.transportId, "transportId");
        this.mode = ensure(input.mode, "mode");
        this.secure = input.secure ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationAuthentication {
    authenticationId;
    mode;
    required;
    metadata;
    constructor(input) {
        this.authenticationId = ensure(input.authenticationId, "authenticationId");
        this.mode = ensure(input.mode, "mode");
        this.required = input.required ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationUpload {
    uploadId;
    allowed;
    metadata;
    constructor(input) {
        this.uploadId = ensure(input.uploadId, "uploadId");
        this.allowed = input.allowed ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationStatus {
    statusId;
    supported;
    metadata;
    constructor(input) {
        this.statusId = ensure(input.statusId, "statusId");
        this.supported = input.supported ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationWebhook {
    webhookId;
    supported;
    metadata;
    constructor(input) {
        this.webhookId = ensure(input.webhookId, "webhookId");
        this.supported = input.supported ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationPolling {
    pollingId;
    supported;
    intervalMs;
    metadata;
    constructor(input) {
        this.pollingId = ensure(input.pollingId, "pollingId");
        this.supported = input.supported ?? true;
        this.intervalMs = input.intervalMs ?? 60_000;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationRoyalty {
    royaltyId;
    supported;
    metadata;
    constructor(input) {
        this.royaltyId = ensure(input.royaltyId, "royaltyId");
        this.supported = input.supported ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationReport {
    reportId;
    supported;
    metadata;
    constructor(input) {
        this.reportId = ensure(input.reportId, "reportId");
        this.supported = input.supported ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationRateLimit {
    rateLimitId;
    requestsPerMinute;
    burst;
    metadata;
    constructor(input) {
        this.rateLimitId = ensure(input.rateLimitId, "rateLimitId");
        this.requestsPerMinute = input.requestsPerMinute ?? 60;
        this.burst = input.burst ?? 10;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationRetryPolicy {
    retryPolicyId;
    maxAttempts;
    backoffMs;
    metadata;
    constructor(input) {
        this.retryPolicyId = ensure(input.retryPolicyId, "retryPolicyId");
        this.maxAttempts = input.maxAttempts ?? 5;
        this.backoffMs = input.backoffMs ?? 1_000;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationSchema {
    schemaId;
    transport;
    authentication;
    upload;
    status;
    webhook;
    polling;
    royalty;
    report;
    rateLimit;
    retryPolicy;
    metadata;
    constructor(input) {
        this.schemaId = ensure(input.schemaId, "schemaId");
        this.transport = input.transport;
        this.authentication = input.authentication;
        this.upload = input.upload;
        this.status = input.status;
        this.webhook = input.webhook;
        this.polling = input.polling;
        this.royalty = input.royalty;
        this.report = input.report;
        this.rateLimit = input.rateLimit;
        this.retryPolicy = input.retryPolicy;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationError {
    code;
    message;
    category;
    severity;
    recoverable;
    timestamp;
    metadata;
    constructor(input) {
        this.code = ensure(input.code, "code");
        this.message = ensure(input.message, "message");
        this.category = ensure(input.category, "category");
        this.severity = input.severity ?? "error";
        this.recoverable = input.recoverable ?? false;
        this.timestamp = input.timestamp ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationValidationResult {
    valid;
    allowed;
    executed;
    reason;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.valid = input.valid;
        this.allowed = input.allowed;
        this.executed = input.executed;
        this.reason = input.reason ?? null;
        this.errors = freezeList(input.errors ?? []);
        this.warnings = freezeList(input.warnings ?? []);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationActivationResult {
    active;
    allowed;
    executed;
    reason;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.active = input.active;
        this.allowed = input.allowed;
        this.executed = input.executed;
        this.reason = input.reason ?? null;
        this.errors = freezeList(input.errors ?? []);
        this.warnings = freezeList(input.warnings ?? []);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class SpecificationAuditRecord {
    auditId;
    partnerName;
    version;
    action;
    occurredAt;
    metadata;
    constructor(input) {
        this.auditId = ensure(input.auditId, "auditId");
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.version = ensure(input.version, "version");
        this.action = ensure(input.action, "action");
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class DspSpecification {
    specificationId;
    partnerName;
    name;
    currentVersion;
    versions;
    environments;
    capabilities;
    schema;
    metadata;
    checksum;
    signature;
    active;
    rollbackVersion;
    constructor(input) {
        this.specificationId = ensure(input.specificationId, "specificationId");
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.name = ensure(input.name, "name");
        this.currentVersion = ensure(input.currentVersion, "currentVersion");
        this.versions = freezeList(input.versions);
        this.environments = freezeList(input.environments);
        this.capabilities = freezeList(input.capabilities);
        this.schema = input.schema;
        this.metadata = input.metadata;
        this.checksum = ensure(input.checksum, "checksum");
        this.signature = input.signature ?? null;
        this.active = input.active ?? false;
        this.rollbackVersion = input.rollbackVersion ?? null;
        Object.freeze(this);
    }
}
