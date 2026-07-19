import type { OfficialDspPartnerName, PartnerActivationGate } from "../partner-onboarding";
import { CredentialError, CredentialValidationResult, type CredentialEnvironmentName } from "./credentialTypes";
import type { PartnerCredentialResolver } from "./credentialRuntime";

export type AuthenticationStatusName =
  | "ready"
  | "missing"
  | "blocked"
  | "revoked"
  | "expired"
  | "disabled"
  | "pending"
  | "unknown";

export type AuthenticationMetadata = Readonly<Record<string, unknown>>;

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function freezeMetadata<T extends AuthenticationMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export class AuthenticationSnapshot {
  readonly partnerId: string;
  readonly credentialId: string;
  readonly credentialVersion: string;
  readonly expiryTimestamp: string | null;
  readonly environment: CredentialEnvironmentName;
  readonly approvedCapabilities: readonly string[];
  readonly authenticationStatus: AuthenticationStatusName;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    partnerId: string;
    credentialId: string;
    credentialVersion: string;
    expiryTimestamp?: string | null;
    environment: CredentialEnvironmentName;
    approvedCapabilities?: readonly string[];
    authenticationStatus?: AuthenticationStatusName;
    metadata?: AuthenticationMetadata;
  }) {
    this.partnerId = ensure(input.partnerId, "partnerId");
    this.credentialId = ensure(input.credentialId, "credentialId");
    this.credentialVersion = ensure(input.credentialVersion, "credentialVersion");
    this.expiryTimestamp = input.expiryTimestamp ?? null;
    this.environment = input.environment;
    this.approvedCapabilities = freezeList(input.approvedCapabilities ?? []);
    this.authenticationStatus = input.authenticationStatus ?? "ready";
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class AuthenticationContext {
  readonly partnerName: OfficialDspPartnerName;
  readonly environment: CredentialEnvironmentName;
  readonly credentialVersion: string | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly executionId: string | null;
  readonly runtimeName: string | null;
  readonly connectorName: string | null;
  readonly workerName: string | null;
  readonly queueName: string | null;
  readonly releaseId: string | null;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    environment: CredentialEnvironmentName;
    credentialVersion?: string | null;
    authentication?: AuthenticationSnapshot | null;
    executionId?: string | null;
    runtimeName?: string | null;
    connectorName?: string | null;
    workerName?: string | null;
    queueName?: string | null;
    releaseId?: string | null;
    metadata?: AuthenticationMetadata;
  }) {
    this.partnerName = ensure(input.partnerName, "partnerName") as OfficialDspPartnerName;
    this.environment = input.environment;
    this.credentialVersion = input.credentialVersion ?? null;
    this.authentication = input.authentication ?? null;
    this.executionId = input.executionId?.trim() || null;
    this.runtimeName = input.runtimeName?.trim() || null;
    this.connectorName = input.connectorName?.trim() || null;
    this.workerName = input.workerName?.trim() || null;
    this.queueName = input.queueName?.trim() || null;
    this.releaseId = input.releaseId?.trim() || null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class CredentialBinding {
  readonly partnerName: OfficialDspPartnerName;
  readonly credentialId: string;
  readonly version: string;
  readonly pinned: boolean;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    credentialId: string;
    version: string;
    pinned?: boolean;
    metadata?: AuthenticationMetadata;
  }) {
    this.partnerName = ensure(input.partnerName, "partnerName") as OfficialDspPartnerName;
    this.credentialId = ensure(input.credentialId, "credentialId");
    this.version = ensure(input.version, "version");
    this.pinned = input.pinned ?? true;
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class CredentialVersionBinding {
  readonly partnerName: OfficialDspPartnerName;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  readonly pendingVersion: string | null;
  readonly revokedVersion: string | null;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    activeVersion: string;
    previousVersion?: string | null;
    pendingVersion?: string | null;
    revokedVersion?: string | null;
    metadata?: AuthenticationMetadata;
  }) {
    this.partnerName = ensure(input.partnerName, "partnerName") as OfficialDspPartnerName;
    this.activeVersion = ensure(input.activeVersion, "activeVersion");
    this.previousVersion = input.previousVersion ?? null;
    this.pendingVersion = input.pendingVersion ?? null;
    this.revokedVersion = input.revokedVersion ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class CredentialExecutionScope {
  readonly executionId: string;
  readonly partnerName: OfficialDspPartnerName;
  readonly releaseId: string | null;
  readonly workerName: string | null;
  readonly queueName: string | null;
  readonly runtimeName: string | null;
  readonly connectorName: string | null;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    executionId: string;
    partnerName: OfficialDspPartnerName;
    releaseId?: string | null;
    workerName?: string | null;
    queueName?: string | null;
    runtimeName?: string | null;
    connectorName?: string | null;
    metadata?: AuthenticationMetadata;
  }) {
    this.executionId = ensure(input.executionId, "executionId");
    this.partnerName = ensure(input.partnerName, "partnerName") as OfficialDspPartnerName;
    this.releaseId = input.releaseId?.trim() || null;
    this.workerName = input.workerName?.trim() || null;
    this.queueName = input.queueName?.trim() || null;
    this.runtimeName = input.runtimeName?.trim() || null;
    this.connectorName = input.connectorName?.trim() || null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class CredentialVersionPinning {
  readonly partnerName: OfficialDspPartnerName;
  readonly pinnedVersion: string;
  readonly pinnedAt: string;
  readonly metadata: AuthenticationMetadata;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    pinnedVersion: string;
    pinnedAt?: string;
    metadata?: AuthenticationMetadata;
  }) {
    this.partnerName = ensure(input.partnerName, "partnerName") as OfficialDspPartnerName;
    this.pinnedVersion = ensure(input.pinnedVersion, "pinnedVersion");
    this.pinnedAt = input.pinnedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as AuthenticationMetadata);
    Object.freeze(this);
  }
}

export class CredentialExpiryGuard {
  check(snapshot: AuthenticationSnapshot | null): CredentialValidationResult {
    const errors: CredentialError[] = [];
    if (!snapshot) {
      errors.push(new CredentialError({
        code: "CREDENTIAL_MISSING",
        message: "Authentication snapshot is missing",
        category: "Authentication",
        severity: "error",
        recoverable: false,
      }));
    } else if (snapshot.expiryTimestamp && new Date(snapshot.expiryTimestamp).getTime() <= Date.now()) {
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
  check(snapshot: AuthenticationSnapshot | null): CredentialValidationResult {
    const errors: CredentialError[] = [];
    if (!snapshot) {
      errors.push(new CredentialError({
        code: "CREDENTIAL_MISSING",
        message: "Authentication snapshot is missing",
        category: "Authentication",
      }));
    } else if (snapshot.authenticationStatus === "revoked") {
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
  validate(
    snapshot: AuthenticationSnapshot | null,
    activationGate: PartnerActivationGate,
    partnerName: OfficialDspPartnerName,
  ): CredentialValidationResult {
    const errors: CredentialError[] = [];
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
  constructor(private readonly resolver: PartnerCredentialResolver) {}

  resolve(partnerName: OfficialDspPartnerName, version?: string | null): AuthenticationSnapshot | null {
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
  constructor(private readonly middleware: CredentialResolverMiddleware) {}

  inject(context: AuthenticationContext): AuthenticationContext {
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
  constructor(private readonly middleware: CredentialResolverMiddleware) {}

  refresh(context: AuthenticationContext): AuthenticationSnapshot | null {
    return this.middleware.resolve(context.partnerName, context.credentialVersion);
  }
}

export class CredentialAuditPublisher {
  private readonly records: readonly AuthenticationContext[] = [];

  publish(context: AuthenticationContext): AuthenticationContext {
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
    (this.records as AuthenticationContext[]).push(next);
    return next;
  }

  list(): readonly AuthenticationContext[] {
    return freezeList(this.records);
  }
}

export class CredentialMetricsPublisher {
  private readonly metrics = new Map<string, number>();

  record(metric: string, value = 1): void {
    this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.metrics.entries()));
  }
}

export class CredentialHealthPublisher {
  readonly healthy: boolean;

  constructor(healthy = true) {
    this.healthy = healthy;
    Object.freeze(this);
  }
}
