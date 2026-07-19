import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { serializeCanonicalJSON } from "../core/canonicalSerializer";
import type { CompositionConfiguration } from "../composition/types/compositionTypes";
import type { HealthChecker, Logger, MetricsCollector } from "../observability/contracts/observabilityContracts";
import { HealthStatus } from "../observability/health/healthStatus";
import { LogEntry } from "../observability/logging/logEntry";
import { Metric } from "../observability/metrics/metric";
import type { ObservabilityEventPublisher } from "../observability/events/observabilityEvent";
import type { PartnerActivationGate, PartnerRegistry } from "../partner-onboarding/contracts/partnerOnboardingContracts";
import type { OfficialDspPartnerName } from "../partner-onboarding/types/partnerOnboardingTypes";
import type { PartnerCredentialResolver } from "../partner-credentials";
import type { CapabilityResolver, ConfigurationProvider as PartnerConfigurationProvider } from "../provider-integration/contracts/providerIntegrationContracts";
import type { ProviderIntegrationConfigurationProvider } from "../provider-integration/configuration/providerConfiguration";
import { ObservabilityEvent } from "../observability/events/observabilityEvent";
import type { SpecificationRegistry } from "../dsp-specification";

export type DspProtocolCapability =
  | "manifest"
  | "checksum"
  | "signature"
  | "compression"
  | "encryption"
  | "upload"
  | "metadata"
  | "release-submission"
  | "release-update"
  | "release-takedown"
  | "release-restore"
  | "catalog-sync"
  | "health"
  | "status"
  | "version-negotiation";

export type DspProtocolState =
  | "created"
  | "registered"
  | "resolved"
  | "configured"
  | "authenticated"
  | "active"
  | "blocked"
  | "failed"
  | "disabled";

export type DspProtocolAction =
  | "authenticate"
  | "upload-asset"
  | "upload-chunk"
  | "upload-metadata"
  | "submit-release"
  | "update-release"
  | "takedown-release"
  | "restore-release"
  | "sync-catalog"
  | "health-check"
  | "resolve-status"
  | "release-takedown"
  | "release-restore"
  | "catalog-sync";

export type DspProtocolErrorCode =
  | "OFFICIAL_SPEC_REQUIRED"
  | "SPECIFICATION_NOT_AVAILABLE"
  | "PARTNER_NOT_ACTIVE"
  | "PARTNER_NOT_APPROVED"
  | "NOT_APPROVED"
  | "CREDENTIALS_REQUIRED"
  | "CERTIFICATION_REQUIRED"
  | "PARTNER_DISABLED"
  | "CAPABILITY_UNSUPPORTED"
  | "VERSION_UNSUPPORTED"
  | "SIGNATURE_INVALID"
  | "CHECKSUM_INVALID"
  | "MANIFEST_INVALID"
  | "RATE_LIMITED"
  | "RETRY_EXHAUSTED"
  | "NOT_FOUND"
  | "INVALID_STATE";

export type DspProtocolMetadata = Readonly<Record<string, unknown>>;

export type DspProtocolErrorSeverity = "info" | "warning" | "error" | "critical";

export type DspProtocolRuntimeError = Readonly<{
  code: DspProtocolErrorCode | "VALIDATION_FAILED" | "SPECIFICATION_UNAVAILABLE" | "CONFIGURATION_ERROR";
  message: string;
  category: "Activation" | "Validation" | "Checksum" | "Manifest" | "Runtime" | "Configuration";
  severity: DspProtocolErrorSeverity;
  recoverable: boolean;
  timestamp: string;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolErrorRecord = DspProtocolRuntimeError;

export type DspProtocolSpecification = Readonly<{
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  officialSpecificationAvailable: boolean;
  supportedCapabilities: readonly DspProtocolCapability[];
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolSession = Readonly<{
  sessionId: string;
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  state: DspProtocolState;
  authenticated: boolean;
  createdAt: string;
  expiresAt: string | null;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolUploadSession = Readonly<{
  uploadSessionId: string;
  sessionId: string;
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  state: DspProtocolState;
  createdAt: string;
  completedAt: string | null;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolManifest = Readonly<{
  manifestId: string;
  releaseId: string;
  protocolName: string;
  version: string;
  createdAt: string;
  checksum: string;
  signature: string | null;
  payload: DspProtocolMetadata;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolRequest = Readonly<{
  requestId: string;
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  action: DspProtocolAction;
  sessionId: string | null;
  manifestId: string | null;
  createdAt: string;
  payload: DspProtocolMetadata;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolResponse = Readonly<{
  responseId: string;
  requestId: string;
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  action: DspProtocolAction;
  receivedAt: string;
  ok: boolean;
  statusCode: number | null;
  payload: DspProtocolMetadata;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolStatus = Readonly<{
  statusId: string;
  partnerName: OfficialDspPartnerName;
  protocolName: string;
  version: string;
  state: string;
  healthy: boolean;
  observedAt: string;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolHealth = Readonly<{
  componentId: string;
  partnerName: OfficialDspPartnerName | null;
  healthy: boolean;
  message: string | null;
  checkedAt: string;
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolResult<T> = Readonly<{
  allowed: boolean;
  executed: boolean;
  valid: boolean;
  value: T | null;
  error: DspProtocolErrorRecord | null;
  reason: string | null;
  errors: readonly DspProtocolErrorRecord[];
  warnings: readonly DspProtocolErrorRecord[];
  metadata: DspProtocolMetadata;
}>;

export type DspProtocolActivationResult = DspProtocolResult<Readonly<{
  partnerName: OfficialDspPartnerName;
  approved: boolean;
  credentialsInstalled: boolean;
  certificationPassed: boolean;
  active: boolean;
}>>;

export type DspProtocolRuntimeDependencies = Readonly<{
  registry: DspProtocolRegistry;
  resolver: DspProtocolResolver;
  specificationRegistry: SpecificationRegistry;
  activationGate: PartnerActivationGate;
  activationGuard: DspProtocolActivationGuard;
  partnerRegistry: PartnerRegistry;
  credentialResolver: PartnerCredentialResolver;
  partnerConfigurationProvider: PartnerConfigurationProvider & ProviderIntegrationConfigurationProvider;
  logger: Logger;
  metrics: MetricsCollector;
  eventPublisher: ObservabilityEventPublisher;
  healthChecker: HealthChecker;
  capabilityResolver: CapabilityResolver;
  configuration: CompositionConfiguration;
  runtimeRegistry: DspProtocolRegistry;
  sessions: DspProtocolSessionManager;
  manifestBuilder: DspProtocolManifestBuilder;
  requestBuilder: DspProtocolRequestBuilder;
  responseParser: DspProtocolResponseParser;
  statusParser: DspProtocolStatusParser;
  errorParser: DspProtocolErrorParser;
  rateLimiter: DspProtocolRateLimiter;
  compression: DspProtocolCompressionService;
  encryption: DspProtocolEncryptionService | null;
  retryEngine: DspProtocolRetryEngine;
  signatureValidator: DspProtocolSignatureValidator;
  loggerAdapter: DspProtocolRuntimeLogger;
  metricsAdapter: DspProtocolRuntimeMetrics;
  protocolHealthChecker: DspProtocolProtocolHealthChecker;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function makeId(prefix: string, suffix: string): string {
  return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomBytes(4).toString("hex")}`;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toBuffer(payload: string | Buffer): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}

function capabilitySet(capabilities: readonly DspProtocolCapability[]): ReadonlySet<DspProtocolCapability> {
  return new Set(capabilities);
}

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function createRuntimeError(
  code: DspProtocolRuntimeError["code"],
  message: string,
  category: DspProtocolRuntimeError["category"],
  recoverable: boolean,
  metadata: DspProtocolMetadata = {},
  severity: DspProtocolErrorSeverity = "error",
): DspProtocolRuntimeError {
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

function isFailure<T>(result: DspProtocolResult<T>): boolean {
  return !result.allowed || !result.valid;
}

function createResult<T>(input: Readonly<{
  allowed: boolean;
  executed: boolean;
  valid: boolean;
  value: T | null;
  reason?: string | null;
  error?: DspProtocolErrorRecord | null;
  errors?: readonly DspProtocolErrorRecord[];
  warnings?: readonly DspProtocolErrorRecord[];
  metadata?: DspProtocolMetadata;
}>): DspProtocolResult<T> {
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

function createBlockedResult<T>(
  code: DspProtocolRuntimeError["code"],
  message: string,
  category: DspProtocolRuntimeError["category"],
  metadata: DspProtocolMetadata = {},
  recoverable = false,
  severity: DspProtocolErrorSeverity = "error",
): DspProtocolResult<T> {
  const error = createRuntimeError(code, message, category, recoverable, metadata, severity);
  return createResult<T>({
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

function createAllowedResult<T>(
  value: T,
  metadata: DspProtocolMetadata = {},
  warnings: readonly DspProtocolErrorRecord[] = [],
  reason: string | null = null,
): DspProtocolResult<T> {
  return createResult<T>({
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

export interface DspProtocolEvents {
  publish(event: Readonly<{
    eventId: string;
    partnerName: OfficialDspPartnerName;
    eventType: string;
    occurredAt: string;
    metadata: DspProtocolMetadata;
  }>): void;
}

export interface DspProtocolRegistry {
  register(specification: DspProtocolSpecification): void;
  resolve(partnerName: OfficialDspPartnerName): DspProtocolSpecification | null;
  list(): readonly DspProtocolSpecification[];
}

export interface DspProtocolResolver {
  resolve(partnerName: OfficialDspPartnerName): DspProtocolSpecification | null;
  resolveVersion(partnerName: OfficialDspPartnerName, version: string): DspProtocolSpecification | null;
}

export interface DspProtocolFactory {
  create(partnerName: OfficialDspPartnerName, specification?: DspProtocolSpecification | null): DspProtocolRuntime;
}

export interface DspProtocolRuntime {
  readonly protocolName: string;
  readonly version: string;
  readonly registry: DspProtocolRegistry;
  readonly resolver: DspProtocolResolver;
  evaluateActivation(partnerName: OfficialDspPartnerName): DspProtocolActivationResult;
  authenticate(partnerName: OfficialDspPartnerName, metadata?: DspProtocolMetadata): DspProtocolResult<DspProtocolSession>;
  openUploadSession(session: DspProtocolSession, metadata?: DspProtocolMetadata): DspProtocolResult<DspProtocolUploadSession>;
  buildManifest(releaseId: string, payload: DspProtocolMetadata, metadata?: DspProtocolMetadata): DspProtocolManifest;
  buildDeliveryRequest(action: DspProtocolAction, partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata, session?: DspProtocolSession | null, manifest?: DspProtocolManifest | null): DspProtocolResult<DspProtocolRequest>;
  parseDeliveryResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolResponse;
  parseStatusResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolStatus;
  parseError(error: unknown, metadata?: DspProtocolMetadata): DspProtocolErrorRecord;
  sign(payload: DspProtocolMetadata): string;
  verifySignature(payload: DspProtocolMetadata, signature: string | null): boolean;
  encrypt(payload: string | Buffer): Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }>;
  decrypt(payload: Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }>): Buffer;
  compress(payload: string | Buffer): Buffer;
  decompress(payload: string | Buffer): Buffer;
  validateManifest(manifest: DspProtocolManifest): DspProtocolResult<DspProtocolManifest>;
  validateChecksum(payload: string | Buffer, checksum: string): DspProtocolResult<string>;
  verifyPackage(manifest: DspProtocolManifest, payload: DspProtocolMetadata, signature: string | null): DspProtocolResult<DspProtocolManifest>;
  negotiateVersion(partnerName: OfficialDspPartnerName, preferredVersions: readonly string[]): DspProtocolResult<string>;
  shouldRetry(error: unknown, attempt: number): boolean;
  nextRetryAt(attempt: number): string;
  rateLimit(partnerName: OfficialDspPartnerName, operation: DspProtocolAction): DspProtocolResult<Readonly<{ remaining: number; resetAt: string | null }>>;
  submitRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest>;
  updateRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest>;
  takedownRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest>;
  restoreRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest>;
  syncCatalog(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest>;
  healthCheck(partnerName: OfficialDspPartnerName): DspProtocolHealth;
  capabilityDetection(partnerName: OfficialDspPartnerName): DspProtocolResult<readonly DspProtocolCapability[]>;
  protocolStatus(partnerName: OfficialDspPartnerName): DspProtocolStatus;
}

export class DspProtocolRegistryImpl implements DspProtocolRegistry {
  private readonly entries = new Map<OfficialDspPartnerName, DspProtocolSpecification>();

  register(specification: DspProtocolSpecification): void {
    this.entries.set(specification.partnerName, specification);
  }

  resolve(partnerName: OfficialDspPartnerName): DspProtocolSpecification | null {
    return this.entries.get(partnerName) ?? null;
  }

  list(): readonly DspProtocolSpecification[] {
    return Object.freeze([...this.entries.values()]);
  }
}

export class DspProtocolResolverImpl implements DspProtocolResolver {
  constructor(private readonly registry: DspProtocolRegistry) {}

  resolve(partnerName: OfficialDspPartnerName): DspProtocolSpecification | null {
    return this.registry.resolve(partnerName);
  }

  resolveVersion(partnerName: OfficialDspPartnerName, version: string): DspProtocolSpecification | null {
    const resolved = this.registry.resolve(partnerName);
    return resolved && resolved.version === version ? resolved : null;
  }
}

export class DspProtocolRetryEngine {
  constructor(
    private readonly baseDelayMs: number,
    private readonly multiplier: number,
    private readonly maxDelayMs: number,
    private readonly jitterRatio: number,
  ) {}

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt < 0) return false;
    const message = error instanceof Error ? error.message : String(error);
    if (/non.?retry|permanent|invalid|unsupported/i.test(message)) {
      return false;
    }
    return attempt < 5;
  }

  nextRetryAt(attempt: number): string {
    const delay = Math.min(this.maxDelayMs, this.baseDelayMs * (this.multiplier ** Math.max(0, attempt)));
    const jitter = delay * this.jitterRatio * (Math.random() - 0.5);
    return new Date(Date.now() + Math.max(0, Math.floor(delay + jitter))).toISOString();
  }
}

export class DspProtocolRateLimiter {
  private readonly windows = new Map<string, { remaining: number; resetAt: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  evaluate(partnerName: OfficialDspPartnerName, operation: DspProtocolAction): Readonly<{ allowed: boolean; remaining: number; resetAt: string | null }> {
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
  sign(payload: DspProtocolMetadata): string {
    return createHash("sha256").update(serializeCanonicalJSON(payload)).digest("hex");
  }

  verify(payload: DspProtocolMetadata, signature: string | null): boolean {
    return Boolean(signature) && this.sign(payload) === signature;
  }
}

export class DspProtocolCompressionService {
  compress(payload: string | Buffer): Buffer {
    return gzipSync(toBuffer(payload));
  }

  decompress(payload: string | Buffer): Buffer {
    return gunzipSync(toBuffer(payload));
  }
}

export class DspProtocolEncryptionService {
  constructor(private readonly secret: string | Buffer) {}

  encrypt(payload: string | Buffer): Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }> {
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

  decrypt(payload: Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }>): Buffer {
    const key = scryptSync(typeof this.secret === "string" ? Buffer.from(this.secret, "utf8") : this.secret, "track-syra-dsp", 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
  }
}

export class DspProtocolManifestBuilder {
  build(releaseId: string, payload: DspProtocolMetadata, protocolName: string, version: string, signature: string | null = null): DspProtocolManifest {
    const checksum = hashText(serializeCanonicalJSON(payload));
    return Object.freeze({
      manifestId: makeId("dsp-manifest", releaseId),
      releaseId: ensure(releaseId, "releaseId"),
      protocolName: ensure(protocolName, "protocolName"),
      version: ensure(version, "version"),
      createdAt: nowIso(),
      checksum,
      signature,
      payload: freeze(payload as Record<string, unknown>),
      metadata: freeze({ releaseId, checksum }),
    });
  }
}

export class DspProtocolRequestBuilder {
  build(
    action: DspProtocolAction,
    partnerName: OfficialDspPartnerName,
    protocolName: string,
    version: string,
    payload: DspProtocolMetadata,
    session: DspProtocolSession | null = null,
    manifest: DspProtocolManifest | null = null,
  ): DspProtocolRequest {
    return Object.freeze({
      requestId: makeId("dsp-request", action),
      partnerName,
      protocolName: ensure(protocolName, "protocolName"),
      version: ensure(version, "version"),
      action,
      sessionId: session?.sessionId ?? null,
      manifestId: manifest?.manifestId ?? null,
      createdAt: nowIso(),
      payload: freeze(payload as Record<string, unknown>),
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
  parse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolResponse {
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
      payload: freeze(response as Record<string, unknown>),
      metadata: freeze({
        requestId: request.requestId,
        partnerName: request.partnerName,
        action: request.action,
      }),
    });
  }
}

export class DspProtocolStatusParser {
  parse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolStatus {
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
  parse(error: unknown, metadata: DspProtocolMetadata = {}): DspProtocolErrorRecord {
    if (error && typeof error === "object" && "code" in error && "message" in error && "category" in error) {
      const record = error as DspProtocolRuntimeError;
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
  constructor(private readonly registry: DspProtocolRegistry, private readonly activationGate: PartnerActivationGate) {}

  check(componentId: string): HealthStatus {
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
  constructor(private readonly sink: Logger) {}

  log(level: "debug" | "info" | "warn" | "error", message: string, context: DspProtocolMetadata = {}): void {
    if (!this.sink) return;
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
  constructor(private readonly sink: MetricsCollector) {}

  increment(metric: string, value = 1, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
    if (!this.sink) return;
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
  private readonly sessions = new Map<string, DspProtocolSession>();
  private readonly uploadSessions = new Map<string, DspProtocolUploadSession>();

  createSession(partnerName: OfficialDspPartnerName, protocolName: string, version: string, metadata: DspProtocolMetadata = {}): DspProtocolSession {
    const session: DspProtocolSession = Object.freeze({
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

  saveSession(session: DspProtocolSession): void {
    this.sessions.set(session.sessionId, session);
  }

  getSession(sessionId: string): DspProtocolSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  openUploadSession(session: DspProtocolSession, metadata: DspProtocolMetadata = {}): DspProtocolUploadSession {
    const uploadSession: DspProtocolUploadSession = Object.freeze({
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
  constructor(
    private readonly activationGate: PartnerActivationGate,
    private readonly partnerRegistry: PartnerRegistry,
    private readonly credentialResolver: PartnerCredentialResolver,
  ) {}

  evaluate(partnerName: OfficialDspPartnerName): DspProtocolActivationResult {
    const profile = this.partnerRegistry.resolve(partnerName);
    if (!profile) {
      return createBlockedResult<Readonly<{
        partnerName: OfficialDspPartnerName;
        approved: boolean;
        credentialsInstalled: boolean;
        certificationPassed: boolean;
        active: boolean;
      }>>("OFFICIAL_SPEC_REQUIRED", `Specification unavailable for ${partnerName}`, "Activation", { partnerName });
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

class DspProtocolFactoryImpl implements DspProtocolFactory {
  constructor(private readonly runtime: DspProtocolRuntimeImpl) {}

  create(partnerName: OfficialDspPartnerName, specification?: DspProtocolSpecification | null): DspProtocolRuntime {
    if (specification) {
      this.runtime.registry.register(specification);
    }
    return this.runtime;
  }
}

export class DspProtocolRuntimeImpl implements DspProtocolRuntime {
  readonly registry: DspProtocolRegistry;
  readonly resolver: DspProtocolResolver;
  readonly configuration: CompositionConfiguration;

  private readonly sessions: DspProtocolSessionManager;
  private readonly manifestBuilder: DspProtocolManifestBuilder;
  private readonly requestBuilder: DspProtocolRequestBuilder;
  private readonly responseParser: DspProtocolResponseParser;
  private readonly statusParser: DspProtocolStatusParser;
  private readonly errorParser: DspProtocolErrorParser;
  private readonly rateLimiter: DspProtocolRateLimiter;
  private readonly compression: DspProtocolCompressionService;
  private readonly encryption: DspProtocolEncryptionService | null;
  private readonly partnerRegistry: PartnerRegistry;
  private readonly credentialResolver: PartnerCredentialResolver;
  private readonly partnerConfigurationProvider: PartnerConfigurationProvider & ProviderIntegrationConfigurationProvider;
  private readonly specificationRegistry: SpecificationRegistry;
  private readonly eventPublisher: ObservabilityEventPublisher;
  private readonly runtimeHealthChecker: HealthChecker;
  private readonly capabilityResolver: CapabilityResolver;
  private readonly retryEngine: DspProtocolRetryEngine;
  private readonly signatureValidator: DspProtocolSignatureValidator;
  readonly healthChecker: DspProtocolProtocolHealthChecker;
  private readonly activationGuard: DspProtocolActivationGuard;
  private readonly loggerAdapter: DspProtocolRuntimeLogger;
  private readonly metricsAdapter: DspProtocolRuntimeMetrics;
  private readonly supported: ReadonlyMap<OfficialDspPartnerName, ReadonlySet<DspProtocolCapability>>;

  constructor(
    readonly protocolName: string,
    readonly version: string,
    dependencies: DspProtocolRuntimeDependencies,
  ) {
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

  evaluateActivation(partnerName: OfficialDspPartnerName): DspProtocolActivationResult {
    return this.activationGuard.evaluate(partnerName);
  }

  authenticate(partnerName: OfficialDspPartnerName, metadata: DspProtocolMetadata = {}): DspProtocolResult<DspProtocolSession> {
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
      state: "authenticated" as const,
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

  openUploadSession(session: DspProtocolSession, metadata: DspProtocolMetadata = {}): DspProtocolResult<DspProtocolUploadSession> {
    const uploadSession = this.sessions.openUploadSession(session, metadata);
    return createAllowedResult(uploadSession, { sessionId: session.sessionId });
  }

  buildManifest(releaseId: string, payload: DspProtocolMetadata, metadata: DspProtocolMetadata = {}): DspProtocolManifest {
    const protocolName = this.protocolName;
    return this.manifestBuilder.build(releaseId, { ...payload, ...metadata }, protocolName, this.version);
  }

  buildDeliveryRequest(action: DspProtocolAction, partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata, session: DspProtocolSession | null = null, manifest: DspProtocolManifest | null = null): DspProtocolResult<DspProtocolRequest> {
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

  parseDeliveryResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolResponse {
    return this.responseParser.parse(request, response);
  }

  parseStatusResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolStatus {
    return this.statusParser.parse(request, response);
  }

  parseError(error: unknown, metadata: DspProtocolMetadata = {}): DspProtocolErrorRecord {
    return this.errorParser.parse(error, metadata);
  }

  sign(payload: DspProtocolMetadata): string {
    return this.signatureValidator.sign(payload);
  }

  verifySignature(payload: DspProtocolMetadata, signature: string | null): boolean {
    return this.signatureValidator.verify(payload, signature);
  }

  encrypt(payload: string | Buffer): Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }> {
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

  decrypt(payload: Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }>): Buffer {
    if (!this.encryption) {
      return Buffer.from("");
    }
    return this.encryption.decrypt(payload);
  }

  compress(payload: string | Buffer): Buffer {
    return this.compression.compress(payload);
  }

  decompress(payload: string | Buffer): Buffer {
    return this.compression.decompress(payload);
  }

  validateManifest(manifest: DspProtocolManifest): DspProtocolResult<DspProtocolManifest> {
    const errors: DspProtocolErrorRecord[] = [];
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
      return createResult<DspProtocolManifest>({
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

  validateChecksum(payload: string | Buffer, checksum: string): DspProtocolResult<string> {
    const canonical = serializeCanonicalJSON(payload);
    const computed = hashText(canonical);
    const valid = computed === checksum;
    if (!valid) {
      const error = createRuntimeError("CHECKSUM_INVALID", "Checksum validation failed", "Checksum", false, { computed, checksum }, "error");
      return createResult<string>({
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

  verifyPackage(manifest: DspProtocolManifest, payload: DspProtocolMetadata, signature: string | null): DspProtocolResult<DspProtocolManifest> {
    const canonicalPayload = serializeCanonicalJSON(payload);
    const checksumValid = manifest.checksum === hashText(canonicalPayload);
    const signatureValid = this.verifySignature(payload, signature);
    const valid = checksumValid && signatureValid;
    if (!valid) {
      const errors = [
        !checksumValid ? createRuntimeError("CHECKSUM_INVALID", "Checksum does not match payload", "Checksum", false, { manifestId: manifest.manifestId }) : null,
        !signatureValid ? createRuntimeError("SIGNATURE_INVALID", "Signature does not match payload", "Validation", false, { manifestId: manifest.manifestId }) : null,
      ].filter((value): value is DspProtocolErrorRecord => value != null);
      return createResult<DspProtocolManifest>({
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

  negotiateVersion(partnerName: OfficialDspPartnerName, preferredVersions: readonly string[]): DspProtocolResult<string> {
    const spec = this.requireSpecification(partnerName);
    if (!spec) {
      return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Runtime", { partnerName });
    }
    const selected = preferredVersions.find((version) => version === spec.version) ?? spec.version;
    return createAllowedResult(selected, { selected, partnerName });
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    return this.retryEngine.shouldRetry(error, attempt);
  }

  nextRetryAt(attempt: number): string {
    return this.retryEngine.nextRetryAt(attempt);
  }

  rateLimit(partnerName: OfficialDspPartnerName, operation: DspProtocolAction): DspProtocolResult<Readonly<{ remaining: number; resetAt: string | null }>> {
    const window = this.rateLimiter.evaluate(partnerName, operation);
    if (!window.allowed) {
      return createBlockedResult("RATE_LIMITED", `Rate limit exceeded for ${partnerName}:${operation}`, "Runtime", { partnerName, operation, remaining: window.remaining, resetAt: window.resetAt });
    }
    return createAllowedResult(Object.freeze({ remaining: window.remaining, resetAt: window.resetAt }), { partnerName, operation });
  }

  submitRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.guardAndBuild("submit-release", partnerName, payload);
  }

  updateRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.guardAndBuild("update-release", partnerName, payload);
  }

  takedownRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.guardAndBuild("release-takedown", partnerName, payload);
  }

  restoreRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.guardAndBuild("release-restore", partnerName, payload);
  }

  syncCatalog(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.guardAndBuild("catalog-sync", partnerName, payload);
  }

  healthCheck(partnerName: OfficialDspPartnerName): DspProtocolHealth {
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

  capabilityDetection(partnerName: OfficialDspPartnerName): DspProtocolResult<readonly DspProtocolCapability[]> {
    const spec = this.requireSpecification(partnerName);
    if (!spec) {
      return createBlockedResult("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Runtime", { partnerName });
    }
    return createAllowedResult(Object.freeze([...spec.supportedCapabilities]), { partnerName });
  }

  protocolStatus(partnerName: OfficialDspPartnerName): DspProtocolStatus {
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

  private guardAndBuild(action: DspProtocolAction, partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    const spec = this.requireSpecification(partnerName);
    if (!spec) {
      return createBlockedResult<DspProtocolRequest>("SPECIFICATION_NOT_AVAILABLE", `Specification is not available for ${partnerName}`, "Activation", { partnerName, action });
    }
    if (!spec.officialSpecificationAvailable) {
      return createBlockedResult<DspProtocolRequest>("OFFICIAL_SPEC_REQUIRED", `Official DSP specification required for ${partnerName}`, "Activation", { partnerName, action });
    }
    const activation = this.evaluateActivation(partnerName);
    if (isFailure(activation)) {
      return createBlockedResult<DspProtocolRequest>(activation.error?.code ?? "PARTNER_DISABLED", activation.reason ?? `Partner is not ready: ${partnerName}`, "Activation", { partnerName, action, ...activation.metadata });
    }
    const request = this.requestBuilder.build(action, partnerName, spec.protocolName, spec.version, payload, null, null);
    this.publishEvent("DeliveryRequestBuilt", partnerName, { action, requestId: request.requestId, protocolName: spec.protocolName });
    return createAllowedResult(request, { partnerName, action });
  }

  private requireSpecification(partnerName: OfficialDspPartnerName): DspProtocolSpecification | null {
    const specification = this.specificationRegistry.resolve(partnerName);
    if (!specification) {
      return null;
    }
    return {
      partnerName: specification.partnerName as OfficialDspPartnerName,
      protocolName: this.protocolName,
      version: specification.currentVersion,
      officialSpecificationAvailable: specification.active,
      supportedCapabilities: Object.freeze(specification.capabilities.filter((capability) => capability.enabled).map((capability) => capability.name as DspProtocolCapability)),
      metadata: freeze({
        specificationId: specification.specificationId,
        partnerName: specification.partnerName,
        version: specification.currentVersion,
        active: specification.active,
      }),
    };
  }

  private isActive(partnerName: OfficialDspPartnerName): boolean {
    const activation = this.evaluateActivation(partnerName);
    return activation.allowed && activation.valid;
  }

  private publishEvent(eventType: string, partnerName: OfficialDspPartnerName, metadata: DspProtocolMetadata = {}): void {
    this.eventPublisher.publish(new ObservabilityEvent({
      type: "AuditRecorded",
      source: "distribution.dsp-runtime",
      subject: `${partnerName}:${eventType}`,
      payload: freeze({ partnerName, eventType, ...metadata }),
    }));
  }

  private allowed<T>(value: T, metadata: DspProtocolMetadata = {}): DspProtocolResult<T> {
    return createAllowedResult(value, metadata);
  }

  private blocked<T>(code: DspProtocolErrorCode, message: string, metadata: DspProtocolMetadata = {}): DspProtocolResult<T> {
    return createBlockedResult<T>(code, message, "Runtime", metadata);
  }
}

function actionToCapability(action: DspProtocolAction): DspProtocolCapability {
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

export class DspProtocolRuntimeFacade implements DspProtocolRuntime, HealthChecker {
  readonly registry: DspProtocolRegistry;
  readonly resolver: DspProtocolResolver;
  readonly protocolName: string;
  readonly version: string;

  private readonly runtime: DspProtocolRuntimeImpl;

  constructor(runtime: DspProtocolRuntimeImpl) {
    this.protocolName = runtime.protocolName;
    this.version = runtime.version;
    this.registry = runtime.registry;
    this.runtime = runtime;
    this.resolver = runtime.resolver;
  }

  evaluateActivation(partnerName: OfficialDspPartnerName): DspProtocolActivationResult {
    return this.runtime.evaluateActivation(partnerName);
  }

  authenticate(partnerName: OfficialDspPartnerName, metadata?: DspProtocolMetadata): DspProtocolResult<DspProtocolSession> {
    return this.runtime.authenticate(partnerName, metadata);
  }

  openUploadSession(session: DspProtocolSession, metadata?: DspProtocolMetadata): DspProtocolResult<DspProtocolUploadSession> {
    return this.runtime.openUploadSession(session, metadata);
  }

  buildManifest(releaseId: string, payload: DspProtocolMetadata, metadata?: DspProtocolMetadata): DspProtocolManifest {
    return this.runtime.buildManifest(releaseId, payload, metadata);
  }

  buildDeliveryRequest(action: DspProtocolAction, partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata, session?: DspProtocolSession | null, manifest?: DspProtocolManifest | null): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.buildDeliveryRequest(action, partnerName, payload, session ?? null, manifest ?? null);
  }

  parseDeliveryResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolResponse {
    return this.runtime.parseDeliveryResponse(request, response);
  }

  parseStatusResponse(request: DspProtocolRequest, response: DspProtocolMetadata): DspProtocolStatus {
    return this.runtime.parseStatusResponse(request, response);
  }

  parseError(error: unknown, metadata?: DspProtocolMetadata): DspProtocolErrorRecord {
    return this.runtime.parseError(error, metadata);
  }

  sign(payload: DspProtocolMetadata): string {
    return this.runtime.sign(payload);
  }

  verifySignature(payload: DspProtocolMetadata, signature: string | null): boolean {
    return this.runtime.verifySignature(payload, signature);
  }

  encrypt(payload: string | Buffer): Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }> {
    return this.runtime.encrypt(payload);
  }

  decrypt(payload: Readonly<{ algorithm: "aes-256-gcm"; iv: string; authTag: string; data: string }>): Buffer {
    return this.runtime.decrypt(payload);
  }

  compress(payload: string | Buffer): Buffer {
    return this.runtime.compress(payload);
  }

  decompress(payload: string | Buffer): Buffer {
    return this.runtime.decompress(payload);
  }

  validateManifest(manifest: DspProtocolManifest): DspProtocolResult<DspProtocolManifest> {
    return this.runtime.validateManifest(manifest);
  }

  validateChecksum(payload: string | Buffer, checksum: string): DspProtocolResult<string> {
    return this.runtime.validateChecksum(payload, checksum);
  }

  verifyPackage(manifest: DspProtocolManifest, payload: DspProtocolMetadata, signature: string | null): DspProtocolResult<DspProtocolManifest> {
    return this.runtime.verifyPackage(manifest, payload, signature);
  }

  negotiateVersion(partnerName: OfficialDspPartnerName, preferredVersions: readonly string[]): DspProtocolResult<string> {
    return this.runtime.negotiateVersion(partnerName, preferredVersions);
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    return this.runtime.shouldRetry(error, attempt);
  }

  nextRetryAt(attempt: number): string {
    return this.runtime.nextRetryAt(attempt);
  }

  rateLimit(partnerName: OfficialDspPartnerName, operation: DspProtocolAction): DspProtocolResult<Readonly<{ remaining: number; resetAt: string | null }>> {
    return this.runtime.rateLimit(partnerName, operation);
  }

  submitRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.submitRelease(partnerName, payload);
  }

  updateRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.updateRelease(partnerName, payload);
  }

  takedownRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.takedownRelease(partnerName, payload);
  }

  restoreRelease(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.restoreRelease(partnerName, payload);
  }

  syncCatalog(partnerName: OfficialDspPartnerName, payload: DspProtocolMetadata): DspProtocolResult<DspProtocolRequest> {
    return this.runtime.syncCatalog(partnerName, payload);
  }

  healthCheck(partnerName: OfficialDspPartnerName): DspProtocolHealth {
    return this.runtime.healthCheck(partnerName);
  }

  capabilityDetection(partnerName: OfficialDspPartnerName): DspProtocolResult<readonly DspProtocolCapability[]> {
    return this.runtime.capabilityDetection(partnerName);
  }

  protocolStatus(partnerName: OfficialDspPartnerName): DspProtocolStatus {
    return this.runtime.protocolStatus(partnerName);
  }

  check(componentId: string): HealthStatus {
    return this.runtime.healthChecker.check(componentId);
  }
}

export function createTrackSyraDspProtocolRuntime(options: Readonly<{
  protocolName: string;
  version: string;
  registry: DspProtocolRegistry;
  resolver: DspProtocolResolver;
  specificationRegistry: SpecificationRegistry;
  activationGate: PartnerActivationGate;
  activationGuard: DspProtocolActivationGuard;
  partnerRegistry: PartnerRegistry;
  credentialResolver: PartnerCredentialResolver;
  partnerConfigurationProvider: PartnerConfigurationProvider & ProviderIntegrationConfigurationProvider;
  logger: Logger;
  metrics: MetricsCollector;
  eventPublisher: ObservabilityEventPublisher;
  healthChecker: HealthChecker;
  capabilityResolver: CapabilityResolver;
  configuration: CompositionConfiguration;
  runtimeRegistry: DspProtocolRegistry;
  sessions: DspProtocolSessionManager;
  manifestBuilder: DspProtocolManifestBuilder;
  requestBuilder: DspProtocolRequestBuilder;
  responseParser: DspProtocolResponseParser;
  statusParser: DspProtocolStatusParser;
  errorParser: DspProtocolErrorParser;
  rateLimiter: DspProtocolRateLimiter;
  compression: DspProtocolCompressionService;
  encryption: DspProtocolEncryptionService | null;
  retryEngine: DspProtocolRetryEngine;
  signatureValidator: DspProtocolSignatureValidator;
  loggerAdapter: DspProtocolRuntimeLogger;
  metricsAdapter: DspProtocolRuntimeMetrics;
  protocolHealthChecker: DspProtocolProtocolHealthChecker;
  runtimeFactory: (protocolName: string, version: string, dependencies: DspProtocolRuntimeDependencies) => DspProtocolRuntimeFacade;
}>): DspProtocolRuntimeFacade {
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
