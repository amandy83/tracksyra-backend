import { createHash, createHmac, randomBytes } from "node:crypto";
import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
import { HealthStatus } from "../observability/health/healthStatus.js";
import { LogEntry } from "../observability/logging/logEntry.js";
import { DspSpecification, SpecificationActivationResult, SpecificationAuditRecord, SpecificationAuthentication, SpecificationCapability, SpecificationEnvironment, SpecificationError, SpecificationMetadata, SpecificationPolling, SpecificationRateLimit, SpecificationReport, SpecificationSchema, SpecificationStatus, SpecificationTransport, SpecificationUpload, SpecificationValidationResult, SpecificationVersion, SpecificationWebhook, SpecificationRoyalty } from "./specificationTypes.js";
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
function cloneSpecification(specification, overrides = {}) {
    return new DspSpecification({
        specificationId: specification.specificationId,
        partnerName: specification.partnerName,
        name: specification.name,
        currentVersion: overrides.currentVersion ?? specification.currentVersion,
        versions: specification.versions,
        environments: specification.environments,
        capabilities: specification.capabilities,
        schema: specification.schema,
        metadata: specification.metadata,
        checksum: overrides.checksum ?? specification.checksum,
        signature: overrides.signature ?? specification.signature,
        active: overrides.active ?? specification.active,
        rollbackVersion: overrides.rollbackVersion ?? specification.rollbackVersion,
    });
}
function createError(code, message, category, severity = "error", recoverable = false, metadata = {}) {
    return new SpecificationError({
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
    return new SpecificationValidationResult({
        valid,
        allowed,
        executed,
        reason,
        errors,
        warnings,
        metadata,
    });
}
function createActivationResult(active, allowed, executed, reason, errors = [], warnings = [], metadata = {}) {
    return new SpecificationActivationResult({
        active,
        allowed,
        executed,
        reason,
        errors,
        warnings,
        metadata,
    });
}
function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value;
}
function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}
function asBoolean(value, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
}
function asNumber(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function toStringList(value) {
    if (!Array.isArray(value)) {
        return Object.freeze([]);
    }
    return Object.freeze(value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean));
}
function parseFeatureFlags(value) {
    const result = {};
    for (const [key, entry] of Object.entries(asObject(value))) {
        result[key] = Boolean(entry);
    }
    return Object.freeze(result);
}
function parseVersions(value) {
    if (!Array.isArray(value)) {
        return Object.freeze([]);
    }
    return freezeList(value.map((entry) => new SpecificationVersion({
        version: asString(asObject(entry).version, "1.0.0"),
        active: asBoolean(asObject(entry).active, false),
        releasedAt: typeof asObject(entry).releasedAt === "string" ? asObject(entry).releasedAt : undefined,
        metadata: asObject(asObject(entry).metadata),
    })));
}
function parseCapabilities(value) {
    if (!Array.isArray(value)) {
        return Object.freeze([]);
    }
    return freezeList(value.map((entry) => new SpecificationCapability({
        capabilityId: asString(asObject(entry).capabilityId, makeId("spec-capability", "capability")),
        name: asString(asObject(entry).name, "capability"),
        enabled: asBoolean(asObject(entry).enabled, true),
        metadata: asObject(asObject(entry).metadata),
    })));
}
function parseEnvironments(value) {
    if (!Array.isArray(value)) {
        return Object.freeze([]);
    }
    return freezeList(value.map((entry) => new SpecificationEnvironment({
        environment: asString(asObject(entry).environment, "production"),
        endpoint: typeof asObject(entry).endpoint === "string" ? asObject(entry).endpoint : null,
        region: typeof asObject(entry).region === "string" ? asObject(entry).region : null,
        metadata: asObject(asObject(entry).metadata),
    })));
}
function parseSchema(value, retryPolicyFactory) {
    const schema = asObject(value);
    return new SpecificationSchema({
        schemaId: asString(schema.schemaId, "default"),
        transport: new SpecificationTransport({
            transportId: asString(asObject(schema.transport).transportId, "transport"),
            mode: asString(asObject(schema.transport).mode, "upload"),
            secure: asBoolean(asObject(schema.transport).secure, true),
            metadata: asObject(asObject(schema.transport).metadata),
        }),
        authentication: new SpecificationAuthentication({
            authenticationId: asString(asObject(schema.authentication).authenticationId, "authentication"),
            mode: asString(asObject(schema.authentication).mode, "token"),
            required: asBoolean(asObject(schema.authentication).required, true),
            metadata: asObject(asObject(schema.authentication).metadata),
        }),
        upload: new SpecificationUpload({
            uploadId: asString(asObject(schema.upload).uploadId, "upload"),
            allowed: asBoolean(asObject(schema.upload).allowed, true),
            metadata: asObject(asObject(schema.upload).metadata),
        }),
        status: new SpecificationStatus({
            statusId: asString(asObject(schema.status).statusId, "status"),
            supported: asBoolean(asObject(schema.status).supported, true),
            metadata: asObject(asObject(schema.status).metadata),
        }),
        webhook: new SpecificationWebhook({
            webhookId: asString(asObject(schema.webhook).webhookId, "webhook"),
            supported: asBoolean(asObject(schema.webhook).supported, true),
            metadata: asObject(asObject(schema.webhook).metadata),
        }),
        polling: new SpecificationPolling({
            pollingId: asString(asObject(schema.polling).pollingId, "polling"),
            supported: asBoolean(asObject(schema.polling).supported, true),
            intervalMs: asNumber(asObject(schema.polling).intervalMs, 60_000),
            metadata: asObject(asObject(schema.polling).metadata),
        }),
        royalty: new SpecificationRoyalty({
            royaltyId: asString(asObject(schema.royalty).royaltyId, "royalty"),
            supported: asBoolean(asObject(schema.royalty).supported, true),
            metadata: asObject(asObject(schema.royalty).metadata),
        }),
        report: new SpecificationReport({
            reportId: asString(asObject(schema.report).reportId, "report"),
            supported: asBoolean(asObject(schema.report).supported, true),
            metadata: asObject(asObject(schema.report).metadata),
        }),
        rateLimit: new SpecificationRateLimit({
            rateLimitId: asString(asObject(schema.rateLimit).rateLimitId, "rate-limit"),
            requestsPerMinute: asNumber(asObject(schema.rateLimit).requestsPerMinute, 60),
            burst: asNumber(asObject(schema.rateLimit).burst, 10),
            metadata: asObject(asObject(schema.rateLimit).metadata),
        }),
        retryPolicy: retryPolicyFactory({
            retryPolicyId: asString(asObject(schema.retryPolicy).retryPolicyId, "retry-policy"),
            maxAttempts: asNumber(asObject(schema.retryPolicy).maxAttempts, 5),
            backoffMs: asNumber(asObject(schema.retryPolicy).backoffMs, 1_000),
            metadata: asObject(asObject(schema.retryPolicy).metadata),
        }),
        metadata: asObject(schema.metadata),
    });
}
export class SpecificationParser {
    retryPolicyFactory;
    constructor(retryPolicyFactory) {
        this.retryPolicyFactory = retryPolicyFactory;
    }
    parse(input) {
        const value = typeof input === "string" ? JSON.parse(input) : input;
        const data = asObject(value);
        const metadata = asObject(data.metadata);
        const schema = asObject(data.schema);
        return new DspSpecification({
            specificationId: ensure(asString(data.specificationId, makeId("spec", "id")), "specificationId"),
            partnerName: ensure(asString(data.partnerName, "UnknownPartner"), "partnerName"),
            name: ensure(asString(data.name, "Specification"), "name"),
            currentVersion: ensure(asString(data.currentVersion, "1.0.0"), "currentVersion"),
            versions: parseVersions(data.versions),
            environments: parseEnvironments(data.environments),
            capabilities: parseCapabilities(data.capabilities),
            schema: parseSchema(schema, this.retryPolicyFactory),
            metadata: new SpecificationMetadata({
                partnerName: ensure(asString(metadata.partnerName, asString(data.partnerName, "UnknownPartner")), "partnerName"),
                specificationId: ensure(asString(metadata.specificationId, asString(data.specificationId, makeId("spec", "id"))), "specificationId"),
                name: ensure(asString(metadata.name, asString(data.name, "Specification")), "name"),
                description: typeof metadata.description === "string" ? metadata.description : null,
                featureFlags: parseFeatureFlags(metadata.featureFlags),
                tags: Object.freeze({ ...(metadata.tags ?? {}) }),
                source: typeof metadata.source === "string" ? metadata.source : null,
                metadata: asObject(metadata.metadata),
            }),
            checksum: ensure(asString(data.checksum, ""), "checksum"),
            signature: typeof data.signature === "string" ? data.signature : null,
            active: asBoolean(data.active, false),
            rollbackVersion: typeof data.rollbackVersion === "string" ? data.rollbackVersion : null,
        });
    }
}
export class SpecificationCache {
    entries = new Map();
    set(key, specification) {
        this.entries.set(key, specification);
    }
    get(key) {
        return this.entries.get(key) ?? null;
    }
    delete(key) {
        this.entries.delete(key);
    }
    clear() {
        this.entries.clear();
    }
    list() {
        return Object.freeze([...this.entries.values()]);
    }
}
export class SpecificationIntegrityValidator {
    serializer;
    constructor(serializer) {
        this.serializer = serializer;
    }
    checksum(specification) {
        return createHash("sha256").update(this.serializer.serializeChecksum(specification), "utf8").digest("hex");
    }
    validate(specification) {
        const computed = this.checksum(specification);
        const valid = computed === specification.checksum;
        if (!valid) {
            const error = createError("CHECKSUM_INVALID", "Specification checksum mismatch", "Integrity", "error", false, {
                computed,
                checksum: specification.checksum,
                specificationId: specification.specificationId,
            });
            return createValidationResult(false, false, true, error.message, [error], [], { computed, checksum: specification.checksum });
        }
        return createValidationResult(true, true, true, "Checksum valid", [], [], { computed, checksum: specification.checksum });
    }
}
export class SpecificationSignatureValidator {
    configuration;
    serializer;
    constructor(configuration, serializer) {
        this.configuration = configuration;
        this.serializer = serializer;
    }
    sign(specification) {
        const payload = this.serializer.serialize(specification);
        if (this.configuration.signingSecret) {
            return createHmac("sha256", this.configuration.signingSecret).update(payload, "utf8").digest("hex");
        }
        return createHash("sha256").update(payload, "utf8").digest("hex");
    }
    verify(specification, signature) {
        if (!signature) {
            const error = createError("SIGNATURE_INVALID", "Specification signature is missing", "Signature", "error", false, {
                specificationId: specification.specificationId,
            });
            return createValidationResult(false, false, true, error.message, [error], [], { specificationId: specification.specificationId });
        }
        const expected = this.sign(specification);
        if (expected !== signature) {
            const error = createError("SIGNATURE_INVALID", "Specification signature mismatch", "Signature", "error", false, {
                expected,
                signature,
                specificationId: specification.specificationId,
            });
            return createValidationResult(false, false, true, error.message, [error], [], { expected, signature });
        }
        return createValidationResult(true, true, true, "Signature valid", [], [], { specificationId: specification.specificationId });
    }
}
export class SpecificationSchemaValidator {
    validate(specification) {
        const errors = [];
        if (!specification.specificationId.trim())
            errors.push(createError("SPECIFICATION_INVALID", "Specification id is required", "Schema"));
        if (!specification.partnerName.trim())
            errors.push(createError("SPECIFICATION_INVALID", "Partner name is required", "Schema"));
        if (!specification.name.trim())
            errors.push(createError("SPECIFICATION_INVALID", "Specification name is required", "Schema"));
        if (!specification.currentVersion.trim())
            errors.push(createError("SPECIFICATION_INVALID", "Current version is required", "Schema"));
        if (!specification.versions.length)
            errors.push(createError("SPECIFICATION_INVALID", "At least one specification version is required", "Schema"));
        if (!specification.capabilities.length)
            errors.push(createError("SPECIFICATION_INVALID", "At least one specification capability is required", "Schema", "warning", true));
        if (!specification.environments.length)
            errors.push(createError("SPECIFICATION_INVALID", "At least one specification environment is required", "Schema", "warning", true));
        const valid = errors.filter((error) => error.severity === "error" || error.severity === "critical").length === 0;
        const warnings = errors.filter((error) => error.severity === "warning");
        const fatal = errors.filter((error) => error.severity !== "warning");
        return createValidationResult(valid, valid, true, valid ? "Schema valid" : "Schema validation failed", fatal, warnings, {
            specificationId: specification.specificationId,
            partnerName: specification.partnerName,
        });
    }
}
export class SpecificationCapabilityResolver {
    resolve(specification) {
        return freezeList(specification.capabilities.filter((capability) => capability.enabled));
    }
}
export class SpecificationEnvironmentResolver {
    configuration;
    constructor(configuration) {
        this.configuration = configuration;
    }
    resolve(specification, environment) {
        const target = environment ?? this.configuration.environment;
        return specification.environments.find((entry) => entry.environment === target) ?? specification.environments[0] ?? null;
    }
}
function compareVersions(left, right) {
    const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const size = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < size; index += 1) {
        const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
export class SpecificationVersionManager {
    negotiate(specification, preferredVersions = []) {
        for (const preferred of preferredVersions) {
            const match = specification.versions.find((version) => version.version === preferred && version.active);
            if (match) {
                return match.version;
            }
        }
        const activeVersions = specification.versions.filter((version) => version.active);
        if (activeVersions.length) {
            return [...activeVersions].sort((left, right) => compareVersions(right.version, left.version))[0].version;
        }
        return specification.currentVersion;
    }
    previousVersion(specification) {
        const ordered = [...specification.versions].sort((left, right) => compareVersions(right.version, left.version));
        const currentIndex = ordered.findIndex((version) => version.version === specification.currentVersion);
        return currentIndex >= 0 ? ordered[currentIndex + 1]?.version ?? null : ordered[1]?.version ?? null;
    }
}
export class SpecificationCompatibilityChecker {
    environmentResolver;
    capabilityResolver;
    constructor(environmentResolver, capabilityResolver) {
        this.environmentResolver = environmentResolver;
        this.capabilityResolver = capabilityResolver;
    }
    validate(specification, options = {}) {
        const errors = [];
        const warnings = [];
        const environment = this.environmentResolver.resolve(specification, options.environment);
        if (!environment) {
            errors.push(createError("SPECIFICATION_NOT_AVAILABLE", "Specification environment is unavailable", "Compatibility", "error", false, {
                partnerName: specification.partnerName,
            }));
        }
        if (options.preferredVersion && !specification.versions.some((version) => version.version === options.preferredVersion)) {
            errors.push(createError("VERSION_UNSUPPORTED", "Requested specification version is unavailable", "Compatibility", "error", false, {
                preferredVersion: options.preferredVersion,
            }));
        }
        const enabledCapabilities = this.capabilityResolver.resolve(specification).map((capability) => capability.name);
        for (const capability of options.requiredCapabilities ?? []) {
            if (!enabledCapabilities.includes(capability)) {
                errors.push(createError("CAPABILITY_UNSUPPORTED", "Requested capability is unsupported", "Compatibility", "error", false, { capability }));
            }
        }
        const specFlags = specification.metadata.featureFlags;
        for (const [flag, enabled] of Object.entries(options.featureFlags ?? {})) {
            if (enabled && !specFlags[flag]) {
                warnings.push(createError("SPECIFICATION_FEATURE_FLAG_DISABLED", "Feature flag is disabled in specification", "Compatibility", "warning", true, { flag }));
            }
        }
        const valid = errors.length === 0;
        return createValidationResult(valid, valid, true, valid ? "Compatibility valid" : "Compatibility validation failed", errors, warnings, {
            partnerName: specification.partnerName,
            environment: environment?.environment ?? null,
        });
    }
}
export class SpecificationValidator {
    schemaValidator;
    integrityValidator;
    signatureValidator;
    compatibilityChecker;
    constructor(schemaValidator, integrityValidator, signatureValidator, compatibilityChecker) {
        this.schemaValidator = schemaValidator;
        this.integrityValidator = integrityValidator;
        this.signatureValidator = signatureValidator;
        this.compatibilityChecker = compatibilityChecker;
    }
    validate(specification, options = {}) {
        const schema = this.schemaValidator.validate(specification);
        const integrity = this.integrityValidator.validate(specification);
        const signature = this.signatureValidator.verify(specification, specification.signature);
        const compatibility = this.compatibilityChecker.validate(specification, options);
        const errors = [...schema.errors, ...integrity.errors, ...signature.errors, ...compatibility.errors];
        const warnings = [...schema.warnings, ...integrity.warnings, ...signature.warnings, ...compatibility.warnings];
        const valid = errors.length === 0;
        const allowed = valid && specification.active;
        return createValidationResult(valid, allowed, true, valid ? (allowed ? "Specification valid" : "Specification inactive") : "Specification validation failed", errors, warnings, {
            specificationId: specification.specificationId,
            partnerName: specification.partnerName,
            currentVersion: specification.currentVersion,
        });
    }
}
export class SpecificationRepository {
    configuration;
    byPartner = new Map();
    byId = new Map();
    constructor(configuration) {
        this.configuration = configuration;
    }
    save(specification) {
        const partnerName = specification.partnerName;
        const existing = this.byPartner.get(partnerName) ?? [];
        const filtered = existing.filter((entry) => entry.specificationId !== specification.specificationId && entry.currentVersion !== specification.currentVersion);
        const next = freezeList([...filtered, specification].sort((left, right) => compareVersions(right.currentVersion, left.currentVersion)).slice(0, this.configuration.maxVersions));
        this.byPartner.set(partnerName, next);
        this.byId.set(specification.specificationId, specification);
        return specification;
    }
    register(specification) {
        return this.save(specification);
    }
    resolve(partnerName, version, environment) {
        const list = this.byPartner.get(partnerName) ?? [];
        if (!list.length) {
            return null;
        }
        if (version) {
            return list.find((entry) => entry.currentVersion === version || entry.versions.some((candidate) => candidate.version === version && candidate.active)) ?? null;
        }
        const active = [...list].find((entry) => entry.active) ?? list[0] ?? null;
        if (!active) {
            return null;
        }
        if (!environment) {
            return active;
        }
        return active.environments.find((entry) => entry.environment === environment) ? active : active;
    }
    list() {
        const values = [...this.byPartner.values()].flat();
        return freezeList(values);
    }
    listVersions(partnerName) {
        return freezeList(this.byPartner.get(partnerName) ?? []);
    }
    findById(specificationId) {
        return this.byId.get(specificationId) ?? null;
    }
    setActive(partnerName, version, active) {
        const list = this.byPartner.get(partnerName) ?? [];
        const index = list.findIndex((entry) => entry.currentVersion === version);
        if (index < 0)
            return null;
        const target = list[index];
        const updated = cloneSpecification(target, { active });
        const next = freezeList([...list.slice(0, index), updated, ...list.slice(index + 1)]);
        this.byPartner.set(partnerName, next);
        this.byId.set(updated.specificationId, updated);
        return updated;
    }
    rollback(partnerName, version) {
        const list = this.byPartner.get(partnerName) ?? [];
        if (!list.length)
            return null;
        const targetVersion = version ?? list[1]?.currentVersion ?? null;
        if (!targetVersion)
            return null;
        const target = list.find((entry) => entry.currentVersion === targetVersion);
        if (!target)
            return null;
        const updated = cloneSpecification(target, { active: true, rollbackVersion: list[0]?.currentVersion ?? null });
        const next = freezeList([updated, ...list.filter((entry) => entry.currentVersion !== updated.currentVersion)].sort((left, right) => compareVersions(right.currentVersion, left.currentVersion)));
        this.byPartner.set(partnerName, next);
        this.byId.set(updated.specificationId, updated);
        return updated;
    }
}
export class SpecificationLoader {
    parser;
    validator;
    repository;
    audit;
    metrics;
    logger;
    constructor(parser, validator, repository, audit, metrics, logger) {
        this.parser = parser;
        this.validator = validator;
        this.repository = repository;
        this.audit = audit;
        this.metrics = metrics;
        this.logger = logger;
    }
    load(input, options = {}) {
        try {
            const specification = this.parser.parse(input);
            const validation = this.validator.validate(specification, options);
            if (!validation.allowed) {
                this.logger.warn("Specification rejected", { specificationId: specification.specificationId, partnerName: specification.partnerName, reason: validation.reason });
                this.metrics.increment("dsp.specification.validation.failed");
                this.audit.record(specification.partnerName, specification.currentVersion, "validation-failed", { reason: validation.reason, errors: validation.errors });
                return validation;
            }
            this.repository.register(specification);
            this.metrics.increment("dsp.specification.registered");
            this.logger.info("Specification registered", { specificationId: specification.specificationId, partnerName: specification.partnerName, version: specification.currentVersion });
            this.audit.record(specification.partnerName, specification.currentVersion, "registered", { specificationId: specification.specificationId });
            return validation;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const validationError = createError("SPECIFICATION_INVALID", message, "Parser", "error", false);
            this.metrics.increment("dsp.specification.validation.failed");
            return createValidationResult(false, false, true, validationError.message, [validationError], [], { message });
        }
    }
}
export class SpecificationAudit {
    records = [];
    record(partnerName, version, action, metadata = {}) {
        const record = new SpecificationAuditRecord({
            auditId: makeId("spec-audit", action),
            partnerName,
            version,
            action,
            occurredAt: nowIso(),
            metadata,
        });
        this.records.push(record);
        return record;
    }
    list() {
        return freezeList(this.records);
    }
}
export class SpecificationMetrics {
    metrics = new Map();
    increment(metric, value = 1) {
        this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
    }
    observe(metric, value) {
        this.metrics.set(metric, value);
    }
    snapshot() {
        return freeze(Object.fromEntries(this.metrics.entries()));
    }
}
export class SpecificationLogger {
    sink;
    constructor(sink) {
        this.sink = sink;
    }
    log(level, message, context = {}) {
        if (!this.sink)
            return;
        void this.sink.log(new LogEntry({
            logId: makeId("spec-log", level),
            level,
            message,
            source: "distribution.dsp-specification",
            occurredAt: nowIso(),
            traceId: typeof context.traceId === "string" ? context.traceId : null,
            spanId: typeof context.spanId === "string" ? context.spanId : null,
            metadata: freeze({ ...context }),
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
export class SpecificationActivationManager {
    activationGate;
    registry;
    credentialsStore;
    logger;
    metrics;
    constructor(activationGate, registry, credentialsStore, logger, metrics) {
        this.activationGate = activationGate;
        this.registry = registry;
        this.credentialsStore = credentialsStore;
        this.logger = logger;
        this.metrics = metrics;
    }
    activate(specification) {
        const partnerName = specification.partnerName;
        const approved = this.activationGate.isPartnerApproved(partnerName);
        const credentialsInstalled = this.activationGate.hasCredentialsInstalled(partnerName);
        const certificationPassed = this.activationGate.hasCertificationPassed(partnerName);
        const partner = this.registry.resolve(partnerName);
        const partnerActive = this.activationGate.isPartnerActive(partnerName);
        const errors = [];
        if (!approved)
            errors.push(createError("NOT_APPROVED", "Partner is not approved", "Activation", "error", false, { partnerName }));
        if (!credentialsInstalled)
            errors.push(createError("CREDENTIALS_REQUIRED", "Credentials are required", "Activation", "error", false, { partnerName }));
        if (!certificationPassed)
            errors.push(createError("CERTIFICATION_REQUIRED", "Certification is required", "Activation", "error", false, { partnerName }));
        if (!partnerActive)
            errors.push(createError("PARTNER_DISABLED", "Partner is disabled", "Activation", "error", false, { partnerName }));
        const allowed = errors.length === 0;
        const result = createActivationResult(allowed, allowed, true, allowed ? "Specification activated" : errors[0]?.message ?? "Activation failed", errors, [], {
            partnerName,
            hasPartner: Boolean(partner),
            credentialsAvailable: Boolean(this.credentialsStore.resolve(partnerName)),
        });
        this.logger.info("Specification activation evaluated", { partnerName, allowed: result.allowed, approved, credentialsInstalled, certificationPassed, partnerActive });
        this.metrics.increment(`dsp.specification.activation.${allowed ? "success" : "failed"}`);
        return result;
    }
    deactivate(specification) {
        this.logger.info("Specification deactivated", { partnerName: specification.partnerName, version: specification.currentVersion });
        this.metrics.increment("dsp.specification.deactivated");
        return createActivationResult(false, true, true, "Specification deactivated", [], [], { partnerName: specification.partnerName, version: specification.currentVersion });
    }
}
export class SpecificationHealthChecker {
    listSpecifications;
    logger;
    constructor(listSpecifications, logger) {
        this.listSpecifications = listSpecifications;
        this.logger = logger;
    }
    check(componentId) {
        const specifications = this.listSpecifications();
        const healthy = specifications.length > 0 && specifications.every((specification) => specification.active);
        this.logger.debug("Specification health check", { componentId, healthy });
        return new HealthStatus({
            componentId,
            category: "Application",
            healthy,
            message: healthy ? "Specification registry healthy" : "Specification registry has inactive entries",
            metadata: freeze({
                specificationCount: specifications.length,
                activeSpecificationCount: specifications.filter((specification) => specification.active).length,
            }),
        });
    }
}
export class SpecificationResolver {
    repository;
    versionManager;
    environmentResolver;
    compatibilityChecker;
    cache;
    constructor(repository, versionManager, environmentResolver, compatibilityChecker, cache) {
        this.repository = repository;
        this.versionManager = versionManager;
        this.environmentResolver = environmentResolver;
        this.compatibilityChecker = compatibilityChecker;
        this.cache = cache;
    }
    resolve(partnerName, options = {}) {
        const cacheKey = serializeCanonicalJSON({ partnerName, ...options });
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const list = this.repository.listVersions(partnerName);
        if (!list.length) {
            return null;
        }
        let specification = options.version ? list.find((entry) => entry.currentVersion === options.version) ?? null : list[0] ?? null;
        if (!specification) {
            return null;
        }
        const environment = this.environmentResolver.resolve(specification, options.environment);
        if (!environment) {
            return null;
        }
        if (options.preferredVersions?.length) {
            const version = this.versionManager.negotiate(specification, options.preferredVersions);
            const match = list.find((entry) => entry.currentVersion === version);
            if (match) {
                specification = match;
            }
        }
        const compatibility = this.compatibilityChecker.validate(specification, {
            environment: environment.environment,
            preferredVersion: options.version ?? null,
            requiredCapabilities: options.requiredCapabilities,
            featureFlags: options.featureFlags,
        });
        if (!compatibility.allowed) {
            return null;
        }
        this.cache.set(cacheKey, specification);
        return specification;
    }
}
export class SpecificationRegistry {
    configuration;
    repository;
    serializer;
    parser;
    cache;
    audit;
    metrics;
    logger;
    schemaValidator;
    integrityValidator;
    signatureValidator;
    capabilityResolver;
    compatibilityChecker;
    environmentResolver;
    versionManager;
    validator;
    resolver;
    loader;
    activationManager;
    healthChecker;
    constructor(options) {
        this.configuration = options.configuration;
        this.serializer = options.serializer;
        this.parser = options.parser;
        this.cache = options.cache;
        this.audit = options.audit;
        this.metrics = options.metrics;
        this.logger = options.logger;
        this.repository = options.repository;
        this.schemaValidator = options.schemaValidator;
        this.integrityValidator = options.integrityValidator;
        this.signatureValidator = options.signatureValidator;
        this.capabilityResolver = options.capabilityResolver;
        this.environmentResolver = options.environmentResolver;
        this.compatibilityChecker = options.compatibilityChecker;
        this.versionManager = options.versionManager;
        this.validator = options.validator;
        this.resolver = options.resolver;
        this.activationManager = options.activationManager;
        this.loader = options.loader;
        this.healthChecker = options.healthChecker;
    }
    register(specification) {
        const validation = this.validator.validate(specification);
        if (validation.allowed) {
            this.repository.register(specification);
            this.audit.record(specification.partnerName, specification.currentVersion, "registered", { specificationId: specification.specificationId });
            this.metrics.increment("dsp.specification.registered");
            this.cache.clear();
        }
        return validation;
    }
    load(input, options = {}) {
        return this.loader.load(input, options);
    }
    resolve(partnerName, options = {}) {
        return this.resolver.resolve(partnerName, options);
    }
    negotiateVersion(partnerName, preferredVersions = []) {
        const specification = this.repository.resolve(partnerName);
        return specification ? this.versionManager.negotiate(specification, preferredVersions) : null;
    }
    activate(partnerName) {
        const specification = this.repository.resolve(partnerName);
        if (!specification) {
            return createActivationResult(false, false, true, "Specification not available", [createError("SPECIFICATION_NOT_AVAILABLE", "Specification is not available", "Activation", "error", false, { partnerName })], [], { partnerName });
        }
        const activation = this.activationManager.activate(specification);
        if (activation.allowed) {
            this.repository.setActive(partnerName, specification.currentVersion, true);
            this.cache.clear();
        }
        return activation;
    }
    deactivate(partnerName) {
        const specification = this.repository.resolve(partnerName);
        if (!specification) {
            return createActivationResult(false, false, true, "Specification is not available", [createError("SPECIFICATION_NOT_AVAILABLE", "Specification is not available", "Activation", "error", false, { partnerName })], [], { partnerName });
        }
        const updated = this.repository.setActive(partnerName, specification.currentVersion, false) ?? specification;
        this.cache.clear();
        return this.activationManager.deactivate(updated);
    }
    rollback(partnerName, version) {
        const rolledBack = this.repository.rollback(partnerName, version);
        if (rolledBack) {
            this.audit.record(rolledBack.partnerName, rolledBack.currentVersion, "rollback", { rollbackVersion: rolledBack.rollbackVersion });
            this.metrics.increment("dsp.specification.rollback");
            this.cache.clear();
        }
        return rolledBack;
    }
    list() {
        return this.repository.list();
    }
    listVersions(partnerName) {
        return this.repository.listVersions(partnerName);
    }
    health() {
        return this.healthChecker.check("dsp-specification-registry");
    }
}
