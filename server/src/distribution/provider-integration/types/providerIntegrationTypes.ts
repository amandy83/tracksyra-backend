import type {
  ConnectorCapabilities,
  ConnectorConfiguration,
  ConnectorCredentials,
  ConnectorHealth,
  ConnectorPolling,
  ConnectorReport,
  ConnectorRoyalty,
  ConnectorStatus,
  ConnectorWebhook,
} from "../../connectors";
import type { AuthenticationSnapshot } from "../../partner-credentials";
import type {
  ProviderCapabilities,
  ProviderConfiguration as FrameworkProviderConfiguration,
  ProviderCredentials as FrameworkProviderCredentials,
  ProviderHealth,
  ProviderResult,
  ProviderStatus,
} from "../../providers";

export type ProviderIntegrationMetadata = Readonly<Record<string, unknown>>;

export type ProviderIntegrationState =
  | "Created"
  | "Configured"
  | "Authenticated"
  | "Ready"
  | "Selected"
  | "Uploading"
  | "Processing"
  | "Synced"
  | "Reported"
  | "Takedown"
  | "Failed";

function freezeMetadata<T extends ProviderIntegrationMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export class ProviderSession<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly sessionId: string;
  readonly providerName: string;
  readonly providerVersion: string;
  readonly authenticated: boolean;
  readonly startedAt: string;
  readonly expiresAt: string | null;
  readonly credentials: ConnectorCredentials | FrameworkProviderCredentials | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly metadata: TMetadata;

  constructor(input: {
    sessionId: string;
    providerName: string;
    providerVersion: string;
    authenticated?: boolean;
    startedAt?: string;
    expiresAt?: string | null;
    credentials?: ConnectorCredentials | FrameworkProviderCredentials | null;
    authentication?: AuthenticationSnapshot | null;
    metadata?: TMetadata;
  }) {
    this.sessionId = input.sessionId.trim();
    this.providerName = input.providerName.trim();
    this.providerVersion = input.providerVersion.trim();
    this.authenticated = input.authenticated ?? false;
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt ?? null;
    this.credentials = input.credentials ?? null;
    this.authentication = input.authentication ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.sessionId || !this.providerName || !this.providerVersion) {
      throw new Error("ProviderSession requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderCredentials<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly credentialId: string;
  readonly providerName: string;
  readonly type: string;
  readonly value: ConnectorCredentials | FrameworkProviderCredentials | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly rotatedAt: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    credentialId: string;
    providerName: string;
    type: string;
    value?: ConnectorCredentials | FrameworkProviderCredentials | null;
    authentication?: AuthenticationSnapshot | null;
    issuedAt?: string;
    expiresAt?: string | null;
    rotatedAt?: string | null;
    metadata?: TMetadata;
  }) {
    this.credentialId = input.credentialId.trim();
    this.providerName = input.providerName.trim();
    this.type = input.type.trim();
    this.value = input.value ?? null;
    this.authentication = input.authentication ?? null;
    this.issuedAt = input.issuedAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt ?? null;
    this.rotatedAt = input.rotatedAt ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.credentialId || !this.providerName || !this.type) {
      throw new Error("ProviderCredentials requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderCapabilitySet<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly capabilityId: string;
  readonly providerName: string;
  readonly capabilities: ProviderCapabilities | ConnectorCapabilities;
  readonly enabled: boolean;
  readonly version: string | null;
  readonly updatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    capabilityId: string;
    providerName: string;
    capabilities: ProviderCapabilities | ConnectorCapabilities;
    enabled?: boolean;
    version?: string | null;
    updatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.capabilityId = input.capabilityId.trim();
    this.providerName = input.providerName.trim();
    this.capabilities = input.capabilities;
    this.enabled = input.enabled ?? true;
    this.version = input.version ?? null;
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.capabilityId || !this.providerName) {
      throw new Error("ProviderCapabilitySet requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderHealthSnapshot<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly snapshotId: string;
  readonly providerName: string;
  readonly health: ProviderHealth | ConnectorHealth;
  readonly healthy: boolean;
  readonly observedAt: string;
  readonly latencyMs: number;
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    providerName: string;
    health: ProviderHealth | ConnectorHealth;
    healthy: boolean;
    observedAt?: string;
    latencyMs?: number;
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.providerName = input.providerName.trim();
    this.health = input.health;
    this.healthy = input.healthy;
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.latencyMs = input.latencyMs ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId || !this.providerName) {
      throw new Error("ProviderHealthSnapshot requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderSelectionResult<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly selectionId: string;
  readonly providerName: string;
  readonly adapterName: string;
  readonly priority: number;
  readonly score: number;
  readonly selectedAt: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly healthSnapshot: ProviderHealthSnapshot<TMetadata> | null;
  readonly metadata: TMetadata;

  constructor(input: {
    selectionId: string;
    providerName: string;
    adapterName: string;
    priority?: number;
    score?: number;
    selectedAt?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    healthSnapshot?: ProviderHealthSnapshot<TMetadata> | null;
    metadata?: TMetadata;
  }) {
    this.selectionId = input.selectionId.trim();
    this.providerName = input.providerName.trim();
    this.adapterName = input.adapterName.trim();
    this.priority = input.priority ?? 0;
    this.score = input.score ?? 0;
    this.selectedAt = input.selectedAt ?? new Date().toISOString();
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.healthSnapshot = input.healthSnapshot ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.selectionId || !this.providerName || !this.adapterName) {
      throw new Error("ProviderSelectionResult requires non-empty identifiers");
    }
    if (!Number.isFinite(this.priority) || this.priority < 0) {
      throw new Error("ProviderSelectionResult.priority must be non-negative");
    }
    if (!Number.isFinite(this.score) || this.score < 0) {
      throw new Error("ProviderSelectionResult.score must be non-negative");
    }
    Object.freeze(this);
  }
}

export class ProviderUploadContext<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly uploadId: string;
  readonly providerName: string;
  readonly adapterName: string;
  readonly session: ProviderSession<TMetadata> | null;
  readonly capabilities: ProviderCapabilitySet<TMetadata> | null;
  readonly metadataMap: Readonly<Record<string, unknown>> | ConnectorConfiguration | FrameworkProviderConfiguration | null;
  readonly connectorPayload: Readonly<Record<string, unknown>> | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    uploadId: string;
    providerName: string;
    adapterName: string;
    session?: ProviderSession<TMetadata> | null;
    capabilities?: ProviderCapabilitySet<TMetadata> | null;
    metadataMap?: Readonly<Record<string, unknown>> | ConnectorConfiguration | FrameworkProviderConfiguration | null;
    connectorPayload?: Readonly<Record<string, unknown>> | null;
    authentication?: AuthenticationSnapshot | null;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.uploadId = input.uploadId.trim();
    this.providerName = input.providerName.trim();
    this.adapterName = input.adapterName.trim();
    this.session = input.session ?? null;
    this.capabilities = input.capabilities ?? null;
    this.metadataMap = input.metadataMap ?? null;
    this.connectorPayload = input.connectorPayload ?? null;
    this.authentication = input.authentication ?? null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.uploadId || !this.providerName || !this.adapterName) {
      throw new Error("ProviderUploadContext requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderUploadResult<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly uploadId: string;
  readonly providerName: string;
  readonly success: boolean;
  readonly failure: boolean;
  readonly connectorStatus: ConnectorStatus | ProviderStatus | null;
  readonly result: ProviderResult | null;
  readonly completedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    uploadId: string;
    providerName: string;
    success: boolean;
    failure: boolean;
    connectorStatus?: ConnectorStatus | ProviderStatus | null;
    result?: ProviderResult | null;
    completedAt?: string;
    metadata?: TMetadata;
  }) {
    this.uploadId = input.uploadId.trim();
    this.providerName = input.providerName.trim();
    this.success = input.success;
    this.failure = input.failure;
    this.connectorStatus = input.connectorStatus ?? null;
    this.result = input.result ?? null;
    this.completedAt = input.completedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.uploadId || !this.providerName) {
      throw new Error("ProviderUploadResult requires non-empty identifiers");
    }
    if (!this.success && !this.failure) {
      throw new Error("ProviderUploadResult must be success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("ProviderUploadResult cannot be both success and failure");
    }
    Object.freeze(this);
  }
}

export class ProviderStatusSnapshot<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly snapshotId: string;
  readonly providerName: string;
  readonly status: ProviderStatus | ConnectorStatus;
  readonly observedAt: string;
  readonly healthy: boolean;
  readonly result: ProviderResult | null;
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    providerName: string;
    status: ProviderStatus | ConnectorStatus;
    observedAt?: string;
    healthy?: boolean;
    result?: ProviderResult | null;
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.providerName = input.providerName.trim();
    this.status = input.status;
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.healthy = input.healthy ?? true;
    this.result = input.result ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId || !this.providerName) {
      throw new Error("ProviderStatusSnapshot requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderWebhookEnvelope<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly eventId: string;
  readonly providerName: string;
  readonly payload: ConnectorWebhook;
  readonly receivedAt: string;
  readonly signature: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    eventId: string;
    providerName: string;
    payload: ConnectorWebhook;
    receivedAt?: string;
    signature?: string | null;
    metadata?: TMetadata;
  }) {
    this.eventId = input.eventId.trim();
    this.providerName = input.providerName.trim();
    this.payload = input.payload;
    this.receivedAt = input.receivedAt ?? new Date().toISOString();
    this.signature = input.signature ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.eventId || !this.providerName) {
      throw new Error("ProviderWebhookEnvelope requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderPollingResult<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly pollingId: string;
  readonly providerName: string;
  readonly status: ConnectorPolling | ConnectorStatus | null;
  readonly snapshot: ProviderStatusSnapshot<TMetadata> | null;
  readonly polledAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    pollingId: string;
    providerName: string;
    status?: ConnectorPolling | ConnectorStatus | null;
    snapshot?: ProviderStatusSnapshot<TMetadata> | null;
    polledAt?: string;
    metadata?: TMetadata;
  }) {
    this.pollingId = input.pollingId.trim();
    this.providerName = input.providerName.trim();
    this.status = input.status ?? null;
    this.snapshot = input.snapshot ?? null;
    this.polledAt = input.polledAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.pollingId || !this.providerName) {
      throw new Error("ProviderPollingResult requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderRoyaltyBatch<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly batchId: string;
  readonly providerName: string;
  readonly royalties: ConnectorRoyalty | ProviderResult | null;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    batchId: string;
    providerName: string;
    royalties?: ConnectorRoyalty | ProviderResult | null;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.batchId = input.batchId.trim();
    this.providerName = input.providerName.trim();
    this.royalties = input.royalties ?? null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.batchId || !this.providerName) {
      throw new Error("ProviderRoyaltyBatch requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderReportBatch<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly batchId: string;
  readonly providerName: string;
  readonly reports: ConnectorReport | ProviderResult | null;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    batchId: string;
    providerName: string;
    reports?: ConnectorReport | ProviderResult | null;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.batchId = input.batchId.trim();
    this.providerName = input.providerName.trim();
    this.reports = input.reports ?? null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.batchId || !this.providerName) {
      throw new Error("ProviderReportBatch requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ProviderRetryContext<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly retryId: string;
  readonly providerName: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: string | null;
  readonly lastError: string | null;
  readonly policy: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    retryId: string;
    providerName: string;
    attempt: number;
    maxAttempts: number;
    nextRetryAt?: string | null;
    lastError?: string | null;
    policy?: string | null;
    metadata?: TMetadata;
  }) {
    this.retryId = input.retryId.trim();
    this.providerName = input.providerName.trim();
    this.attempt = input.attempt;
    this.maxAttempts = input.maxAttempts;
    this.nextRetryAt = input.nextRetryAt ?? null;
    this.lastError = input.lastError ?? null;
    this.policy = input.policy ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.retryId || !this.providerName) {
      throw new Error("ProviderRetryContext requires non-empty identifiers");
    }
    if (!Number.isInteger(this.attempt) || this.attempt < 0) {
      throw new Error("ProviderRetryContext.attempt must be a non-negative integer");
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 0) {
      throw new Error("ProviderRetryContext.maxAttempts must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class ProviderConfiguration<TMetadata extends ProviderIntegrationMetadata = ProviderIntegrationMetadata> {
  readonly configurationId: string;
  readonly providerName: string;
  readonly adapterName: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly region: string | null;
  readonly retryPolicy: string | null;
  readonly rateLimitPolicy: string | null;
  readonly source: FrameworkProviderConfiguration | ConnectorConfiguration | null;
  readonly metadata: TMetadata;

  constructor(input: {
    configurationId: string;
    providerName: string;
    adapterName: string;
    enabled?: boolean;
    priority?: number;
    featureFlags?: Readonly<Record<string, boolean>>;
    region?: string | null;
    retryPolicy?: string | null;
    rateLimitPolicy?: string | null;
    source?: FrameworkProviderConfiguration | ConnectorConfiguration | null;
    metadata?: TMetadata;
  }) {
    this.configurationId = input.configurationId.trim();
    this.providerName = input.providerName.trim();
    this.adapterName = input.adapterName.trim();
    this.enabled = input.enabled ?? true;
    this.priority = input.priority ?? 0;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.region = input.region ?? null;
    this.retryPolicy = input.retryPolicy ?? null;
    this.rateLimitPolicy = input.rateLimitPolicy ?? null;
    this.source = input.source ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.configurationId || !this.providerName || !this.adapterName) {
      throw new Error("ProviderConfiguration requires non-empty identifiers");
    }
    if (!Number.isFinite(this.priority) || this.priority < 0) {
      throw new Error("ProviderConfiguration.priority must be non-negative");
    }
    Object.freeze(this);
  }
}
