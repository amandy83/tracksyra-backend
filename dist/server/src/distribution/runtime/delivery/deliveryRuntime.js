import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, scryptSync } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { ConnectorAsset as ConnectorAssetModel } from "../../connectors/assets/connectorAsset.js";
import { ConnectorCapabilities } from "../../connectors/capabilities/connectorCapabilities.js";
import { ConnectorConfiguration } from "../../connectors/configuration/connectorConfiguration.js";
import { ConnectorContext } from "../../connectors/context/connectorContext.js";
import { ConnectorSubmission } from "../../connectors/catalog/connectorCatalog.js";
import { ConnectorMetadata } from "../../connectors/metadata/connectorMetadata.js";
import { QueueEnvelope as QueueEnvelopeModel, QueueExecutionResult as QueueExecutionResultModel } from "../../queue/integration/types/queueIntegrationTypes.js";
import { WorkerExecutionContext as WorkerExecutionContextModel, WorkerExecutionRequest as WorkerExecutionRequestModel, WorkerExecutionResult as WorkerExecutionResultModel, WorkerPipelineExecution as WorkerPipelineExecutionModel } from "../integration/types/workerIntegrationTypes.js";
import { HealthStatus } from "../../observability/health/healthStatus.js";
import { LogEntry } from "../../observability/logging/logEntry.js";
import { Metric } from "../../observability/metrics/metric.js";
import { serializeCanonicalJSON } from "../../core/canonicalSerializer.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function createId(prefix, suffix) {
    return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomBytes(4).toString("hex")}`;
}
function normalizeSchedule(value) {
    if (value == null)
        return null;
    return value instanceof Date ? value.toISOString() : value;
}
function normalizePriority(priority) {
    if (typeof priority === "number" && Number.isFinite(priority)) {
        return priority;
    }
    switch (priority ?? "Normal") {
        case "Critical":
            return 100;
        case "High":
            return 75;
        case "Low":
            return 25;
        case "Background":
            return 10;
        case "Normal":
        default:
            return 50;
    }
}
function stableChecksum(text) {
    return createHash("sha256").update(text).digest("hex");
}
function toBuffer(payload) {
    return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}
function createConnectorConfiguration(connectorId, version, releaseId, metadata) {
    return new ConnectorConfiguration({
        connectorId,
        version,
        enabled: true,
        authenticationType: "Bearer Token",
        settings: freeze({
            releaseId,
            ...metadata,
        }),
    });
}
function buildConnectorContext(target, releaseId, executionId, packageId, metadata) {
    return new ConnectorContext({
        connectorId: target.partnerName,
        connectorVersion: target.adapterName ?? "1.0.0",
        releaseId,
        executionId,
        providerReference: `${target.partnerName}:${packageId}`,
        configuration: createConnectorConfiguration(target.partnerName, target.adapterName ?? "1.0.0", releaseId, metadata),
        metadata: freeze({
            releaseId,
            packageId,
            partnerName: target.partnerName,
            ...metadata,
        }),
        attributes: freeze({
            targetPriority: target.priority,
            scheduledFor: target.scheduledFor,
            dependencyCount: target.dependencies.length,
        }),
    });
}
function buildConnectorAssets(packageModel) {
    return Object.freeze(packageModel.artifacts.map((artifact, index) => new ConnectorAssetModel({
        assetId: `${packageModel.packageId}:asset:${index}`,
        releaseId: packageModel.releaseId,
        kind: artifact.kind,
        uri: artifact.path,
        checksum: artifact.checksum,
        sizeBytes: artifact.sizeBytes,
        mediaType: artifact.contentType,
        metadata: freeze({
            packageId: packageModel.packageId,
            version: packageModel.version,
            fingerprint: packageModel.packageModel.fingerprint.value,
        }),
    })));
}
function buildConnectorSubmission(packageModel, target) {
    return new ConnectorSubmission({
        submissionId: `${packageModel.packageId}:${target.partnerName}:submission`,
        connectorId: target.partnerName,
        releaseId: packageModel.releaseId,
        submittedAt: packageModel.generatedAt,
        accepted: false,
        metadata: freeze({
            packageId: packageModel.packageId,
            packageVersion: packageModel.version,
            checksum: packageModel.checksum,
            targetPartner: target.partnerName,
        }),
    });
}
function buildConnectorMetadata(packageModel, target) {
    return new ConnectorMetadata({
        connectorId: target.partnerName,
        releaseId: packageModel.releaseId,
        payload: freeze({
            packageId: packageModel.packageId,
            packageVersion: packageModel.version,
            checksum: packageModel.checksum,
            manifestChecksum: packageModel.packageModel.manifestChecksum.value,
            fingerprint: packageModel.packageModel.fingerprint.value,
            targetPartner: target.partnerName,
            deliveryMode: packageModel.metadata.deliveryMode ?? null,
        }),
        language: typeof packageModel.normalizedRelease.language?.code === "string" ? packageModel.normalizedRelease.language.code : null,
        territories: packageModel.normalizedRelease.territories.map((territory) => territory.code),
        createdAt: packageModel.generatedAt,
    });
}
function buildCapabilities(target, packageModel) {
    return new ConnectorCapabilities({
        connectorId: target.partnerName,
        categories: Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting"]),
        uploadModes: Object.freeze(["Single Upload", "Multipart Upload", "Resumable Upload"]),
        territories: Object.freeze(packageModel.normalizedRelease.territories.map((territory) => territory.code)),
        languages: packageModel.normalizedRelease.language?.code ? Object.freeze([packageModel.normalizedRelease.language.code]) : Object.freeze([]),
        features: Object.freeze(["metadata-validation", "asset-validation", "status-sync", "retry", "checkpoint"]),
        metadata: freeze({
            packageId: packageModel.packageId,
            releaseId: packageModel.releaseId,
        }),
    });
}
function mapConnectorStatus(status) {
    if (!status)
        return null;
    if (typeof status === "string")
        return status;
    if ("status" in status && typeof status.status === "string")
        return status.status;
    if ("providerStatus" in status && typeof status.providerStatus === "string")
        return status.providerStatus;
    return null;
}
function scoreJob(job) {
    return job.priority + (job.mode === "priority" ? 50 : 0) - job.retryCount;
}
function cloneJob(job, patch) {
    return Object.freeze({ ...job, ...patch, metadata: freeze({ ...job.metadata, ...(patch.metadata ?? {}) }) });
}
function toQueueEnvelope(job) {
    return new QueueEnvelopeModel({
        messageId: job.jobId,
        type: "delivery.job",
        body: freeze({
            jobId: job.jobId,
            releaseId: job.releaseId,
            mode: job.mode,
            targets: job.targets,
            metadata: job.metadata,
        }),
        tracing: {
            traceId: job.jobId,
            correlationId: job.releaseId,
            parentSpanId: null,
            spanId: `${job.jobId}:span`,
        },
        metadata: freeze({
            jobId: job.jobId,
            releaseId: job.releaseId,
            mode: job.mode,
        }),
    });
}
function createWorkerContext(job) {
    return new WorkerExecutionContextModel({
        workerId: "delivery-worker",
        orchestrationId: job.jobId,
        executionId: `${job.jobId}:worker`,
        releaseId: job.releaseId,
        jobId: job.jobId,
        queueName: "delivery",
        pipelineName: "delivery",
        stage: "Delivery",
        state: "Running",
        retryCount: job.retryCount,
        startedAt: job.startedAt ?? nowIso(),
        updatedAt: nowIso(),
        metadata: freeze({
            jobId: job.jobId,
            releaseId: job.releaseId,
            mode: job.mode,
            requestedBy: job.requestedBy,
        }),
    });
}
export class DeliveryLogger {
    sink;
    entries = [];
    constructor(sink) {
        this.sink = sink;
    }
    debug(message, context = {}) {
        this.emit("debug", message, context);
    }
    info(message, context = {}) {
        this.emit("info", message, context);
    }
    warn(message, context = {}) {
        this.emit("warn", message, context);
    }
    error(message, context = {}) {
        this.emit("error", message, context);
    }
    list() {
        return Object.freeze([...this.entries]);
    }
    emit(level, message, context) {
        const entry = Object.freeze({ level, message, context: freeze({ ...context }), recordedAt: nowIso() });
        this.entries.push(entry);
        if (this.sink) {
            void this.sink.log(new LogEntry({
                logId: createId("delivery", level),
                level,
                message,
                source: "distribution.delivery",
                occurredAt: entry.recordedAt,
                traceId: typeof context.traceId === "string" ? context.traceId : null,
                spanId: typeof context.spanId === "string" ? context.spanId : null,
                metadata: freeze({ ...context }),
            }));
        }
    }
}
export class DeliveryMetrics {
    repositories;
    sink;
    constructor(repositories, sink = null) {
        this.repositories = repositories;
        this.sink = sink;
    }
    increment(metric, value = 1, tags = {}) {
        const key = this.key(metric, tags);
        this.repositories.counters.set(key, (this.repositories.counters.get(key) ?? 0) + value);
        if (this.sink) {
            void this.sink.record(new Metric({
                metricId: createId("delivery-metric", metric),
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
    observe(metric, value, tags = {}) {
        const key = this.key(metric, tags);
        const current = this.repositories.observations.get(key) ?? [];
        this.repositories.observations.set(key, Object.freeze([...current, value]));
        if (this.sink) {
            void this.sink.record(new Metric({
                metricId: createId("delivery-metric", metric),
                name: metric,
                category: "Latency",
                value,
                unit: null,
                recordedAt: nowIso(),
                tags,
                metadata: tags,
            }));
        }
    }
    gauge(metric, value, tags = {}) {
        const key = this.key(metric, tags);
        this.repositories.gauges.set(key, value);
        if (this.sink) {
            void this.sink.record(new Metric({
                metricId: createId("delivery-metric", metric),
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
    snapshot() {
        return freeze({
            counters: freeze(Object.fromEntries(this.repositories.counters.entries())),
            gauges: freeze(Object.fromEntries(this.repositories.gauges.entries())),
            observations: freeze(Object.fromEntries([...this.repositories.observations.entries()].map(([key, values]) => [key, Object.freeze([...values])]))),
        });
    }
    key(metric, tags) {
        return `${metric}:${JSON.stringify(tags)}`;
    }
}
export class DeliveryCheckpointManager {
    checkpoints;
    constructor(checkpoints) {
        this.checkpoints = checkpoints;
    }
    save(checkpoint) {
        this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    }
    create(job, stage, packageId, version, metadata = {}, resumedFromCheckpointId = null) {
        const checkpoint = Object.freeze({
            checkpointId: `${packageId}:${stage}:${Date.now().toString(36)}`,
            releaseId: job.releaseId,
            packageId,
            version,
            stage,
            createdAt: nowIso(),
            resumedFromCheckpointId,
            metadata: freeze({ jobId: job.jobId, ...metadata }),
        });
        this.save(checkpoint);
        return checkpoint;
    }
    restore(checkpointId) {
        return this.checkpoints.get(checkpointId) ?? null;
    }
    list(releaseId) {
        const items = [...this.checkpoints.values()];
        return Object.freeze(releaseId ? items.filter((entry) => entry.releaseId === releaseId) : items);
    }
}
export class DeliveryProgressTracker {
    progress;
    stages;
    constructor(progress, stages) {
        this.progress = progress;
        this.stages = stages;
    }
    update(jobId, state, progress) {
        this.progress.set(jobId, Math.max(0, Math.min(100, progress)));
        this.stages.set(jobId, state);
    }
    get(jobId) {
        return freeze({
            state: (this.stages.get(jobId) ?? null),
            progress: this.progress.get(jobId) ?? 0,
        });
    }
}
export class DeliveryArtifactStore {
    artifacts;
    packages;
    archives;
    constructor(artifacts, packages, archives) {
        this.artifacts = artifacts;
        this.packages = packages;
        this.archives = archives;
    }
    storeArtifact(kind, payload, metadata = {}) {
        const artifact = Object.freeze({
            artifactId: createId("delivery-artifact", kind),
            kind,
            payload,
            checksum: stableChecksum(payload.toString("base64")),
            createdAt: nowIso(),
            metadata: freeze({ ...metadata }),
        });
        this.artifacts.set(artifact.artifactId, artifact);
        return artifact;
    }
    storePackage(packageModel) {
        this.packages.set(packageModel.packageId, packageModel);
    }
    loadPackage(packageId) {
        return this.packages.get(packageId) ?? null;
    }
    storeArchive(packageId, archive) {
        this.archives.set(packageId, archive);
    }
    loadArchive(packageId) {
        return this.archives.get(packageId) ?? null;
    }
    listArtifacts() {
        return Object.freeze([...this.artifacts.values()]);
    }
}
export class DeliverySigningService {
    secret;
    constructor(secret = null) {
        this.secret = secret;
    }
    sign(packageModel) {
        const payload = serializeCanonicalJSON({
            packageId: packageModel.packageId,
            releaseId: packageModel.releaseId,
            version: packageModel.version,
            checksum: packageModel.checksum,
            manifestChecksum: packageModel.packageModel.manifestChecksum.value,
        });
        if (!this.secret) {
            return stableChecksum(payload);
        }
        return createHmac("sha256", this.resolveSecret()).update(payload).digest("hex");
    }
    verify(packageModel, signature) {
        if (!signature)
            return false;
        return this.sign(packageModel) === signature;
    }
    resolveSecret() {
        if (!this.secret) {
            throw new Error("Delivery signing secret is not configured");
        }
        return typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret;
    }
}
export class DeliveryCompressionService {
    level;
    constructor(level) {
        this.level = level;
    }
    compress(payload) {
        return gzipSync(toBuffer(payload), { level: this.level });
    }
    decompress(payload) {
        return gunzipSync(toBuffer(payload));
    }
}
export class DeliveryEncryptionService {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    encrypt(payload) {
        const key = scryptSync(this.resolveSecret(), "track-syra-delivery", 32);
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
        const key = scryptSync(this.resolveSecret(), "track-syra-delivery", 32);
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
        decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
    }
    resolveSecret() {
        return typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret;
    }
}
export class DeliveryManifestValidator {
    validate(packageModel) {
        const errors = [];
        if (!packageModel.manifest) {
            errors.push(Object.freeze({
                code: "MANIFEST_MISSING",
                category: "manifest",
                message: "Package manifest is missing",
                severity: "error",
                target: "package.manifest",
                value: null,
            }));
        }
        if (packageModel.checksum !== packageModel.packageResult.checksum) {
            errors.push(Object.freeze({
                code: "CHECKSUM_MISMATCH",
                category: "manifest",
                message: "Package checksum does not match package result checksum",
                severity: "error",
                target: "package.checksum",
                value: packageModel.checksum,
            }));
        }
        return freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
    }
}
export class DeliveryPackageVerifier {
    engine;
    signing;
    manifestValidator;
    constructor(engine, signing, manifestValidator) {
        this.engine = engine;
        this.signing = signing;
        this.manifestValidator = manifestValidator;
    }
    async verify(packageModel) {
        const packageVerification = await Promise.resolve(this.engine.verifyPackage(packageModel.packageModel));
        const manifestValidation = this.manifestValidator.validate(packageModel);
        const signatureValue = packageModel.signature && typeof packageModel.signature === "object" && "value" in packageModel.signature
            ? String(packageModel.signature.value ?? "")
            : null;
        const signatureValid = this.signing.verify(packageModel, signatureValue);
        const verifiedAt = nowIso();
        return freeze({
            manifestValid: packageVerification.manifestValid && manifestValidation.valid,
            checksumValid: packageVerification.checksumValid,
            fingerprintValid: packageVerification.fingerprintValid,
            signatureValid,
            verifiedAt,
            metadata: freeze({
                releaseId: packageModel.releaseId,
                packageId: packageModel.packageId,
            }),
        });
    }
}
export class DeliveryBackoffPolicy {
    baseDelayMs;
    multiplier;
    maxDelayMs;
    jitterRatio;
    constructor(baseDelayMs = 1_000, multiplier = 2, maxDelayMs = 5 * 60_000, jitterRatio = 0.1) {
        this.baseDelayMs = baseDelayMs;
        this.multiplier = multiplier;
        this.maxDelayMs = maxDelayMs;
        this.jitterRatio = jitterRatio;
    }
    nextDelay(attempt) {
        const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * (this.multiplier ** Math.max(0, attempt)));
        const jitter = exponential * this.jitterRatio * (Math.random() - 0.5);
        return Math.max(0, Math.floor(exponential + jitter));
    }
}
export class DeliveryRetryEngine {
    backoffPolicy;
    constructor(backoffPolicy) {
        this.backoffPolicy = backoffPolicy;
    }
    shouldRetry(error, job) {
        if (job.retryCount >= job.maxRetries)
            return false;
        const message = error instanceof Error ? error.message : String(error);
        return /timeout|retry|temporary|unavailable|rate limit|429|503|recover/i.test(message) || message.length > 0;
    }
    nextRetryAt(job) {
        return new Date(Date.now() + this.backoffPolicy.nextDelay(job.retryCount)).toISOString();
    }
}
export class DeliveryAuditManager {
    records = [];
    record(releaseId, packageId, version, action, status, metadata = {}) {
        const record = Object.freeze({
            auditId: createId(packageId, action),
            releaseId,
            packageId,
            version,
            action,
            status,
            createdAt: nowIso(),
            metadata: freeze({ ...metadata }),
        });
        this.records.push(record);
        return record;
    }
    list(releaseId) {
        return Object.freeze(releaseId ? this.records.filter((entry) => entry.releaseId === releaseId) : [...this.records]);
    }
}
export class DeliveryHealthChecker {
    runtime;
    artifactStore;
    partnerGate;
    constructor(runtime, artifactStore, partnerGate = null) {
        this.runtime = runtime;
        this.artifactStore = artifactStore;
        this.partnerGate = partnerGate;
    }
    check(componentId) {
        const stats = this.runtime.statistics();
        const activeJobs = stats.jobs.filter((job) => job.state === "queued" || job.state === "scheduled" || job.state === "validating" || job.state === "packaging" || job.state === "dispatching").length;
        return new HealthStatus({
            componentId,
            category: "Application",
            healthy: activeJobs < 1000,
            message: activeJobs < 1000 ? "Delivery runtime healthy" : "Delivery runtime has excessive active jobs",
            metadata: freeze({
                activeJobs,
                artifactCount: this.artifactStore.listArtifacts().length,
                partnerGateReady: this.partnerGate ? true : null,
            }),
        });
    }
}
export class DeliveryPipeline {
    engine;
    verifier;
    signing;
    compression;
    artifactStore;
    auditManager;
    logger;
    constructor(engine, verifier, signing, compression, artifactStore, auditManager, logger) {
        this.engine = engine;
        this.verifier = verifier;
        this.signing = signing;
        this.compression = compression;
        this.artifactStore = artifactStore;
        this.auditManager = auditManager;
        this.logger = logger;
    }
    async prepare(release, job, options = {}) {
        const packageModel = await this.buildPackage(release, job, options);
        const verification = await this.verifier.verify(packageModel);
        if (!(verification.manifestValid && verification.checksumValid && verification.fingerprintValid && verification.signatureValid)) {
            throw new Error(`Delivery package verification failed for ${packageModel.packageId}`);
        }
        const signature = this.signing.sign(packageModel);
        const archive = this.compression.compress(serializeCanonicalJSON(packageModel.toJSON()));
        this.artifactStore.storePackage(packageModel);
        this.artifactStore.storeArchive(packageModel.packageId, archive);
        this.auditManager.record(packageModel.releaseId, packageModel.packageId, packageModel.version, "PACKAGE_READY", "SUCCESS", {
            signature,
            archiveSize: archive.byteLength,
            mode: job.mode,
        });
        this.logger.info("delivery package prepared", { releaseId: packageModel.releaseId, packageId: packageModel.packageId, mode: job.mode });
        return {
            packageModel,
            verification,
            checkpoint: packageModel.checkpoint,
            archive,
            signature,
        };
    }
    async recover(releaseId, reason) {
        return await Promise.resolve(this.engine.recover(releaseId, reason ?? "Recovery requested"));
    }
    async buildPackage(release, job, options) {
        const buildOptions = {
            ...options,
            requestedBy: job.requestedBy,
            scheduledFor: job.scheduledFor,
            metadata: {
                ...(options.metadata ?? {}),
                jobId: job.jobId,
                deliveryMode: job.mode,
            },
        };
        if (job.mode === "scheduled") {
            return await this.engine.prepareScheduledDelivery(release, job.scheduledFor ?? nowIso());
        }
        if (job.mode === "incremental") {
            const previous = options.previousPackage ?? null;
            return await this.engine.buildIncrementalPackage(release, previous, buildOptions);
        }
        if (job.mode === "takedown") {
            const previous = options.previousPackage ?? null;
            if (previous) {
                return await this.engine.createRollbackPackage(release, previous, buildOptions);
            }
        }
        return await this.engine.buildDeliveryPackage(release, buildOptions);
    }
}
export class DeliveryDispatcher {
    connectorFactory;
    partnerGate;
    credentialResolver;
    logger;
    metrics;
    constructor(connectorFactory, partnerGate, credentialResolver, logger, metrics) {
        this.connectorFactory = connectorFactory;
        this.partnerGate = partnerGate;
        this.credentialResolver = credentialResolver;
        this.logger = logger;
        this.metrics = metrics;
    }
    async dispatch(packageModel, job) {
        const results = [];
        for (const target of job.targets) {
            const credential = this.credentialResolver?.resolve(target.partnerName) ?? null;
            if (!this.partnerGate.isPartnerActive(target.partnerName)) {
                results.push(this.failureResult(target, "PARTNER_DISABLED", "Partner is not approved or active"));
                continue;
            }
            if (!credential || !credential.valid || credential.status === "revoked" || credential.status === "expired") {
                results.push(this.failureResult(target, "CREDENTIALS_REQUIRED", "Credential resolution failed"));
                this.metrics.increment("delivery.credentials.failed", 1, { partnerName: target.partnerName });
                continue;
            }
            const context = buildConnectorContext(target, packageModel.releaseId, `${job.jobId}:connector:${target.partnerName}`, packageModel.packageId, {
                jobId: job.jobId,
                packageVersion: packageModel.version,
                packageChecksum: packageModel.checksum,
            });
            const connector = this.connectorFactory.create(context);
            const capabilities = buildCapabilities(target, packageModel);
            const assets = buildConnectorAssets(packageModel);
            const submission = buildConnectorSubmission(packageModel, target);
            const metadata = buildConnectorMetadata(packageModel, target);
            const authenticated = await Promise.resolve(connector.authenticate(context));
            await Promise.resolve(connector.validateCapabilities(context, capabilities));
            const assetResponse = await Promise.resolve(connector.uploadAssets(context, assets));
            const metadataResponse = await Promise.resolve(connector.submitMetadata(context, metadata));
            const submissionResponse = await Promise.resolve(connector.createRelease(context, submission));
            const statusResponse = await Promise.resolve(connector.trackProcessing(context));
            const connectorStatus = mapConnectorStatus(statusResponse.payload ?? null);
            const success = Boolean(authenticated.success && assetResponse.success && metadataResponse.success && submissionResponse.success);
            const result = Object.freeze({
                partnerName: target.partnerName,
                adapterName: target.adapterName,
                connectorStatus,
                receipt: submissionResponse.payload ? submissionResponse.payload.submissionId : null,
                success,
                failure: !success,
                status: success ? "completed" : "failed",
                metadata: freeze({
                    authentication: authenticated.metadata,
                    assets: assetResponse.metadata,
                    metadataSubmission: metadataResponse.metadata,
                    submission: submissionResponse.metadata,
                    status: statusResponse.metadata,
                }),
            });
            results.push(result);
            this.logger.info("delivery dispatched", { releaseId: packageModel.releaseId, packageId: packageModel.packageId, partnerName: target.partnerName, connectorStatus });
            this.metrics.increment("delivery.dispatch.count", 1, { partnerName: target.partnerName });
        }
        return Object.freeze(results);
    }
    failureResult(target, connectorStatus, reason) {
        return Object.freeze({
            partnerName: target.partnerName,
            adapterName: target.adapterName,
            connectorStatus,
            receipt: null,
            success: false,
            failure: true,
            status: "failed",
            metadata: freeze({
                reason,
                partnerName: target.partnerName,
            }),
        });
    }
}
export class DeliveryCoordinator {
    scheduler;
    constructor(scheduler) {
        this.scheduler = scheduler;
    }
    order(jobs) {
        return this.scheduler.order(jobs);
    }
}
export class DeliveryScheduler {
    order(jobs) {
        const graph = new Map();
        for (const job of jobs) {
            graph.set(job.jobId, job);
        }
        const result = [];
        const visited = new Set();
        const visiting = new Set();
        const visit = (job) => {
            if (visited.has(job.jobId))
                return;
            if (visiting.has(job.jobId)) {
                throw new Error(`Cyclic delivery dependency detected for ${job.jobId}`);
            }
            visiting.add(job.jobId);
            for (const dependencyId of job.dependencyJobIds) {
                const dependency = graph.get(dependencyId);
                if (dependency) {
                    visit(dependency);
                }
            }
            visiting.delete(job.jobId);
            visited.add(job.jobId);
            result.push(job);
        };
        [...jobs]
            .sort((left, right) => {
            const leftSchedule = left.scheduledFor ? Date.parse(left.scheduledFor) : 0;
            const rightSchedule = right.scheduledFor ? Date.parse(right.scheduledFor) : 0;
            if (leftSchedule !== rightSchedule)
                return leftSchedule - rightSchedule;
            return scoreJob(right) - scoreJob(left);
        })
            .forEach((job) => visit(job));
        return Object.freeze(result);
    }
    isDue(job) {
        return !job.scheduledFor || Date.parse(job.scheduledFor) <= Date.now();
    }
}
export class DeliveryBatchProcessor {
    coordinator;
    executor;
    concurrency;
    constructor(coordinator, executor, concurrency = 2) {
        this.coordinator = coordinator;
        this.executor = executor;
        this.concurrency = concurrency;
    }
    async process(jobs) {
        const ordered = this.coordinator.order(jobs);
        const results = [];
        const queue = [...ordered];
        const active = new Set();
        const runNext = async () => {
            const job = queue.shift();
            if (!job)
                return;
            const task = this.executor.execute(job).then((result) => {
                results.push(result);
            }).finally(() => {
                active.delete(task);
            });
            active.add(task);
            if (active.size < this.concurrency) {
                void runNext();
            }
            await task;
        };
        while (queue.length || active.size) {
            while (queue.length && active.size < this.concurrency) {
                await runNext();
            }
            if (active.size) {
                await Promise.race([...active]);
            }
        }
        return Object.freeze(results);
    }
}
export class DeliveryResumeManager {
    checkpoints;
    pipeline;
    constructor(checkpoints, pipeline) {
        this.checkpoints = checkpoints;
        this.pipeline = pipeline;
    }
    async resume(job, checkpointId, release) {
        if (!checkpointId)
            return null;
        const checkpoint = this.checkpoints.restore(checkpointId);
        if (!checkpoint)
            return null;
        const recovery = await this.pipeline.recover(job.releaseId, "Resume requested");
        if (!recovery.package)
            return null;
        return {
            release,
            packageModel: recovery.package,
            verification: {
                manifestValid: true,
                checksumValid: true,
                fingerprintValid: true,
                signatureValid: true,
                verifiedAt: nowIso(),
                metadata: freeze({ resumedFromCheckpointId: checkpointId }),
            },
            archive: null,
            signature: null,
            checkpoint,
            resumedFromCheckpointId: checkpointId,
            metadata: freeze({ checkpointId, recovery: recovery.metadata }),
        };
    }
}
export class DeliveryFailureRecovery {
    pipeline;
    checkpoints;
    logger;
    constructor(pipeline, checkpoints, logger) {
        this.pipeline = pipeline;
        this.checkpoints = checkpoints;
        this.logger = logger;
    }
    async recover(job, release, reason) {
        const checkpoint = job.checkpointId ? this.checkpoints.restore(job.checkpointId) : null;
        const recovery = await this.pipeline.recover(release.id.value, reason);
        if (!recovery.package) {
            return null;
        }
        this.logger.warn("delivery recovery completed", { releaseId: release.id.value, jobId: job.jobId, checkpointId: checkpoint?.checkpointId ?? null, reason });
        return {
            release,
            packageModel: recovery.package,
            verification: {
                manifestValid: true,
                checksumValid: true,
                fingerprintValid: true,
                signatureValid: true,
                verifiedAt: nowIso(),
                metadata: freeze({ reason }),
            },
            archive: null,
            signature: null,
            checkpoint: checkpoint ?? recovery.package.checkpoint,
            resumedFromCheckpointId: checkpoint?.checkpointId ?? null,
            metadata: freeze({ reason, recovered: recovery.recovered }),
        };
    }
}
export class DeliveryExecutor {
    runtime;
    pipeline;
    dispatcher;
    checkpoints;
    progress;
    retries;
    auditManager;
    logger;
    metrics;
    constructor(runtime, pipeline, dispatcher, checkpoints, progress, retries, auditManager, logger, metrics) {
        this.runtime = runtime;
        this.pipeline = pipeline;
        this.dispatcher = dispatcher;
        this.checkpoints = checkpoints;
        this.progress = progress;
        this.retries = retries;
        this.auditManager = auditManager;
        this.logger = logger;
        this.metrics = metrics;
    }
    async execute(job) {
        const startedAt = nowIso();
        const release = await this.runtime.resolveRelease(job.releaseId);
        if (!release) {
            throw new Error(`Release not found: ${job.releaseId}`);
        }
        if (job.state === "cancelled") {
            return this.result(job, null, startedAt, [], ["Job cancelled"], []);
        }
        if (job.timeoutMs != null && job.startedAt && Date.now() - Date.parse(job.startedAt) > job.timeoutMs) {
            throw new Error(`Delivery job timed out: ${job.jobId}`);
        }
        this.progress.update(job.jobId, "validating", 10);
        const plan = await this.pipeline.prepare(release, job, {
            requestedBy: job.requestedBy ?? undefined,
            scheduledFor: job.scheduledFor,
            checkpointId: job.checkpointId ?? undefined,
            resumeFromCheckpointId: job.checkpointId ?? undefined,
            metadata: freeze({ jobId: job.jobId, mode: job.mode }),
        });
        const checkpoint = this.checkpoints.create(job, "PACKAGE", plan.packageModel.packageId, plan.packageModel.version, {
            checksum: plan.packageModel.checksum,
            signature: plan.signature,
            verification: plan.verification,
        }, job.checkpointId);
        this.progress.update(job.jobId, "dispatching", 60);
        const targetResults = job.mode === "takedown"
            ? await this.dispatchTakedown(job, plan.packageModel)
            : await this.dispatcher.dispatch(plan.packageModel, job);
        const success = targetResults.every((result) => result.success);
        const completedState = success ? "completed" : "failed";
        const result = this.result(job, plan.packageModel, startedAt, targetResults, success ? [] : ["One or more target deliveries failed"], [], checkpoint.checkpointId, plan.signature);
        this.auditManager.record(job.releaseId, plan.packageModel.packageId, plan.packageModel.version, success ? "DELIVERY_COMPLETED" : "DELIVERY_FAILED", success ? "SUCCESS" : "FAILED", {
            jobId: job.jobId,
            targetCount: targetResults.length,
        });
        this.progress.update(job.jobId, completedState, 100);
        this.metrics.increment(success ? "delivery.completed" : "delivery.failed", 1, { jobId: job.jobId });
        this.logger.info("delivery execution finished", { jobId: job.jobId, releaseId: job.releaseId, success });
        this.runtime.updateJob(job.jobId, {
            state: completedState,
            packageId: plan.packageModel.packageId,
            packageVersion: plan.packageModel.version,
            checkpointId: checkpoint.checkpointId,
            completedAt: nowIso(),
            progress: 100,
            lastError: success ? null : "One or more target deliveries failed",
        });
        return result;
    }
    async dispatchTakedown(job, packageModel) {
        const results = [];
        for (const target of job.targets) {
            const credential = this.runtime.resolveCredential(target.partnerName);
            if (!this.runtime.partnerGate.isPartnerActive(target.partnerName) || !credential || !credential.valid || credential.status === "revoked" || credential.status === "expired") {
                results.push(Object.freeze({
                    partnerName: target.partnerName,
                    adapterName: target.adapterName,
                    connectorStatus: "CREDENTIALS_REQUIRED",
                    receipt: null,
                    success: false,
                    failure: true,
                    status: "failed",
                    metadata: freeze({
                        reason: "Credential resolution failed or partner inactive",
                        partnerName: target.partnerName,
                    }),
                }));
                continue;
            }
            const context = buildConnectorContext(target, packageModel.releaseId, `${job.jobId}:takedown:${target.partnerName}`, packageModel.packageId, { jobId: job.jobId });
            const connector = this.runtime.connectorFactory.create(context);
            const response = await Promise.resolve(connector.takedownRelease(context));
            results.push(Object.freeze({
                partnerName: target.partnerName,
                adapterName: target.adapterName,
                connectorStatus: mapConnectorStatus(typeof response.metadata?.status === "string" ? response.metadata.status : null),
                receipt: response.metadata?.takedownId ? String(response.metadata.takedownId) : null,
                success: Boolean(response.success),
                failure: !response.success,
                status: response.success ? "completed" : "failed",
                metadata: freeze({ response: response.metadata }),
            }));
        }
        return Object.freeze(results);
    }
    result(job, packageModel, startedAt, targetResults, errors, warnings, checkpointId = null, signature = null) {
        return Object.freeze({
            jobId: job.jobId,
            releaseId: job.releaseId,
            state: errors.length ? "failed" : "completed",
            packageId: packageModel?.packageId ?? null,
            packageVersion: packageModel?.version ?? null,
            checksum: packageModel?.checksum ?? null,
            checkpointId,
            startedAt,
            completedAt: nowIso(),
            targetResults,
            errors,
            warnings: [...warnings, ...(signature ? [] : [])],
            metadata: freeze({
                mode: job.mode,
                signature,
            }),
        });
    }
}
export class DeliveryWorkerBridge {
    runtime;
    executor;
    constructor(runtime, executor) {
        this.runtime = runtime;
        this.executor = executor;
    }
    execute(request) {
        return this.handle(request);
    }
    async handle(request) {
        const body = request.queueEnvelope?.body;
        const jobId = typeof body?.jobId === "string" ? body.jobId : request.executionContext.jobId;
        const releaseId = typeof body?.releaseId === "string" ? body.releaseId : request.executionContext.releaseId;
        const targets = Array.isArray(body?.targets) ? body.targets : [];
        const job = this.runtime.getJob(jobId) ?? this.runtime.createJob({
            releaseId,
            mode: "single",
            targets,
            requestedBy: null,
            metadata: freeze({ workerRequestId: request.requestId }),
        });
        try {
            const result = await this.executor.execute(job);
            return new WorkerExecutionResultModel({
                success: result.errors.length === 0,
                failure: result.errors.length > 0,
                executionId: request.executionContext.executionId,
                workerId: request.executionContext.workerId,
                completedStage: "Delivery",
                executionTime: Date.now() - Date.parse(request.requestedAt),
                nextStage: null,
                checkpoint: null,
                errors: result.errors,
                warnings: result.warnings,
                metadata: freeze({
                    jobId,
                    releaseId,
                }),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return new WorkerExecutionResultModel({
                success: false,
                failure: true,
                executionId: request.executionContext.executionId,
                workerId: request.executionContext.workerId,
                completedStage: "Delivery",
                executionTime: Date.now() - Date.parse(request.requestedAt),
                nextStage: null,
                checkpoint: null,
                errors: [message],
                warnings: [],
                metadata: freeze({
                    jobId,
                    releaseId,
                }),
            });
        }
    }
}
export class DeliveryQueueBridge {
    workerRuntime;
    logger;
    constructor(workerRuntime, logger) {
        this.workerRuntime = workerRuntime;
        this.logger = logger;
    }
    dispatch(envelope, context) {
        return this.handle(envelope, context);
    }
    async handle(envelope, context) {
        const request = new WorkerExecutionRequestModel({
            requestId: envelope.messageId,
            executionContext: new WorkerExecutionContextModel({
                workerId: String(context.metadata.workerId ?? "delivery-worker"),
                orchestrationId: String(context.metadata.orchestrationId ?? context.executionId),
                executionId: context.executionId,
                releaseId: context.releaseId,
                jobId: context.jobId,
                queueName: context.queueName,
                pipelineName: String(context.metadata.pipelineName ?? "delivery"),
                stage: context.stage,
                state: "Running",
                retryCount: context.retryCount,
                lease: null,
                heartbeat: null,
                checkpoint: null,
                recovery: null,
                queueEnvelope: envelope,
                pipelineExecution: new WorkerPipelineExecutionModel({
                    pipelineExecutionId: `${context.executionId}:pipeline`,
                    workerId: String(context.metadata.workerId ?? "delivery-worker"),
                    executionId: context.executionId,
                    pipelineName: String(context.metadata.pipelineName ?? "delivery"),
                    currentStage: context.stage,
                    completedStages: [],
                    pendingStages: [],
                    metadata: context.metadata,
                }),
                startedAt: context.createdAt,
                updatedAt: context.updatedAt,
                metadata: context.metadata,
            }),
            queueEnvelope: envelope,
            pipelineExecution: new WorkerPipelineExecutionModel({
                pipelineExecutionId: `${context.executionId}:pipeline`,
                workerId: String(context.metadata.workerId ?? "delivery-worker"),
                executionId: context.executionId,
                pipelineName: String(context.metadata.pipelineName ?? "delivery"),
                currentStage: context.stage,
                completedStages: [],
                pendingStages: [],
                metadata: context.metadata,
            }),
            metadata: context.metadata,
        });
        const workerResult = await Promise.resolve(this.workerRuntime.execute(request));
        this.logger.info("delivery queue bridge dispatched", { messageId: envelope.messageId, releaseId: context.releaseId });
        return new QueueExecutionResultModel({
            success: workerResult.success,
            failure: workerResult.failure,
            completedStage: workerResult.completedStage,
            executionTime: workerResult.executionTime,
            nextStage: workerResult.nextStage,
            checkpoint: null,
            errors: workerResult.errors,
            warnings: workerResult.warnings,
            metadata: freeze({
                executionId: context.executionId,
                jobId: context.jobId,
            }),
        });
    }
}
export class DeliveryJobRuntime {
    dependencies;
    logger;
    metrics;
    auditManager;
    progressTracker;
    checkpoints;
    retryEngine;
    pipeline;
    dispatcher;
    jobs;
    batchProcessor;
    constructor(dependencies, logger, metrics, auditManager, progressTracker, checkpoints, retryEngine, pipeline, dispatcher, jobs, batchProcessor = null) {
        this.dependencies = dependencies;
        this.logger = logger;
        this.metrics = metrics;
        this.auditManager = auditManager;
        this.progressTracker = progressTracker;
        this.checkpoints = checkpoints;
        this.retryEngine = retryEngine;
        this.pipeline = pipeline;
        this.dispatcher = dispatcher;
        this.jobs = jobs;
        this.batchProcessor = batchProcessor;
    }
    get connectorFactory() {
        return this.dependencies.connectorFactory;
    }
    get partnerGate() {
        if (!this.dependencies.partnerActivationGate) {
            throw new Error("Delivery partner activation gate is not configured");
        }
        return this.dependencies.partnerActivationGate;
    }
    resolveCredential(partnerName) {
        return this.dependencies.credentialResolver?.resolve(partnerName) ?? null;
    }
    createJob(input) {
        const job = Object.freeze({
            jobId: createId("delivery-job", input.releaseId),
            releaseId: input.releaseId.trim(),
            mode: input.mode,
            state: normalizeSchedule(input.scheduledFor) ? "scheduled" : "queued",
            requestedBy: input.requestedBy ?? null,
            priority: normalizePriority(input.priority),
            scheduledFor: normalizeSchedule(input.scheduledFor),
            dependencyJobIds: Object.freeze([...(input.dependencyJobIds ?? [])]),
            targets: Object.freeze([...input.targets]),
            maxRetries: Math.max(0, input.maxRetries ?? 3),
            retryCount: 0,
            timeoutMs: input.timeoutMs ?? null,
            packageId: null,
            packageVersion: null,
            checkpointId: null,
            startedAt: null,
            completedAt: null,
            cancelledAt: null,
            pausedAt: null,
            lastError: null,
            progress: 0,
            metadata: freeze({ ...(input.metadata ?? {}) }),
        });
        this.jobs.set(job.jobId, job);
        this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_CREATED", "SUCCESS", { mode: job.mode });
        this.metrics.increment("delivery.jobs.created", 1, { mode: job.mode });
        return job;
    }
    submit(input) {
        return this.createJob(input);
    }
    async run(jobId) {
        const job = this.requireJob(jobId);
        if (job.state === "cancelled") {
            return {
                jobId: job.jobId,
                releaseId: job.releaseId,
                state: "cancelled",
                packageId: null,
                packageVersion: null,
                checksum: null,
                checkpointId: job.checkpointId,
                startedAt: job.startedAt ?? nowIso(),
                completedAt: nowIso(),
                targetResults: [],
                errors: ["Job cancelled"],
                warnings: [],
                metadata: freeze({ cancelledAt: job.cancelledAt }),
            };
        }
        const updated = cloneJob(job, {
            state: job.scheduledFor && Date.parse(job.scheduledFor) > Date.now() ? "scheduled" : "validating",
            startedAt: job.startedAt ?? nowIso(),
        });
        this.jobs.set(job.jobId, updated);
        try {
            const release = await this.resolveRelease(job.releaseId);
            if (!release) {
                throw new Error(`Release not found: ${job.releaseId}`);
            }
            const result = await this.pipelineAndDispatch(updated, release);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const shouldRetry = this.retryEngine.shouldRetry(error, updated);
            const nextState = shouldRetry ? "queued" : "failed";
            this.updateJob(job.jobId, {
                state: nextState,
                retryCount: updated.retryCount + 1,
                lastError: message,
            });
            if (shouldRetry) {
                this.metrics.increment("delivery.jobs.retry", 1, { jobId });
            }
            else {
                this.metrics.increment("delivery.jobs.failed", 1, { jobId });
            }
            throw error;
        }
    }
    async runDueJobs() {
        const due = [...this.jobs.values()].filter((job) => (job.state === "queued" || job.state === "scheduled") && (!job.scheduledFor || Date.parse(job.scheduledFor) <= Date.now()));
        if (due.length === 0) {
            return Object.freeze([]);
        }
        const results = [];
        for (const job of due) {
            results.push(await this.run(job.jobId));
        }
        return Object.freeze(results);
    }
    pause(jobId, reason = null) {
        const job = this.requireJob(jobId);
        const updated = cloneJob(job, { state: "paused", pausedAt: nowIso(), lastError: reason });
        this.jobs.set(jobId, updated);
        this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_PAUSED", "UPDATED", { reason });
        return updated;
    }
    resume(jobId) {
        const job = this.requireJob(jobId);
        const updated = cloneJob(job, { state: job.scheduledFor ? "scheduled" : "queued", pausedAt: null, lastError: null });
        this.jobs.set(jobId, updated);
        this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_RESUMED", "UPDATED", {});
        return updated;
    }
    cancel(jobId, reason = null) {
        const job = this.requireJob(jobId);
        const updated = cloneJob(job, { state: "cancelled", cancelledAt: nowIso(), lastError: reason });
        this.jobs.set(jobId, updated);
        this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_CANCELLED", "UPDATED", { reason });
        return updated;
    }
    updateJob(jobId, patch) {
        const job = this.requireJob(jobId);
        const updated = cloneJob(job, patch);
        this.jobs.set(jobId, updated);
        return updated;
    }
    getJob(jobId) {
        return this.jobs.get(jobId) ?? null;
    }
    listJobs() {
        return Object.freeze([...this.jobs.values()]);
    }
    statistics() {
        return freeze({
            jobs: this.listJobs(),
            metrics: this.metrics.snapshot(),
        });
    }
    async resolveRelease(releaseId) {
        return await Promise.resolve(this.dependencies.releaseResolver(releaseId));
    }
    async recover(jobId, reason = "Recovery requested") {
        const job = this.requireJob(jobId);
        const release = await this.resolveRelease(job.releaseId);
        if (!release)
            return null;
        const recovery = await this.pipeline.recover(job.releaseId, reason);
        if (!recovery.package)
            return null;
        this.auditManager.record(job.releaseId, recovery.package.packageId, recovery.package.version, "RECOVERY_COMPLETED", "RECOVERED", { reason });
        return recovery;
    }
    async pipelineAndDispatch(job, release) {
        const prepared = await this.pipeline.prepare(release, job, {
            requestedBy: job.requestedBy ?? undefined,
            scheduledFor: job.scheduledFor,
            checkpointId: job.checkpointId ?? undefined,
            resumeFromCheckpointId: job.checkpointId ?? undefined,
            metadata: freeze({ jobId: job.jobId, mode: job.mode }),
        });
        const checkpoint = this.checkpoints.create(job, "PACKAGE", prepared.packageModel.packageId, prepared.packageModel.version, { mode: job.mode }, job.checkpointId);
        this.updateJob(job.jobId, {
            state: "dispatching",
            packageId: prepared.packageModel.packageId,
            packageVersion: prepared.packageModel.version,
            checkpointId: checkpoint.checkpointId,
        });
        const targetResults = job.mode === "takedown"
            ? await this.dispatchTakedown(job, prepared.packageModel)
            : await this.dispatcher.dispatch(prepared.packageModel, job);
        const errors = targetResults.filter((target) => !target.success).map((target) => `${target.partnerName}:${target.connectorStatus ?? "failed"}`);
        const nextState = errors.length ? "failed" : "completed";
        const updated = this.updateJob(job.jobId, {
            state: nextState,
            completedAt: nowIso(),
            progress: 100,
            lastError: errors.length ? errors.join(", ") : null,
        });
        this.progressTracker.update(job.jobId, nextState, 100);
        this.auditManager.record(job.releaseId, prepared.packageModel.packageId, prepared.packageModel.version, errors.length ? "DELIVERY_FAILED" : "DELIVERY_COMPLETED", errors.length ? "FAILED" : "SUCCESS", { jobId: job.jobId });
        return Object.freeze({
            jobId: updated.jobId,
            releaseId: updated.releaseId,
            state: updated.state,
            packageId: prepared.packageModel.packageId,
            packageVersion: prepared.packageModel.version,
            checksum: prepared.packageModel.checksum,
            checkpointId: checkpoint.checkpointId,
            startedAt: updated.startedAt ?? nowIso(),
            completedAt: updated.completedAt,
            targetResults,
            errors,
            warnings: [],
            metadata: freeze({
                signature: prepared.signature,
                verification: prepared.verification,
            }),
        });
    }
    async dispatchTakedown(job, packageModel) {
        const results = [];
        for (const target of job.targets) {
            if (!this.partnerGate.isPartnerActive(target.partnerName)) {
                throw new Error(`Partner is not approved or active: ${target.partnerName}`);
            }
            const context = buildConnectorContext(target, packageModel.releaseId, `${job.jobId}:takedown:${target.partnerName}`, packageModel.packageId, { jobId: job.jobId });
            const connector = this.connectorFactory.create(context);
            const response = await Promise.resolve(connector.takedownRelease(context));
            results.push(Object.freeze({
                partnerName: target.partnerName,
                adapterName: target.adapterName,
                connectorStatus: mapConnectorStatus(typeof response.metadata?.status === "string" ? response.metadata.status : null),
                receipt: response.metadata?.takedownId ? String(response.metadata.takedownId) : null,
                success: Boolean(response.success),
                failure: !response.success,
                status: response.success ? "completed" : "failed",
                metadata: freeze({ response: response.metadata }),
            }));
        }
        return Object.freeze(results);
    }
    requireJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            throw new Error(`Delivery job not found: ${jobId}`);
        }
        return job;
    }
}
export function createTrackSyraDeliveryRuntime(dependencies) {
    return dependencies;
}
