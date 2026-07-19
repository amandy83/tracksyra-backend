import { AuditEvent } from "../../observability/audit/auditEvent.js";
import { LogEntry } from "../../observability/logging/logEntry.js";
import { Metric } from "../../observability/metrics/metric.js";
import { ValidationError, ValidationResult, ValidationWarning } from "../../validation/types/validationTypes.js";
import { PartnerAuditEntry, PartnerHealth, PartnerMetadata, PartnerMetricRecord, PartnerProfile, PartnerReadiness, PartnerReadinessReport, PartnerCapabilityMatrix, PartnerEventRecord, PartnerRequirement, CertificationStatus, ComplianceTracking, FeatureFlags, SandboxConfiguration, ProductionConfiguration, VersionTracking, OFFICIAL_DSP_PARTNERS, } from "../types/partnerOnboardingTypes.js";
function nowIso() {
    return new Date().toISOString();
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function partnerCategories(partnerName) {
    if (partnerName === "TikTok" || partnerName === "Meta" || partnerName === "YouTubeMusic") {
        return Object.freeze(["Music", "Video", "Territories", "Languages", "Monetization", "Royalty Reporting", "Webhooks", "Polling"]);
    }
    return Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting", "Webhooks", "Polling", "Takedown"]);
}
function createDefaultCapabilityMatrix(partnerName, featureFlags) {
    return new PartnerCapabilityMatrix({
        partnerName,
        categories: partnerCategories(partnerName),
        featureFlags,
        environments: Object.freeze(["sandbox", "production"]),
        requirements: Object.freeze([
            "Partner agreement executed",
            "Certification completed",
            "Credentials installed",
            "Validation passed",
        ]),
        metadata: freeze({
            officialPartner: true,
            onboardingManaged: true,
            connectorActivationRequired: true,
        }),
    });
}
function createDefaultEnvironmentConfiguration(partnerName, environment, featureFlags) {
    return environment === "production"
        ? new ProductionConfiguration({
            partnerName,
            configurationId: `${partnerName}:production:config`,
            specificationReference: null,
            featureFlags,
            metadata: freeze({ partnerName, environment }),
        })
        : new SandboxConfiguration({
            partnerName,
            configurationId: `${partnerName}:sandbox:config`,
            specificationReference: null,
            featureFlags,
            metadata: freeze({ partnerName, environment }),
        });
}
function createDefaultMetadata(partnerName) {
    return new PartnerMetadata({
        partnerName,
        metadataId: `${partnerName}:metadata`,
        notes: "Official DSP partner onboarding record",
        documentationReferences: [],
        details: freeze({ partnerName, seeded: true }),
    });
}
function createDefaultVersionTracking(partnerName) {
    return new VersionTracking({
        partnerName,
        version: "1.0.0",
        details: freeze({ partnerName, seedVersion: true }),
    });
}
function createDefaultCertificationStatus(partnerName) {
    return new CertificationStatus({
        partnerName,
        status: "Pending",
        passedAt: null,
        expiresAt: null,
        details: freeze({ partnerName, seeded: true }),
    });
}
function createDefaultComplianceTracking(partnerName, approved, credentialsInstalled, certificationPassed) {
    return new ComplianceTracking({
        partnerName,
        compliant: approved && credentialsInstalled && certificationPassed,
        trackedAt: nowIso(),
        details: freeze({ partnerName, seeded: true }),
    });
}
function createReadiness(partnerName, approved, credentialsInstalled, certificationPassed, details = {}) {
    const issues = [];
    if (!approved) {
        issues.push({ code: "APPROVAL_PENDING", message: "Partner approval has not been granted", severity: "Warning" });
    }
    if (!credentialsInstalled) {
        issues.push({ code: "CREDENTIALS_MISSING", message: "Partner credentials are not installed", severity: "Warning" });
    }
    if (!certificationPassed) {
        issues.push({ code: "CERTIFICATION_PENDING", message: "Certification has not been passed", severity: "Warning" });
    }
    return new PartnerReadiness({
        partnerName,
        ready: approved && credentialsInstalled && certificationPassed,
        approved,
        credentialsInstalled,
        certificationPassed,
        issues,
        metadata: freeze({ partnerName, ...details }),
    });
}
function buildHealth(partnerName, state) {
    return new PartnerHealth({
        partnerName,
        healthy: state.approved && state.credentialsInstalled && state.certificationPassed,
        activated: state.activationState === "Active",
        checkedAt: nowIso(),
        details: freeze({
            partnerName,
            approvalState: state.approvalState,
            activationState: state.activationState,
            certificationState: state.certificationStatus.status,
            credentialsInstalled: state.credentialsInstalled,
            approved: state.approved,
            certificationPassed: state.certificationPassed,
        }),
    });
}
function buildCompliance(partnerName, state) {
    return new ComplianceTracking({
        partnerName,
        compliant: state.approved && state.credentialsInstalled && state.certificationPassed,
        trackedAt: nowIso(),
        details: freeze({
            partnerName,
            approvalState: state.approvalState,
            certificationStatus: state.certificationStatus.status,
        }),
    });
}
function buildState(partnerName, overrides = {}) {
    const featureFlags = freeze({
        metadataValidation: true,
        assetValidation: true,
        statusSync: true,
        reporting: true,
        ...(overrides.capabilityMatrix?.featureFlags ?? {}),
    });
    const capabilityMatrix = overrides.capabilityMatrix ?? createDefaultCapabilityMatrix(partnerName, featureFlags);
    const environment = overrides.environment ?? "sandbox";
    const environmentConfiguration = overrides.environmentConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, environment, capabilityMatrix.featureFlags);
    const sandboxConfiguration = (overrides.sandboxConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, "sandbox", capabilityMatrix.featureFlags));
    const productionConfiguration = (overrides.productionConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, "production", capabilityMatrix.featureFlags));
    const versionTracking = overrides.versionTracking ?? createDefaultVersionTracking(partnerName);
    const approved = overrides.approved ?? false;
    const credentialsInstalled = overrides.credentialsInstalled ?? false;
    const certificationPassed = overrides.certificationPassed ?? false;
    const approvalState = overrides.approvalState ?? "Pending";
    const activationState = overrides.activationState ?? "Inactive";
    const certificationStatus = overrides.certificationStatus ?? createDefaultCertificationStatus(partnerName);
    const partnerMetadata = overrides.partnerMetadata ?? createDefaultMetadata(partnerName);
    const requirements = overrides.requirements ?? [];
    const checklist = overrides.checklist ?? null;
    const validationRules = overrides.validationRules ?? [];
    const complianceTracking = overrides.complianceTracking ?? createDefaultComplianceTracking(partnerName, approved, credentialsInstalled, certificationPassed);
    return Object.freeze({
        partnerName,
        displayName: overrides.displayName ?? partnerName,
        environment,
        approvalState,
        activationState,
        approved,
        credentialsInstalled,
        certificationPassed,
        versionTracking,
        capabilityMatrix,
        environmentConfiguration,
        sandboxConfiguration,
        productionConfiguration,
        partnerMetadata,
        contact: overrides.contact ?? null,
        agreement: overrides.agreement ?? null,
        certificationStatus,
        complianceTracking,
        requirements,
        checklist,
        validationRules,
        createdAt: overrides.createdAt ?? nowIso(),
        updatedAt: overrides.updatedAt ?? nowIso(),
        details: freeze({ partnerName, ...(overrides.details ?? {}) }),
    });
}
function createMetricRecord(partnerName, name, value = 1, tags = {}) {
    return new PartnerMetricRecord({
        metricId: `${partnerName}:metric:${name}:${Date.now().toString(36)}`,
        partnerName,
        name,
        value,
        recordedAt: nowIso(),
        tags,
        metadata: freeze({ partnerName, metricName: name }),
    });
}
function createAuditEntry(partnerName, eventType, metadata = {}, actor) {
    return new PartnerAuditEntry({
        auditId: `${partnerName}:audit:${eventType}:${Date.now().toString(36)}`,
        partnerName,
        eventType,
        occurredAt: nowIso(),
        actor: actor ?? null,
        metadata: freeze({ partnerName, eventType, ...metadata }),
    });
}
function createEventRecord(partnerName, eventType, metadata = {}) {
    return new PartnerEventRecord({
        eventId: `${partnerName}:event:${eventType}:${Date.now().toString(36)}`,
        partnerName,
        eventType,
        occurredAt: nowIso(),
        metadata: freeze({ partnerName, eventType, ...metadata }),
    });
}
function createObservabilityMetric(partnerName, name, value) {
    const normalized = name.toLowerCase();
    const category = normalized.includes("latency")
        ? "Latency"
        : normalized.includes("failure")
            ? "Failures"
            : normalized.includes("retry")
                ? "Retries"
                : "Throughput";
    return new Metric({
        metricId: `${partnerName}:obs:${name}:${Date.now().toString(36)}`,
        name,
        category,
        value,
        unit: null,
        recordedAt: nowIso(),
        tags: { partnerName, name },
        metadata: { partnerName, name },
    });
}
function createObservabilityLog(partnerName, level, message, context = {}) {
    return new LogEntry({
        logId: `${partnerName}:log:${Date.now().toString(36)}`,
        level,
        message,
        source: "partner-onboarding",
        occurredAt: nowIso(),
        traceId: null,
        spanId: null,
        metadata: freeze({ partnerName, ...context }),
    });
}
function createObservabilityAudit(partnerName, eventType) {
    return new AuditEvent({
        auditId: `${partnerName}:obs-audit:${eventType}:${Date.now().toString(36)}`,
        source: "partner-onboarding",
        eventType,
        occurredAt: nowIso(),
        actor: null,
        metadata: { partnerName, eventType },
    });
}
export class PartnerOnboardingRuntimeEngine {
    repositories;
    dependencies;
    constructor(repositories, dependencies) {
        this.repositories = repositories;
        this.dependencies = dependencies;
        for (const partnerName of OFFICIAL_DSP_PARTNERS) {
            if (!this.states.has(partnerName)) {
                this.states.set(partnerName, buildState(partnerName));
            }
        }
    }
    get states() {
        return this.repositories.states;
    }
    get credentials() {
        return this.repositories.credentials;
    }
    get documentation() {
        return this.repositories.documentation;
    }
    get contacts() {
        return this.repositories.contacts;
    }
    get agreements() {
        return this.repositories.agreements;
    }
    get metadata() {
        return this.repositories.metadata;
    }
    get requirements() {
        return this.repositories.requirements;
    }
    get checklists() {
        return this.repositories.checklists;
    }
    get validationRules() {
        return this.repositories.validationRules;
    }
    audits = [];
    events = [];
    metricRecords = [];
    assertKnownPartner(partnerName) {
        const trimmed = ensure(partnerName, "partnerName");
        if (!OFFICIAL_DSP_PARTNERS.includes(trimmed)) {
            throw new Error(`Unsupported official DSP partner: ${trimmed}`);
        }
        return trimmed;
    }
    state(partnerName) {
        const state = this.states.get(partnerName);
        if (!state) {
            const created = buildState(partnerName);
            this.states.set(partnerName, created);
            return created;
        }
        return state;
    }
    persist(state) {
        const readiness = createReadiness(state.partnerName, state.approved, state.credentialsInstalled, state.certificationPassed, {
            environment: state.environment,
            approvalState: state.approvalState,
            activationState: state.activationState,
            version: state.versionTracking.version,
        });
        const profile = new PartnerProfile({
            partnerName: state.partnerName,
            displayName: state.displayName,
            environment: state.environment,
            approvalState: state.approvalState,
            activationState: state.activationState,
            approved: state.approved,
            credentialsInstalled: state.credentialsInstalled,
            certificationPassed: state.certificationPassed,
            versionTracking: state.versionTracking,
            capabilityMatrix: state.capabilityMatrix,
            environmentConfiguration: state.environmentConfiguration,
            sandboxConfiguration: state.sandboxConfiguration,
            productionConfiguration: state.productionConfiguration,
            partnerMetadata: state.partnerMetadata,
            contact: state.contact,
            agreement: state.agreement,
            certificationStatus: state.certificationStatus,
            complianceTracking: state.complianceTracking,
            readiness,
            createdAt: state.createdAt,
            updatedAt: nowIso(),
            details: state.details,
        });
        this.states.set(state.partnerName, Object.freeze({
            ...state,
            updatedAt: profile.updatedAt,
        }));
        this.increment(createMetricRecord(state.partnerName, "partner_state_persisted"));
        this.record(createAuditEntry(state.partnerName, "PartnerStatePersisted", { readiness: profile.readiness.ready }));
        this.publish(createEventRecord(state.partnerName, "PartnerStatePersisted", { readiness: profile.readiness.ready }));
        return profile;
    }
    withState(partnerName, mutator) {
        const nextState = mutator(this.state(partnerName));
        this.states.set(partnerName, nextState);
        return this.persist(nextState);
    }
    register(profile) {
        const partnerName = this.assertKnownPartner(profile.partnerName);
        const nextState = buildState(partnerName, {
            displayName: profile.displayName,
            environment: profile.environment,
            approvalState: profile.approvalState,
            activationState: profile.activationState,
            approved: profile.approved,
            credentialsInstalled: profile.credentialsInstalled,
            certificationPassed: profile.certificationPassed,
            versionTracking: profile.versionTracking,
            capabilityMatrix: profile.capabilityMatrix,
            environmentConfiguration: profile.environmentConfiguration,
            sandboxConfiguration: profile.sandboxConfiguration,
            productionConfiguration: profile.productionConfiguration,
            partnerMetadata: profile.partnerMetadata,
            contact: profile.contact,
            agreement: profile.agreement,
            certificationStatus: profile.certificationStatus,
            complianceTracking: profile.complianceTracking,
            requirements: profile.readiness.issues.map((issue) => new PartnerRequirement({
                partnerName,
                requirementId: issue.code,
                description: issue.message,
                satisfied: false,
                metadata: freeze({ severity: issue.severity }),
            })),
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            details: profile.details,
        });
        this.states.set(partnerName, nextState);
        this.record(createAuditEntry(partnerName, "PartnerRegistered"));
        this.publish(createEventRecord(partnerName, "PartnerRegistered"));
    }
    resolve(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        return this.persist(this.state(name));
    }
    list() {
        return Object.freeze(OFFICIAL_DSP_PARTNERS.map((partnerName) => this.persist(this.state(partnerName))));
    }
    install(credentials) {
        const partnerName = this.assertKnownPartner(credentials.partnerName);
        this.credentials.set(partnerName, credentials);
        this.withState(partnerName, (state) => Object.freeze({
            ...state,
            credentialsInstalled: credentials.credentialsInstalled,
            activationState: state.approved && credentials.credentialsInstalled && state.certificationPassed ? "Active" : state.activationState,
            updatedAt: nowIso(),
            details: freeze({ ...state.details, credentialsId: credentials.credentialsId }),
        }));
        this.increment(createMetricRecord(partnerName, "partner_credentials_installed"));
        this.record(createAuditEntry(partnerName, "PartnerCredentialsInstalled"));
        this.publish(createEventRecord(partnerName, "PartnerCredentialsInstalled"));
        void this.emitObservability(partnerName, "info", "partner credentials installed", { credentialsId: credentials.credentialsId });
    }
    rotate(partnerName, credentials) {
        const name = this.assertKnownPartner(partnerName);
        this.credentials.set(name, credentials);
        this.withState(name, (state) => Object.freeze({
            ...state,
            credentialsInstalled: true,
            updatedAt: nowIso(),
            details: freeze({ ...state.details, rotatedCredentialsId: credentials.credentialsId }),
        }));
        this.increment(createMetricRecord(name, "partner_credentials_rotated"));
        this.record(createAuditEntry(name, "PartnerCredentialsRotated"));
        this.publish(createEventRecord(name, "PartnerCredentialsRotated"));
    }
    resolveCredentials(partnerName) {
        return this.credentials.get(this.assertKnownPartner(partnerName)) ?? null;
    }
    listCredentials() {
        return Object.freeze([...this.credentials.values()]);
    }
    registerDocumentation(documentation) {
        const partnerName = this.assertKnownPartner(documentation.partnerName);
        this.documentation.set(partnerName, documentation);
        this.record(createAuditEntry(partnerName, "PartnerDocumentationRegistered"));
        this.publish(createEventRecord(partnerName, "PartnerDocumentationRegistered"));
    }
    resolveDocumentation(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        return this.documentation.get(name) ?? null;
    }
    listDocumentation() {
        return Object.freeze([...this.documentation.values()]);
    }
    isPartnerApproved(partnerName) {
        return this.state(this.assertKnownPartner(partnerName)).approved;
    }
    hasCredentialsInstalled(partnerName) {
        return Boolean(this.credentials.get(this.assertKnownPartner(partnerName))?.credentialsInstalled);
    }
    hasCertificationPassed(partnerName) {
        return this.state(this.assertKnownPartner(partnerName)).certificationPassed;
    }
    isPartnerActive(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        const state = this.state(name);
        return state.approved && state.credentialsInstalled && state.certificationPassed && state.activationState === "Active";
    }
    readiness(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        const state = this.state(name);
        const readiness = createReadiness(name, state.approved, state.credentialsInstalled, state.certificationPassed, {
            activationState: state.activationState,
            environment: state.environment,
            version: state.versionTracking.version,
        });
        return new PartnerReadinessReport({
            partnerName: name,
            ready: readiness.ready,
            approved: readiness.approved,
            credentialsInstalled: readiness.credentialsInstalled,
            certificationPassed: readiness.certificationPassed,
            issues: readiness.issues,
            generatedAt: nowIso(),
            metadata: freeze({
                partnerName: name,
                approvalState: state.approvalState,
                activationState: state.activationState,
            }),
        });
    }
    health(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        return buildHealth(name, this.state(name));
    }
    compliance(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        const state = this.state(name);
        return buildCompliance(name, state);
    }
    record(entry) {
        this.audits.push(entry);
        void this.emitObservability(entry.partnerName, "info", `partner audit ${entry.eventType}`, entry.metadata);
    }
    listAudits(partnerName) {
        if (!partnerName) {
            return Object.freeze([...this.audits]);
        }
        const name = this.assertKnownPartner(partnerName);
        return Object.freeze(this.audits.filter((entry) => entry.partnerName === name));
    }
    publish(event) {
        this.events.push(event);
        void this.emitObservability(event.partnerName, "debug", `partner event ${event.eventType}`, event.metadata);
    }
    listEvents(partnerName) {
        if (!partnerName) {
            return Object.freeze([...this.events]);
        }
        const name = this.assertKnownPartner(partnerName);
        return Object.freeze(this.events.filter((event) => event.partnerName === name));
    }
    increment(metric) {
        this.metricRecords.push(metric);
        void this.emitObservabilityMetric(metric.partnerName, metric.name, metric.value);
    }
    listMetrics(partnerName) {
        if (!partnerName) {
            return Object.freeze([...this.metricRecords]);
        }
        const name = this.assertKnownPartner(partnerName);
        return Object.freeze(this.metricRecords.filter((metric) => metric.partnerName === name));
    }
    debug(message, context) {
        void this.emitLog("debug", message, context ?? {});
    }
    info(message, context) {
        void this.emitLog("info", message, context ?? {});
    }
    warn(message, context) {
        void this.emitLog("warn", message, context ?? {});
    }
    error(message, context) {
        void this.emitLog("error", message, context ?? {});
    }
    check(componentId) {
        const partnerName = this.assertKnownPartner(componentId);
        return this.health(partnerName);
    }
    registerContact(contact) {
        const partnerName = this.assertKnownPartner(contact.partnerName);
        this.contacts.set(partnerName, contact);
        this.withState(partnerName, (state) => Object.freeze({ ...state, contact, updatedAt: nowIso(), details: freeze({ ...state.details, contactName: contact.contactName }) }));
        this.record(createAuditEntry(partnerName, "PartnerContactRegistered"));
    }
    resolveContact(partnerName) {
        return this.contacts.get(this.assertKnownPartner(partnerName)) ?? null;
    }
    registerAgreement(agreement) {
        const partnerName = this.assertKnownPartner(agreement.partnerName);
        this.agreements.set(partnerName, agreement);
        this.withState(partnerName, (state) => Object.freeze({ ...state, agreement, updatedAt: nowIso(), details: freeze({ ...state.details, agreementId: agreement.agreementId }) }));
        this.record(createAuditEntry(partnerName, "PartnerAgreementRegistered"));
    }
    resolveAgreement(partnerName) {
        return this.agreements.get(this.assertKnownPartner(partnerName)) ?? null;
    }
    registerMetadata(metadata) {
        const partnerName = this.assertKnownPartner(metadata.partnerName);
        this.metadata.set(partnerName, metadata);
        this.withState(partnerName, (state) => Object.freeze({ ...state, partnerMetadata: metadata, updatedAt: nowIso() }));
        this.record(createAuditEntry(partnerName, "PartnerMetadataRegistered"));
    }
    resolveMetadata(partnerName) {
        return this.metadata.get(this.assertKnownPartner(partnerName)) ?? null;
    }
    configureEnvironment(partnerName, environment) {
        const name = this.assertKnownPartner(partnerName);
        this.withState(name, (state) => Object.freeze({ ...state, environment, updatedAt: nowIso() }));
        this.increment(createMetricRecord(name, "partner_environment_configured"));
    }
    setApproval(partnerName, approval) {
        const name = this.assertKnownPartner(partnerName);
        const nextApprovalState = typeof approval === "string" ? approval : approval.approved ? "Approved" : "Pending";
        const approved = typeof approval === "string" ? approval === "Approved" : approval.approved;
        this.withState(name, (state) => Object.freeze({
            ...state,
            approvalState: nextApprovalState,
            approved,
            activationState: approved && state.credentialsInstalled && state.certificationPassed ? "Active" : state.activationState,
            updatedAt: nowIso(),
            details: freeze({ ...state.details, approvalId: typeof approval === "string" ? null : approval.approvalId }),
        }));
        this.record(createAuditEntry(name, "PartnerApprovalUpdated", { approved }));
    }
    setCertification(partnerName, certification) {
        const name = this.assertKnownPartner(partnerName);
        const certificationStatus = typeof certification === "string"
            ? new CertificationStatus({ partnerName: name, status: certification, passedAt: certification === "Passed" ? nowIso() : null, expiresAt: null, details: freeze({ partnerName: name, update: "state" }) })
            : certification;
        const certificationPassed = certificationStatus.status === "Passed";
        this.withState(name, (state) => Object.freeze({
            ...state,
            certificationStatus,
            certificationPassed,
            activationState: state.approved && state.credentialsInstalled && certificationPassed ? "Active" : state.activationState,
            updatedAt: nowIso(),
            details: freeze({ ...state.details, certificationStatus: certificationStatus.status }),
        }));
        this.record(createAuditEntry(name, "PartnerCertificationUpdated", { certificationStatus: certificationStatus.status }));
    }
    setFeatureFlags(partnerName, flags) {
        const name = this.assertKnownPartner(partnerName);
        const nextFlags = flags instanceof FeatureFlags ? flags.flags : flags;
        this.withState(name, (state) => Object.freeze({
            ...state,
            capabilityMatrix: new PartnerCapabilityMatrix({
                partnerName: name,
                categories: state.capabilityMatrix.categories,
                featureFlags: freeze({ ...state.capabilityMatrix.featureFlags, ...nextFlags }),
                environments: state.capabilityMatrix.environments,
                requirements: state.capabilityMatrix.requirements,
                metadata: freeze({ ...state.capabilityMatrix.metadata, featureFlagsUpdated: true }),
            }),
            updatedAt: nowIso(),
        }));
        this.increment(createMetricRecord(name, "partner_feature_flags_updated"));
    }
    setCapabilityMatrix(matrix) {
        const name = this.assertKnownPartner(matrix.partnerName);
        this.withState(name, (state) => Object.freeze({ ...state, capabilityMatrix: matrix, updatedAt: nowIso() }));
        this.record(createAuditEntry(name, "PartnerCapabilityMatrixUpdated"));
    }
    setEnvironmentConfiguration(configuration) {
        const name = this.assertKnownPartner(configuration.partnerName);
        this.withState(name, (state) => Object.freeze({
            ...state,
            environmentConfiguration: configuration.environment === "production" ? state.environmentConfiguration : configuration,
            sandboxConfiguration: configuration.environment === "sandbox" ? configuration : state.sandboxConfiguration,
            productionConfiguration: configuration.environment === "production" ? configuration : state.productionConfiguration,
            updatedAt: nowIso(),
        }));
    }
    setVersionTracking(version) {
        const name = this.assertKnownPartner(version.partnerName);
        this.withState(name, (state) => Object.freeze({ ...state, versionTracking: version, updatedAt: nowIso() }));
        this.increment(createMetricRecord(name, "partner_version_updated"));
    }
    setRequirements(partnerName, requirements) {
        const name = this.assertKnownPartner(partnerName);
        this.requirements.set(name, Object.freeze([...requirements]));
        this.withState(name, (state) => Object.freeze({ ...state, requirements: Object.freeze([...requirements]), updatedAt: nowIso() }));
    }
    setChecklist(partnerName, checklist) {
        const name = this.assertKnownPartner(partnerName);
        this.checklists.set(name, checklist);
        this.withState(name, (state) => Object.freeze({ ...state, checklist, updatedAt: nowIso() }));
    }
    setValidationRule(rule) {
        const name = this.assertKnownPartner(rule.partnerName);
        const current = this.validationRules.get(name) ?? [];
        this.validationRules.set(name, Object.freeze([...current, rule]));
        this.withState(name, (state) => Object.freeze({ ...state, validationRules: this.validationRules.get(name) ?? [], updatedAt: nowIso() }));
    }
    activate(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        const current = this.state(name);
        const ready = current.approved && current.credentialsInstalled && current.certificationPassed;
        const nextState = Object.freeze({
            ...current,
            activationState: ready ? "Active" : "Inactive",
            updatedAt: nowIso(),
            details: freeze({ ...current.details, activationRequested: true, ready }),
        });
        this.states.set(name, nextState);
        this.record(createAuditEntry(name, "PartnerActivationRequested", { ready }));
        this.increment(createMetricRecord(name, "partner_activation_requested"));
        return this.persist(nextState);
    }
    deactivate(partnerName, reason) {
        const name = this.assertKnownPartner(partnerName);
        return this.withState(name, (state) => Object.freeze({
            ...state,
            activationState: "Paused",
            updatedAt: nowIso(),
            details: freeze({ ...state.details, deactivatedReason: reason ?? null }),
        }));
    }
    refreshPartner(partnerName) {
        const name = this.assertKnownPartner(partnerName);
        if (!this.states.has(name)) {
            return null;
        }
        return this.persist(this.state(name));
    }
    createValidator() {
        const validatorId = "partner-onboarding-readiness";
        return {
            validatorId,
            validate: (context) => {
                const activePartners = this.list().filter((profile) => profile.approved || profile.credentialsInstalled || profile.certificationPassed);
                const errors = [];
                const warnings = [];
                for (const profile of activePartners) {
                    if (!profile.approved) {
                        warnings.push(new ValidationWarning({
                            warningId: `${profile.partnerName}:approval`,
                            code: "PARTNER_APPROVAL_PENDING",
                            message: `Partner approval pending for ${profile.partnerName}`,
                            validator: validatorId,
                            details: { partnerName: profile.partnerName },
                            metadata: { partnerName: profile.partnerName },
                        }));
                    }
                    if (profile.approved && !profile.credentialsInstalled) {
                        errors.push(new ValidationError({
                            errorId: `${profile.partnerName}:credentials`,
                            code: "PARTNER_CREDENTIALS_MISSING",
                            message: `Credentials are not installed for ${profile.partnerName}`,
                            validator: validatorId,
                            severity: "Error",
                            details: { partnerName: profile.partnerName },
                            metadata: { partnerName: profile.partnerName },
                        }));
                    }
                    if (profile.approved && profile.credentialsInstalled && !profile.certificationPassed) {
                        errors.push(new ValidationError({
                            errorId: `${profile.partnerName}:certification`,
                            code: "PARTNER_CERTIFICATION_REQUIRED",
                            message: `Certification has not passed for ${profile.partnerName}`,
                            validator: validatorId,
                            severity: "Error",
                            details: { partnerName: profile.partnerName },
                            metadata: { partnerName: profile.partnerName },
                        }));
                    }
                }
                const valid = errors.length === 0;
                return new ValidationResult({
                    resultId: `${validatorId}:result:${Date.now().toString(36)}`,
                    validator: validatorId,
                    valid,
                    errors,
                    warnings,
                    checkedAt: nowIso(),
                    metadata: { partnerCount: this.states.size, contextId: context.contextId },
                });
            },
        };
    }
    emitLog(level, message, context) {
        const partnerName = typeof context.partnerName === "string" ? this.assertKnownPartner(context.partnerName) : null;
        const log = createObservabilityLog(partnerName ?? "Spotify", level, message, context);
        this.dependencies.logger?.log(log);
    }
    emitObservabilityMetric(partnerName, name, value) {
        this.dependencies.metrics?.record(createObservabilityMetric(partnerName, name, value));
    }
    emitObservability(partnerName, level, message, context) {
        const log = createObservabilityLog(partnerName, level, message, context);
        this.dependencies.logger?.log(log);
        this.dependencies.auditService?.record(createObservabilityAudit(partnerName, message));
    }
}
export class PartnerOnboardingRegistry {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    register(profile) {
        this.runtime.register(profile);
    }
    resolve(partnerName) {
        return this.runtime.resolve(partnerName);
    }
    list() {
        return this.runtime.list();
    }
}
export class PartnerOnboardingCredentialsStore {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    install(credentials) {
        this.runtime.install(credentials);
    }
    rotate(partnerName, credentials) {
        this.runtime.rotate(partnerName, credentials);
    }
    resolve(partnerName) {
        return this.runtime.resolveCredentials(partnerName);
    }
    list() {
        return this.runtime.listCredentials();
    }
}
export class PartnerOnboardingDocumentationRegistry {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    registerDocumentation(documentation) {
        this.runtime.registerDocumentation(documentation);
    }
    resolveDocumentation(partnerName) {
        return this.runtime.resolveDocumentation(partnerName);
    }
    listDocumentation() {
        return this.runtime.listDocumentation();
    }
}
export class PartnerOnboardingActivationResolver {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    isPartnerApproved(partnerName) {
        return this.runtime.isPartnerApproved(partnerName);
    }
    hasCredentialsInstalled(partnerName) {
        return this.runtime.hasCredentialsInstalled(partnerName);
    }
    hasCertificationPassed(partnerName) {
        return this.runtime.hasCertificationPassed(partnerName);
    }
    isPartnerActive(partnerName) {
        return this.runtime.isPartnerActive(partnerName);
    }
    readiness(partnerName) {
        return this.runtime.readiness(partnerName);
    }
    health(partnerName) {
        return this.runtime.health(partnerName);
    }
    compliance(partnerName) {
        return this.runtime.compliance(partnerName);
    }
    check(componentId) {
        return this.runtime.check(componentId);
    }
}
export class TrackSyraPartnerOnboardingRuntime {
    runtime;
    registry;
    credentialsStore;
    documentationRegistry;
    activationResolver;
    constructor(runtime, registry, credentialsStore, documentationRegistry, activationResolver) {
        this.runtime = runtime;
        this.registry = registry;
        this.credentialsStore = credentialsStore;
        this.documentationRegistry = documentationRegistry;
        this.activationResolver = activationResolver;
    }
    resolve(partnerName) {
        return this.runtime.resolve(partnerName);
    }
    list() {
        return this.runtime.list();
    }
    install(credentials) {
        this.runtime.install(credentials);
    }
    rotate(partnerName, credentials) {
        this.runtime.rotate(partnerName, credentials);
    }
    resolveCredentials(partnerName) {
        return this.runtime.resolveCredentials(partnerName);
    }
    listCredentials() {
        return this.runtime.listCredentials();
    }
    register(profile) {
        this.runtime.register(profile);
    }
    registerDocumentation(documentation) {
        this.runtime.registerDocumentation(documentation);
    }
    resolveDocumentation(partnerName) {
        return this.runtime.resolveDocumentation(partnerName);
    }
    listDocumentation() {
        return this.runtime.listDocumentation();
    }
    isPartnerApproved(partnerName) {
        return this.runtime.isPartnerApproved(partnerName);
    }
    hasCredentialsInstalled(partnerName) {
        return this.runtime.hasCredentialsInstalled(partnerName);
    }
    hasCertificationPassed(partnerName) {
        return this.runtime.hasCertificationPassed(partnerName);
    }
    isPartnerActive(partnerName) {
        return this.runtime.isPartnerActive(partnerName);
    }
    readiness(partnerName) {
        return this.runtime.readiness(partnerName);
    }
    health(partnerName) {
        return this.runtime.health(partnerName);
    }
    compliance(partnerName) {
        return this.runtime.compliance(partnerName);
    }
    record(entry) {
        this.runtime.record(entry);
    }
    listAudits(partnerName) {
        return this.runtime.listAudits(partnerName);
    }
    publish(event) {
        this.runtime.publish(event);
    }
    listEvents(partnerName) {
        return this.runtime.listEvents(partnerName);
    }
    increment(metric) {
        this.runtime.increment(metric);
    }
    listMetrics(partnerName) {
        return this.runtime.listMetrics(partnerName);
    }
    debug(message, context) {
        this.runtime.debug(message, context);
    }
    info(message, context) {
        this.runtime.info(message, context);
    }
    warn(message, context) {
        this.runtime.warn(message, context);
    }
    error(message, context) {
        this.runtime.error(message, context);
    }
    check(componentId) {
        return this.runtime.check(componentId);
    }
    registerContact(contact) {
        this.runtime.registerContact(contact);
    }
    resolveContact(partnerName) {
        return this.runtime.resolveContact(partnerName);
    }
    registerAgreement(agreement) {
        this.runtime.registerAgreement(agreement);
    }
    resolveAgreement(partnerName) {
        return this.runtime.resolveAgreement(partnerName);
    }
    registerMetadata(metadata) {
        this.runtime.registerMetadata(metadata);
    }
    resolveMetadata(partnerName) {
        return this.runtime.resolveMetadata(partnerName);
    }
    configureEnvironment(partnerName, environment) {
        this.runtime.configureEnvironment(partnerName, environment);
    }
    setApproval(partnerName, approval) {
        this.runtime.setApproval(partnerName, approval);
    }
    setCertification(partnerName, certification) {
        this.runtime.setCertification(partnerName, certification);
    }
    setFeatureFlags(partnerName, flags) {
        this.runtime.setFeatureFlags(partnerName, flags);
    }
    setCapabilityMatrix(matrix) {
        this.runtime.setCapabilityMatrix(matrix);
    }
    setEnvironmentConfiguration(configuration) {
        this.runtime.setEnvironmentConfiguration(configuration);
    }
    setVersionTracking(version) {
        this.runtime.setVersionTracking(version);
    }
    setRequirements(partnerName, requirements) {
        this.runtime.setRequirements(partnerName, requirements);
    }
    setChecklist(partnerName, checklist) {
        this.runtime.setChecklist(partnerName, checklist);
    }
    setValidationRule(rule) {
        this.runtime.setValidationRule(rule);
    }
    activate(partnerName) {
        return this.runtime.activate(partnerName);
    }
    deactivate(partnerName, reason) {
        return this.runtime.deactivate(partnerName, reason ?? null);
    }
    refreshPartner(partnerName) {
        return this.runtime.refreshPartner(partnerName);
    }
    createValidator() {
        return this.runtime.createValidator();
    }
}
