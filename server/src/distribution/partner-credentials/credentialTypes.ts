export type CredentialEnvironmentName = "sandbox" | "production";
export type CredentialSeverity = "info" | "warning" | "error" | "critical";
export type CredentialStatusName = "active" | "expired" | "revoked" | "disabled" | "pending";
export type CredentialMetadataMap = Readonly<Record<string, unknown>>;

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export class CredentialMetadata {
  readonly partnerName: string;
  readonly credentialId: string;
  readonly name: string;
  readonly description: string | null;
  readonly source: string | null;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    partnerName: string;
    credentialId: string;
    name: string;
    description?: string | null;
    source?: string | null;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly environment: CredentialEnvironmentName;
  readonly endpoint: string | null;
  readonly region: string | null;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    environment: CredentialEnvironmentName;
    endpoint?: string | null;
    region?: string | null;
    metadata?: CredentialMetadataMap;
  }) {
    this.environment = input.environment;
    this.endpoint = input.endpoint ?? null;
    this.region = input.region ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialRotationPolicy {
  readonly policyId: string;
  readonly autoRotate: boolean;
  readonly rotationIntervalMs: number;
  readonly expiresAfterMs: number | null;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    policyId: string;
    autoRotate?: boolean;
    rotationIntervalMs?: number;
    expiresAfterMs?: number | null;
    metadata?: CredentialMetadataMap;
  }) {
    this.policyId = ensure(input.policyId, "policyId");
    this.autoRotate = input.autoRotate ?? true;
    this.rotationIntervalMs = input.rotationIntervalMs ?? 30 * 24 * 60 * 60_000;
    this.expiresAfterMs = input.expiresAfterMs ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialAccessPolicy {
  readonly policyId: string;
  readonly allowedRoles: readonly string[];
  readonly allowedEnvironments: readonly CredentialEnvironmentName[];
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    policyId: string;
    allowedRoles?: readonly string[];
    allowedEnvironments?: readonly CredentialEnvironmentName[];
    metadata?: CredentialMetadataMap;
  }) {
    this.policyId = ensure(input.policyId, "policyId");
    this.allowedRoles = freezeList(input.allowedRoles ?? []);
    this.allowedEnvironments = freezeList(input.allowedEnvironments ?? ["sandbox", "production"]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialVersion {
  readonly version: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly rotatedAt: string | null;
  readonly revokedAt: string | null;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    version: string;
    active?: boolean;
    createdAt?: string;
    rotatedAt?: string | null;
    revokedAt?: string | null;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly statusId: string;
  readonly state: CredentialStatusName;
  readonly active: boolean;
  readonly revoked: boolean;
  readonly expired: boolean;
  readonly checkedAt: string;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    statusId: string;
    state: CredentialStatusName;
    active?: boolean;
    revoked?: boolean;
    expired?: boolean;
    checkedAt?: string;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly code: string;
  readonly message: string;
  readonly category: string;
  readonly severity: CredentialSeverity;
  readonly recoverable: boolean;
  readonly timestamp: string;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    code: string;
    message: string;
    category: string;
    severity?: CredentialSeverity;
    recoverable?: boolean;
    timestamp?: string;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly auditId: string;
  readonly partnerName: string;
  readonly credentialId: string;
  readonly version: string;
  readonly action: string;
  readonly occurredAt: string;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    auditId: string;
    partnerName: string;
    credentialId: string;
    version: string;
    action: string;
    occurredAt?: string;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly valid: boolean;
  readonly allowed: boolean;
  readonly executed: boolean;
  readonly reason: string | null;
  readonly errors: readonly CredentialError[];
  readonly warnings: readonly CredentialError[];
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    valid: boolean;
    allowed: boolean;
    executed: boolean;
    reason?: string | null;
    errors?: readonly CredentialError[];
    warnings?: readonly CredentialError[];
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly healthy: boolean;
  readonly status: string;
  readonly message: string | null;
  readonly checkedAt: string;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    healthy: boolean;
    status: string;
    message?: string | null;
    checkedAt?: string;
    metadata?: CredentialMetadataMap;
  }) {
    this.healthy = input.healthy;
    this.status = ensure(input.status, "status");
    this.message = input.message ?? null;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialAuthentication {
  readonly partnerName: string;
  readonly credentialId: string;
  readonly environment: CredentialEnvironmentName;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  readonly pendingVersion: string | null;
  readonly revokedVersion: string | null;
  readonly status: CredentialStatusName;
  readonly expiresAt: string | null;
  readonly rotationVersion: string | null;
  readonly valid: boolean;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    partnerName: string;
    credentialId: string;
    environment: CredentialEnvironmentName;
    activeVersion: string;
    previousVersion?: string | null;
    pendingVersion?: string | null;
    revokedVersion?: string | null;
    status: CredentialStatusName;
    expiresAt?: string | null;
    rotationVersion?: string | null;
    valid?: boolean;
    metadata?: CredentialMetadataMap;
  }) {
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
  readonly recovered: boolean;
  readonly allowed: boolean;
  readonly executed: boolean;
  readonly reason: string | null;
  readonly errors: readonly CredentialError[];
  readonly warnings: readonly CredentialError[];
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    recovered: boolean;
    allowed: boolean;
    executed: boolean;
    reason?: string | null;
    errors?: readonly CredentialError[];
    warnings?: readonly CredentialError[];
    metadata?: CredentialMetadataMap;
  }) {
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

export type CredentialCiphertext = Readonly<{
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  data: string;
  checksum: string;
}>;

export class PartnerCredential {
  readonly partnerName: string;
  readonly credentialId: string;
  readonly environment: CredentialEnvironment;
  readonly version: CredentialVersion;
  readonly status: CredentialStatus;
  readonly metadata: CredentialMetadata;
  readonly accessPolicy: CredentialAccessPolicy;
  readonly rotationPolicy: CredentialRotationPolicy;
  readonly ciphertext: CredentialCiphertext;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;

  constructor(input: {
    partnerName: string;
    credentialId: string;
    environment: CredentialEnvironment;
    version: CredentialVersion;
    status: CredentialStatus;
    metadata: CredentialMetadata;
    accessPolicy: CredentialAccessPolicy;
    rotationPolicy: CredentialRotationPolicy;
    ciphertext: CredentialCiphertext;
    issuedAt?: string;
    expiresAt?: string | null;
    revokedAt?: string | null;
  }) {
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
  readonly bundleId: string;
  readonly partnerName: string;
  readonly activeVersion: string;
  readonly credentials: readonly PartnerCredential[];
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    bundleId: string;
    partnerName: string;
    activeVersion: string;
    credentials: readonly PartnerCredential[];
    metadata?: CredentialMetadataMap;
  }) {
    this.bundleId = ensure(input.bundleId, "bundleId");
    this.partnerName = ensure(input.partnerName, "partnerName");
    this.activeVersion = ensure(input.activeVersion, "activeVersion");
    this.credentials = freezeList(input.credentials);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialHealthSnapshot extends CredentialHealthStatus {}
