import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
import { HealthStatus } from "../observability/health/healthStatus.js";
import { LogEntry } from "../observability/logging/logEntry.js";
import { Metric } from "../observability/metrics/metric.js";
import { ObservabilityEvent } from "../observability/events/observabilityEvent.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
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
function hashText(value) {
    return createHash("sha256").update(value).digest("hex");
}
function toBuffer(payload) {
    return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}
function capabilitySet(capabilities) {
    return new Set(capabilities);
}
function freezeList(values) {
    return Object.freeze([...values]);
}
function createRuntimeError(code, message, category, recoverable, metadata = {}, severity = "error") {
    return Object.freeze({
        code,
        message,
        category,
        severity,
        recoverable,
        timestamp: nowIso(),
        metadata: freeze({ ...metadata }),
    });
}
function isFailure(result) {
    return !result.allowed || !result.valid;
}
function createResult(input) {
    return Object.freeze({
        allowed: input.allowed,
        executed: input.executed,
        valid: input.valid,
        value: input.value,
        error: input.error ?? null,
        reason: input.reason ?? null,
        errors: freezeList(input.errors ?? []),
        warnings: freezeList(input.warnings ?? []),
        metadata: freeze({ ...(input.metadata ?? {}) }),
    });
}
function createBlockedResult(code, message, category, metadata = {}, recoverable = false, severity = "error") {
    const error = createRuntimeError(code, message, category, recoverable, metadata, severity);
    return createResult({
        allowed: false,
        executed: false,
        valid: false,
        value: null,
        reason: message,
        error,
        errors: [error],
        warnings: [],
        metadata,
    });
}
function createAllowedResult(value, metadata = {}, warnings = [], reason = null) {
    return createResult({
        allowed: true,
        executed: true,
        valid: true,
        value,
        reason,
        error: null,
        errors: [],
        warnings,
        metadata,
    });
}
export class DspProtocolRegistryImpl {
    entries = new Map();
    register(specification) {
        this.entries.set(specification.partnerName, specification);
    }
    resolve(partnerName) {
        return this.entries.get(partnerName) ?? null;
    }
    list() {
        return Object.freeze([...this.entries.values()]);
    }
}
export class DspProtocolResolverImpl {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(partnerName) {
        return this.registry.resolve(partnerName);
    }
    resolveVersion(partnerName, version) {
        const resolved = this.registry.resolve(partnerName);
        return resolved && resolved.version === version ? resolved : null;
    }
}
export class DspProtocolRetryEngine {
    baseDelayMs;
    multiplier;
    maxDelayMs;
    jitterRatio;
    constructor(baseDelayMs, multiplier, maxDelayMs, jitterRatio) {
        this.baseDelayMs = baseDelayMs;
        this.multiplier = multiplier;
        this.maxDelayMs = maxDelayMs;
        this.jitterRatio = jitterRatio;
    }
    shouldRetry(error, attempt) {
        if (attempt < 0)
            return false;
        const message = error instanceof Error ? error.message : String(error);
        if (/non.?retry|permanent|invalid|unsupported/i.test(message)) {
            return false;
        }
        return attempt < 5;
    }
    nextRetryAt(attempt) {
        const delay = Math.min(this.maxDelayMs, this.baseDelayMs * (this.multiplier ** Math.max(0, attempt)));
        const jitter = delay * this.jitterRatio * (Math.random() - 0.5);
        return new Date(Date.now() + Math.max(0, Math.floor(delay + jitter))).toISOString();
    }
}
export class DspProtocolRateLimiter {
    limit;
    windowMs;
    windows = new Map();
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }
    evaluate(partnerName, operation) {
        const key = `${partnerName}:${operation}`;
        const now = Date.now();
        const window = this.windows.get(key);
        if (!window || window.resetAt <= now) {
            const resetAt = now + this.windowMs;
            const next = { remaining: this.limit - 1, resetAt };
            this.windows.set(key, next);
            return Object.freeze({ allowed: true, remaining: next.remaining, resetAt: new Date(resetAt).toISOString() });
        }
        if (window.remaining <= 0) {
            return Object.freeze({ allowed: false, remaining: 0, resetAt: new Date(window.resetAt).toISOString() });
        }
        window.remaining -= 1;
        return Object.freeze({ allowed: true, remaining: window.remaining, resetAt: new Date(window.resetAt).toISOString() });
    }
}
export class DspProtocolSignatureValidator {
    sign(payload) {
        return createHash("sha256").update(serializeCanonicalJSON(payload)).digest("hex");
    }
    verify(payload, signature) {
        return Boolean(signature) && this.sign(payload) === signature;
    }
}
export class DspProtocolCompressionService {
    compress(payload) {
        return gzipSync(toBuffer(payload));
    }
    decompress(payload) {
        return gunzipSync(toBuffer(payload));
    }
}
export class DspProtocolEncryptionService {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    encrypt(payload) {
        const key = scryptSync(typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret, "track-syra-dsp", 32);
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(toBuffer(payload)), cipher.final()]);
        return Object.freeze({
            algorithm: "aes-256-gcm",
            iv: iv.toString("base64"),
            authTag: cipher.getAuthTag().toString("base64"),
            data: encrypted.toString("base64"),
        });
    }
    decrypt(payload) {
        const key = scryptSync(typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret, "track-syra-dsp", 32);
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
        decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
    }
}
export class DspProtocolManifestBuilder {
    build(releaseId, payload, protocolName, version, signature = null) {
        const checksum = hashText(serializeCanonicalJSON(payload));
        return Object.freeze({
            manifestId: makeId("dsp-manifest", releaseId),
            releaseId: ensure(releaseId, "releaseId"),
            protocolName: ensure(protocolName, "protocolName"),
            version: ensure(version, "version"),
            createdAt: nowIso(),
            checksum,
            signature,
            payload: freeze(payload),
            metadata: freeze({ releaseId, checksum }),
        });
    }
}
export class DspProtocolRequestBuilder {
    build(action, partnerName, protocolName, version, payload, session = null, manifest = null) {
        return Object.freeze({
            requestId: makeId("dsp-request", action),
            partnerName,
            protocolName: ensure(protocolName, "protocolName"),
            version: ensure(version, "version"),
            action,
            sessionId: session?.sessionId ?? null,
            manifestId: manifest?.manifestId ?? null,
            createdAt: nowIso(),
            payload: freeze(payload),
            metadata: freeze({
                partnerName,
                sessionId: session?.sessionId ?? null,
                manifestId: manifest?.manifestId ?? null,
                action,
            }),
        });
    }
}
export class DspProtocolResponseParser {
    parse(request, response) {
        const ok = response.ok !== false;
        return Object.freeze({
            responseId: makeId("dsp-response", request.requestId),
            requestId: request.requestId,
            partnerName: request.partnerName,
            protocolName: request.protocolName,
            version: request.version,
            action: request.action,
            receivedAt: nowIso(),
            ok,
            statusCode: typeof response.statusCode === "number" ? response.statusCode : null,
            payload: freeze(response),
            metadata: freeze({
                requestId: request.requestId,
                partnerName: request.partnerName,
                action: request.action,
            }),
        });
    }
}
export class DspProtocolStatusParser {
    parse(request, response) {
        return Object.freeze({
            statusId: makeId("dsp-status", request.requestId),
            partnerName: request.partnerName,
            protocolName: request.protocolName,
            version: request.version,
            state: typeof response.state === "string" ? response.state : "unknown",
            healthy: response.healthy !== false,
            observedAt: nowIso(),
            metadata: freeze({
                requestId: request.requestId,
                partnerName: request.partnerName,
                action: request.action,
            }),
        });
    }
}
export class DspProtocolErrorParser {
    parse(error, metadata = {}) {
        if (error && typeof error === "object" && "code" in error && "message" in error && "category" in error) {
            const record = error;
            return Object.freeze({
                ...record,
                metadata: freeze({ ...record.metadata, ...metadata }),
            });
        }
        const message = error instanceof Error ? error.message : String(error);
        const recoverable = /timeout|retry|temporary|unavailable|rate limit|429|503/i.test(message);
        return createRuntimeError(recoverable ? "RETRY_EXHAUSTED" : "INVALID_STATE", message, recoverable ? "Runtime" : "Runtime", recoverable, metadata);
    }
}
export class DspProtocolProtocolHealthChecker {
    registry;
    activationGate;
    constructor(registry, activationGate) {
        this.registry = registry;
        this.activationGate = activationGate;
    }
    check(componentId) {
        return new HealthStatus({
            componentId,
            category: "Application",
            healthy: true,
            message: "DSP protocol runtime healthy",
            metadata: freeze({
                registeredProtocols: this.registry.list().length,
                activationGateConfigured: Boolean(this.activationGate),
            }),
        });
    }
}
export class DspProtocolRuntimeLogger {
    sink;
    constructor(sink) {
        this.sink = sink;
    }
    log(level, message, context = {}) {
        if (!this.sink)
            return;
        void this.sink.log(new LogEntry({
            logId: makeId("dsp-log", level),
            level,
            message,
            source: "distribution.dsp-runtime",
            occurredAt: nowIso(),
            traceId: typeof context.traceId === "string" ? context.traceId : null,
            spanId: typeof context.spanId === "string" ? context.spanId : null,
            metadata: freeze({ ...context }),
        }));
    }
}
export class DspProtocolRuntimeMetrics {
    sink;
    constructor(sink) {
        this.sink = sink;
    }
    increment(metric, value = 1, tags = {}) {
        if (!this.sink)
            return;
        void this.sink.record(new Metric({
            metricId: makeId("dsp-metric", metric),
            name: metric,
            category: "Throughput",
            value,
            unit: null,
            recordedAt: nowIso(),
            tags,
            metadata: tags,
        }));
    }
}
export class DspProtocolSessionManager {
    sessions = new Map();
    uploadSessions = new Map();
    createSession(partnerName, protocolName, version, metadata = {}) {
        const session = Object.freeze({
            sessionId: makeId("dsp-session", partnerName),
            partnerName,
            protocolName: ensure(protocolName, "protocolName"),
            version: ensure(version, "version"),
            state: "created",
            authenticated: false,
            createdAt: nowIso(),
            expiresAt: null,
            metadata: freeze({ ...metadata }),
        });
        this.sessions.set(session.sessionId, session);
        return session;
    }
    saveSession(session) {
        this.sessions.set(session.sessionId, session);
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }
    openUploadSession(session, metadata = {}) {
        const uploadSession = Object.freeze({
            uploadSessionId: makeId("dsp-upload-session", session.sessionId),
            sessionId: session.sessionId,
            partnerName: session.partnerName,
            protocolName: session.protocolName,
            version: session.version,
            state: session.authenticated ? "authenticated" : "blocked",
            createdAt: nowIso(),
            completedAt: null,
            metadata: freeze({ ...metadata, sessionId: session.sessionId }),
        });
        this.uploadSessions.set(uploadSession.uploadSessionId, uploadSession);
        return uploadSession;
    }
}
export class DspProtocolActivationGuard {
    activationGate;
    partnerRegistry;
    credentialResolver;
    constructor(activationGate, partnerRegistry, credentialResolver) {
        this.activationGate = activationGate;
        this.partnerRegistry = partnerRegistry;
        this.credentialResolver = credentialResolver;
    }
    evaluate(partnerName) {
        const profile = this.partnerRegistry.resolve(partnerName);
        if (!profile) {
            return createBlockedResult("OFFICIAL_SPEC_REQUIRED", `Specification unavailable for ${partnerName}`, "Activation", { partnerName });
        }
        const approved = this.activationGate.isPartnerApproved(partnerName);
        const credentialsInstalled = this.activationGate.hasCredentialsInstalled(partnerName) || Boolean(this.credentialResolver.resolve(partnerName));
        const certificationPassed = this.activationGate.hasCertificationPassed(partnerName);
        const active = this.activationGate.isPartnerActive(partnerName);
        const value = Object.freeze({
            partnerName,
            approved,
            credentialsInstalled,
            certificationPassed,
            active,
        });
        const metadata = freeze({
            partnerName,
            approved,
            credentialsInstalled,
            certificationPassed,
            active,
            profileState: profile.activationState,
        });
        if (!approved) {
            return createBlockedResult("NOT_APPROVED", `Partner is not approved: ${partnerName}`, "Activation", metadata);
        }
        if (!credentialsInstalled) {
            return createBlockedResult("CREDENTIALS_REQUIRED", `Credentials are required for ${partnerName}`, "Activation", metadata);
        }
        if (!certificationPassed) {
            return createBlockedResult("CERTIFICATION_REQUIRED", `Certification is required for ${partnerName}`, "Activation", metadata);
        }
        if (!active) {
            return createBlockedResult("PARTNER_DISABLED", `Partner is disabled: ${partnerName}`, "Activation", metadata);
        }
        return createAllowedResult(value, metadata);
    }
}
class DspProtocolFactoryImpl {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    create(partnerName, specification) {
        if (specification) {
            this.runtime.registry.register(specification);
        }
        return this.runtime;
    }
}
export class DspProtocolRuntimeImpl {
    protocolName;
    version;
    registry;
    resolver;
    configuration;
    sessions;
    manifestBuilder;
    requestBuilder;
    responseParser;
    statusParser;
    errorParser;
    rateLimiter;
    compression;
    encryption;
    partnerRegistry;
    credentialResolver;
    partnerConfigurationProvider;
    specificationRegistry;
    eventPublisher;
    runtimeHealthChecker;
    capabilityResolver;
    retryEngine;
    signatureValidator;
    healthChecker;
    activationGuard;
    loggerAdapter;
    metricsAdapter;
    supported;
    constructor(protocolName, version, dependencies) {
        this.protocolName = protocolName;
        this.version = version;
        this.registry = dependencies.runtimeRegistry;
        this.resolver = dependencies.resolver;
        this.configuration = dependencies.configuration;
        this.partnerRegistry = dependencies.partnerRegistry;
        this.credentialResolver = dependencies.credentialResolver;
        this.partnerConfigurationProvider = dependencies.partnerConfigurationProvider;
        this.specificationRegistry = dependencies.specificationRegistry;
        this.eventPublisher = dependencies.eventPublisher;
        this.runtimeHealthChecker = dependencies.healthChecker;
        this.capabilityResolver = dependencies.capabilityResolver;
        this.sessions = dependencies.sessions;
        this.manifestBuilder = dependencies.manifestBuilder;
        this.requestBuilder = dependencies.requestBuilder;
        this.responseParser = dependencies.responseParser;
        this.statusParser = dependencies.statusParser;
        this.errorParser = dependencies.errorParser;
        this.rateLimiter = dependencies.rateLimiter;
        this.compression = dependencies.compression;
        this.retryEngine = dependencies.retryEngine;
        this.signatureValidator = dependencies.signatureValidator;
        this.activationGuard = dependencies.activationGuard;
        this.loggerAdapter = dependencies.loggerAdapter;
        this.metricsAdapter = dependencies.metricsAdapter;
        this.encryption = dependencies.encryption;
        this.healthChecker = dependencies.protocolHealthChecker;
        this.supported = new Map();
    }
    evaluateActivation(partnerName) {
        return this.activationGuard.evaluate(partnerName);
    }
    authenticate(partnerName, metadata = {}) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Activation", {
                partnerName,
            });
        }
        const activation = this.evaluateActivation(partnerName);
        if (isFailure(activation)) {
            return createBlockedResult("PARTNER_DISABLED", activation.reason ?? `Partner is not ready: ${partnerName}`, "Activation", {
                partnerName,
                protocolName: spec.protocolName,
                ...activation.metadata,
            });
        }
        const session = this.sessions.createSession(partnerName, spec.protocolName, spec.version, metadata);
        const authenticated = Object.freeze({
            ...session,
            state: "authenticated",
            authenticated: true,
            expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
            metadata: freeze({ ...metadata, authenticated: true }),
        });
        this.sessions.saveSession(authenticated);
        this.metricsAdapter.increment("dsp.protocol.authenticate", 1, { partnerName });
        this.loggerAdapter.log("info", "DSP protocol session authenticated", { partnerName, protocolName: spec.protocolName, version: spec.version });
        this.publishEvent("Authenticated", partnerName, { protocolName: spec.protocolName, version: spec.version });
        return createAllowedResult(authenticated, { partnerName, protocolName: spec.protocolName });
    }
    openUploadSession(session, metadata = {}) {
        const uploadSession = this.sessions.openUploadSession(session, metadata);
        return createAllowedResult(uploadSession, { sessionId: session.sessionId });
    }
    buildManifest(releaseId, payload, metadata = {}) {
        const protocolName = this.protocolName;
        return this.manifestBuilder.build(releaseId, { ...payload, ...metadata }, protocolName, this.version);
    }
    buildDeliveryRequest(action, partnerName, payload, session = null, manifest = null) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Activation", {
                partnerName,
                action,
            });
        }
        const activation = this.evaluateActivation(partnerName);
        if (isFailure(activation)) {
            return createBlockedResult("PARTNER_DISABLED", activation.reason ?? `Partner is not ready: ${partnerName}`, "Activation", {
                partnerName,
                action,
                protocolName: spec.protocolName,
                ...activation.metadata,
            });
        }
        if (!spec.supportedCapabilities.includes(actionToCapability(action))) {
            return createBlockedResult("CAPABILITY_UNSUPPORTED", `Capability unsupported for partner ${partnerName}: ${action}`, "Runtime", {
                partnerName,
                action,
                protocolName: spec.protocolName,
            });
        }
        const request = this.requestBuilder.build(action, partnerName, spec.protocolName, spec.version, payload, session, manifest);
        this.publishEvent("DeliveryRequestBuilt", partnerName, { action, requestId: request.requestId, protocolName: spec.protocolName });
        return createAllowedResult(request, { partnerName, action, protocolName: spec.protocolName });
    }
    parseDeliveryResponse(request, response) {
        return this.responseParser.parse(request, response);
    }
    parseStatusResponse(request, response) {
        return this.statusParser.parse(request, response);
    }
    parseError(error, metadata = {}) {
        return this.errorParser.parse(error, metadata);
    }
    sign(payload) {
        return this.signatureValidator.sign(payload);
    }
    verifySignature(payload, signature) {
        return this.signatureValidator.verify(payload, signature);
    }
    encrypt(payload) {
        if (!this.encryption) {
            return Object.freeze({
                algorithm: "aes-256-gcm",
                iv: "",
                authTag: "",
                data: "",
            });
        }
        return this.encryption.encrypt(payload);
    }
    decrypt(payload) {
        if (!this.encryption) {
            return Buffer.from("");
        }
        return this.encryption.decrypt(payload);
    }
    compress(payload) {
        return this.compression.compress(payload);
    }
    decompress(payload) {
        return this.compression.decompress(payload);
    }
    validateManifest(manifest) {
        const errors = [];
        if (!manifest.manifestId?.trim()) {
            errors.push(createRuntimeError("MANIFEST_INVALID", "Manifest id is required", "Manifest", false, { manifestId: manifest.manifestId ?? null }));
        }
        if (!manifest.releaseId?.trim()) {
            errors.push(createRuntimeError("MANIFEST_INVALID", "Release id is required", "Manifest", false, { releaseId: manifest.releaseId ?? null }));
        }
        if (!manifest.protocolName?.trim()) {
            errors.push(createRuntimeError("MANIFEST_INVALID", "Protocol name is required", "Manifest", false, { protocolName: manifest.protocolName ?? null }));
        }
        if (!manifest.version?.trim()) {
            errors.push(createRuntimeError("MANIFEST_INVALID", "Version is required", "Manifest", false, { version: manifest.version ?? null }));
        }
        if (!manifest.checksum?.trim()) {
            errors.push(createRuntimeError("MANIFEST_INVALID", "Checksum is required", "Manifest", false, { checksum: manifest.checksum ?? null }));
        }
        if (manifest.payload && hashText(serializeCanonicalJSON(manifest.payload)) !== manifest.checksum) {
            errors.push(createRuntimeError("CHECKSUM_INVALID", "Manifest checksum does not match payload", "Checksum", false, {
                checksum: manifest.checksum,
                computed: hashText(serializeCanonicalJSON(manifest.payload)),
            }));
        }
        const valid = errors.length === 0;
        if (!valid) {
            return createResult({
                allowed: false,
                executed: true,
                valid: false,
                value: manifest,
                reason: "Manifest validation failed",
                error: errors[0] ?? null,
                errors,
                warnings: [],
                metadata: freeze({ manifestId: manifest.manifestId, releaseId: manifest.releaseId, protocolName: manifest.protocolName, version: manifest.version }),
            });
        }
        return createAllowedResult(manifest, { manifestId: manifest.manifestId, releaseId: manifest.releaseId });
    }
    validateChecksum(payload, checksum) {
        const canonical = serializeCanonicalJSON(payload);
        const computed = hashText(canonical);
        const valid = computed === checksum;
        if (!valid) {
            const error = createRuntimeError("CHECKSUM_INVALID", "Checksum validation failed", "Checksum", false, { computed, checksum }, "error");
            return createResult({
                allowed: false,
                executed: true,
                valid: false,
                value: checksum,
                reason: error.message,
                error,
                errors: [error],
                warnings: [],
                metadata: freeze({ computed, checksum }),
            });
        }
        return createAllowedResult(checksum, { computed, checksum });
    }
    verifyPackage(manifest, payload, signature) {
        const canonicalPayload = serializeCanonicalJSON(payload);
        const checksumValid = manifest.checksum === hashText(canonicalPayload);
        const signatureValid = this.verifySignature(payload, signature);
        const valid = checksumValid && signatureValid;
        if (!valid) {
            const errors = [
                !checksumValid ? createRuntimeError("CHECKSUM_INVALID", "Checksum does not match payload", "Checksum", false, { manifestId: manifest.manifestId }) : null,
                !signatureValid ? createRuntimeError("SIGNATURE_INVALID", "Signature does not match payload", "Validation", false, { manifestId: manifest.manifestId }) : null,
            ].filter((value) => value != null);
            return createResult({
                allowed: false,
                executed: true,
                valid: false,
                value: manifest,
                reason: "Package verification failed",
                error: errors[0] ?? null,
                errors,
                warnings: [],
                metadata: freeze({ checksumValid, signatureValid, manifestId: manifest.manifestId }),
            });
        }
        return createAllowedResult(manifest, { checksumValid, signatureValid, manifestId: manifest.manifestId });
    }
    negotiateVersion(partnerName, preferredVersions) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Runtime", { partnerName });
        }
        const selected = preferredVersions.find((version) => version === spec.version) ?? spec.version;
        return createAllowedResult(selected, { selected, partnerName });
    }
    shouldRetry(error, attempt) {
        return this.retryEngine.shouldRetry(error, attempt);
    }
    nextRetryAt(attempt) {
        return this.retryEngine.nextRetryAt(attempt);
    }
    rateLimit(partnerName, operation) {
        const window = this.rateLimiter.evaluate(partnerName, operation);
        if (!window.allowed) {
            return createBlockedResult("RATE_LIMITED", `Rate limit exceeded for ${partnerName}:${operation}`, "Runtime", { partnerName, operation, remaining: window.remaining, resetAt: window.resetAt });
        }
        return createAllowedResult(Object.freeze({ remaining: window.remaining, resetAt: window.resetAt }), { partnerName, operation });
    }
    submitRelease(partnerName, payload) {
        return this.guardAndBuild("submit-release", partnerName, payload);
    }
    updateRelease(partnerName, payload) {
        return this.guardAndBuild("update-release", partnerName, payload);
    }
    takedownRelease(partnerName, payload) {
        return this.guardAndBuild("release-takedown", partnerName, payload);
    }
    restoreRelease(partnerName, payload) {
        return this.guardAndBuild("release-restore", partnerName, payload);
    }
    syncCatalog(partnerName, payload) {
        return this.guardAndBuild("catalog-sync", partnerName, payload);
    }
    healthCheck(partnerName) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return Object.freeze({
                componentId: `${partnerName}:dsp-protocol`,
                partnerName,
                healthy: false,
                message: "Specification is not available",
                checkedAt: nowIso(),
                metadata: freeze({ partnerName, reason: "Specification is not available" }),
            });
        }
        const activation = this.evaluateActivation(partnerName);
        const healthy = activation.allowed && activation.valid;
        void this.runtimeHealthChecker.check(`${spec.partnerName}:dsp-runtime`);
        return Object.freeze({
            componentId: `${spec.partnerName}:dsp-protocol`,
            partnerName,
            healthy,
            message: healthy ? "DSP protocol runtime healthy" : "DSP protocol runtime blocked",
            checkedAt: nowIso(),
            metadata: freeze({
                protocolName: spec.protocolName,
                version: spec.version,
                officialSpecificationAvailable: spec.officialSpecificationAvailable,
            }),
        });
    }
    capabilityDetection(partnerName) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Runtime", { partnerName });
        }
        return createAllowedResult(Object.freeze([...spec.supportedCapabilities]), { partnerName });
    }
    protocolStatus(partnerName) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return Object.freeze({
                statusId: makeId("dsp-protocol-status", partnerName),
                partnerName,
                protocolName: this.protocolName,
                version: this.version,
                state: "blocked",
                healthy: false,
                observedAt: nowIso(),
                metadata: freeze({ partnerName, reason: "Specification is not available" }),
            });
        }
        const activation = this.evaluateActivation(partnerName);
        return Object.freeze({
            statusId: makeId("dsp-protocol-status", partnerName),
            partnerName,
            protocolName: spec.protocolName,
            version: spec.version,
            state: activation.allowed ? "active" : "blocked",
            healthy: activation.allowed,
            observedAt: nowIso(),
            metadata: freeze({ partnerName, officialSpecificationAvailable: spec.officialSpecificationAvailable }),
        });
    }
    guardAndBuild(action, partnerName, payload) {
        const spec = this.requireSpecification(partnerName);
        if (!spec) {
            return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Activation", { partnerName, action });
        }
        if (!spec.officialSpecificationAvailable) {
            return createBlockedResult("OFFICIAL_SPEC_REQUIRED", `Official DSP specification required for ${partnerName}`, "Activation", { partnerName, action });
        }
        const activation = this.evaluateActivation(partnerName);
        if (isFailure(activation)) {
            return createBlockedResult(activation.error?.code ?? "PARTNER_DISABLED", activation.reason ?? `Partner is not ready: ${partnerName}`, "Activation", { partnerName, action, ...activation.metadata });
        }
        const request = this.requestBuilder.build(action, partnerName, spec.protocolName, spec.version, payload, null, null);
        this.publishEvent("DeliveryRequestBuilt", partnerName, { action, requestId: request.requestId, protocolName: spec.protocolName });
        return createAllowedResult(request, { partnerName, action });
    }
    requireSpecification(partnerName) {
        const specification = this.specificationRegistry.resolve(partnerName);
        if (!specification) {
            return null;
        }
        return {
            partnerName: specification.partnerName,
            protocolName: this.protocolName,
            version: specification.currentVersion,
            officialSpecificationAvailable: specification.active,
            supportedCapabilities: Object.freeze(specification.capabilities.filter((capability) => capability.enabled).map((capability) => capability.name)),
            metadata: freeze({
                specificationId: specification.specificationId,
                partnerName: specification.partnerName,
                version: specification.currentVersion,
                active: specification.active,
            }),
        };
    }
    isActive(partnerName) {
        const activation = this.evaluateActivation(partnerName);
        return activation.allowed && activation.valid;
    }
    publishEvent(eventType, partnerName, metadata = {}) {
        this.eventPublisher.publish(new ObservabilityEvent({
            type: "AuditRecorded",
            source: "distribution.dsp-runtime",
            subject: `${partnerName}:${eventType}`,
            payload: freeze({ partnerName, eventType, ...metadata }),
        }));
    }
    allowed(value, metadata = {}) {
        return createAllowedResult(value, metadata);
    }
    blocked(code, message, metadata = {}) {
        return createBlockedResult(code, message, "Runtime", metadata);
    }
}
function actionToCapability(action) {
    switch (action) {
        case "upload-asset":
        case "upload-chunk":
            return "upload";
        case "upload-metadata":
            return "metadata";
        case "submit-release":
            return "release-submission";
        case "update-release":
            return "release-update";
        case "takedown-release":
            return "release-takedown";
        case "restore-release":
            return "release-restore";
        case "sync-catalog":
            return "catalog-sync";
        case "health-check":
            return "health";
        case "resolve-status":
            return "status";
        case "authenticate":
        default:
            return "version-negotiation";
    }
}
export class DspProtocolRuntimeFacade {
    registry;
    resolver;
    protocolName;
    version;
    runtime;
    constructor(runtime) {
        this.protocolName = runtime.protocolName;
        this.version = runtime.version;
        this.registry = runtime.registry;
        this.runtime = runtime;
        this.resolver = runtime.resolver;
    }
    evaluateActivation(partnerName) {
        return this.runtime.evaluateActivation(partnerName);
    }
    authenticate(partnerName, metadata) {
        return this.runtime.authenticate(partnerName, metadata);
    }
    openUploadSession(session, metadata) {
        return this.runtime.openUploadSession(session, metadata);
    }
    buildManifest(releaseId, payload, metadata) {
        return this.runtime.buildManifest(releaseId, payload, metadata);
    }
    buildDeliveryRequest(action, partnerName, payload, session, manifest) {
        return this.runtime.buildDeliveryRequest(action, partnerName, payload, session ?? null, manifest ?? null);
    }
    parseDeliveryResponse(request, response) {
        return this.runtime.parseDeliveryResponse(request, response);
    }
    parseStatusResponse(request, response) {
        return this.runtime.parseStatusResponse(request, response);
    }
    parseError(error, metadata) {
        return this.runtime.parseError(error, metadata);
    }
    sign(payload) {
        return this.runtime.sign(payload);
    }
    verifySignature(payload, signature) {
        return this.runtime.verifySignature(payload, signature);
    }
    encrypt(payload) {
        return this.runtime.encrypt(payload);
    }
    decrypt(payload) {
        return this.runtime.decrypt(payload);
    }
    compress(payload) {
        return this.runtime.compress(payload);
    }
    decompress(payload) {
        return this.runtime.decompress(payload);
    }
    validateManifest(manifest) {
        return this.runtime.validateManifest(manifest);
    }
    validateChecksum(payload, checksum) {
        return this.runtime.validateChecksum(payload, checksum);
    }
    verifyPackage(manifest, payload, signature) {
        return this.runtime.verifyPackage(manifest, payload, signature);
    }
    negotiateVersion(partnerName, preferredVersions) {
        return this.runtime.negotiateVersion(partnerName, preferredVersions);
    }
    shouldRetry(error, attempt) {
        return this.runtime.shouldRetry(error, attempt);
    }
    nextRetryAt(attempt) {
        return this.runtime.nextRetryAt(attempt);
    }
    rateLimit(partnerName, operation) {
        return this.runtime.rateLimit(partnerName, operation);
    }
    submitRelease(partnerName, payload) {
        return this.runtime.submitRelease(partnerName, payload);
    }
    updateRelease(partnerName, payload) {
        return this.runtime.updateRelease(partnerName, payload);
    }
    takedownRelease(partnerName, payload) {
        return this.runtime.takedownRelease(partnerName, payload);
    }
    restoreRelease(partnerName, payload) {
        return this.runtime.restoreRelease(partnerName, payload);
    }
    syncCatalog(partnerName, payload) {
        return this.runtime.syncCatalog(partnerName, payload);
    }
    healthCheck(partnerName) {
        return this.runtime.healthCheck(partnerName);
    }
    capabilityDetection(partnerName) {
        return this.runtime.capabilityDetection(partnerName);
    }
    protocolStatus(partnerName) {
        return this.runtime.protocolStatus(partnerName);
    }
    check(componentId) {
        return this.runtime.healthChecker.check(componentId);
    }
}
export function createTrackSyraDspProtocolRuntime(options) {
    return options.runtimeFactory(options.protocolName, options.version, {
        registry: options.registry,
        resolver: options.resolver,
        specificationRegistry: options.specificationRegistry,
        activationGate: options.activationGate,
        activationGuard: options.activationGuard,
        partnerRegistry: options.partnerRegistry,
        credentialResolver: options.credentialResolver,
        partnerConfigurationProvider: options.partnerConfigurationProvider,
        logger: options.logger,
        metrics: options.metrics,
        eventPublisher: options.eventPublisher,
        healthChecker: options.healthChecker,
        capabilityResolver: options.capabilityResolver,
        configuration: options.configuration,
        runtimeRegistry: options.runtimeRegistry,
        sessions: options.sessions,
        manifestBuilder: options.manifestBuilder,
        requestBuilder: options.requestBuilder,
        responseParser: options.responseParser,
        statusParser: options.statusParser,
        errorParser: options.errorParser,
        rateLimiter: options.rateLimiter,
        compression: options.compression,
        encryption: options.encryption,
        retryEngine: options.retryEngine,
        signatureValidator: options.signatureValidator,
        loggerAdapter: options.loggerAdapter,
        metricsAdapter: options.metricsAdapter,
        protocolHealthChecker: options.protocolHealthChecker,
    });
}
