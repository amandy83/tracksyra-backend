import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import { serializeCanonicalJSON } from "../core/canonicalSerializer";
import { HealthStatus } from "../observability/health/healthStatus";
import { LogEntry } from "../observability/logging/logEntry";
import { Metric } from "../observability/metrics/metric";
import type { HealthChecker, Logger, MetricsCollector } from "../observability/contracts/observabilityContracts";
import type { OfficialDspPartnerName, PartnerCredentials, PartnerActivationGate, PartnerRegistry } from "../partner-onboarding";
import type { PartnerCredentialPayload } from "../partner-onboarding/types/partnerOnboardingTypes";
import { distributionPersistenceBasePath } from "../infrastructure/repositories/persistencePaths";
import { createRuntimeRepository, type RuntimeRepository } from "../infrastructure/repositories/runtime";
import { CredentialAccessPolicy, CredentialAuthentication, CredentialAuditRecord, CredentialBundle, CredentialEnvironment, CredentialEnvironmentName, CredentialError, CredentialHealthStatus, CredentialMetadata, CredentialRecoveryResult, CredentialRotationPolicy, CredentialStatus, CredentialStatusName, CredentialValidationResult, CredentialVersion, PartnerCredential, CredentialCiphertext } from "./credentialTypes";
import { CredentialConfiguration } from "./credentialConfiguration";
import { CredentialSerializer } from "./credentialSerializer";

export type CredentialRepositoryBundle = Readonly<{
  bundles: RuntimeRepository<OfficialDspPartnerName, CredentialBundle>;
  versions: RuntimeRepository<OfficialDspPartnerName, readonly PartnerCredential[]>;
  metrics: RuntimeRepository<string, number>;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
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

function createError(
  code: string,
  message: string,
  category: string,
  severity: "info" | "warning" | "error" | "critical" = "error",
  recoverable = false,
  metadata: Readonly<Record<string, unknown>> = {},
): CredentialError {
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

function createValidationResult(
  valid: boolean,
  allowed: boolean,
  executed: boolean,
  reason: string | null,
  errors: readonly CredentialError[] = [],
  warnings: readonly CredentialError[] = [],
  metadata: Readonly<Record<string, unknown>> = {},
): CredentialValidationResult {
  return new CredentialValidationResult({ valid, allowed, executed, reason, errors, warnings, metadata });
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(serializeCanonicalJSON(value), "utf8").digest("hex");
}

function normalizePayload(payload: PartnerCredentialPayload): PartnerCredentialPayload {
  return Object.freeze({
    token: payload.token ?? null,
    clientId: payload.clientId ?? null,
    clientSecret: payload.clientSecret ?? null,
    refreshToken: payload.refreshToken ?? null,
    expiresAt: payload.expiresAt ?? null,
    metadata: Object.freeze({ ...(payload.metadata ?? {}) }),
  });
}

function toSecretKey(secret: string | Buffer | null, configuration: CredentialConfiguration): Buffer {
  const source = secret ?? configuration.encryptionSecret ?? serializeCanonicalJSON(configuration.metadata);
  const material = typeof source === "string" ? Buffer.from(source, "utf8") : Buffer.from(source);
  return scryptSync(material, "track-syra-credential-vault", 32);
}

export interface CredentialStore {
  install(credential: PartnerCredential): void;
  rotate(partnerName: OfficialDspPartnerName, credential: PartnerCredential): void;
  revoke(partnerName: OfficialDspPartnerName, version?: string | null): void;
  resolve(partnerName: OfficialDspPartnerName, version?: string | null): PartnerCredential | null;
  list(partnerName?: OfficialDspPartnerName): readonly PartnerCredential[];
}

export interface CredentialProvider {
  install(credentials: PartnerCredentials): PartnerCredential;
  resolve(partnerName: OfficialDspPartnerName, version?: string | null): CredentialAuthentication | null;
  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): PartnerCredential;
  revoke(partnerName: OfficialDspPartnerName, version?: string | null): CredentialValidationResult;
  validate(partnerName: OfficialDspPartnerName, version?: string | null): CredentialValidationResult;
  backup(): string;
  recover(backup: string): CredentialRecoveryResult;
  health(componentId: string): HealthStatus;
}

export type CredentialAccessPolicyFactory = (credentials: PartnerCredentials, environment: CredentialEnvironment) => CredentialAccessPolicy;
export type CredentialRotationPolicyFactory = (credentials: PartnerCredentials) => CredentialRotationPolicy;

export interface PartnerCredentialResolver {
  resolve(partnerName: OfficialDspPartnerName, version?: string | null): CredentialAuthentication | null;
}

export class CredentialVault {
  private readonly key: Buffer;

  constructor(private readonly configuration: CredentialConfiguration, secret: string | Buffer | null) {
    this.key = toSecretKey(secret, configuration);
  }

  encrypt(payload: PartnerCredentialPayload): CredentialCiphertext {
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

  decrypt(ciphertext: CredentialCiphertext): PartnerCredentialPayload {
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ciphertext.iv, "base64"));
    decipher.setAuthTag(Buffer.from(ciphertext.authTag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext.data, "base64")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plaintext) as PartnerCredentialPayload;
    const normalized = normalizePayload(parsed);
    if (hashCanonical(normalized) !== ciphertext.checksum) {
      throw new Error("Credential checksum mismatch");
    }
    return normalized;
  }
}

export class CredentialEncryptor {
  constructor(private readonly vault: CredentialVault) {}

  encrypt(payload: PartnerCredentialPayload): CredentialCiphertext {
    return this.vault.encrypt(payload);
  }
}

export class CredentialDecryptor {
  constructor(private readonly vault: CredentialVault) {}

  decrypt(ciphertext: CredentialCiphertext): PartnerCredentialPayload {
    return this.vault.decrypt(ciphertext);
  }
}

export class CredentialVersionManager {
  next(current?: string | null): string {
    if (!current) return "1.0.0";
    const parts = current.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
      return `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`;
    }
    return `${current}.1`;
  }
}

export class CredentialRegistry implements CredentialStore {
  constructor(private readonly repositories: CredentialRepositoryBundle) {}

  private get bundles(): CredentialRepositoryBundle["bundles"] {
    return this.repositories.bundles;
  }

  private get versions(): CredentialRepositoryBundle["versions"] {
    return this.repositories.versions;
  }

  install(credential: PartnerCredential): void {
    const partnerName = credential.partnerName as OfficialDspPartnerName;
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

  rotate(partnerName: OfficialDspPartnerName, credential: PartnerCredential): void {
    this.install(credential);
  }

  revoke(partnerName: OfficialDspPartnerName, version?: string | null): void {
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

  resolve(partnerName: OfficialDspPartnerName, version?: string | null): PartnerCredential | null {
    const list = this.versions.get(partnerName) ?? [];
    if (!list.length) return null;
    if (version) {
      return list.find((credential) => credential.version.version === version) ?? null;
    }
    return list.find((credential) => credential.version.active && credential.status.active && !credential.status.revoked && !credential.status.expired) ?? null;
  }

  list(partnerName?: OfficialDspPartnerName): readonly PartnerCredential[] {
    if (partnerName) {
      return freezeList(this.versions.get(partnerName) ?? []);
    }
    return freezeList([...this.versions.values()].flat());
  }

  bundle(partnerName: OfficialDspPartnerName): CredentialBundle | null {
    return this.bundles.get(partnerName) ?? null;
  }
}

export class CredentialFactory {
  constructor(
    private readonly encryptor: CredentialEncryptor,
    private readonly versionManager: CredentialVersionManager,
    private readonly accessPolicyFactory: CredentialAccessPolicyFactory,
    private readonly rotationPolicyFactory: CredentialRotationPolicyFactory,
  ) {}

  create(credentials: PartnerCredentials, options: Readonly<{
    name?: string;
    description?: string | null;
    source?: string | null;
  }> = {}): PartnerCredential {
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
  constructor(private readonly decryptor: CredentialDecryptor) {}

  validate(credential: PartnerCredential): CredentialValidationResult {
    const errors: CredentialError[] = [];
    const warnings: CredentialError[] = [];
    let payload: PartnerCredentialPayload | null = null;
    try {
      payload = this.decryptor.decrypt(credential.ciphertext);
    } catch (error) {
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
      partnerName: credential.partnerName as OfficialDspPartnerName,
      credentialId: credential.credentialId,
      version: credential.version.version,
    });
  }
}

export class CredentialRotator {
  constructor(private readonly factory: CredentialFactory, private readonly registry: CredentialRegistry, private readonly logger: CredentialLogger, private readonly metrics: CredentialMetrics) {}

  rotate(credentials: PartnerCredentials, options: Readonly<{ name?: string; description?: string | null; source?: string | null }> = {}): PartnerCredential {
    const rotated = this.factory.create(credentials, options);
    this.registry.rotate(credentials.partnerName, rotated);
    this.logger.info("Credential rotated", { partnerName: credentials.partnerName, credentialId: rotated.credentialId, version: rotated.version.version });
    this.metrics.increment("credential.rotated");
    return rotated;
  }
}

export class CredentialBackupManager {
  constructor(private readonly registry: CredentialRegistry, private readonly serializer: CredentialSerializer) {}

  backup(): string {
    return this.serializer.serialize({
      bundles: this.registry.list().map((credential) => ({
        partnerName: credential.partnerName as OfficialDspPartnerName,
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
  constructor(
    private readonly registry: CredentialRegistry,
    private readonly serializer: CredentialSerializer,
    private readonly accessPolicyFactory: (value: never) => CredentialAccessPolicy,
    private readonly rotationPolicyFactory: (value: never) => CredentialRotationPolicy,
  ) {}

  recover(backup: string): CredentialRecoveryResult {
    try {
      const parsed = this.serializer.deserialize<{ bundles: ReadonlyArray<Record<string, unknown>> }>(backup);
      for (const entry of parsed.bundles ?? []) {
        const credential = new PartnerCredential({
          partnerName: String(entry.partnerName ?? ""),
          credentialId: String(entry.credentialId ?? ""),
          environment: new CredentialEnvironment({
            environment: (entry.environment as CredentialEnvironmentName) ?? "production",
            endpoint: typeof entry.environment === "object" && entry.environment && "endpoint" in entry.environment ? String((entry.environment as Record<string, unknown>).endpoint ?? "") : null,
            region: typeof entry.environment === "object" && entry.environment && "region" in entry.environment ? String((entry.environment as Record<string, unknown>).region ?? "") : null,
            metadata: freeze({}),
          }),
          version: new CredentialVersion(entry.version as never),
          status: new CredentialStatus(entry.status as never),
          metadata: new CredentialMetadata({
            partnerName: String(entry.partnerName ?? ""),
            credentialId: String(entry.credentialId ?? ""),
            name: "Recovered credential",
            metadata: freeze({}),
          }),
          accessPolicy: this.accessPolicyFactory(entry.accessPolicy as never),
          rotationPolicy: this.rotationPolicyFactory(entry.rotationPolicy as never),
          ciphertext: entry.ciphertext as CredentialCiphertext,
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
    } catch (error) {
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
  private readonly records: CredentialAuditRecord[] = [];

  record(partnerName: OfficialDspPartnerName, credentialId: string, version: string, action: string, metadata: Readonly<Record<string, unknown>> = {}): CredentialAuditRecord {
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

  list(partnerName?: OfficialDspPartnerName): readonly CredentialAuditRecord[] {
    return freezeList(partnerName ? this.records.filter((record) => record.partnerName === partnerName) : this.records);
  }
}

export class CredentialMetrics {
  constructor(private readonly counters: CredentialRepositoryBundle["metrics"]) {}

  increment(metric: string, value = 1): void {
    this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
  }

  observe(metric: string, value: number): void {
    this.counters.set(metric, value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return freeze(Object.fromEntries(this.counters.entries()));
  }
}

export class CredentialLogger {
  constructor(private readonly sink: Logger | null) {}

  private redact(context: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
    const redacted = { ...context };
    for (const key of Object.keys(redacted)) {
      if (/secret|token|credential|password|refresh/i.test(key)) {
        redacted[key] = "[redacted]";
      }
    }
    return freeze(redacted);
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, context: Readonly<Record<string, unknown>> = {}): void {
    if (!this.sink) return;
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

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("error", message, context);
  }
}

export class CredentialHealthChecker implements HealthChecker {
  constructor(private readonly registry: CredentialRegistry, private readonly validator: CredentialValidator, private readonly logger: CredentialLogger) {}

  check(componentId: string): HealthStatus {
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

export class CredentialResolver implements PartnerCredentialResolver {
  constructor(private readonly registry: CredentialRegistry, private readonly validator: CredentialValidator) {}

  resolve(partnerName: OfficialDspPartnerName, version?: string | null): CredentialAuthentication | null {
    const credential = this.registry.resolve(partnerName, version);
    if (!credential) return null;
    const validation = this.validator.validate(credential);
    if (!validation.allowed) return null;
    const versions = this.registry.list(partnerName).map((entry) => entry.version.version);
    const activeVersion = credential.version.version;
    const activeIndex = versions.indexOf(activeVersion);
    return new CredentialAuthentication({
      partnerName: credential.partnerName as OfficialDspPartnerName,
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
        partnerName: credential.partnerName as OfficialDspPartnerName,
        credentialId: credential.credentialId,
        version: credential.version.version,
      }),
    });
  }
}

export class CredentialProviderImpl implements CredentialProvider {
  readonly registry: CredentialRegistry;
  readonly vault: CredentialVault;
  readonly encryptor: CredentialEncryptor;
  readonly decryptor: CredentialDecryptor;
  readonly versionManager: CredentialVersionManager;
  readonly serializer: CredentialSerializer;
  readonly metadata: CredentialConfiguration;
  readonly factory: CredentialFactory;
  readonly validator: CredentialValidator;
  readonly logger: CredentialLogger;
  readonly metrics: CredentialMetrics;
  readonly audit: CredentialAudit;
  readonly backupManager: CredentialBackupManager;
  readonly recoveryManager: CredentialRecoveryManager;
  readonly healthChecker: CredentialHealthChecker;
  readonly rotator: CredentialRotator;
  readonly resolver: CredentialResolver;

  constructor(
    dependencies: Readonly<{
      metadata: CredentialConfiguration;
      serializer: CredentialSerializer;
      vault: CredentialVault;
      encryptor: CredentialEncryptor;
      decryptor: CredentialDecryptor;
      versionManager: CredentialVersionManager;
      registry: CredentialRegistry;
      logger: CredentialLogger;
      metrics: CredentialMetrics;
      audit: CredentialAudit;
      factory: CredentialFactory;
      validator: CredentialValidator;
      backupManager: CredentialBackupManager;
      recoveryManager: CredentialRecoveryManager;
      healthChecker: CredentialHealthChecker;
      rotator: CredentialRotator;
      resolver: CredentialResolver;
    }>,
  ) {
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

  install(credentials: PartnerCredentials): PartnerCredential {
    const credential = this.factory.create(credentials);
    this.registry.install(credential);
    this.audit.record(credentials.partnerName, credential.credentialId, credential.version.version, "install", { environment: credential.environment.environment });
    this.metrics.increment("credential.installed");
    this.logger.info("Credential installed", { partnerName: credentials.partnerName, credentialId: credential.credentialId, version: credential.version.version });
    return credential;
  }

  resolve(partnerName: OfficialDspPartnerName, version?: string | null): CredentialAuthentication | null {
    return this.resolver.resolve(partnerName, version);
  }

  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): PartnerCredential {
    if (partnerName !== credentials.partnerName) {
      throw new Error("Credential partner mismatch");
    }
    return this.rotator.rotate(credentials);
  }

  revoke(partnerName: OfficialDspPartnerName, version?: string | null): CredentialValidationResult {
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

  validate(partnerName: OfficialDspPartnerName, version?: string | null): CredentialValidationResult {
    const credential = this.registry.resolve(partnerName, version);
    if (!credential) {
      const error = createError("CREDENTIAL_NOT_FOUND", "Credential is not available", "Validation", "error", false, { partnerName, version: version ?? null });
      return createValidationResult(false, false, true, error.message, [error], [], { partnerName, version: version ?? null });
    }
    return this.validator.validate(credential);
  }

  backup(): string {
    return this.backupManager.backup();
  }

  recover(backup: string): CredentialRecoveryResult {
    return this.recoveryManager.recover(backup);
  }

  health(componentId: string): HealthStatus {
    return this.healthChecker.check(componentId);
  }
}

export function createTrackSyraCredentialService(dependencies: ConstructorParameters<typeof CredentialProviderImpl>[0]): CredentialProviderImpl {
  return new CredentialProviderImpl(dependencies);
}
