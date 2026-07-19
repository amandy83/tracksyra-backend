export const OFFICIAL_DSP_PARTNERS = Object.freeze([
  "Spotify",
  "AppleMusic",
  "YouTubeMusic",
  "AmazonMusic",
  "Deezer",
  "TikTok",
  "Meta",
  "JioSaavn",
  "Gaana",
  "Wynk",
  "Boomplay",
  "Anghami",
  "Tidal",
  "KKBOX",
  "LineMusic",
] as const);

export type OfficialDspPartnerName = (typeof OFFICIAL_DSP_PARTNERS)[number];
export type PartnerEnvironment = "sandbox" | "production";
export type PartnerCertificationState = "Pending" | "InReview" | "Passed" | "Failed" | "Expired";
export type PartnerApprovalState = "Pending" | "Approved" | "Rejected" | "Suspended";
export type PartnerActivationState = "Inactive" | "Active" | "Paused";
export type PartnerCapabilityCategory =
  | "Music"
  | "Video"
  | "Lyrics"
  | "Dolby Atmos"
  | "Spatial Audio"
  | "Territories"
  | "Languages"
  | "Monetization"
  | "Royalty Reporting"
  | "Webhooks"
  | "Polling"
  | "Takedown"
  | "Reports";

export type PartnerFeatureFlags = Readonly<Record<string, boolean>>;
export type PartnerMetadataMap = Readonly<Record<string, unknown>>;
export type PartnerIssue = Readonly<{
  code: string;
  message: string;
  severity: "Info" | "Warning" | "Error" | "Critical";
}>;

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

export class PartnerContact {
  readonly partnerName: OfficialDspPartnerName;
  readonly contactName: string;
  readonly email: string | null;
  readonly role: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    contactName: string;
    email?: string | null;
    role?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.contactName = ensure(input.contactName, "contactName");
    this.email = input.email ?? null;
    this.role = input.role ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerAgreement {
  readonly partnerName: OfficialDspPartnerName;
  readonly agreementId: string;
  readonly version: string;
  readonly acceptedAt: string | null;
  readonly documentReference: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    agreementId: string;
    version: string;
    acceptedAt?: string | null;
    documentReference?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.agreementId = ensure(input.agreementId, "agreementId");
    this.version = ensure(input.version, "version");
    this.acceptedAt = input.acceptedAt ?? null;
    this.documentReference = input.documentReference ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerCredentials {
  readonly partnerName: OfficialDspPartnerName;
  readonly credentialsId: string;
  readonly environment: PartnerEnvironment;
  readonly credentialsInstalled: boolean;
  readonly activatedAt: string | null;
  readonly rotatedAt: string | null;
  readonly payload: PartnerCredentialPayload;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    credentialsId: string;
    environment: PartnerEnvironment;
    credentialsInstalled?: boolean;
    activatedAt?: string | null;
    rotatedAt?: string | null;
    payload?: PartnerCredentialPayload;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.credentialsId = ensure(input.credentialsId, "credentialsId");
    this.environment = input.environment;
    this.credentialsInstalled = input.credentialsInstalled ?? true;
    this.activatedAt = input.activatedAt ?? new Date().toISOString();
    this.rotatedAt = input.rotatedAt ?? null;
    this.payload = Object.freeze({
      token: input.payload?.token ?? null,
      clientId: input.payload?.clientId ?? null,
      clientSecret: input.payload?.clientSecret ?? null,
      refreshToken: input.payload?.refreshToken ?? null,
      expiresAt: input.payload?.expiresAt ?? null,
      metadata: Object.freeze({ ...(input.payload?.metadata ?? {}) }),
    });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class EnvironmentConfiguration {
  readonly partnerName: OfficialDspPartnerName;
  readonly environment: PartnerEnvironment;
  readonly configurationId: string;
  readonly specificationReference: string | null;
  readonly featureFlags: PartnerFeatureFlags;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    environment: PartnerEnvironment;
    configurationId: string;
    specificationReference?: string | null;
    featureFlags?: PartnerFeatureFlags;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.environment = input.environment;
    this.configurationId = ensure(input.configurationId, "configurationId");
    this.specificationReference = input.specificationReference ?? null;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class SandboxConfiguration extends EnvironmentConfiguration {
  constructor(input: Omit<ConstructorParameters<typeof EnvironmentConfiguration>[0], "environment">) {
    super({ ...input, environment: "sandbox" });
  }
}

export class ProductionConfiguration extends EnvironmentConfiguration {
  constructor(input: Omit<ConstructorParameters<typeof EnvironmentConfiguration>[0], "environment">) {
    super({ ...input, environment: "production" });
  }
}

export class PartnerCapabilityMatrix {
  readonly partnerName: OfficialDspPartnerName;
  readonly categories: readonly PartnerCapabilityCategory[];
  readonly featureFlags: PartnerFeatureFlags;
  readonly environments: readonly PartnerEnvironment[];
  readonly requirements: readonly string[];
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    categories: readonly PartnerCapabilityCategory[];
    featureFlags?: PartnerFeatureFlags;
    environments?: readonly PartnerEnvironment[];
    requirements?: readonly string[];
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.categories = Object.freeze([...input.categories]);
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.environments = Object.freeze([...(input.environments ?? ["sandbox", "production"])] as readonly PartnerEnvironment[]);
    this.requirements = Object.freeze([...(input.requirements ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class FeatureFlags {
  readonly partnerName: OfficialDspPartnerName;
  readonly flags: PartnerFeatureFlags;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    flags?: PartnerFeatureFlags;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.flags = Object.freeze({ ...(input.flags ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerRequirement {
  readonly partnerName: OfficialDspPartnerName;
  readonly requirementId: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    requirementId: string;
    description: string;
    satisfied?: boolean;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.requirementId = ensure(input.requirementId, "requirementId");
    this.description = ensure(input.description, "description");
    this.satisfied = input.satisfied ?? false;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CertificationChecklist {
  readonly partnerName: OfficialDspPartnerName;
  readonly requirements: readonly PartnerRequirement[];
  readonly checklistId: string;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    checklistId: string;
    requirements: readonly PartnerRequirement[];
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.checklistId = ensure(input.checklistId, "checklistId");
    this.requirements = Object.freeze([...input.requirements]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class ValidationRule {
  readonly partnerName: OfficialDspPartnerName;
  readonly ruleId: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    ruleId: string;
    description: string;
    enabled?: boolean;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.ruleId = ensure(input.ruleId, "ruleId");
    this.description = ensure(input.description, "description");
    this.enabled = input.enabled ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerReadiness {
  readonly partnerName: OfficialDspPartnerName;
  readonly ready: boolean;
  readonly approved: boolean;
  readonly credentialsInstalled: boolean;
  readonly certificationPassed: boolean;
  readonly issues: readonly PartnerIssue[];
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    ready: boolean;
    approved: boolean;
    credentialsInstalled: boolean;
    certificationPassed: boolean;
    issues?: readonly PartnerIssue[];
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.ready = input.ready;
    this.approved = input.approved;
    this.credentialsInstalled = input.credentialsInstalled;
    this.certificationPassed = input.certificationPassed;
    this.issues = Object.freeze([...(input.issues ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class IntegrationApproval {
  readonly partnerName: OfficialDspPartnerName;
  readonly approvalId: string;
  readonly approved: boolean;
  readonly approvedAt: string | null;
  readonly approvedBy: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    approvalId: string;
    approved?: boolean;
    approvedAt?: string | null;
    approvedBy?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.approvalId = ensure(input.approvalId, "approvalId");
    this.approved = input.approved ?? false;
    this.approvedAt = input.approvedAt ?? null;
    this.approvedBy = input.approvedBy ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class CredentialActivation {
  readonly partnerName: OfficialDspPartnerName;
  readonly activationId: string;
  readonly credentialsInstalled: boolean;
  readonly activatedAt: string | null;
  readonly rotatedAt: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    activationId: string;
    credentialsInstalled?: boolean;
    activatedAt?: string | null;
    rotatedAt?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.activationId = ensure(input.activationId, "activationId");
    this.credentialsInstalled = input.credentialsInstalled ?? false;
    this.activatedAt = input.activatedAt ?? null;
    this.rotatedAt = input.rotatedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerHealth {
  readonly partnerName: OfficialDspPartnerName;
  readonly healthy: boolean;
  readonly activated: boolean;
  readonly checkedAt: string;
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    healthy: boolean;
    activated: boolean;
    checkedAt?: string;
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.healthy = input.healthy;
    this.activated = input.activated;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class ComplianceTracking {
  readonly partnerName: OfficialDspPartnerName;
  readonly compliant: boolean;
  readonly trackedAt: string;
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    compliant: boolean;
    trackedAt?: string;
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.compliant = input.compliant;
    this.trackedAt = input.trackedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class CertificationStatus {
  readonly partnerName: OfficialDspPartnerName;
  readonly status: PartnerCertificationState;
  readonly passedAt: string | null;
  readonly expiresAt: string | null;
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    status: PartnerCertificationState;
    passedAt?: string | null;
    expiresAt?: string | null;
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.status = input.status;
    this.passedAt = input.passedAt ?? null;
    this.expiresAt = input.expiresAt ?? null;
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class VersionTracking {
  readonly partnerName: OfficialDspPartnerName;
  readonly version: string;
  readonly updatedAt: string;
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    version: string;
    updatedAt?: string;
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.version = ensure(input.version, "version");
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerMetadata {
  readonly partnerName: OfficialDspPartnerName;
  readonly metadataId: string;
  readonly notes: string | null;
  readonly documentationReferences: readonly string[];
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    metadataId: string;
    notes?: string | null;
    documentationReferences?: readonly string[];
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.metadataId = ensure(input.metadataId, "metadataId");
    this.notes = input.notes ?? null;
    this.documentationReferences = Object.freeze([...(input.documentationReferences ?? [])]);
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerProfile {
  readonly partnerName: OfficialDspPartnerName;
  readonly displayName: string;
  readonly environment: PartnerEnvironment;
  readonly approvalState: PartnerApprovalState;
  readonly activationState: PartnerActivationState;
  readonly approved: boolean;
  readonly credentialsInstalled: boolean;
  readonly certificationPassed: boolean;
  readonly versionTracking: VersionTracking;
  readonly capabilityMatrix: PartnerCapabilityMatrix;
  readonly environmentConfiguration: EnvironmentConfiguration;
  readonly sandboxConfiguration: SandboxConfiguration;
  readonly productionConfiguration: ProductionConfiguration;
  readonly partnerMetadata: PartnerMetadata;
  readonly contact: PartnerContact | null;
  readonly agreement: PartnerAgreement | null;
  readonly certificationStatus: CertificationStatus;
  readonly complianceTracking: ComplianceTracking;
  readonly readiness: PartnerReadiness;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly details: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    displayName: string;
    environment?: PartnerEnvironment;
    approvalState?: PartnerApprovalState;
    activationState?: PartnerActivationState;
    approved?: boolean;
    credentialsInstalled?: boolean;
    certificationPassed?: boolean;
    versionTracking: VersionTracking;
    capabilityMatrix: PartnerCapabilityMatrix;
    environmentConfiguration: EnvironmentConfiguration;
    sandboxConfiguration: SandboxConfiguration;
    productionConfiguration: ProductionConfiguration;
    partnerMetadata: PartnerMetadata;
    contact?: PartnerContact | null;
    agreement?: PartnerAgreement | null;
    certificationStatus: CertificationStatus;
    complianceTracking: ComplianceTracking;
    readiness: PartnerReadiness;
    createdAt?: string;
    updatedAt?: string;
    details?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.displayName = ensure(input.displayName, "displayName");
    this.environment = input.environment ?? "sandbox";
    this.approvalState = input.approvalState ?? "Pending";
    this.activationState = input.activationState ?? "Inactive";
    this.approved = input.approved ?? false;
    this.credentialsInstalled = input.credentialsInstalled ?? false;
    this.certificationPassed = input.certificationPassed ?? false;
    this.versionTracking = input.versionTracking;
    this.capabilityMatrix = input.capabilityMatrix;
    this.environmentConfiguration = input.environmentConfiguration;
    this.sandboxConfiguration = input.sandboxConfiguration;
    this.productionConfiguration = input.productionConfiguration;
    this.partnerMetadata = input.partnerMetadata;
    this.contact = input.contact ?? null;
    this.agreement = input.agreement ?? null;
    this.certificationStatus = input.certificationStatus;
    this.complianceTracking = input.complianceTracking;
    this.readiness = input.readiness;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.details = Object.freeze({ ...(input.details ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerDocumentationRecord {
  readonly partnerName: OfficialDspPartnerName;
  readonly documentationId: string;
  readonly title: string;
  readonly reference: string | null;
  readonly version: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    documentationId: string;
    title: string;
    reference?: string | null;
    version?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.documentationId = ensure(input.documentationId, "documentationId");
    this.title = ensure(input.title, "title");
    this.reference = input.reference ?? null;
    this.version = input.version ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerAuditEntry {
  readonly auditId: string;
  readonly partnerName: OfficialDspPartnerName;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actor: string | null;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    auditId: string;
    partnerName: OfficialDspPartnerName;
    eventType: string;
    occurredAt?: string;
    actor?: string | null;
    metadata?: PartnerMetadataMap;
  }) {
    this.auditId = ensure(input.auditId, "auditId");
    this.partnerName = input.partnerName;
    this.eventType = ensure(input.eventType, "eventType");
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.actor = input.actor ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerEventRecord {
  readonly eventId: string;
  readonly partnerName: OfficialDspPartnerName;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    eventId: string;
    partnerName: OfficialDspPartnerName;
    eventType: string;
    occurredAt?: string;
    metadata?: PartnerMetadataMap;
  }) {
    this.eventId = ensure(input.eventId, "eventId");
    this.partnerName = input.partnerName;
    this.eventType = ensure(input.eventType, "eventType");
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerMetricRecord {
  readonly metricId: string;
  readonly partnerName: OfficialDspPartnerName;
  readonly name: string;
  readonly value: number;
  readonly recordedAt: string;
  readonly tags: Readonly<Record<string, string | number | boolean>>;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    metricId: string;
    partnerName: OfficialDspPartnerName;
    name: string;
    value: number;
    recordedAt?: string;
    tags?: Readonly<Record<string, string | number | boolean>>;
    metadata?: PartnerMetadataMap;
  }) {
    this.metricId = ensure(input.metricId, "metricId");
    this.partnerName = input.partnerName;
    this.name = ensure(input.name, "name");
    this.value = input.value;
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.tags = Object.freeze({ ...(input.tags ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class PartnerReadinessReport {
  readonly partnerName: OfficialDspPartnerName;
  readonly ready: boolean;
  readonly approved: boolean;
  readonly credentialsInstalled: boolean;
  readonly certificationPassed: boolean;
  readonly issues: readonly PartnerIssue[];
  readonly generatedAt: string;
  readonly metadata: PartnerMetadataMap;

  constructor(input: {
    partnerName: OfficialDspPartnerName;
    ready: boolean;
    approved: boolean;
    credentialsInstalled: boolean;
    certificationPassed: boolean;
    issues?: readonly PartnerIssue[];
    generatedAt?: string;
    metadata?: PartnerMetadataMap;
  }) {
    this.partnerName = input.partnerName;
    this.ready = input.ready;
    this.approved = input.approved;
    this.credentialsInstalled = input.credentialsInstalled;
    this.certificationPassed = input.certificationPassed;
    this.issues = Object.freeze([...(input.issues ?? [])]);
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = freeze((input.metadata ?? {}) as Record<string, unknown>);
    Object.freeze(this);
  }
}

export type PartnerCredentialPayload = Readonly<{
  token: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  metadata: PartnerMetadataMap;
}>;
