import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
import { HealthStatus } from "../observability/health/healthStatus.js";
import { LogEntry } from "../observability/logging/logEntry.js";
import { CredentialAuthentication, CredentialAuditRecord, CredentialBundle, CredentialEnvironment, CredentialError, CredentialMetadata, CredentialRecoveryResult, CredentialStatus, CredentialValidationResult, CredentialVersion, PartnerCredential } from "./credentialTypes.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function freezeList(values) {
    return Object.freeze([...values]);
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function makeId(prefix, suffix) {
    return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomBytes(4).toString("hex")}`;
}
function createError(code, message, category, severity = "error", recoverable = false, metadata = {}) {
    return new CredentialError({
        code,
        message,
        category,
        severity,
        recoverable,
        timestamp: nowIso(),
        metadata,
    });
}
function createValidationResult(valid, allowed, executed, reason, errors = [], warnings = [], metadata = {}) {
    return new CredentialValidationResult({ valid, allowed, executed, reason, errors, warnings, metadata });
}
function hashCanonical(value) {
    return createHash("sha256").update(serializeCanonicalJSON(value), "utf8").digest("hex");
}
function normalizePayload(payload) {
    return Object.freeze({
        token: payload.token ?? null,
        clientId: payload.clientId ?? null,
        clientSecret: payload.clientSecret ?? null,
        refreshToken: payload.refreshToken ?? null,
        expiresAt: payload.expiresAt ?? null,
        metadata: Object.freeze({ ...(payload.metadata ?? {}) }),
    });
}
function toSecretKey(secret, configuration) {
    const source = secret ?? configuration.encryptionSecret ?? serializeCanonicalJSON(configuration.metadata);
    const material = typeof source === "string" ? Buffer.from(source, "utf8") : Buffer.from(source);
    return scryptSync(material, "track-syra-credential-vault", 32);
}
export class CredentialVault {
    configuration;
    key;
    constructor(configuration, secret) {
        this.configuration = configuration;
        this.key = toSecretKey(secret, configuration);
    }
    encrypt(payload) {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.key, iv);
        const serialized = serializeCanonicalJSON(normalizePayload(payload));
        const encrypted = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
        return Object.freeze({
            algorithm: "aes-256-gcm",
            iv: iv.toString("base64"),
            authTag: cipher.getAuthTag().toString("base64"),
            data: encrypted.toString("base64"),
            checksum: hashCanonical(serialized),
        });
    }
    decrypt(ciphertext) {
        const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ciphertext.iv, "base64"));
        decipher.setAuthTag(Buffer.from(ciphertext.authTag, "base64"));
        const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext.data, "base64")), decipher.final()]).toString("utf8");
        const parsed = JSON.parse(plaintext);
        const normalized = normalizePayload(parsed);
        if (hashCanonical(normalized) !== ciphertext.checksum) {
            throw new Error("Credential checksum mismatch");
        }
        return normalized;
    }
}
export class CredentialEncryptor {
    vault;
    constructor(vault) {
        this.vault = vault;
    }
    encrypt(payload) {
        return this.vault.encrypt(payload);
    }
}
export class CredentialDecryptor {
    vault;
    constructor(vault) {
        this.vault = vault;
    }
    decrypt(ciphertext) {
        return this.vault.decrypt(ciphertext);
    }
}
export class CredentialVersionManager {
    next(current) {
        if (!current)
            return "1.0.0";
        const parts = current.split(".").map((part) => Number.parseInt(part, 10));
        if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
            return `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`;
        }
        return `${current}.1`;
    }
}
export class CredentialRegistry {
    repositories;
    constructor(repositories) {
        this.repositories = repositories;
    }
    get bundles() {
        return this.repositories.bundles;
    }
    get versions() {
        return this.repositories.versions;
    }
    install(credential) {
        const partnerName = credential.partnerName;
        const list = this.versions.get(partnerName) ?? [];
        const next = freezeList([...list.filter((entry) => entry.version.version !== credential.version.version), credential]);
        this.versions.set(partnerName, next);
        this.bundles.set(partnerName, new CredentialBundle({
            bundleId: `${credential.partnerName}:bundle`,
            partnerName,
            activeVersion: credential.version.version,
            credentials: next,
            metadata: credential.metadata.metadata,
        }));
    }
    rotate(partnerName, credential) {
        this.install(credential);
    }
    revoke(partnerName, version) {
        const list = this.versions.get(partnerName) ?? [];
        const next = list.map((credential) => credential.version.version === (version ?? credential.version.version)
            ? new PartnerCredential({
                ...credential,
                version: new CredentialVersion({
                    version: credential.version.version,
                    active: false,
                    createdAt: credential.version.createdAt,
                    rotatedAt: credential.version.rotatedAt,
                    revokedAt: nowIso(),
                    metadata: credential.version.metadata,
                }),
                status: new CredentialStatus({
                    statusId: `${credential.credentialId}:status`,
                    state: "revoked",
                    active: false,
                    revoked: true,
                    expired: credential.status.expired,
                    checkedAt: nowIso(),
                    metadata: credential.status.metadata,
                }),
                revokedAt: nowIso(),
            })
            : credential);
        this.versions.set(partnerName, next);
        const active = next.find((entry) => entry.version.active) ?? next[0] ?? null;
        if (active) {
            this.bundles.set(partnerName, new CredentialBundle({
                bundleId: `${partnerName}:bundle`,
                partnerName,
                activeVersion: active.version.version,
                credentials: next,
                metadata: active.metadata.metadata,
            }));
        }
    }
    resolve(partnerName, version) {
        const list = this.versions.get(partnerName) ?? [];
        if (!list.length)
            return null;
        if (version) {
            return list.find((credential) => credential.version.version === version) ?? null;
        }
        return list.find((credential) => credential.version.active && credential.status.active && !credential.status.revoked && !credential.status.expired) ?? null;
    }
    list(partnerName) {
        if (partnerName) {
            return freezeList(this.versions.get(partnerName) ?? []);
        }
        return freezeList([...this.versions.values()].flat());
    }
    bundle(partnerName) {
        return this.bundles.get(partnerName) ?? null;
    }
}
export class CredentialFactory {
    encryptor;
    versionManager;
    accessPolicyFactory;
    rotationPolicyFactory;
    constructor(encryptor, versionManager, accessPolicyFactory, rotationPolicyFactory) {
        this.encryptor = encryptor;
        this.versionManager = versionManager;
        this.accessPolicyFactory = accessPolicyFactory;
        this.rotationPolicyFactory = rotationPolicyFactory;
    }
    create(credentials, options = {}) {
        const version = this.versionManager.next(credentials.rotatedAt ?? null);
        const environment = new CredentialEnvironment({
            environment: credentials.environment === "sandbox" ? "sandbox" : "production",
            metadata: freeze({ partnerName: credentials.partnerName }),
        });
        const ciphertext = this.encryptor.encrypt(credentials.payload);
        const status = new CredentialStatus({
            statusId: `${credentials.credentialsId}:status`,
            state: credentials.credentialsInstalled ? "active" : "pending",
            active: credentials.credentialsInstalled,
            revoked: false,
            expired: Boolean(credentials.payload.expiresAt && new Date(credentials.payload.expiresAt).getTime() <= Date.now()),
            checkedAt: nowIso(),
            metadata: freeze({ partnerName: credentials.partnerName, installed: credentials.credentialsInstalled }),
        });
        return new PartnerCredential({
            partnerName: credentials.partnerName,
            credentialId: credentials.credentialsId,
            environment,
            version: new CredentialVersion({
                version,
                active: true,
                createdAt: credentials.activatedAt ?? nowIso(),
                rotatedAt: credentials.rotatedAt,
                metadata: freeze({ partnerName: credentials.partnerName }),
            }),
            status,
            metadata: new CredentialMetadata({
                partnerName: credentials.partnerName,
                credentialId: credentials.credentialsId,
                name: options.name ?? `${credentials.partnerName} credential`,
                description: options.description ?? null,
                source: options.source ?? "partner-onboarding",
                metadata: freeze({ installed: credentials.credentialsInstalled }),
            }),
            accessPolicy: this.accessPolicyFactory(credentials, environment),
            rotationPolicy: this.rotationPolicyFactory(credentials),
            ciphertext,
            issuedAt: credentials.activatedAt ?? nowIso(),
            expiresAt: credentials.payload.expiresAt ?? null,
            revokedAt: null,
        });
    }
}
export class CredentialValidator {
    decryptor;
    constructor(decryptor) {
        this.decryptor = decryptor;
    }
    validate(credential) {
        const errors = [];
        const warnings = [];
        let payload = null;
        try {
            payload = this.decryptor.decrypt(credential.ciphertext);
        }
        catch (error) {
            errors.push(createError("CREDENTIAL_INVALID", error instanceof Error ? error.message : "Credential decryption failed", "Integrity", "error", false));
        }
        const expired = credential.expiresAt ? new Date(credential.expiresAt).getTime() <= Date.now() : Boolean(payload?.expiresAt && new Date(payload.expiresAt).getTime() <= Date.now());
        if (expired) {
            errors.push(createError("CREDENTIAL_EXPIRED", "Credential has expired", "Lifecycle", "error", false, { credentialId: credential.credentialId }));
        }
        if (credential.status.revoked || credential.revokedAt) {
            errors.push(createError("CREDENTIAL_REVOKED", "Credential has been revoked", "Lifecycle", "error", false, { credentialId: credential.credentialId }));
        }
        if (!credential.status.active || !credential.version.active) {
            warnings.push(createError("CREDENTIAL_INACTIVE", "Credential is inactive", "Lifecycle", "warning", true, { credentialId: credential.credentialId }));
        }
        const valid = errors.length === 0;
        const allowed = valid;
        return createValidationResult(valid, allowed, true, valid ? "Credential valid" : "Credential validation failed", errors, warnings, {
            partnerName: credential.partnerName,
            credentialId: credential.credentialId,
            version: credential.version.version,
        });
    }
}
export class CredentialRotator {
    factory;
    registry;
    logger;
    metrics;
    constructor(factory, registry, logger, metrics) {
        this.factory = factory;
        this.registry = registry;
        this.logger = logger;
        this.metrics = metrics;
    }
    rotate(credentials, options = {}) {
        const rotated = this.factory.create(credentials, options);
        this.registry.rotate(credentials.partnerName, rotated);
        this.logger.info("Credential rotated", { partnerName: credentials.partnerName, credentialId: rotated.credentialId, version: rotated.version.version });
        this.metrics.increment("credential.rotated");
        return rotated;
    }
}
export class CredentialBackupManager {
    registry;
    serializer;
    constructor(registry, serializer) {
        this.registry = registry;
        this.serializer = serializer;
    }
    backup() {
        return this.serializer.serialize({
            bundles: this.registry.list().map((credential) => ({
                partnerName: credential.partnerName,
                credentialId: credential.credentialId,
                environment: credential.environment,
                version: credential.version,
                status: credential.status,
                metadata: credential.metadata,
                accessPolicy: credential.accessPolicy,
                rotationPolicy: credential.rotationPolicy,
                ciphertext: credential.ciphertext,
                issuedAt: credential.issuedAt,
                expiresAt: credential.expiresAt,
                revokedAt: credential.revokedAt,
            })),
        });
    }
}
export class CredentialRecoveryManager {
    registry;
    serializer;
    accessPolicyFactory;
    rotationPolicyFactory;
    constructor(registry, serializer, accessPolicyFactory, rotationPolicyFactory) {
        this.registry = registry;
        this.serializer = serializer;
        this.accessPolicyFactory = accessPolicyFactory;
        this.rotationPolicyFactory = rotationPolicyFactory;
    }
    recover(backup) {
        try {
            const parsed = this.serializer.deserialize(backup);
            for (const entry of parsed.bundles ?? []) {
                const credential = new PartnerCredential({
                    partnerName: String(entry.partnerName ?? ""),
                    credentialId: String(entry.credentialId ?? ""),
                    environment: new CredentialEnvironment({
                        environment: entry.environment ?? "production",
                        endpoint: typeof entry.environment === "object" && entry.environment && "endpoint" in entry.environment ? String(entry.environment.endpoint ?? "") : null,
                        region: typeof entry.environment === "object" && entry.environment && "region" in entry.environment ? String(entry.environment.region ?? "") : null,
                        metadata: freeze({}),
                    }),
                    version: new CredentialVersion(entry.version),
                    status: new CredentialStatus(entry.status),
                    metadata: new CredentialMetadata({
                        partnerName: String(entry.partnerName ?? ""),
                        credentialId: String(entry.credentialId ?? ""),
                        name: "Recovered credential",
                        metadata: freeze({}),
                    }),
                    accessPolicy: this.accessPolicyFactory(entry.accessPolicy),
                    rotationPolicy: this.rotationPolicyFactory(entry.rotationPolicy),
                    ciphertext: entry.ciphertext,
                    issuedAt: typeof entry.issuedAt === "string" ? entry.issuedAt : undefined,
                    expiresAt: typeof entry.expiresAt === "string" ? entry.expiresAt : null,
                    revokedAt: typeof entry.revokedAt === "string" ? entry.revokedAt : null,
                });
                this.registry.install(credential);
            }
            return new CredentialRecoveryResult({
                recovered: true,
                allowed: true,
                executed: true,
                reason: "Recovery completed",
                metadata: freeze({ credentialCount: parsed.bundles?.length ?? 0 }),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return new CredentialRecoveryResult({
                recovered: false,
                allowed: false,
                executed: true,
                reason: message,
                errors: [createError("CREDENTIAL_RECOVERY_FAILED", message, "Recovery", "error", false)],
                metadata: freeze({ message }),
            });
        }
    }
}
export class CredentialAudit {
    records = [];
    record(partnerName, credentialId, version, action, metadata = {}) {
        const record = new CredentialAuditRecord({
            auditId: makeId("credential-audit", action),
            partnerName,
            credentialId,
            version,
            action,
            occurredAt: nowIso(),
            metadata: freeze({ ...metadata }),
        });
        this.records.push(record);
        return record;
    }
    list(partnerName) {
        return freezeList(partnerName ? this.records.filter((record) => record.partnerName === partnerName) : this.records);
    }
}
export class CredentialMetrics {
    counters;
    constructor(counters) {
        this.counters = counters;
    }
    increment(metric, value = 1) {
        this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
    }
    observe(metric, value) {
        this.counters.set(metric, value);
    }
    snapshot() {
        return freeze(Object.fromEntries(this.counters.entries()));
    }
}
export class CredentialLogger {
    sink;
    constructor(sink) {
        this.sink = sink;
    }
    redact(context = {}) {
        const redacted = { ...context };
        for (const key of Object.keys(redacted)) {
            if (/secret|token|credential|password|refresh/i.test(key)) {
                redacted[key] = "[redacted]";
            }
        }
        return freeze(redacted);
    }
    log(level, message, context = {}) {
        if (!this.sink)
            return;
        void this.sink.log(new LogEntry({
            logId: makeId("credential-log", level),
            level,
            message,
            source: "distribution.partner-credentials",
            occurredAt: nowIso(),
            traceId: typeof context.traceId === "string" ? context.traceId : null,
            spanId: typeof context.spanId === "string" ? context.spanId : null,
            metadata: this.redact(context),
        }));
    }
    debug(message, context) {
        this.log("debug", message, context);
    }
    info(message, context) {
        this.log("info", message, context);
    }
    warn(message, context) {
        this.log("warn", message, context);
    }
    error(message, context) {
        this.log("error", message, context);
    }
}
export class CredentialHealthChecker {
    registry;
    validator;
    logger;
    constructor(registry, validator, logger) {
        this.registry = registry;
        this.validator = validator;
        this.logger = logger;
    }
    check(componentId) {
        const credentials = this.registry.list();
        const valid = credentials.length > 0 && credentials.every((credential) => this.validator.validate(credential).allowed);
        this.logger.debug("Credential health check", { componentId, valid, credentialCount: credentials.length });
        return new HealthStatus({
            componentId,
            category: "Application",
            healthy: valid,
            message: valid ? "Credential registry healthy" : "Credential registry has invalid or missing entries",
            metadata: freeze({
                credentialCount: credentials.length,
                activeCredentialCount: credentials.filter((credential) => credential.status.active).length,
            }),
        });
    }
}
export class CredentialResolver {
    registry;
    validator;
    constructor(registry, validator) {
        this.registry = registry;
        this.validator = validator;
    }
    resolve(partnerName, version) {
        const credential = this.registry.resolve(partnerName, version);
        if (!credential)
            return null;
        const validation = this.validator.validate(credential);
        if (!validation.allowed)
            return null;
        const versions = this.registry.list(partnerName).map((entry) => entry.version.version);
        const activeVersion = credential.version.version;
        const activeIndex = versions.indexOf(activeVersion);
        return new CredentialAuthentication({
            partnerName: credential.partnerName,
            credentialId: credential.credentialId,
            environment: credential.environment.environment,
            activeVersion,
            previousVersion: activeIndex >= 0 ? versions[activeIndex + 1] ?? null : null,
            pendingVersion: versions.find((version) => version !== activeVersion && version !== credential.version.version && version > activeVersion) ?? null,
            revokedVersion: credential.status.revoked ? credential.version.version : null,
            status: credential.status.state,
            expiresAt: credential.expiresAt,
            rotationVersion: credential.rotationPolicy.autoRotate ? credential.rotationPolicy.policyId : null,
            valid: validation.allowed,
            metadata: freeze({
                partnerName: credential.partnerName,
                credentialId: credential.credentialId,
                version: credential.version.version,
            }),
        });
    }
}
export class CredentialProviderImpl {
    registry;
    vault;
    encryptor;
    decryptor;
    versionManager;
    serializer;
    metadata;
    factory;
    validator;
    logger;
    metrics;
    audit;
    backupManager;
    recoveryManager;
    healthChecker;
    rotator;
    resolver;
    constructor(dependencies) {
        this.metadata = dependencies.metadata;
        this.serializer = dependencies.serializer;
        this.vault = dependencies.vault;
        this.encryptor = dependencies.encryptor;
        this.decryptor = dependencies.decryptor;
        this.versionManager = dependencies.versionManager;
        this.registry = dependencies.registry;
        this.logger = dependencies.logger;
        this.metrics = dependencies.metrics;
        this.audit = dependencies.audit;
        this.factory = dependencies.factory;
        this.validator = dependencies.validator;
        this.backupManager = dependencies.backupManager;
        this.recoveryManager = dependencies.recoveryManager;
        this.healthChecker = dependencies.healthChecker;
        this.rotator = dependencies.rotator;
        this.resolver = dependencies.resolver;
    }
    install(credentials) {
        const credential = this.factory.create(credentials);
        this.registry.install(credential);
        this.audit.record(credentials.partnerName, credential.credentialId, credential.version.version, "install", { environment: credential.environment.environment });
        this.metrics.increment("credential.installed");
        this.logger.info("Credential installed", { partnerName: credentials.partnerName, credentialId: credential.credentialId, version: credential.version.version });
        return credential;
    }
    resolve(partnerName, version) {
        return this.resolver.resolve(partnerName, version);
    }
    rotate(partnerName, credentials) {
        if (partnerName !== credentials.partnerName) {
            throw new Error("Credential partner mismatch");
        }
        return this.rotator.rotate(credentials);
    }
    revoke(partnerName, version) {
        const credential = this.registry.resolve(partnerName, version);
        if (!credential) {
            const error = createError("CREDENTIAL_NOT_FOUND", "Credential is not available", "Lifecycle", "error", false, { partnerName, version: version ?? null });
            return createValidationResult(false, false, true, error.message, [error], [], { partnerName, version: version ?? null });
        }
        this.registry.revoke(partnerName, version ?? credential.version.version);
        this.audit.record(partnerName, credential.credentialId, credential.version.version, "revoke", {});
        this.metrics.increment("credential.revoked");
        this.logger.warn("Credential revoked", { partnerName, credentialId: credential.credentialId, version: credential.version.version });
        return createValidationResult(true, true, true, "Credential revoked", [], [], { partnerName, version: credential.version.version });
    }
    validate(partnerName, version) {
        const credential = this.registry.resolve(partnerName, version);
        if (!credential) {
            const error = createError("CREDENTIAL_NOT_FOUND", "Credential is not available", "Validation", "error", false, { partnerName, version: version ?? null });
            return createValidationResult(false, false, true, error.message, [error], [], { partnerName, version: version ?? null });
        }
        return this.validator.validate(credential);
    }
    backup() {
        return this.backupManager.backup();
    }
    recover(backup) {
        return this.recoveryManager.recover(backup);
    }
    health(componentId) {
        return this.healthChecker.check(componentId);
    }
}
export function createTrackSyraCredentialService(dependencies) {
    return new CredentialProviderImpl(dependencies);
}
