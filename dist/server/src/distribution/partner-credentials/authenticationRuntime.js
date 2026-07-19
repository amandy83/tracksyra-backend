import { CredentialError, CredentialValidationResult } from "./credentialTypes.js";
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
function freezeList(values) {
    return Object.freeze([...values]);
}
export class AuthenticationSnapshot {
    partnerId;
    credentialId;
    credentialVersion;
    expiryTimestamp;
    environment;
    approvedCapabilities;
    authenticationStatus;
    metadata;
    constructor(input) {
        this.partnerId = ensure(input.partnerId, "partnerId");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.credentialVersion = ensure(input.credentialVersion, "credentialVersion");
        this.expiryTimestamp = input.expiryTimestamp ?? null;
        this.environment = input.environment;
        this.approvedCapabilities = freezeList(input.approvedCapabilities ?? []);
        this.authenticationStatus = input.authenticationStatus ?? "ready";
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class AuthenticationContext {
    partnerName;
    environment;
    credentialVersion;
    authentication;
    executionId;
    runtimeName;
    connectorName;
    workerName;
    queueName;
    releaseId;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.environment = input.environment;
        this.credentialVersion = input.credentialVersion ?? null;
        this.authentication = input.authentication ?? null;
        this.executionId = input.executionId?.trim() || null;
        this.runtimeName = input.runtimeName?.trim() || null;
        this.connectorName = input.connectorName?.trim() || null;
        this.workerName = input.workerName?.trim() || null;
        this.queueName = input.queueName?.trim() || null;
        this.releaseId = input.releaseId?.trim() || null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class CredentialBinding {
    partnerName;
    credentialId;
    version;
    pinned;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.credentialId = ensure(input.credentialId, "credentialId");
        this.version = ensure(input.version, "version");
        this.pinned = input.pinned ?? true;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class CredentialVersionBinding {
    partnerName;
    activeVersion;
    previousVersion;
    pendingVersion;
    revokedVersion;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.activeVersion = ensure(input.activeVersion, "activeVersion");
        this.previousVersion = input.previousVersion ?? null;
        this.pendingVersion = input.pendingVersion ?? null;
        this.revokedVersion = input.revokedVersion ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class CredentialExecutionScope {
    executionId;
    partnerName;
    releaseId;
    workerName;
    queueName;
    runtimeName;
    connectorName;
    metadata;
    constructor(input) {
        this.executionId = ensure(input.executionId, "executionId");
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.releaseId = input.releaseId?.trim() || null;
        this.workerName = input.workerName?.trim() || null;
        this.queueName = input.queueName?.trim() || null;
        this.runtimeName = input.runtimeName?.trim() || null;
        this.connectorName = input.connectorName?.trim() || null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class CredentialVersionPinning {
    partnerName;
    pinnedVersion;
    pinnedAt;
    metadata;
    constructor(input) {
        this.partnerName = ensure(input.partnerName, "partnerName");
        this.pinnedVersion = ensure(input.pinnedVersion, "pinnedVersion");
        this.pinnedAt = input.pinnedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class CredentialExpiryGuard {
    check(snapshot) {
        const errors = [];
        if (!snapshot) {
            errors.push(new CredentialError({
                code: "CREDENTIAL_MISSING",
                message: "Authentication snapshot is missing",
                category: "Authentication",
                severity: "error",
                recoverable: false,
            }));
        }
        else if (snapshot.expiryTimestamp && new Date(snapshot.expiryTimestamp).getTime() <= Date.now()) {
            errors.push(new CredentialError({
                code: "CREDENTIAL_EXPIRED",
                message: "Authentication snapshot is expired",
                category: "Authentication",
                severity: "error",
                recoverable: false,
                metadata: { credentialId: snapshot.credentialId, partnerId: snapshot.partnerId },
            }));
        }
        const valid = errors.length === 0;
        return new CredentialValidationResult({
            valid,
            allowed: valid,
            executed: true,
            reason: valid ? "Credential expiry check passed" : errors[0]?.message ?? "Credential expiry check failed",
            errors,
            warnings: [],
            metadata: { validator: "CredentialExpiryGuard" },
        });
    }
}
export class CredentialRevocationGuard {
    check(snapshot) {
        const errors = [];
        if (!snapshot) {
            errors.push(new CredentialError({
                code: "CREDENTIAL_MISSING",
                message: "Authentication snapshot is missing",
                category: "Authentication",
            }));
        }
        else if (snapshot.authenticationStatus === "revoked") {
            errors.push(new CredentialError({
                code: "CREDENTIAL_REVOKED",
                message: "Authentication snapshot is revoked",
                category: "Authentication",
                severity: "error",
                recoverable: false,
                metadata: { credentialId: snapshot.credentialId, partnerId: snapshot.partnerId },
            }));
        }
        const valid = errors.length === 0;
        return new CredentialValidationResult({
            valid,
            allowed: valid,
            executed: true,
            reason: valid ? "Credential revocation check passed" : errors[0]?.message ?? "Credential revocation check failed",
            errors,
            warnings: [],
            metadata: { validator: "CredentialRevocationGuard" },
        });
    }
}
export class CredentialConsistencyValidator {
    validate(snapshot, activationGate, partnerName) {
        const errors = [];
        if (!snapshot) {
            errors.push(new CredentialError({
                code: "CREDENTIAL_MISSING",
                message: "Authentication snapshot is missing",
                category: "Authentication",
            }));
        }
        if (!activationGate.isPartnerApproved(partnerName)) {
            errors.push(new CredentialError({
                code: "NOT_APPROVED",
                message: "Partner is not approved",
                category: "Onboarding",
            }));
        }
        if (!activationGate.hasCredentialsInstalled(partnerName)) {
            errors.push(new CredentialError({
                code: "CREDENTIALS_REQUIRED",
                message: "Credentials are not installed",
                category: "Onboarding",
            }));
        }
        if (!activationGate.hasCertificationPassed(partnerName)) {
            errors.push(new CredentialError({
                code: "CERTIFICATION_REQUIRED",
                message: "Certification is required",
                category: "Onboarding",
            }));
        }
        const valid = errors.length === 0;
        return new CredentialValidationResult({
            valid,
            allowed: valid,
            executed: true,
            reason: valid ? "Credential consistency check passed" : errors[0]?.message ?? "Credential consistency check failed",
            errors,
            warnings: [],
            metadata: snapshot ? {
                partnerId: snapshot.partnerId,
                credentialId: snapshot.credentialId,
                version: snapshot.credentialVersion,
            } : {},
        });
    }
}
export class CredentialResolverMiddleware {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    resolve(partnerName, version) {
        const authentication = this.resolver.resolve(partnerName, version);
        return authentication ? new AuthenticationSnapshot({
            partnerId: authentication.partnerName,
            credentialId: authentication.credentialId,
            credentialVersion: authentication.activeVersion,
            expiryTimestamp: authentication.expiresAt,
            environment: authentication.environment,
            approvedCapabilities: freezeList(Object.keys(authentication.metadata ?? {})),
            authenticationStatus: authentication.valid ? "ready" : "blocked",
            metadata: freezeMetadata({
                previousVersion: authentication.previousVersion,
                pendingVersion: authentication.pendingVersion,
                revokedVersion: authentication.revokedVersion,
                status: authentication.status,
                rotationVersion: authentication.rotationVersion,
            }),
        }) : null;
    }
}
export class CredentialInjectionPipeline {
    middleware;
    constructor(middleware) {
        this.middleware = middleware;
    }
    inject(context) {
        const snapshot = context.authentication ?? this.middleware.resolve(context.partnerName, context.credentialVersion);
        return new AuthenticationContext({
            partnerName: context.partnerName,
            environment: context.environment,
            credentialVersion: snapshot?.credentialVersion ?? context.credentialVersion,
            authentication: snapshot,
            executionId: context.executionId,
            runtimeName: context.runtimeName,
            connectorName: context.connectorName,
            workerName: context.workerName,
            queueName: context.queueName,
            releaseId: context.releaseId,
            metadata: context.metadata,
        });
    }
}
export class CredentialRefreshCoordinator {
    middleware;
    constructor(middleware) {
        this.middleware = middleware;
    }
    refresh(context) {
        return this.middleware.resolve(context.partnerName, context.credentialVersion);
    }
}
export class CredentialAuditPublisher {
    records = [];
    publish(context) {
        const next = new AuthenticationContext({
            partnerName: context.partnerName,
            environment: context.environment,
            credentialVersion: context.credentialVersion,
            authentication: context.authentication,
            executionId: context.executionId,
            runtimeName: context.runtimeName,
            connectorName: context.connectorName,
            workerName: context.workerName,
            queueName: context.queueName,
            releaseId: context.releaseId,
            metadata: freezeMetadata({ ...context.metadata, auditedAt: new Date().toISOString() }),
        });
        this.records.push(next);
        return next;
    }
    list() {
        return freezeList(this.records);
    }
}
export class CredentialMetricsPublisher {
    metrics = new Map();
    record(metric, value = 1) {
        this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
    }
    snapshot() {
        return Object.freeze(Object.fromEntries(this.metrics.entries()));
    }
}
export class CredentialHealthPublisher {
    healthy;
    constructor(healthy = true) {
        this.healthy = healthy;
        Object.freeze(this);
    }
}
