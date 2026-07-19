import type { Logger, MetricsCollector, AuditService, HealthChecker } from "../../observability/contracts/observabilityContracts";
import type { ValidationContext, ValidationResult } from "../../validation/types/validationTypes";
import type {
  OfficialDspPartnerName,
  PartnerAgreement,
  PartnerAuditEntry,
  PartnerCertificationState,
  PartnerContact,
  PartnerCredentialPayload,
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
  PartnerCapabilityMatrix,
  PartnerCredentials,
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
  CredentialActivation,
} from "../types/partnerOnboardingTypes";

export interface PartnerRegistry {
  register(profile: PartnerProfile): void;
  resolve(partnerName: OfficialDspPartnerName): PartnerProfile | null;
  list(): readonly PartnerProfile[];
}

export interface PartnerCredentialsStore {
  install(credentials: PartnerCredentials): void;
  rotate(partnerName: OfficialDspPartnerName, credentials: PartnerCredentials): void;
  resolve(partnerName: OfficialDspPartnerName): PartnerCredentials | null;
  list(): readonly PartnerCredentials[];
}

export interface PartnerDocumentationRegistry {
  registerDocumentation(documentation: PartnerDocumentationRecord): void;
  resolveDocumentation(partnerName: OfficialDspPartnerName): PartnerDocumentationRecord | null;
  listDocumentation(): readonly PartnerDocumentationRecord[];
}

export interface PartnerActivationGate {
  isPartnerApproved(partnerName: OfficialDspPartnerName): boolean;
  hasCredentialsInstalled(partnerName: OfficialDspPartnerName): boolean;
  hasCertificationPassed(partnerName: OfficialDspPartnerName): boolean;
  isPartnerActive(partnerName: OfficialDspPartnerName): boolean;
}

export interface PartnerReadinessService {
  readiness(partnerName: OfficialDspPartnerName): PartnerReadinessReport;
  health(partnerName: OfficialDspPartnerName): PartnerHealth;
  compliance(partnerName: OfficialDspPartnerName): ComplianceTracking;
}

export interface PartnerAuditTrail {
  record(entry: PartnerAuditEntry): void;
  list(partnerName?: OfficialDspPartnerName): readonly PartnerAuditEntry[];
}

export interface PartnerEventLog {
  publish(event: PartnerEventRecord): void;
  list(partnerName?: OfficialDspPartnerName): readonly PartnerEventRecord[];
}

export interface PartnerMetrics {
  increment(metric: PartnerMetricRecord): void;
  list(partnerName?: OfficialDspPartnerName): readonly PartnerMetricRecord[];
}

export interface PartnerLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface PartnerOnboardingRuntime {
  list(): readonly PartnerProfile[];
}

export interface PartnerOnboardingDependencies {
  readonly logger?: Logger | null;
  readonly metrics?: MetricsCollector | null;
  readonly auditService?: AuditService | null;
  readonly healthChecker?: HealthChecker | null;
}

export interface PartnerOnboardingRuntimeFactory {
  create(dependencies?: PartnerOnboardingDependencies | null): PartnerOnboardingRuntime;
}
