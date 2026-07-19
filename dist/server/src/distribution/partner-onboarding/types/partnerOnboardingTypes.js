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
]);
function freeze(value) {
    return Object.freeze({ ...value });
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
export class PartnerContact {
    partnerName;
    contactName;
    email;
    role;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.contactName = ensure(input.contactName, "contactName");
        this.email = input.email ?? null;
        this.role = input.role ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerAgreement {
    partnerName;
    agreementId;
    version;
    acceptedAt;
    documentReference;
    metadata;
    constructor(input) {
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
    partnerName;
    credentialsId;
    environment;
    credentialsInstalled;
    activatedAt;
    rotatedAt;
    payload;
    metadata;
    constructor(input) {
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
    partnerName;
    environment;
    configurationId;
    specificationReference;
    featureFlags;
    metadata;
    constructor(input) {
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
    constructor(input) {
        super({ ...input, environment: "sandbox" });
    }
}
export class ProductionConfiguration extends EnvironmentConfiguration {
    constructor(input) {
        super({ ...input, environment: "production" });
    }
}
export class PartnerCapabilityMatrix {
    partnerName;
    categories;
    featureFlags;
    environments;
    requirements;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.categories = Object.freeze([...input.categories]);
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.environments = Object.freeze([...(input.environments ?? ["sandbox", "production"])]);
        this.requirements = Object.freeze([...(input.requirements ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class FeatureFlags {
    partnerName;
    flags;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.flags = Object.freeze({ ...(input.flags ?? {}) });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerRequirement {
    partnerName;
    requirementId;
    description;
    satisfied;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.requirementId = ensure(input.requirementId, "requirementId");
        this.description = ensure(input.description, "description");
        this.satisfied = input.satisfied ?? false;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class CertificationChecklist {
    partnerName;
    requirements;
    checklistId;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.checklistId = ensure(input.checklistId, "checklistId");
        this.requirements = Object.freeze([...input.requirements]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class ValidationRule {
    partnerName;
    ruleId;
    description;
    enabled;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.ruleId = ensure(input.ruleId, "ruleId");
        this.description = ensure(input.description, "description");
        this.enabled = input.enabled ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerReadiness {
    partnerName;
    ready;
    approved;
    credentialsInstalled;
    certificationPassed;
    issues;
    metadata;
    constructor(input) {
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
    partnerName;
    approvalId;
    approved;
    approvedAt;
    approvedBy;
    metadata;
    constructor(input) {
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
    partnerName;
    activationId;
    credentialsInstalled;
    activatedAt;
    rotatedAt;
    metadata;
    constructor(input) {
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
    partnerName;
    healthy;
    activated;
    checkedAt;
    details;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.healthy = input.healthy;
        this.activated = input.activated;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        Object.freeze(this);
    }
}
export class ComplianceTracking {
    partnerName;
    compliant;
    trackedAt;
    details;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.compliant = input.compliant;
        this.trackedAt = input.trackedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        Object.freeze(this);
    }
}
export class CertificationStatus {
    partnerName;
    status;
    passedAt;
    expiresAt;
    details;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.status = input.status;
        this.passedAt = input.passedAt ?? null;
        this.expiresAt = input.expiresAt ?? null;
        this.details = Object.freeze({ ...(input.details ?? {}) });
        Object.freeze(this);
    }
}
export class VersionTracking {
    partnerName;
    version;
    updatedAt;
    details;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.version = ensure(input.version, "version");
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerMetadata {
    partnerName;
    metadataId;
    notes;
    documentationReferences;
    details;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.metadataId = ensure(input.metadataId, "metadataId");
        this.notes = input.notes ?? null;
        this.documentationReferences = Object.freeze([...(input.documentationReferences ?? [])]);
        this.details = Object.freeze({ ...(input.details ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerProfile {
    partnerName;
    displayName;
    environment;
    approvalState;
    activationState;
    approved;
    credentialsInstalled;
    certificationPassed;
    versionTracking;
    capabilityMatrix;
    environmentConfiguration;
    sandboxConfiguration;
    productionConfiguration;
    partnerMetadata;
    contact;
    agreement;
    certificationStatus;
    complianceTracking;
    readiness;
    createdAt;
    updatedAt;
    details;
    constructor(input) {
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
    partnerName;
    documentationId;
    title;
    reference;
    version;
    metadata;
    constructor(input) {
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
    auditId;
    partnerName;
    eventType;
    occurredAt;
    actor;
    metadata;
    constructor(input) {
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
    eventId;
    partnerName;
    eventType;
    occurredAt;
    metadata;
    constructor(input) {
        this.eventId = ensure(input.eventId, "eventId");
        this.partnerName = input.partnerName;
        this.eventType = ensure(input.eventType, "eventType");
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class PartnerMetricRecord {
    metricId;
    partnerName;
    name;
    value;
    recordedAt;
    tags;
    metadata;
    constructor(input) {
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
    partnerName;
    ready;
    approved;
    credentialsInstalled;
    certificationPassed;
    issues;
    generatedAt;
    metadata;
    constructor(input) {
        this.partnerName = input.partnerName;
        this.ready = input.ready;
        this.approved = input.approved;
        this.credentialsInstalled = input.credentialsInstalled;
        this.certificationPassed = input.certificationPassed;
        this.issues = Object.freeze([...(input.issues ?? [])]);
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metadata = freeze((input.metadata ?? {}));
        Object.freeze(this);
    }
}
