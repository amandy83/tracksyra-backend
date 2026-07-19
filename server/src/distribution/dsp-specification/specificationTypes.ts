export type SpecificationEnvironmentName = "sandbox" | "production";

export type SpecificationSeverity = "info" | "warning" | "error" | "critical";

export type SpecificationMetadataMap = Readonly<Record<string, unknown>>;

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function freezeRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export class SpecificationVersion {
  readonly version: string;
  readonly active: boolean;
  readonly releasedAt: string;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    version: string;
    active?: boolean;
    releasedAt?: string;
    metadata?: SpecificationMetadataMap;
  }) {
    this.version = ensure(input.version, "version");
    this.active = input.active ?? false;
    this.releasedAt = input.releasedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationMetadata {
  readonly partnerName: string;
  readonly specificationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly tags: Readonly<Record<string, string>>;
  readonly source: string | null;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    partnerName: string;
    specificationId: string;
    name: string;
    description?: string | null;
    featureFlags?: Readonly<Record<string, boolean>>;
    tags?: Readonly<Record<string, string>>;
    source?: string | null;
    metadata?: SpecificationMetadataMap;
  }) {
    this.partnerName = ensure(input.partnerName, "partnerName");
    this.specificationId = ensure(input.specificationId, "specificationId");
    this.name = ensure(input.name, "name");
    this.description = input.description ?? null;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.tags = Object.freeze({ ...(input.tags ?? {}) });
    this.source = input.source ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationCapability {
  readonly capabilityId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    capabilityId: string;
    name: string;
    enabled?: boolean;
    metadata?: SpecificationMetadataMap;
  }) {
    this.capabilityId = ensure(input.capabilityId, "capabilityId");
    this.name = ensure(input.name, "name");
    this.enabled = input.enabled ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationEnvironment {
  readonly environment: SpecificationEnvironmentName;
  readonly endpoint: string | null;
  readonly region: string | null;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    environment: SpecificationEnvironmentName;
    endpoint?: string | null;
    region?: string | null;
    metadata?: SpecificationMetadataMap;
  }) {
    this.environment = input.environment;
    this.endpoint = input.endpoint ?? null;
    this.region = input.region ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationTransport {
  readonly transportId: string;
  readonly mode: string;
  readonly secure: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    transportId: string;
    mode: string;
    secure?: boolean;
    metadata?: SpecificationMetadataMap;
  }) {
    this.transportId = ensure(input.transportId, "transportId");
    this.mode = ensure(input.mode, "mode");
    this.secure = input.secure ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationAuthentication {
  readonly authenticationId: string;
  readonly mode: string;
  readonly required: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    authenticationId: string;
    mode: string;
    required?: boolean;
    metadata?: SpecificationMetadataMap;
  }) {
    this.authenticationId = ensure(input.authenticationId, "authenticationId");
    this.mode = ensure(input.mode, "mode");
    this.required = input.required ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationUpload {
  readonly uploadId: string;
  readonly allowed: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { uploadId: string; allowed?: boolean; metadata?: SpecificationMetadataMap }) {
    this.uploadId = ensure(input.uploadId, "uploadId");
    this.allowed = input.allowed ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationStatus {
  readonly statusId: string;
  readonly supported: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { statusId: string; supported?: boolean; metadata?: SpecificationMetadataMap }) {
    this.statusId = ensure(input.statusId, "statusId");
    this.supported = input.supported ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationWebhook {
  readonly webhookId: string;
  readonly supported: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { webhookId: string; supported?: boolean; metadata?: SpecificationMetadataMap }) {
    this.webhookId = ensure(input.webhookId, "webhookId");
    this.supported = input.supported ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationPolling {
  readonly pollingId: string;
  readonly supported: boolean;
  readonly intervalMs: number;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { pollingId: string; supported?: boolean; intervalMs?: number; metadata?: SpecificationMetadataMap }) {
    this.pollingId = ensure(input.pollingId, "pollingId");
    this.supported = input.supported ?? true;
    this.intervalMs = input.intervalMs ?? 60_000;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationRoyalty {
  readonly royaltyId: string;
  readonly supported: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { royaltyId: string; supported?: boolean; metadata?: SpecificationMetadataMap }) {
    this.royaltyId = ensure(input.royaltyId, "royaltyId");
    this.supported = input.supported ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationReport {
  readonly reportId: string;
  readonly supported: boolean;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { reportId: string; supported?: boolean; metadata?: SpecificationMetadataMap }) {
    this.reportId = ensure(input.reportId, "reportId");
    this.supported = input.supported ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationRateLimit {
  readonly rateLimitId: string;
  readonly requestsPerMinute: number;
  readonly burst: number;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    rateLimitId: string;
    requestsPerMinute?: number;
    burst?: number;
    metadata?: SpecificationMetadataMap;
  }) {
    this.rateLimitId = ensure(input.rateLimitId, "rateLimitId");
    this.requestsPerMinute = input.requestsPerMinute ?? 60;
    this.burst = input.burst ?? 10;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationRetryPolicy {
  readonly retryPolicyId: string;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: { retryPolicyId: string; maxAttempts?: number; backoffMs?: number; metadata?: SpecificationMetadataMap }) {
    this.retryPolicyId = ensure(input.retryPolicyId, "retryPolicyId");
    this.maxAttempts = input.maxAttempts ?? 5;
    this.backoffMs = input.backoffMs ?? 1_000;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationSchema {
  readonly schemaId: string;
  readonly transport: SpecificationTransport;
  readonly authentication: SpecificationAuthentication;
  readonly upload: SpecificationUpload;
  readonly status: SpecificationStatus;
  readonly webhook: SpecificationWebhook;
  readonly polling: SpecificationPolling;
  readonly royalty: SpecificationRoyalty;
  readonly report: SpecificationReport;
  readonly rateLimit: SpecificationRateLimit;
  readonly retryPolicy: SpecificationRetryPolicy;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    schemaId: string;
    transport: SpecificationTransport;
    authentication: SpecificationAuthentication;
    upload: SpecificationUpload;
    status: SpecificationStatus;
    webhook: SpecificationWebhook;
    polling: SpecificationPolling;
    royalty: SpecificationRoyalty;
    report: SpecificationReport;
    rateLimit: SpecificationRateLimit;
    retryPolicy: SpecificationRetryPolicy;
    metadata?: SpecificationMetadataMap;
  }) {
    this.schemaId = ensure(input.schemaId, "schemaId");
    this.transport = input.transport;
    this.authentication = input.authentication;
    this.upload = input.upload;
    this.status = input.status;
    this.webhook = input.webhook;
    this.polling = input.polling;
    this.royalty = input.royalty;
    this.report = input.report;
    this.rateLimit = input.rateLimit;
    this.retryPolicy = input.retryPolicy;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationError {
  readonly code: string;
  readonly message: string;
  readonly category: string;
  readonly severity: SpecificationSeverity;
  readonly recoverable: boolean;
  readonly timestamp: string;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    code: string;
    message: string;
    category: string;
    severity?: SpecificationSeverity;
    recoverable?: boolean;
    timestamp?: string;
    metadata?: SpecificationMetadataMap;
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

export class SpecificationValidationResult {
  readonly valid: boolean;
  readonly allowed: boolean;
  readonly executed: boolean;
  readonly reason: string | null;
  readonly errors: readonly SpecificationError[];
  readonly warnings: readonly SpecificationError[];
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    valid: boolean;
    allowed: boolean;
    executed: boolean;
    reason?: string | null;
    errors?: readonly SpecificationError[];
    warnings?: readonly SpecificationError[];
    metadata?: SpecificationMetadataMap;
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

export class SpecificationActivationResult {
  readonly active: boolean;
  readonly allowed: boolean;
  readonly executed: boolean;
  readonly reason: string | null;
  readonly errors: readonly SpecificationError[];
  readonly warnings: readonly SpecificationError[];
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    active: boolean;
    allowed: boolean;
    executed: boolean;
    reason?: string | null;
    errors?: readonly SpecificationError[];
    warnings?: readonly SpecificationError[];
    metadata?: SpecificationMetadataMap;
  }) {
    this.active = input.active;
    this.allowed = input.allowed;
    this.executed = input.executed;
    this.reason = input.reason ?? null;
    this.errors = freezeList(input.errors ?? []);
    this.warnings = freezeList(input.warnings ?? []);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SpecificationAuditRecord {
  readonly auditId: string;
  readonly partnerName: string;
  readonly version: string;
  readonly action: string;
  readonly occurredAt: string;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    auditId: string;
    partnerName: string;
    version: string;
    action: string;
    occurredAt?: string;
    metadata?: SpecificationMetadataMap;
  }) {
    this.auditId = ensure(input.auditId, "auditId");
    this.partnerName = ensure(input.partnerName, "partnerName");
    this.version = ensure(input.version, "version");
    this.action = ensure(input.action, "action");
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class DspSpecification {
  readonly specificationId: string;
  readonly partnerName: string;
  readonly name: string;
  readonly currentVersion: string;
  readonly versions: readonly SpecificationVersion[];
  readonly environments: readonly SpecificationEnvironment[];
  readonly capabilities: readonly SpecificationCapability[];
  readonly schema: SpecificationSchema;
  readonly metadata: SpecificationMetadata;
  readonly checksum: string;
  readonly signature: string | null;
  readonly active: boolean;
  readonly rollbackVersion: string | null;

  constructor(input: {
    specificationId: string;
    partnerName: string;
    name: string;
    currentVersion: string;
    versions: readonly SpecificationVersion[];
    environments: readonly SpecificationEnvironment[];
    capabilities: readonly SpecificationCapability[];
    schema: SpecificationSchema;
    metadata: SpecificationMetadata;
    checksum: string;
    signature?: string | null;
    active?: boolean;
    rollbackVersion?: string | null;
  }) {
    this.specificationId = ensure(input.specificationId, "specificationId");
    this.partnerName = ensure(input.partnerName, "partnerName");
    this.name = ensure(input.name, "name");
    this.currentVersion = ensure(input.currentVersion, "currentVersion");
    this.versions = freezeList(input.versions);
    this.environments = freezeList(input.environments);
    this.capabilities = freezeList(input.capabilities);
    this.schema = input.schema;
    this.metadata = input.metadata;
    this.checksum = ensure(input.checksum, "checksum");
    this.signature = input.signature ?? null;
    this.active = input.active ?? false;
    this.rollbackVersion = input.rollbackVersion ?? null;
    Object.freeze(this);
  }
}
