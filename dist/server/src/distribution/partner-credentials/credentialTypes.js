function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freezeList(values) {
    return Object.freeze([...values]);
}
export class CredentialMetadata {
    partnerName;
    credentialId;
    name;
    description;
    source;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.name = ensure(input.name, "name");
        this.description = input.description ?? null;
        this.source = input.source ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialEnvironment {
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
export class CredentialRotationPolicy {
    policyId;
    autoRotate;
    rotationIntervalMs;
    expiresAfterMs;
    metadata;
    constructor(input) {
        this.policyId = ensure(input.policyId, "policyId");
        this.autoRotate = input.autoRotate ?? true;
        this.rotationIntervalMs = input.rotationIntervalMs ?? 30 * 24 * 60 * 60_000;
        this.expiresAfterMs = input.expiresAfterMs ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialAccessPolicy {
    policyId;
    allowedRoles;
    allowedEnvironments;
    metadata;
    constructor(input) {
        this.policyId = ensure(input.policyId, "policyId");
        this.allowedRoles = freezeList(input.allowedRoles ?? []);
        this.allowedEnvironments = freezeList(input.allowedEnvironments ?? ["sandbox", "production"]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialVersion {
    version;
    active;
    createdAt;
    rotatedAt;
    revokedAt;
    metadata;
    constructor(input) {
        this.version = ensure(input.version, "version");
        this.active = input.active ?? true;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.rotatedAt = input.rotatedAt ?? null;
        this.revokedAt = input.revokedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialStatus {
    statusId;
    state;
    active;
    revoked;
    expired;
    checkedAt;
    metadata;
    constructor(input) {
        this.statusId = ensure(input.statusId, "statusId");
        this.state = input.state;
        this.active = input.active ?? input.state === "active";
        this.revoked = input.revoked ?? input.state === "revoked";
        this.expired = input.expired ?? input.state === "expired";
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialError {
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
export class CredentialAuditRecord {
    auditId;
    partnerName;
    credentialId;
    version;
    action;
    occurredAt;
    metadata;
    constructor(input) {
        this.auditId = ensure(input.auditId, "auditId");
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.version = ensure(input.version, "version");
        this.action = ensure(input.action, "action");
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialValidationResult {
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
export class CredentialHealthStatus {
    healthy;
    status;
    message;
    checkedAt;
    metadata;
    constructor(input) {
        this.healthy = input.healthy;
        this.status = ensure(input.status, "status");
        this.message = input.message ?? null;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialAuthentication {
    partnerName;
    credentialId;
    environment;
    activeVersion;
    previousVersion;
    pendingVersion;
    revokedVersion;
    status;
    expiresAt;
    rotationVersion;
    valid;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.environment = input.environment;
        this.activeVersion = ensure(input.activeVersion, "activeVersion");
        this.previousVersion = input.previousVersion ?? null;
        this.pendingVersion = input.pendingVersion ?? null;
        this.revokedVersion = input.revokedVersion ?? null;
        this.status = input.status;
        this.expiresAt = input.expiresAt ?? null;
        this.rotationVersion = input.rotationVersion ?? null;
        this.valid = input.valid ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialRecoveryResult {
    recovered;
    allowed;
    executed;
    reason;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.recovered = input.recovered;
        this.allowed = input.allowed;
        this.executed = input.executed;
        this.reason = input.reason ?? null;
        this.errors = freezeList(input.errors ?? []);
        this.warnings = freezeList(input.warnings ?? []);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerCredential {
    partnerName;
    credentialId;
    environment;
    version;
    status;
    metadata;
    accessPolicy;
    rotationPolicy;
    ciphertext;
    issuedAt;
    expiresAt;
    revokedAt;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.environment = input.environment;
        this.version = input.version;
        this.status = input.status;
        this.metadata = input.metadata;
        this.accessPolicy = input.accessPolicy;
        this.rotationPolicy = input.rotationPolicy;
        this.ciphertext = input.ciphertext;
        this.issuedAt = input.issuedAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt ?? null;
        this.revokedAt = input.revokedAt ?? null;
        Object.freeze(this);
    }
}
export class CredentialBundle {
    bundleId;
    partnerName;
    activeVersion;
    credentials;
    metadata;
    constructor(input) {
        this.bundleId = ensure(input.bundleId, "bundleId");
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.activeVersion = ensure(input.activeVersion, "activeVersion");
        this.credentials = freezeList(input.credentials);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CredentialHealthSnapshot extends CredentialHealthStatus {
}
