import type { AuditService, HealthChecker, Logger, MetricsCollector } from "../../observability/contracts/observabilityContracts";
import { AuditEvent } from "../../observability/audit/auditEvent";
import { LogEntry } from "../../observability/logging/logEntry";
import { Metric } from "../../observability/metrics/metric";
import { ValidationContext, ValidationError, ValidationResult, ValidationWarning } from "../../validation/types/validationTypes";
import type { Validator } from "../../validation/contracts/validationContracts";
import {
  OfficialDspPartnerName,
  PartnerAgreement,
  PartnerAuditEntry,
  PartnerCertificationState,
  PartnerContact,
  PartnerCredentials,
  PartnerDocumentationRecord,
  PartnerEnvironment,
  PartnerHealth,
  PartnerMetadata,
  PartnerMetricRecord,
  PartnerProfile,
  PartnerReadiness,
  PartnerReadinessReport,
  PartnerActivationState,
  PartnerApprovalState,
  PartnerCapabilityCategory,
  PartnerCapabilityMatrix,
  PartnerEventRecord,
  PartnerFeatureFlags,
  PartnerMetadataMap,
  PartnerRequirement,
  CertificationChecklist,
  CertificationStatus,
  ComplianceTracking,
  EnvironmentConfiguration,
  FeatureFlags,
  IntegrationApproval,
  SandboxConfiguration,
  ProductionConfiguration,
  ValidationRule,
  VersionTracking,
  OFFICIAL_DSP_PARTNERS,
  PartnerIssue,
} from "../types/partnerOnboardingTypes";
import type {
  PartnerActivationGate,
  PartnerAuditTrail,
  PartnerCredentialsStore,
  PartnerDocumentationRegistry,
  PartnerEventLog,
  PartnerLogger,
  PartnerMetrics,
  PartnerOnboardingDependencies,
  PartnerOnboardingRuntime,
  PartnerReadinessService,
  PartnerRegistry,
} from "../contracts/partnerOnboardingContracts";
import type { RuntimeRepository } from "../../infrastructure/repositories/runtime";

type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

type PartnerState = Readonly<{
  partnerName: OfficialDspPartnerName;
  displayName: string;
  environment: PartnerEnvironment;
  approvalState: PartnerApprovalState;
  activationState: PartnerActivationState;
  approved: boolean;
  credentialsInstalled: boolean;
  certificationPassed: boolean;
  versionTracking: VersionTracking;
  capabilityMatrix: PartnerCapabilityMatrix;
  environmentConfiguration: EnvironmentConfiguration;
  sandboxConfiguration: SandboxConfiguration;
  productionConfiguration: ProductionConfiguration;
  partnerMetadata: PartnerMetadata;
  contact: PartnerContact | null;
  agreement: PartnerAgreement | null;
  certificationStatus: CertificationStatus;
  complianceTracking: ComplianceTracking;
  requirements: readonly PartnerRequirement[];
  checklist: CertificationChecklist | null;
  validationRules: readonly ValidationRule[];
  createdAt: string;
  updatedAt: string;
  details: PartnerMetadataMap;
}>;

export type PartnerRepositoryBundle = Readonly<{
  states: RuntimeRepository<OfficialDspPartnerName, PartnerState>;
  credentials: RuntimeRepository<OfficialDspPartnerName, PartnerCredentials>;
  documentation: RuntimeRepository<OfficialDspPartnerName, PartnerDocumentationRecord>;
  contacts: RuntimeRepository<OfficialDspPartnerName, PartnerContact>;
  agreements: RuntimeRepository<OfficialDspPartnerName, PartnerAgreement>;
  metadata: RuntimeRepository<OfficialDspPartnerName, PartnerMetadata>;
  requirements: RuntimeRepository<OfficialDspPartnerName, readonly PartnerRequirement[]>;
  checklists: RuntimeRepository<OfficialDspPartnerName, CertificationChecklist>;
  validationRules: RuntimeRepository<OfficialDspPartnerName, readonly ValidationRule[]>;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function partnerCategories(partnerName: OfficialDspPartnerName): readonly PartnerCapabilityCategory[] {
  if (partnerName === "TikTok" || partnerName === "Meta" || partnerName === "YouTubeMusic") {
    return Object.freeze(["Music", "Video", "Territories", "Languages", "Monetization", "Royalty Reporting", "Webhooks", "Polling"] as readonly PartnerCapabilityCategory[]);
  }
  return Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting", "Webhooks", "Polling", "Takedown"] as readonly PartnerCapabilityCategory[]);
}

function createDefaultCapabilityMatrix(partnerName: OfficialDspPartnerName, featureFlags: PartnerFeatureFlags): PartnerCapabilityMatrix {
  return new PartnerCapabilityMatrix({
    partnerName,
    categories: partnerCategories(partnerName),
    featureFlags,
    environments: Object.freeze(["sandbox", "production"] as const),
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

function createDefaultEnvironmentConfiguration(partnerName: OfficialDspPartnerName, environment: PartnerEnvironment, featureFlags: PartnerFeatureFlags): EnvironmentConfiguration {
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

function createDefaultMetadata(partnerName: OfficialDspPartnerName): PartnerMetadata {
  return new PartnerMetadata({
    partnerName,
    metadataId: `${partnerName}:metadata`,
    notes: "Official DSP partner onboarding record",
    documentationReferences: [],
    details: freeze({ partnerName, seeded: true }),
  });
}

function createDefaultVersionTracking(partnerName: OfficialDspPartnerName): VersionTracking {
  return new VersionTracking({
    partnerName,
    version: "1.0.0",
    details: freeze({ partnerName, seedVersion: true }),
  });
}

function createDefaultCertificationStatus(partnerName: OfficialDspPartnerName): CertificationStatus {
  return new CertificationStatus({
    partnerName,
    status: "Pending",
    passedAt: null,
    expiresAt: null,
    details: freeze({ partnerName, seeded: true }),
  });
}

function createDefaultComplianceTracking(partnerName: OfficialDspPartnerName, approved: boolean, credentialsInstalled: boolean, certificationPassed: boolean): ComplianceTracking {
  return new ComplianceTracking({
    partnerName,
    compliant: approved && credentialsInstalled && certificationPassed,
    trackedAt: nowIso(),
    details: freeze({ partnerName, seeded: true }),
  });
}

function createReadiness(partnerName: OfficialDspPartnerName, approved: boolean, credentialsInstalled: boolean, certificationPassed: boolean, details: PartnerMetadataMap = {}): PartnerReadiness {
  const issues: PartnerIssue[] = [];
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

function buildHealth(partnerName: OfficialDspPartnerName, state: PartnerState): PartnerHealth {
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

function buildCompliance(partnerName: OfficialDspPartnerName, state: PartnerState): ComplianceTracking {
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

function buildState(partnerName: OfficialDspPartnerName, overrides: Partial<PartnerState> = {}): PartnerState {
  const featureFlags = freeze({
    metadataValidation: true,
    assetValidation: true,
    statusSync: true,
    reporting: true,
    ...((overrides.capabilityMatrix?.featureFlags ?? {}) as Record<string, boolean>),
  });
  const capabilityMatrix = overrides.capabilityMatrix ?? createDefaultCapabilityMatrix(partnerName, featureFlags);
  const environment = overrides.environment ?? "sandbox";
  const environmentConfiguration = overrides.environmentConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, environment, capabilityMatrix.featureFlags);
  const sandboxConfiguration = (overrides.sandboxConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, "sandbox", capabilityMatrix.featureFlags)) as SandboxConfiguration;
  const productionConfiguration = (overrides.productionConfiguration ?? createDefaultEnvironmentConfiguration(partnerName, "production", capabilityMatrix.featureFlags)) as ProductionConfiguration;
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

function createMetricRecord(partnerName: OfficialDspPartnerName, name: string, value = 1, tags: Readonly<Record<string, string | number | boolean>> = {}): PartnerMetricRecord {
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

function createAuditEntry(partnerName: OfficialDspPartnerName, eventType: string, metadata: PartnerMetadataMap = {}, actor?: string | null): PartnerAuditEntry {
  return new PartnerAuditEntry({
    auditId: `${partnerName}:audit:${eventType}:${Date.now().toString(36)}`,
    partnerName,
    eventType,
    occurredAt: nowIso(),
    actor: actor ?? null,
    metadata: freeze({ partnerName, eventType, ...metadata }),
  });
}

function createEventRecord(partnerName: OfficialDspPartnerName, eventType: string, metadata: PartnerMetadataMap = {}): PartnerEventRecord {
  return new PartnerEventRecord({
    eventId: `${partnerName}:event:${eventType}:${Date.now().toString(36)}`,
    partnerName,
    eventType,
    occurredAt: nowIso(),
    metadata: freeze({ partnerName, eventType, ...metadata }),
  });
}

function createObservabilityMetric(partnerName: OfficialDspPartnerName, name: string, value: number): Metric {
  const normalized = name.toLowerCase();
  const category: Metric["category"] = normalized.includes("latency")
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

function createObservabilityLog(partnerName: OfficialDspPartnerName, level: RuntimeLogLevel, message: string, context: Readonly<Record<string, unknown>> = {}): LogEntry {
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

function createObservabilityAudit(partnerName: OfficialDspPartnerName, eventType: string): AuditEvent {
  return new AuditEvent({
    auditId: `${partnerName}:obs-audit:${eventType}:${Date.now().toString(36)}`,
    source: "partner-onboarding",
    eventType,
    occurredAt: nowIso(),
    actor: null,
    metadata: { partnerName, eventType },
  });
}

export class PartnerOnboardingRuntimeEngine implements PartnerOnboardingRuntime {
  constructor(
    private readonly repositories: PartnerRepositoryBundle,
    private readonly dependencies: PartnerOnboardingDependencies,
  ) {
    for (const partnerName of OFFICIAL_DSP_PARTNERS) {
      if (!this.states.has(partnerName)) {
        this.states.set(partnerName, buildState(partnerName));
      }
    }
  }

  private get states(): PartnerRepositoryBundle["states"] {
    return this.repositories.states;
  }

  private get credentials(): PartnerRepositoryBundle["credentials"] {
    return this.repositories.credentials;
  }

  private get documentation(): PartnerRepositoryBundle["documentation"] {
    return this.repositories.documentation;
  }

  private get contacts(): PartnerRepositoryBundle["contacts"] {
    return this.repositories.contacts;
  }

  private get agreements(): PartnerRepositoryBundle["agreements"] {
    return this.repositories.agreements;
  }

  private get metadata(): PartnerRepositoryBundle["metadata"] {
    return this.repositories.metadata;
  }

  private get requirements(): PartnerRepositoryBundle["requirements"] {
    return this.repositories.requirements;
  }

  private get checklists(): PartnerRepositoryBundle["checklists"] {
    return this.repositories.checklists;
  }

  private get validationRules(): PartnerRepositoryBundle["validationRules"] {
    return this.repositories.validationRules;
  }
  private readonly audits: PartnerAuditEntry[] = [];
  private readonly events: PartnerEventRecord[] = [];
  private readonly metricRecords: PartnerMetricRecord[] = [];

  private assertKnownPartner(partnerName: string): OfficialDspPartnerName {
    const trimmed = ensure(partnerName, "partnerName");
    if (!OFFICIAL_DSP_PARTNERS.includes(trimmed as OfficialDspPartnerName)) {
      throw new Error(`Unsupported official DSP partner: ${trimmed}`);
    }
    return trimmed as OfficialDspPartnerName;
  }

  private state(partnerName: OfficialDspPartnerName): PartnerState {
    const state = this.states.get(partnerName);
    if (!state) {
      const created = buildState(partnerName);
      this.states.set(partnerName, created);
      return created;
    }
    return state;
  }

  private persist(state: PartnerState): PartnerProfile {
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
    }) as PartnerState);
    this.increment(createMetricRecord(state.partnerName, "partner_state_persisted"));
    this.record(createAuditEntry(state.partnerName, "PartnerStatePersisted", { readiness: profile.readiness.ready }));
    this.publish(createEventRecord(state.partnerName, "PartnerStatePersisted", { readiness: profile.readiness.ready }));
    return profile;
  }

  private withState(partnerName: OfficialDspPartnerName, mutator: (state: PartnerState) => PartnerState): PartnerProfile {
    const nextState = mutator(this.state(partnerName));
    this.states.set(partnerName, nextState);
    return this.persist(nextState);
  }

  register(profile: PartnerProfile): void {
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

  resolve(partnerName: OfficialDspPartnerName): PartnerProfile | null {
    const name = this.assertKnownPartner(partnerName);
    return this.persist(this.state(name));
  }

  list(): readonly PartnerProfile[] {
    return Object.freeze(OFFICIAL_DSP_PARTNERS.map((partnerName) => this.persist(this.state(partnerName))));
  }

  install(credentials: PartnerCredentials): void {
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

  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): void {
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

  resolveCredentials(partnerName: OfficialDspPartnerName): PartnerCredentials | null {
    return this.credentials.get(this.assertKnownPartner(partnerName)) ?? null;
  }

  listCredentials(): readonly PartnerCredentials[] {
    return Object.freeze([...this.credentials.values()]);
  }

  registerDocumentation(documentation: PartnerDocumentationRecord): void {
    const partnerName = this.assertKnownPartner(documentation.partnerName);
    this.documentation.set(partnerName, documentation);
    this.record(createAuditEntry(partnerName, "PartnerDocumentationRegistered"));
    this.publish(createEventRecord(partnerName, "PartnerDocumentationRegistered"));
  }

  resolveDocumentation(partnerName: OfficialDspPartnerName): PartnerDocumentationRecord | null {
    const name = this.assertKnownPartner(partnerName);
    return this.documentation.get(name) ?? null;
  }

  listDocumentation(): readonly PartnerDocumentationRecord[] {
    return Object.freeze([...this.documentation.values()]);
  }

  isPartnerApproved(partnerName: OfficialDspPartnerName): boolean {
    return this.state(this.assertKnownPartner(partnerName)).approved;
  }

  hasCredentialsInstalled(partnerName: OfficialDspPartnerName): boolean {
    return Boolean(this.credentials.get(this.assertKnownPartner(partnerName))?.credentialsInstalled);
  }

  hasCertificationPassed(partnerName: OfficialDspPartnerName): boolean {
    return this.state(this.assertKnownPartner(partnerName)).certificationPassed;
  }

  isPartnerActive(partnerName: OfficialDspPartnerName): boolean {
    const name = this.assertKnownPartner(partnerName);
    const state = this.state(name);
    return state.approved && state.credentialsInstalled && state.certificationPassed && state.activationState === "Active";
  }

  readiness(partnerName: OfficialDspPartnerName): PartnerReadinessReport {
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

  health(partnerName: OfficialDspPartnerName): PartnerHealth {
    const name = this.assertKnownPartner(partnerName);
    return buildHealth(name, this.state(name));
  }

  compliance(partnerName: OfficialDspPartnerName): ComplianceTracking {
    const name = this.assertKnownPartner(partnerName);
    const state = this.state(name);
    return buildCompliance(name, state);
  }

  record(entry: PartnerAuditEntry): void {
    this.audits.push(entry);
    void this.emitObservability(entry.partnerName, "info", `partner audit ${entry.eventType}`, entry.metadata);
  }

  listAudits(partnerName?: OfficialDspPartnerName): readonly PartnerAuditEntry[] {
    if (!partnerName) {
      return Object.freeze([...this.audits]);
    }
    const name = this.assertKnownPartner(partnerName);
    return Object.freeze(this.audits.filter((entry) => entry.partnerName === name));
  }

  publish(event: PartnerEventRecord): void {
    this.events.push(event);
    void this.emitObservability(event.partnerName, "debug", `partner event ${event.eventType}`, event.metadata);
  }

  listEvents(partnerName?: OfficialDspPartnerName): readonly PartnerEventRecord[] {
    if (!partnerName) {
      return Object.freeze([...this.events]);
    }
    const name = this.assertKnownPartner(partnerName);
    return Object.freeze(this.events.filter((event) => event.partnerName === name));
  }

  increment(metric: PartnerMetricRecord): void {
    this.metricRecords.push(metric);
    void this.emitObservabilityMetric(metric.partnerName, metric.name, metric.value);
  }

  listMetrics(partnerName?: OfficialDspPartnerName): readonly PartnerMetricRecord[] {
    if (!partnerName) {
      return Object.freeze([...this.metricRecords]);
    }
    const name = this.assertKnownPartner(partnerName);
    return Object.freeze(this.metricRecords.filter((metric) => metric.partnerName === name));
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    void this.emitLog("debug", message, context ?? {});
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    void this.emitLog("info", message, context ?? {});
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    void this.emitLog("warn", message, context ?? {});
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    void this.emitLog("error", message, context ?? {});
  }

  check(componentId: string): PartnerHealth {
    const partnerName = this.assertKnownPartner(componentId);
    return this.health(partnerName);
  }

  registerContact(contact: PartnerContact): void {
    const partnerName = this.assertKnownPartner(contact.partnerName);
    this.contacts.set(partnerName, contact);
    this.withState(partnerName, (state) => Object.freeze({ ...state, contact, updatedAt: nowIso(), details: freeze({ ...state.details, contactName: contact.contactName }) }));
    this.record(createAuditEntry(partnerName, "PartnerContactRegistered"));
  }

  resolveContact(partnerName: OfficialDspPartnerName): PartnerContact | null {
    return this.contacts.get(this.assertKnownPartner(partnerName)) ?? null;
  }

  registerAgreement(agreement: PartnerAgreement): void {
    const partnerName = this.assertKnownPartner(agreement.partnerName);
    this.agreements.set(partnerName, agreement);
    this.withState(partnerName, (state) => Object.freeze({ ...state, agreement, updatedAt: nowIso(), details: freeze({ ...state.details, agreementId: agreement.agreementId }) }));
    this.record(createAuditEntry(partnerName, "PartnerAgreementRegistered"));
  }

  resolveAgreement(partnerName: OfficialDspPartnerName): PartnerAgreement | null {
    return this.agreements.get(this.assertKnownPartner(partnerName)) ?? null;
  }

  registerMetadata(metadata: PartnerMetadata): void {
    const partnerName = this.assertKnownPartner(metadata.partnerName);
    this.metadata.set(partnerName, metadata);
    this.withState(partnerName, (state) => Object.freeze({ ...state, partnerMetadata: metadata, updatedAt: nowIso() }));
    this.record(createAuditEntry(partnerName, "PartnerMetadataRegistered"));
  }

  resolveMetadata(partnerName: OfficialDspPartnerName): PartnerMetadata | null {
    return this.metadata.get(this.assertKnownPartner(partnerName)) ?? null;
  }

  configureEnvironment(partnerName: OfficialDspPartnerName, environment: PartnerEnvironment): void {
    const name = this.assertKnownPartner(partnerName);
    this.withState(name, (state) => Object.freeze({ ...state, environment, updatedAt: nowIso() }));
    this.increment(createMetricRecord(name, "partner_environment_configured"));
  }

  setApproval(partnerName: OfficialDspPartnerName, approval: IntegrationApproval | PartnerApprovalState): void {
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

  setCertification(partnerName: OfficialDspPartnerName, certification: CertificationStatus | PartnerCertificationState): void {
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

  setFeatureFlags(partnerName: OfficialDspPartnerName, flags: PartnerFeatureFlags | FeatureFlags): void {
    const name = this.assertKnownPartner(partnerName);
    const nextFlags: PartnerFeatureFlags = flags instanceof FeatureFlags ? flags.flags : flags;
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

  setCapabilityMatrix(matrix: PartnerCapabilityMatrix): void {
    const name = this.assertKnownPartner(matrix.partnerName);
    this.withState(name, (state) => Object.freeze({ ...state, capabilityMatrix: matrix, updatedAt: nowIso() }));
    this.record(createAuditEntry(name, "PartnerCapabilityMatrixUpdated"));
  }

  setEnvironmentConfiguration(configuration: EnvironmentConfiguration | SandboxConfiguration | ProductionConfiguration): void {
    const name = this.assertKnownPartner(configuration.partnerName);
    this.withState(name, (state) => Object.freeze({
      ...state,
      environmentConfiguration: configuration.environment === "production" ? state.environmentConfiguration : configuration,
      sandboxConfiguration: configuration.environment === "sandbox" ? configuration : state.sandboxConfiguration,
      productionConfiguration: configuration.environment === "production" ? configuration : state.productionConfiguration,
      updatedAt: nowIso(),
    }));
  }

  setVersionTracking(version: VersionTracking): void {
    const name = this.assertKnownPartner(version.partnerName);
    this.withState(name, (state) => Object.freeze({ ...state, versionTracking: version, updatedAt: nowIso() }));
    this.increment(createMetricRecord(name, "partner_version_updated"));
  }

  setRequirements(partnerName: OfficialDspPartnerName, requirements: readonly PartnerRequirement[]): void {
    const name = this.assertKnownPartner(partnerName);
    this.requirements.set(name, Object.freeze([...requirements]));
    this.withState(name, (state) => Object.freeze({ ...state, requirements: Object.freeze([...requirements]), updatedAt: nowIso() }));
  }

  setChecklist(partnerName: OfficialDspPartnerName, checklist: CertificationChecklist): void {
    const name = this.assertKnownPartner(partnerName);
    this.checklists.set(name, checklist);
    this.withState(name, (state) => Object.freeze({ ...state, checklist, updatedAt: nowIso() }));
  }

  setValidationRule(rule: ValidationRule): void {
    const name = this.assertKnownPartner(rule.partnerName);
    const current = this.validationRules.get(name) ?? [];
    this.validationRules.set(name, Object.freeze([...current, rule]));
    this.withState(name, (state) => Object.freeze({ ...state, validationRules: this.validationRules.get(name) ?? [], updatedAt: nowIso() }));
  }

  activate(partnerName: OfficialDspPartnerName): PartnerProfile {
    const name = this.assertKnownPartner(partnerName);
    const current = this.state(name);
    const ready = current.approved && current.credentialsInstalled && current.certificationPassed;
    const nextState = Object.freeze({
      ...current,
      activationState: ready ? "Active" : "Inactive",
      updatedAt: nowIso(),
      details: freeze({ ...current.details, activationRequested: true, ready }),
    }) as PartnerState;
    this.states.set(name, nextState);
    this.record(createAuditEntry(name, "PartnerActivationRequested", { ready }));
    this.increment(createMetricRecord(name, "partner_activation_requested"));
    return this.persist(nextState);
  }

  deactivate(partnerName: OfficialDspPartnerName, reason?: string | null): PartnerProfile {
    const name = this.assertKnownPartner(partnerName);
    return this.withState(name, (state) => Object.freeze({
      ...state,
      activationState: "Paused",
      updatedAt: nowIso(),
      details: freeze({ ...state.details, deactivatedReason: reason ?? null }),
    }));
  }

  refreshPartner(partnerName: OfficialDspPartnerName): PartnerProfile | null {
    const name = this.assertKnownPartner(partnerName);
    if (!this.states.has(name)) {
      return null;
    }
    return this.persist(this.state(name));
  }

  createValidator(): Validator {
    const validatorId = "partner-onboarding-readiness";
    return {
      validatorId,
      validate: (context: ValidationContext): ValidationResult => {
        const activePartners = this.list().filter((profile) => profile.approved || profile.credentialsInstalled || profile.certificationPassed);
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
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

  private emitLog(level: RuntimeLogLevel, message: string, context: Readonly<Record<string, unknown>>): void {
    const partnerName = typeof context.partnerName === "string" ? this.assertKnownPartner(context.partnerName) : null;
    const log = createObservabilityLog(partnerName ?? "Spotify", level, message, context);
    this.dependencies.logger?.log(log);
  }

  private emitObservabilityMetric(partnerName: OfficialDspPartnerName, name: string, value: number): void {
    this.dependencies.metrics?.record(createObservabilityMetric(partnerName, name, value));
  }

  private emitObservability(partnerName: OfficialDspPartnerName, level: RuntimeLogLevel, message: string, context: Readonly<Record<string, unknown>>): void {
    const log = createObservabilityLog(partnerName, level, message, context);
    this.dependencies.logger?.log(log);
    this.dependencies.auditService?.record(createObservabilityAudit(partnerName, message));
  }
}

export class PartnerOnboardingRegistry implements PartnerRegistry {
  constructor(private readonly runtime: PartnerOnboardingRuntimeEngine) {}

  register(profile: PartnerProfile): void {
    this.runtime.register(profile);
  }

  resolve(partnerName: OfficialDspPartnerName): PartnerProfile | null {
    return this.runtime.resolve(partnerName);
  }

  list(): readonly PartnerProfile[] {
    return this.runtime.list();
  }
}

export class PartnerOnboardingCredentialsStore implements PartnerCredentialsStore {
  constructor(private readonly runtime: PartnerOnboardingRuntimeEngine) {}

  install(credentials: PartnerCredentials): void {
    this.runtime.install(credentials);
  }

  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): void {
    this.runtime.rotate(partnerName, credentials);
  }

  resolve(partnerName: OfficialDspPartnerName): PartnerCredentials | null {
    return this.runtime.resolveCredentials(partnerName);
  }

  list(): readonly PartnerCredentials[] {
    return this.runtime.listCredentials();
  }
}

export class PartnerOnboardingDocumentationRegistry implements PartnerDocumentationRegistry {
  constructor(private readonly runtime: PartnerOnboardingRuntimeEngine) {}

  registerDocumentation(documentation: PartnerDocumentationRecord): void {
    this.runtime.registerDocumentation(documentation);
  }

  resolveDocumentation(partnerName: OfficialDspPartnerName): PartnerDocumentationRecord | null {
    return this.runtime.resolveDocumentation(partnerName);
  }

  listDocumentation(): readonly PartnerDocumentationRecord[] {
    return this.runtime.listDocumentation();
  }
}

export class PartnerOnboardingActivationResolver implements PartnerActivationGate, PartnerReadinessService {
  constructor(private readonly runtime: PartnerOnboardingRuntimeEngine) {}

  isPartnerApproved(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.isPartnerApproved(partnerName);
  }

  hasCredentialsInstalled(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.hasCredentialsInstalled(partnerName);
  }

  hasCertificationPassed(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.hasCertificationPassed(partnerName);
  }

  isPartnerActive(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.isPartnerActive(partnerName);
  }

  readiness(partnerName: OfficialDspPartnerName): PartnerReadinessReport {
    return this.runtime.readiness(partnerName);
  }

  health(partnerName: OfficialDspPartnerName): PartnerHealth {
    return this.runtime.health(partnerName);
  }

  compliance(partnerName: OfficialDspPartnerName): ComplianceTracking {
    return this.runtime.compliance(partnerName);
  }

  check(componentId: string): PartnerHealth {
    return this.runtime.check(componentId);
  }
}

export class TrackSyraPartnerOnboardingRuntime implements PartnerOnboardingRuntime {
  readonly registry: PartnerOnboardingRegistry;
  readonly credentialsStore: PartnerOnboardingCredentialsStore;
  readonly documentationRegistry: PartnerOnboardingDocumentationRegistry;
  readonly activationResolver: PartnerOnboardingActivationResolver;

  constructor(
    private readonly runtime: PartnerOnboardingRuntimeEngine,
    registry: PartnerOnboardingRegistry,
    credentialsStore: PartnerOnboardingCredentialsStore,
    documentationRegistry: PartnerOnboardingDocumentationRegistry,
    activationResolver: PartnerOnboardingActivationResolver,
  ) {
    this.registry = registry;
    this.credentialsStore = credentialsStore;
    this.documentationRegistry = documentationRegistry;
    this.activationResolver = activationResolver;
  }

  resolve(partnerName: OfficialDspPartnerName): PartnerProfile | null {
    return this.runtime.resolve(partnerName);
  }

  list(): readonly PartnerProfile[] {
    return this.runtime.list();
  }

  install(credentials: PartnerCredentials): void {
    this.runtime.install(credentials);
  }

  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): void {
    this.runtime.rotate(partnerName, credentials);
  }

  resolveCredentials(partnerName: OfficialDspPartnerName): PartnerCredentials | null {
    return this.runtime.resolveCredentials(partnerName);
  }

  listCredentials(): readonly PartnerCredentials[] {
    return this.runtime.listCredentials();
  }

  register(profile: PartnerProfile): void {
    this.runtime.register(profile);
  }

  registerDocumentation(documentation: PartnerDocumentationRecord): void {
    this.runtime.registerDocumentation(documentation);
  }

  resolveDocumentation(partnerName: OfficialDspPartnerName): PartnerDocumentationRecord | null {
    return this.runtime.resolveDocumentation(partnerName);
  }

  listDocumentation(): readonly PartnerDocumentationRecord[] {
    return this.runtime.listDocumentation();
  }

  isPartnerApproved(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.isPartnerApproved(partnerName);
  }

  hasCredentialsInstalled(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.hasCredentialsInstalled(partnerName);
  }

  hasCertificationPassed(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.hasCertificationPassed(partnerName);
  }

  isPartnerActive(partnerName: OfficialDspPartnerName): boolean {
    return this.runtime.isPartnerActive(partnerName);
  }

  readiness(partnerName: OfficialDspPartnerName): PartnerReadinessReport {
    return this.runtime.readiness(partnerName);
  }

  health(partnerName: OfficialDspPartnerName): PartnerHealth {
    return this.runtime.health(partnerName);
  }

  compliance(partnerName: OfficialDspPartnerName): ComplianceTracking {
    return this.runtime.compliance(partnerName);
  }

  record(entry: PartnerAuditEntry): void {
    this.runtime.record(entry);
  }

  listAudits(partnerName?: OfficialDspPartnerName): readonly PartnerAuditEntry[] {
    return this.runtime.listAudits(partnerName);
  }

  publish(event: PartnerEventRecord): void {
    this.runtime.publish(event);
  }

  listEvents(partnerName?: OfficialDspPartnerName): readonly PartnerEventRecord[] {
    return this.runtime.listEvents(partnerName);
  }

  increment(metric: PartnerMetricRecord): void {
    this.runtime.increment(metric);
  }

  listMetrics(partnerName?: OfficialDspPartnerName): readonly PartnerMetricRecord[] {
    return this.runtime.listMetrics(partnerName);
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.debug(message, context);
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.info(message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.warn(message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.runtime.error(message, context);
  }

  check(componentId: string): PartnerHealth {
    return this.runtime.check(componentId);
  }

  registerContact(contact: PartnerContact): void {
    this.runtime.registerContact(contact);
  }

  resolveContact(partnerName: OfficialDspPartnerName): PartnerContact | null {
    return this.runtime.resolveContact(partnerName);
  }

  registerAgreement(agreement: PartnerAgreement): void {
    this.runtime.registerAgreement(agreement);
  }

  resolveAgreement(partnerName: OfficialDspPartnerName): PartnerAgreement | null {
    return this.runtime.resolveAgreement(partnerName);
  }

  registerMetadata(metadata: PartnerMetadata): void {
    this.runtime.registerMetadata(metadata);
  }

  resolveMetadata(partnerName: OfficialDspPartnerName): PartnerMetadata | null {
    return this.runtime.resolveMetadata(partnerName);
  }

  configureEnvironment(partnerName: OfficialDspPartnerName, environment: PartnerEnvironment): void {
    this.runtime.configureEnvironment(partnerName, environment);
  }

  setApproval(partnerName: OfficialDspPartnerName, approval: IntegrationApproval | PartnerApprovalState): void {
    this.runtime.setApproval(partnerName, approval);
  }

  setCertification(partnerName: OfficialDspPartnerName, certification: CertificationStatus | PartnerCertificationState): void {
    this.runtime.setCertification(partnerName, certification);
  }

  setFeatureFlags(partnerName: OfficialDspPartnerName, flags: PartnerFeatureFlags | FeatureFlags): void {
    this.runtime.setFeatureFlags(partnerName, flags);
  }

  setCapabilityMatrix(matrix: PartnerCapabilityMatrix): void {
    this.runtime.setCapabilityMatrix(matrix);
  }

  setEnvironmentConfiguration(configuration: EnvironmentConfiguration | SandboxConfiguration | ProductionConfiguration): void {
    this.runtime.setEnvironmentConfiguration(configuration);
  }

  setVersionTracking(version: VersionTracking): void {
    this.runtime.setVersionTracking(version);
  }

  setRequirements(partnerName: OfficialDspPartnerName, requirements: readonly PartnerRequirement[]): void {
    this.runtime.setRequirements(partnerName, requirements);
  }

  setChecklist(partnerName: OfficialDspPartnerName, checklist: CertificationChecklist): void {
    this.runtime.setChecklist(partnerName, checklist);
  }

  setValidationRule(rule: ValidationRule): void {
    this.runtime.setValidationRule(rule);
  }

  activate(partnerName: OfficialDspPartnerName): PartnerProfile {
    return this.runtime.activate(partnerName);
  }

  deactivate(partnerName: OfficialDspPartnerName, reason?: string | null): PartnerProfile {
    return this.runtime.deactivate(partnerName, reason ?? null);
  }

  refreshPartner(partnerName: OfficialDspPartnerName): PartnerProfile | null {
    return this.runtime.refreshPartner(partnerName);
  }

  createValidator(): Validator {
    return this.runtime.createValidator();
  }
}
