import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, scryptSync } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Release } from "../../domain";
import { DeliveryPackage as DeliveryPackageModel, type DeliveryAuditRecord, type DeliveryCheckpoint, type DeliveryCheckpointStage, type DeliveryValidationIssue, type DeliveryValidationReport } from "../../core/deliveryPackage";
import { ReleaseDeliveryEngine, type ReleaseDeliveryBuildOptions, type ReleaseDeliveryRecovery } from "../../core/releaseDeliveryEngine";
import type { ConnectorAsset } from "../../connectors/assets/connectorAsset";
import { ConnectorAsset as ConnectorAssetModel } from "../../connectors/assets/connectorAsset";
import { ConnectorCapabilities } from "../../connectors/capabilities/connectorCapabilities";
import { ConnectorConfiguration } from "../../connectors/configuration/connectorConfiguration";
import { ConnectorContext } from "../../connectors/context/connectorContext";
import { ConnectorSubmission } from "../../connectors/catalog/connectorCatalog";
import type { DSPConnector, ConnectorFactory } from "../../connectors/contracts/connectorContracts";
import { ConnectorMetadata } from "../../connectors/metadata/connectorMetadata";
import type { ConnectorStatus } from "../../connectors/status/connectorStatus";
import type { ConnectorMetadataMap } from "../../connectors/types/connectorTypes";
import type { OfficialDspPartnerName, PartnerActivationGate } from "../../partner-onboarding";
import type { ProviderIntegrationResolver } from "../../provider-integration/resolver/providerResolver";
import type { ProviderStatusSnapshot } from "../../provider-integration/types/providerIntegrationTypes";
import type { QueueDispatcher } from "../../queue/integration/dispatcher/queueDispatcher";
import type { QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "../../queue/integration/types/queueIntegrationTypes";
import { QueueEnvelope as QueueEnvelopeModel, QueueExecutionResult as QueueExecutionResultModel } from "../../queue/integration/types/queueIntegrationTypes";
import type { WorkerRuntime } from "../integration/contracts/workerRuntimeContracts";
import type { WorkerExecutionContext, WorkerExecutionRequest, WorkerExecutionResult, WorkerPipelineExecution } from "../integration/types/workerIntegrationTypes";
import { WorkerExecutionContext as WorkerExecutionContextModel, WorkerExecutionRequest as WorkerExecutionRequestModel, WorkerExecutionResult as WorkerExecutionResultModel, WorkerPipelineExecution as WorkerPipelineExecutionModel } from "../integration/types/workerIntegrationTypes";
import type { AuditService, HealthChecker, Logger, MetricsCollector } from "../../observability/contracts/observabilityContracts";
import { HealthStatus } from "../../observability/health/healthStatus";
import { LogEntry } from "../../observability/logging/logEntry";
import { Metric } from "../../observability/metrics/metric";
import { serializeCanonicalJSON } from "../../core/canonicalSerializer";
import type { PartnerCredentialResolver } from "../../partner-credentials";
import type { RuntimeRepository } from "../../infrastructure/repositories/runtime";

export type DeliveryMode =
  | "single"
  | "bulk"
  | "scheduled"
  | "priority"
  | "incremental"
  | "metadata-only"
  | "takedown"
  | "reinstatement"
  | "retryable"
  | "resumable";

export type DeliveryJobState =
  | "queued"
  | "scheduled"
  | "validating"
  | "packaging"
  | "dispatching"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed"
  | "recovered";

export type DeliveryPriority = "Critical" | "High" | "Normal" | "Low" | "Background";

export type DeliveryJobTarget = Readonly<{
  partnerName: OfficialDspPartnerName;
  adapterName: string | null;
  priority: number;
  dependencies: readonly string[];
  scheduledFor: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryJobInput = Readonly<{
  releaseId: string;
  mode: DeliveryMode;
  targets: readonly DeliveryJobTarget[];
  requestedBy?: string | null;
  priority?: DeliveryPriority | number;
  scheduledFor?: string | Date | null;
  dependencyJobIds?: readonly string[];
  maxRetries?: number;
  timeoutMs?: number | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryTargetResult = Readonly<{
  partnerName: OfficialDspPartnerName;
  adapterName: string | null;
  connectorStatus: string | null;
  receipt: string | null;
  success: boolean;
  failure: boolean;
  status: DeliveryJobState;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryJobResult = Readonly<{
  jobId: string;
  releaseId: string;
  state: DeliveryJobState;
  packageId: string | null;
  packageVersion: string | null;
  checksum: string | null;
  checkpointId: string | null;
  startedAt: string;
  completedAt: string | null;
  targetResults: readonly DeliveryTargetResult[];
  errors: readonly string[];
  warnings: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryJobRecord = Readonly<{
  jobId: string;
  releaseId: string;
  mode: DeliveryMode;
  state: DeliveryJobState;
  requestedBy: string | null;
  priority: number;
  scheduledFor: string | null;
  dependencyJobIds: readonly string[];
  targets: readonly DeliveryJobTarget[];
  maxRetries: number;
  retryCount: number;
  timeoutMs: number | null;
  packageId: string | null;
  packageVersion: string | null;
  checkpointId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  pausedAt: string | null;
  lastError: string | null;
  progress: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryArtifactRecord = Readonly<{
  artifactId: string;
  kind: string;
  payload: Buffer;
  checksum: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryEncryptedPayload = Readonly<{
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  data: string;
}>;

export type DeliveryVerificationReport = Readonly<{
  manifestValid: boolean;
  checksumValid: boolean;
  fingerprintValid: boolean;
  signatureValid: boolean;
  verifiedAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryExecutionPlan = Readonly<{
  release: Release;
  packageModel: DeliveryPackageModel;
  verification: DeliveryVerificationReport;
  archive: Buffer | null;
  signature: string | null;
  checkpoint: DeliveryCheckpoint;
  resumedFromCheckpointId: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryRuntimeDependencies = DeliveryRuntimeBundle & Readonly<{
  releaseResolver: (releaseId: string) => Promise<Release | null> | Release | null;
  releaseDeliveryEngine: ReleaseDeliveryEngine | null;
  connectorFactory: ConnectorFactory;
  partnerActivationGate: PartnerActivationGate;
  credentialResolver: PartnerCredentialResolver | null;
  providerIntegrationResolver: ProviderIntegrationResolver | null;
  queueDispatcher: QueueDispatcher | null;
  workerRuntime: WorkerRuntime | null;
  scheduler: DeliveryScheduler;
  logger: Logger | null;
  metrics: MetricsCollector | null;
  auditService: AuditService | null;
  healthChecker: HealthChecker | null;
  signingKey: string | Buffer | null;
  encryptionKey: string | Buffer | null;
  compressionLevel: number;
  storageNamespace: string | null;
}>;

export type DeliveryRepositoryBundle = Readonly<{
  counters: RuntimeRepository<string, number>;
  observations: RuntimeRepository<string, readonly number[]>;
  gauges: RuntimeRepository<string, number>;
  checkpoints: RuntimeRepository<string, DeliveryCheckpoint>;
  progress: RuntimeRepository<string, number>;
  stages: RuntimeRepository<string, DeliveryJobState>;
  artifacts: RuntimeRepository<string, DeliveryArtifactRecord>;
  packages: RuntimeRepository<string, DeliveryPackageModel>;
  archives: RuntimeRepository<string, Buffer>;
  jobs: RuntimeRepository<string, DeliveryJobRecord>;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function createId(prefix: string, suffix: string): string {
  return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomBytes(4).toString("hex")}`;
}

function normalizeSchedule(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizePriority(priority: DeliveryPriority | number | undefined): number {
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

function stableChecksum(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function toBuffer(payload: string | Buffer): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}

function createConnectorConfiguration(connectorId: string, version: string, releaseId: string, metadata: Readonly<Record<string, unknown>>): ConnectorConfiguration {
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

function buildConnectorContext(target: DeliveryJobTarget, releaseId: string, executionId: string, packageId: string, metadata: Readonly<Record<string, unknown>>): ConnectorContext {
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

function buildConnectorAssets(packageModel: DeliveryPackageModel): readonly ConnectorAsset[] {
  return Object.freeze(packageModel.artifacts.map((artifact, index) =>
    new ConnectorAssetModel({
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
    }),
  ));
}

function buildConnectorSubmission(packageModel: DeliveryPackageModel, target: DeliveryJobTarget): ConnectorSubmission {
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

function buildConnectorMetadata(packageModel: DeliveryPackageModel, target: DeliveryJobTarget): ConnectorMetadata {
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

function buildCapabilities(target: DeliveryJobTarget, packageModel: DeliveryPackageModel): ConnectorCapabilities {
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

function mapConnectorStatus(status: ConnectorStatus | ProviderStatusSnapshot | string | null): string | null {
  if (!status) return null;
  if (typeof status === "string") return status;
  if ("status" in status && typeof status.status === "string") return status.status;
  if ("providerStatus" in status && typeof status.providerStatus === "string") return status.providerStatus;
  return null;
}

function scoreJob(job: DeliveryJobRecord): number {
  return job.priority + (job.mode === "priority" ? 50 : 0) - job.retryCount;
}

function cloneJob(job: DeliveryJobRecord, patch: Partial<DeliveryJobRecord>): DeliveryJobRecord {
  return Object.freeze({ ...job, ...patch, metadata: freeze({ ...job.metadata, ...(patch.metadata ?? {}) }) });
}

function toQueueEnvelope(job: DeliveryJobRecord): QueueEnvelope {
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

function createWorkerContext(job: DeliveryJobRecord): WorkerExecutionContext {
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
  private readonly entries: Array<Readonly<{ level: "debug" | "info" | "warn" | "error"; message: string; context: Readonly<Record<string, unknown>>; recordedAt: string }>> = [];

  constructor(private readonly sink: Logger | null) {}

  debug(message: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit("debug", message, context);
  }

  info(message: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit("info", message, context);
  }

  warn(message: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit("warn", message, context);
  }

  error(message: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit("error", message, context);
  }

  list(): readonly typeof this.entries[number][] {
    return Object.freeze([...this.entries]);
  }

  private emit(level: "debug" | "info" | "warn" | "error", message: string, context: Readonly<Record<string, unknown>>): void {
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
  constructor(
    private readonly repositories: Readonly<{
      counters: RuntimeRepository<string, number>;
      observations: RuntimeRepository<string, readonly number[]>;
      gauges: RuntimeRepository<string, number>;
    }>,
    private readonly sink: MetricsCollector | null = null,
  ) {}

  increment(metric: string, value = 1, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
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

  observe(metric: string, value: number, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
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

  gauge(metric: string, value: number, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
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

  snapshot(): Readonly<Record<string, unknown>> {
    return freeze({
      counters: freeze(Object.fromEntries(this.repositories.counters.entries())),
      gauges: freeze(Object.fromEntries(this.repositories.gauges.entries())),
      observations: freeze(Object.fromEntries([...this.repositories.observations.entries()].map(([key, values]) => [key, Object.freeze([...values])] as const))),
    });
  }

  private key(metric: string, tags: Readonly<Record<string, string | number | boolean>>): string {
    return `${metric}:${JSON.stringify(tags)}`;
  }
}

export class DeliveryCheckpointManager {
  constructor(private readonly checkpoints: RuntimeRepository<string, DeliveryCheckpoint>) {}

  save(checkpoint: DeliveryCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
  }

  create(job: DeliveryJobRecord, stage: DeliveryCheckpointStage, packageId: string, version: string, metadata: Readonly<Record<string, unknown>> = {}, resumedFromCheckpointId: string | null = null): DeliveryCheckpoint {
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

  restore(checkpointId: string): DeliveryCheckpoint | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  list(releaseId?: string): readonly DeliveryCheckpoint[] {
    const items = [...this.checkpoints.values()];
    return Object.freeze(releaseId ? items.filter((entry) => entry.releaseId === releaseId) : items);
  }
}

export class DeliveryProgressTracker {
  constructor(
    private readonly progress: RuntimeRepository<string, number>,
    private readonly stages: RuntimeRepository<string, DeliveryJobState>,
  ) {}

  update(jobId: string, state: DeliveryJobState, progress: number): void {
    this.progress.set(jobId, Math.max(0, Math.min(100, progress)));
    this.stages.set(jobId, state);
  }

  get(jobId: string): Readonly<{ state: DeliveryJobState | null; progress: number }> {
    return freeze({
      state: (this.stages.get(jobId) ?? null) as DeliveryJobState | null,
      progress: this.progress.get(jobId) ?? 0,
    });
  }
}

export class DeliveryArtifactStore {
  constructor(
    private readonly artifacts: RuntimeRepository<string, DeliveryArtifactRecord>,
    private readonly packages: RuntimeRepository<string, DeliveryPackageModel>,
    private readonly archives: RuntimeRepository<string, Buffer>,
  ) {}

  storeArtifact(kind: string, payload: Buffer, metadata: Readonly<Record<string, unknown>> = {}): DeliveryArtifactRecord {
    const artifact: DeliveryArtifactRecord = Object.freeze({
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

  storePackage(packageModel: DeliveryPackageModel): void {
    this.packages.set(packageModel.packageId, packageModel);
  }

  loadPackage(packageId: string): DeliveryPackageModel | null {
    return this.packages.get(packageId) ?? null;
  }

  storeArchive(packageId: string, archive: Buffer): void {
    this.archives.set(packageId, archive);
  }

  loadArchive(packageId: string): Buffer | null {
    return this.archives.get(packageId) ?? null;
  }

  listArtifacts(): readonly DeliveryArtifactRecord[] {
    return Object.freeze([...this.artifacts.values()]);
  }
}

export class DeliverySigningService {
  constructor(private readonly secret: string | Buffer | null = null) {}

  sign(packageModel: DeliveryPackageModel): string {
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

  verify(packageModel: DeliveryPackageModel, signature: string | null): boolean {
    if (!signature) return false;
    return this.sign(packageModel) === signature;
  }

  private resolveSecret(): Buffer {
    if (!this.secret) {
      throw new Error("Delivery signing secret is not configured");
    }
    return typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret;
  }
}

export class DeliveryCompressionService {
  constructor(private readonly level: number) {}

  compress(payload: Buffer | string): Buffer {
    return gzipSync(toBuffer(payload), { level: this.level });
  }

  decompress(payload: Buffer | string): Buffer {
    return gunzipSync(toBuffer(payload));
  }
}

export class DeliveryEncryptionService {
  constructor(private readonly secret: string | Buffer) {}

  encrypt(payload: Buffer | string): DeliveryEncryptedPayload {
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

  decrypt(payload: DeliveryEncryptedPayload): Buffer {
    const key = scryptSync(this.resolveSecret(), "track-syra-delivery", 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
  }

  private resolveSecret(): Buffer {
    return typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret;
  }
}

export class DeliveryManifestValidator {
  validate(packageModel: DeliveryPackageModel): Readonly<{ valid: boolean; errors: readonly DeliveryValidationIssue[] }> {
    const errors: DeliveryValidationIssue[] = [];
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
  constructor(
    private readonly engine: ReleaseDeliveryEngine,
    private readonly signing: DeliverySigningService,
    private readonly manifestValidator: DeliveryManifestValidator,
  ) {}

  async verify(packageModel: DeliveryPackageModel): Promise<DeliveryVerificationReport> {
    const packageVerification = await Promise.resolve(this.engine.verifyPackage(packageModel.packageModel));
    const manifestValidation = this.manifestValidator.validate(packageModel);
    const signatureValue = packageModel.signature && typeof packageModel.signature === "object" && "value" in packageModel.signature
      ? String((packageModel.signature as Readonly<Record<string, unknown>>).value ?? "")
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
  constructor(
    private readonly baseDelayMs = 1_000,
    private readonly multiplier = 2,
    private readonly maxDelayMs = 5 * 60_000,
    private readonly jitterRatio = 0.1,
  ) {}

  nextDelay(attempt: number): number {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * (this.multiplier ** Math.max(0, attempt)));
    const jitter = exponential * this.jitterRatio * (Math.random() - 0.5);
    return Math.max(0, Math.floor(exponential + jitter));
  }
}

export class DeliveryRetryEngine {
  constructor(private readonly backoffPolicy: DeliveryBackoffPolicy) {}

  shouldRetry(error: unknown, job: DeliveryJobRecord): boolean {
    if (job.retryCount >= job.maxRetries) return false;
    const message = error instanceof Error ? error.message : String(error);
    return /timeout|retry|temporary|unavailable|rate limit|429|503|recover/i.test(message) || message.length > 0;
  }

  nextRetryAt(job: DeliveryJobRecord): string {
    return new Date(Date.now() + this.backoffPolicy.nextDelay(job.retryCount)).toISOString();
  }
}

export class DeliveryAuditManager {
  private readonly records: DeliveryAuditRecord[] = [];

  record(releaseId: string, packageId: string, version: string, action: string, status: DeliveryAuditRecord["status"], metadata: Readonly<Record<string, unknown>> = {}): DeliveryAuditRecord {
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

  list(releaseId?: string): readonly DeliveryAuditRecord[] {
    return Object.freeze(releaseId ? this.records.filter((entry) => entry.releaseId === releaseId) : [...this.records]);
  }
}

export class DeliveryHealthChecker implements HealthChecker {
  constructor(
    private readonly runtime: DeliveryJobRuntime,
    private readonly artifactStore: DeliveryArtifactStore,
    private readonly partnerGate: PartnerActivationGate | null = null,
  ) {}

  check(componentId: string): HealthStatus {
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

type DeliveryPipelineResult = Readonly<{
  packageModel: DeliveryPackageModel;
  verification: DeliveryVerificationReport;
  checkpoint: DeliveryCheckpoint;
  archive: Buffer | null;
  signature: string | null;
}>;

export class DeliveryPipeline {
  constructor(
    private readonly engine: ReleaseDeliveryEngine,
    private readonly verifier: DeliveryPackageVerifier,
    private readonly signing: DeliverySigningService,
    private readonly compression: DeliveryCompressionService,
    private readonly artifactStore: DeliveryArtifactStore,
    private readonly auditManager: DeliveryAuditManager,
    private readonly logger: DeliveryLogger,
  ) {}

  async prepare(release: Release, job: DeliveryJobRecord, options: ReleaseDeliveryBuildOptions = {}): Promise<DeliveryPipelineResult> {
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

  async recover(releaseId: string, reason?: string | null): Promise<ReleaseDeliveryRecovery> {
    return await Promise.resolve(this.engine.recover(releaseId, reason ?? "Recovery requested"));
  }

  private async buildPackage(release: Release, job: DeliveryJobRecord, options: ReleaseDeliveryBuildOptions): Promise<DeliveryPackageModel> {
    const buildOptions: ReleaseDeliveryBuildOptions = {
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
  constructor(
    private readonly connectorFactory: ConnectorFactory,
    private readonly partnerGate: PartnerActivationGate,
    private readonly credentialResolver: PartnerCredentialResolver | null,
    private readonly logger: DeliveryLogger,
    private readonly metrics: DeliveryMetrics,
  ) {}

  async dispatch(packageModel: DeliveryPackageModel, job: DeliveryJobRecord): Promise<readonly DeliveryTargetResult[]> {
    const results: DeliveryTargetResult[] = [];
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
      const connector = this.connectorFactory.create(context) as DSPConnector;
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
      const result: DeliveryTargetResult = Object.freeze({
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

  private failureResult(target: DeliveryJobTarget, connectorStatus: string, reason: string): DeliveryTargetResult {
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
  constructor(private readonly scheduler: DeliveryScheduler) {}

  order(jobs: readonly DeliveryJobRecord[]): readonly DeliveryJobRecord[] {
    return this.scheduler.order(jobs);
  }
}

export class DeliveryScheduler {
  order(jobs: readonly DeliveryJobRecord[]): readonly DeliveryJobRecord[] {
    const graph = new Map<string, DeliveryJobRecord>();
    for (const job of jobs) {
      graph.set(job.jobId, job);
    }
    const result: DeliveryJobRecord[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (job: DeliveryJobRecord): void => {
      if (visited.has(job.jobId)) return;
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
        if (leftSchedule !== rightSchedule) return leftSchedule - rightSchedule;
        return scoreJob(right) - scoreJob(left);
      })
      .forEach((job) => visit(job));

    return Object.freeze(result);
  }

  isDue(job: DeliveryJobRecord): boolean {
    return !job.scheduledFor || Date.parse(job.scheduledFor) <= Date.now();
  }
}

export class DeliveryBatchProcessor {
  constructor(
    private readonly coordinator: DeliveryCoordinator,
    private readonly executor: DeliveryExecutor,
    private readonly concurrency = 2,
  ) {}

  async process(jobs: readonly DeliveryJobRecord[]): Promise<readonly DeliveryJobResult[]> {
    const ordered = this.coordinator.order(jobs);
    const results: DeliveryJobResult[] = [];
    const queue = [...ordered];
    const active = new Set<Promise<void>>();
    const runNext = async (): Promise<void> => {
      const job = queue.shift();
      if (!job) return;
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
  constructor(private readonly checkpoints: DeliveryCheckpointManager, private readonly pipeline: DeliveryPipeline) {}

  async resume(job: DeliveryJobRecord, checkpointId: string | null, release: Release): Promise<DeliveryExecutionPlan | null> {
    if (!checkpointId) return null;
    const checkpoint = this.checkpoints.restore(checkpointId);
    if (!checkpoint) return null;
    const recovery = await this.pipeline.recover(job.releaseId, "Resume requested");
    if (!recovery.package) return null;
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
  constructor(private readonly pipeline: DeliveryPipeline, private readonly checkpoints: DeliveryCheckpointManager, private readonly logger: DeliveryLogger) {}

  async recover(job: DeliveryJobRecord, release: Release, reason: string): Promise<DeliveryExecutionPlan | null> {
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
  constructor(
    private readonly runtime: DeliveryJobRuntime,
    private readonly pipeline: DeliveryPipeline,
    private readonly dispatcher: DeliveryDispatcher,
    private readonly checkpoints: DeliveryCheckpointManager,
    private readonly progress: DeliveryProgressTracker,
    private readonly retries: DeliveryRetryEngine,
    private readonly auditManager: DeliveryAuditManager,
    private readonly logger: DeliveryLogger,
    private readonly metrics: DeliveryMetrics,
  ) {}

  async execute(job: DeliveryJobRecord): Promise<DeliveryJobResult> {
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
    const completedState: DeliveryJobState = success ? "completed" : "failed";
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

  private async dispatchTakedown(job: DeliveryJobRecord, packageModel: DeliveryPackageModel): Promise<readonly DeliveryTargetResult[]> {
    const results: DeliveryTargetResult[] = [];
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
      const connector = this.runtime.connectorFactory.create(context) as DSPConnector;
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

  private result(job: DeliveryJobRecord, packageModel: DeliveryPackageModel | null, startedAt: string, targetResults: readonly DeliveryTargetResult[], errors: readonly string[], warnings: readonly string[], checkpointId: string | null = null, signature: string | null = null): DeliveryJobResult {
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

export class DeliveryWorkerBridge implements WorkerRuntime {
  constructor(private readonly runtime: DeliveryJobRuntime, private readonly executor: DeliveryExecutor) {}

  execute(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult {
    return this.handle(request);
  }

  private async handle(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> {
    const body = request.queueEnvelope?.body as Readonly<Record<string, unknown>> | null;
    const jobId = typeof body?.jobId === "string" ? body.jobId : request.executionContext.jobId;
    const releaseId = typeof body?.releaseId === "string" ? body.releaseId : request.executionContext.releaseId;
    const targets = Array.isArray(body?.targets) ? body.targets as readonly DeliveryJobTarget[] : [];
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
    } catch (error) {
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

export class DeliveryQueueBridge implements QueueDispatcher {
  constructor(private readonly workerRuntime: WorkerRuntime, private readonly logger: DeliveryLogger) {}

  dispatch(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> | QueueExecutionResult {
    return this.handle(envelope, context);
  }

  private async handle(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> {
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
  constructor(
    private readonly dependencies: DeliveryRuntimeDependencies,
    private readonly logger: DeliveryLogger,
    private readonly metrics: DeliveryMetrics,
    private readonly auditManager: DeliveryAuditManager,
    private readonly progressTracker: DeliveryProgressTracker,
    private readonly checkpoints: DeliveryCheckpointManager,
    private readonly retryEngine: DeliveryRetryEngine,
    private readonly pipeline: DeliveryPipeline,
    private readonly dispatcher: DeliveryDispatcher,
    private readonly jobs: RuntimeRepository<string, DeliveryJobRecord>,
    private readonly batchProcessor: DeliveryBatchProcessor | null = null,
  ) {}

  get connectorFactory(): ConnectorFactory {
    return this.dependencies.connectorFactory;
  }

  get partnerGate(): PartnerActivationGate {
    if (!this.dependencies.partnerActivationGate) {
      throw new Error("Delivery partner activation gate is not configured");
    }
    return this.dependencies.partnerActivationGate;
  }

  resolveCredential(partnerName: string): ReturnType<PartnerCredentialResolver["resolve"]> {
    return this.dependencies.credentialResolver?.resolve(partnerName as never) ?? null;
  }

  createJob(input: DeliveryJobInput): DeliveryJobRecord {
    const job: DeliveryJobRecord = Object.freeze({
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

  submit(input: DeliveryJobInput): DeliveryJobRecord {
    return this.createJob(input);
  }

  async run(jobId: string): Promise<DeliveryJobResult> {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = this.retryEngine.shouldRetry(error, updated);
      const nextState: DeliveryJobState = shouldRetry ? "queued" : "failed";
      this.updateJob(job.jobId, {
        state: nextState,
        retryCount: updated.retryCount + 1,
        lastError: message,
      });
      if (shouldRetry) {
        this.metrics.increment("delivery.jobs.retry", 1, { jobId });
      } else {
        this.metrics.increment("delivery.jobs.failed", 1, { jobId });
      }
      throw error;
    }
  }

  async runDueJobs(): Promise<readonly DeliveryJobResult[]> {
    const due = [...this.jobs.values()].filter((job) => (job.state === "queued" || job.state === "scheduled") && (!job.scheduledFor || Date.parse(job.scheduledFor) <= Date.now()));
    if (due.length === 0) {
      return Object.freeze([] as DeliveryJobResult[]);
    }
    const results: DeliveryJobResult[] = [];
    for (const job of due) {
      results.push(await this.run(job.jobId));
    }
    return Object.freeze(results);
  }

  pause(jobId: string, reason: string | null = null): DeliveryJobRecord {
    const job = this.requireJob(jobId);
    const updated = cloneJob(job, { state: "paused", pausedAt: nowIso(), lastError: reason });
    this.jobs.set(jobId, updated);
    this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_PAUSED", "UPDATED", { reason });
    return updated;
  }

  resume(jobId: string): DeliveryJobRecord {
    const job = this.requireJob(jobId);
    const updated = cloneJob(job, { state: job.scheduledFor ? "scheduled" : "queued", pausedAt: null, lastError: null });
    this.jobs.set(jobId, updated);
    this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_RESUMED", "UPDATED", {});
    return updated;
  }

  cancel(jobId: string, reason: string | null = null): DeliveryJobRecord {
    const job = this.requireJob(jobId);
    const updated = cloneJob(job, { state: "cancelled", cancelledAt: nowIso(), lastError: reason });
    this.jobs.set(jobId, updated);
    this.auditManager.record(job.releaseId, job.jobId, "v0", "JOB_CANCELLED", "UPDATED", { reason });
    return updated;
  }

  updateJob(jobId: string, patch: Partial<DeliveryJobRecord>): DeliveryJobRecord {
    const job = this.requireJob(jobId);
    const updated = cloneJob(job, patch);
    this.jobs.set(jobId, updated);
    return updated;
  }

  getJob(jobId: string): DeliveryJobRecord | null {
    return this.jobs.get(jobId) ?? null;
  }

  listJobs(): readonly DeliveryJobRecord[] {
    return Object.freeze([...this.jobs.values()]);
  }

  statistics(): Readonly<{ jobs: readonly DeliveryJobRecord[]; metrics: Readonly<Record<string, unknown>> }> {
    return freeze({
      jobs: this.listJobs(),
      metrics: this.metrics.snapshot(),
    });
  }

  async resolveRelease(releaseId: string): Promise<Release | null> {
    return await Promise.resolve(this.dependencies.releaseResolver(releaseId));
  }

  async recover(jobId: string, reason = "Recovery requested"): Promise<ReleaseDeliveryRecovery | null> {
    const job = this.requireJob(jobId);
    const release = await this.resolveRelease(job.releaseId);
    if (!release) return null;
    const recovery = await this.pipeline.recover(job.releaseId, reason);
    if (!recovery.package) return null;
    this.auditManager.record(job.releaseId, recovery.package.packageId, recovery.package.version, "RECOVERY_COMPLETED", "RECOVERED", { reason });
    return recovery;
  }

  private async pipelineAndDispatch(job: DeliveryJobRecord, release: Release): Promise<DeliveryJobResult> {
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
    const nextState: DeliveryJobState = errors.length ? "failed" : "completed";
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

  private async dispatchTakedown(job: DeliveryJobRecord, packageModel: DeliveryPackageModel): Promise<readonly DeliveryTargetResult[]> {
    const results: DeliveryTargetResult[] = [];
    for (const target of job.targets) {
      if (!this.partnerGate.isPartnerActive(target.partnerName)) {
        throw new Error(`Partner is not approved or active: ${target.partnerName}`);
      }
      const context = buildConnectorContext(target, packageModel.releaseId, `${job.jobId}:takedown:${target.partnerName}`, packageModel.packageId, { jobId: job.jobId });
      const connector = this.connectorFactory.create(context) as DSPConnector;
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

  private requireJob(jobId: string): DeliveryJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Delivery job not found: ${jobId}`);
    }
    return job;
  }
}

export type DeliveryRuntimeBundle = Readonly<{
  runtime: DeliveryJobRuntime;
  pipeline: DeliveryPipeline;
  executor: DeliveryExecutor;
  dispatcher: DeliveryDispatcher;
  workerBridge: DeliveryWorkerBridge;
  queueBridge: DeliveryQueueBridge;
  scheduler: DeliveryScheduler;
  coordinator: DeliveryCoordinator;
  batchProcessor: DeliveryBatchProcessor;
  retryEngine: DeliveryRetryEngine;
  checkpointManager: DeliveryCheckpointManager;
  resumeManager: DeliveryResumeManager;
  failureRecovery: DeliveryFailureRecovery;
  auditManager: DeliveryAuditManager;
  progressTracker: DeliveryProgressTracker;
  artifactStore: DeliveryArtifactStore;
  packageVerifier: DeliveryPackageVerifier;
  manifestValidator: DeliveryManifestValidator;
  signingService: DeliverySigningService;
  encryptionService: DeliveryEncryptionService | null;
  compressionService: DeliveryCompressionService;
  metrics: DeliveryMetrics;
  logger: DeliveryLogger;
  healthChecker: DeliveryHealthChecker;
}>;

export function createTrackSyraDeliveryRuntime(dependencies: DeliveryRuntimeDependencies): DeliveryRuntimeBundle {
  return dependencies;
}
