import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Validator } from "../contracts/validationContracts";
import type { ValidationEvent } from "../events/validationEvents";
import {
  ValidationBucketKey,
  ValidationContext,
  ValidationError,
  ValidationMetadata,
  ValidationResult,
  ValidationScope,
  ValidationWarning,
} from "../types/validationTypes";

function nowIso(): string {
  return new Date().toISOString();
}

function freezeMetadata<T extends ValidationMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? Object.freeze(value.map((item) => item.trim()).filter(Boolean))
    : Object.freeze([]);
}

function validationSections(context: ValidationContext): Readonly<Record<ValidationBucketKey, Readonly<Record<string, unknown>> | null>> {
  return Object.freeze({
    composition: context.composition,
    bootstrap: context.bootstrap,
    workflow: context.workflow,
    orchestrator: context.orchestrator,
    execution: context.execution,
    queue: context.queue,
    runtime: context.runtime,
    provider: context.provider,
    connectors: context.connectors,
    statusSync: context.statusSync,
    royalty: context.royalty,
    observability: context.observability,
    security: context.security,
    authentication: context.authentication,
    storage: context.storage,
    repository: context.repository,
    unitOfWork: context.unitOfWork,
    health: context.health,
    recovery: context.recovery,
    checkpoint: context.checkpoint,
    projection: context.projection,
    audit: context.audit,
    metrics: context.metrics,
    logging: context.logging,
    trace: context.trace,
    stateMachine: context.stateMachine,
    compensation: context.compensation,
    performance: context.performance,
    scalability: context.scalability,
    load: context.load,
    concurrency: context.concurrency,
    dataIntegrity: context.dataIntegrity,
  });
}

function sectionOf(context: ValidationContext, section: ValidationBucketKey): Readonly<Record<string, unknown>> | null {
  return validationSections(context)[section];
}

function createError(validator: string, code: string, message: string, details: Readonly<Record<string, unknown>> = {}, severity: "Error" | "Critical" = "Error"): ValidationError {
  return new ValidationError({
    errorId: `${validator}:error:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    code,
    message,
    validator,
    severity,
    details,
  });
}

function createWarning(validator: string, code: string, message: string, details: Readonly<Record<string, unknown>> = {}): ValidationWarning {
  return new ValidationWarning({
    warningId: `${validator}:warning:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    code,
    message,
    validator,
    details,
  });
}

function createResult(
  validatorId: string,
  scope: ValidationScope,
  valid: boolean,
  errors: readonly ValidationError[] = [],
  warnings: readonly ValidationWarning[] = [],
  metadata: ValidationMetadata = {},
): ValidationResult {
  return new ValidationResult({
    resultId: `${validatorId}:result:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    validator: validatorId,
    valid,
    errors,
    warnings,
    checkedAt: nowIso(),
    metadata: freezeMetadata({ ...metadata, scope }),
  });
}

function validateRequiredKeys(
  validatorId: string,
  scope: ValidationScope,
  context: ValidationContext,
  sectionName: ValidationBucketKey,
  requiredKeys: readonly string[],
  metadata: ValidationMetadata = {},
  extraWarnings: readonly ValidationWarning[] = [],
): ValidationResult {
  const section = sectionOf(context, sectionName);
  if (!isRecord(section)) {
    return createResult(validatorId, scope, false, [
      createError(validatorId, "SECTION_MISSING", `Validation section ${sectionName} is missing`, { sectionName }, "Critical"),
    ], extraWarnings, metadata);
  }
  const missing = requiredKeys.filter((key) => !(key in section));
  if (missing.length > 0) {
    return createResult(validatorId, scope, false, [
      createError(validatorId, "REQUIRED_KEYS_MISSING", `Validation section ${sectionName} is missing required keys`, { sectionName, missing }, "Critical"),
    ], extraWarnings, metadata);
  }
  return createResult(validatorId, scope, true, [], extraWarnings, metadata);
}

function validateListSection(
  validatorId: string,
  scope: ValidationScope,
  context: ValidationContext,
  sectionName: ValidationBucketKey,
  key: string,
  metadata: ValidationMetadata = {},
): ValidationResult {
  const section = sectionOf(context, sectionName);
  if (!isRecord(section)) {
    return createResult(validatorId, scope, false, [
      createError(validatorId, "SECTION_MISSING", `Validation section ${sectionName} is missing`, { sectionName }, "Critical"),
    ], [], metadata);
  }
  const values = stringList(section[key]);
  if (!values.length) {
    return createResult(validatorId, scope, false, [
      createError(validatorId, "LIST_EMPTY", `${sectionName}.${key} must contain at least one entry`, { sectionName, key }, "Critical"),
    ], [], metadata);
  }
  return createResult(validatorId, scope, true, [], [], metadata);
}

function validateGraphConsistency(validatorId: string, context: ValidationContext): ValidationResult {
  const graph = context.composition && isRecord(context.composition) ? context.composition.graph : null;
  if (!graph || typeof graph !== "object") {
    return createResult(validatorId, "Dependency", false, [createError(validatorId, "GRAPH_MISSING", "Dependency graph is missing", {}, "Critical")]);
  }
  const modules = Array.isArray((graph as { modules?: unknown }).modules) ? (graph as { modules: readonly { moduleName: string; dependencies?: readonly string[] }[] }).modules : [];
  if (!modules.length) {
    return createResult(validatorId, "Dependency", false, [createError(validatorId, "MODULES_MISSING", "Dependency graph contains no modules", {}, "Critical")]);
  }
  const seen = new Set<string>();
  const indexes = new Map<string, number>();
  modules.forEach((module, index) => {
    indexes.set(module.moduleName, index);
  });
  const duplicates = modules.filter((module) => {
    const duplicate = seen.has(module.moduleName);
    seen.add(module.moduleName);
    return duplicate;
  }).map((module) => module.moduleName);
  const orderingErrors: string[] = [];
  for (const module of modules) {
    for (const dependency of module.dependencies ?? []) {
      const dependencyIndex = indexes.get(dependency);
      if (dependencyIndex == null) {
        orderingErrors.push(`Missing dependency ${dependency} for ${module.moduleName}`);
      } else if (dependencyIndex > (indexes.get(module.moduleName) ?? -1)) {
        orderingErrors.push(`Dependency order violation: ${module.moduleName} depends on ${dependency}`);
      }
    }
  }
  if (duplicates.length || orderingErrors.length) {
    return createResult(validatorId, "Dependency", false, [
      createError(validatorId, "GRAPH_INCONSISTENT", "Dependency graph is inconsistent", { duplicates, orderingErrors }, "Critical"),
    ]);
  }
  return createResult(validatorId, "Dependency", true);
}

function validateBootstrapOrder(validatorId: string, context: ValidationContext): ValidationResult {
  const bootstrap = context.bootstrap;
  if (!isRecord(bootstrap)) {
    return createResult(validatorId, "Bootstrap", false, [createError(validatorId, "BOOTSTRAP_MISSING", "Bootstrap context is missing", {}, "Critical")]);
  }
  const planOrder = stringList((bootstrap as { plan?: { modules?: unknown } }).plan?.modules);
  const startupOrder = stringList((bootstrap as { startupSequence?: { modules?: unknown } }).startupSequence?.modules);
  const expected = planOrder.length ? planOrder : stringList((bootstrap as { startupOrder?: unknown }).startupOrder);
  if (!expected.length || !startupOrder.length) {
    return createResult(validatorId, "Bootstrap", false, [createError(validatorId, "STARTUP_ORDER_MISSING", "Bootstrap startup order is incomplete", {}, "Critical")]);
  }
  const mismatch = expected.some((module, index) => startupOrder[index] !== module);
  if (mismatch) {
    return createResult(validatorId, "Bootstrap", false, [createError(validatorId, "STARTUP_ORDER_INVALID", "Bootstrap startup order is inconsistent", { expected, actual: startupOrder }, "Critical")]);
  }
  return createResult(validatorId, "Bootstrap", true);
}

function validateStateMachine(validatorId: string, context: ValidationContext): ValidationResult {
  const stateMachine = context.stateMachine;
  if (!isRecord(stateMachine)) {
    return createResult(validatorId, "StateMachine", false, [createError(validatorId, "STATE_MACHINE_MISSING", "State machine context is missing", {}, "Critical")]);
  }
  const transitions = stringList((stateMachine as { transitions?: unknown }).transitions);
  const authority = String((stateMachine as { authority?: unknown }).authority ?? "").trim();
  const validAuthority = authority === "DistributionStateMachine" || authority === "StateMachine";
  if (!transitions.length || !validAuthority) {
    return createResult(validatorId, "StateMachine", false, [createError(validatorId, "STATE_MACHINE_INVALID", "State machine authority or transitions are invalid", { transitions, authority }, "Critical")]);
  }
  return createResult(validatorId, "StateMachine", true);
}

function validateSectionChain(
  validatorId: string,
  scope: ValidationScope,
  context: ValidationContext,
  sectionName: ValidationBucketKey,
  requiredKeys: readonly string[],
  metadata: ValidationMetadata = {},
): ValidationResult {
  return validateRequiredKeys(validatorId, scope, context, sectionName, requiredKeys, metadata);
}

abstract class BaseValidator implements Validator {
  abstract readonly validatorId: string;

  abstract validate(context: ValidationContext): ValidationResult;
}

export class PlatformValidator extends BaseValidator {
  readonly validatorId = "PlatformValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "composition", ["graph", "configuration"], context.metadata);
  }
}

export class RuntimeValidator extends BaseValidator {
  readonly validatorId = "RuntimeValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "runtime", ["registry", "pipeline", "scheduler", "coordinator"], context.metadata);
  }
}

export class WorkflowValidator extends BaseValidator {
  readonly validatorId = "WorkflowValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "workflow", ["stages", "transitions"], context.metadata);
  }
}

export class OrchestratorValidator extends BaseValidator {
  readonly validatorId = "OrchestratorValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "orchestrator", ["coordinators", "pipelines"], context.metadata);
  }
}

export class QueueValidator extends BaseValidator {
  readonly validatorId = "QueueValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "queue", ["registrations", "jobs", "dispatcher"], context.metadata);
  }
}

export class WorkerValidator extends BaseValidator {
  readonly validatorId = "WorkerValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "runtime", ["workers", "leases", "heartbeats"], context.metadata);
  }
}

export class ProviderValidator extends BaseValidator {
  readonly validatorId = "ProviderValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "provider", ["providers", "registrations", "health"], context.metadata);
  }
}

export class ConnectorValidator extends BaseValidator {
  readonly validatorId = "ConnectorValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "connectors", ["connectors", "capabilities", "registry"], context.metadata);
  }
}

export class StatusSyncValidator extends BaseValidator {
  readonly validatorId = "StatusSyncValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "statusSync", ["runtime", "validators", "timeline"], context.metadata);
  }
}

export class RoyaltyValidator extends BaseValidator {
  readonly validatorId = "RoyaltyValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "royalty", ["runtime", "ledger", "settlement", "statements"], context.metadata);
  }
}

export class ObservabilityValidator extends BaseValidator {
  readonly validatorId = "ObservabilityValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "observability", ["logger", "metrics", "tracing", "health"], context.metadata);
  }
}

export class BootstrapValidator extends BaseValidator {
  readonly validatorId = "BootstrapValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateBootstrapOrder(this.validatorId, context);
  }
}

export class CompositionValidator extends BaseValidator {
  readonly validatorId = "CompositionValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "composition", ["graph", "snapshot", "configuration"], context.metadata);
  }
}

export class DependencyValidator extends BaseValidator {
  readonly validatorId = "DependencyValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateGraphConsistency(this.validatorId, context);
  }
}

export class ConfigurationValidator extends BaseValidator {
  readonly validatorId = "ConfigurationValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "composition", ["configuration"], context.metadata);
  }
}

export class SecurityValidator extends BaseValidator {
  readonly validatorId = "SecurityValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "security", ["policies", "secrets"], context.metadata);
  }
}

export class StorageValidator extends BaseValidator {
  readonly validatorId = "StorageValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "storage", ["engine", "registry", "repository", "adapter", "serializer", "metrics", "logger", "health"], context.metadata);
  }
}

export class StorageConsistencyValidator extends BaseValidator {
  readonly validatorId = "StorageConsistencyValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "storage", ["consistency", "optimisticLocking", "transactionIntegrity", "checkpointRecovery", "snapshotRecovery", "migrationCompatibility", "versionCompatibility", "distributedOwnership"], context.metadata);
  }
}

export class RepositoryValidator extends BaseValidator {
  readonly validatorId = "RepositoryValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "repository", ["aggregateLoading", "aggregatePersistence", "optimisticLocking", "transactions", "snapshots", "eventReplay", "versionHistory", "incrementalPersistence", "batchPersistence", "streamingReads", "pagination", "filtering", "indexing"], context.metadata);
  }
}

export class RepositoryConsistencyValidator extends BaseValidator {
  readonly validatorId = "RepositoryConsistencyValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "repository", ["releaseAggregate", "deliveryAggregate", "workflowAggregate", "runtimeAggregate", "workerAggregate", "queueAggregate", "stateAggregate", "royaltyAggregate", "partnerAggregate", "credentialAggregate"], context.metadata);
  }
}

export class UnitOfWorkValidator extends BaseValidator {
  readonly validatorId = "UnitOfWorkValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "unitOfWork", ["manager", "factory", "scope", "transaction", "commit", "rollback", "savepoint", "versionTracker", "lockManager", "lifetimeManager"], context.metadata);
  }
}

export class AggregateIsolationValidator extends BaseValidator {
  readonly validatorId = "AggregateIsolationValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "unitOfWork", ["aggregateIsolation", "aggregateOwnership", "repositoryInjection", "transactionScope", "dependencyGraph"], context.metadata);
  }
}

function authenticationSnapshot(context: ValidationContext): Readonly<Record<string, unknown>> | null {
  const section = sectionOf(context, "authentication");
  return isRecord(section) ? section : null;
}

function authenticationErrors(validatorId: string, context: ValidationContext): ValidationError[] {
  const snapshot = authenticationSnapshot(context);
  const errors: ValidationError[] = [];
  if (!snapshot) {
    errors.push(createError(validatorId, "AUTHENTICATION_MISSING", "Authentication snapshot is missing", {}, "Critical"));
    return errors;
  }
  const invalidKeys = ["clientSecret", "refreshToken", "accessToken", "encryptionKey", "signingKey", "vaultIdentifier"].filter((key) => key in snapshot);
  if (invalidKeys.length) {
    errors.push(createError(validatorId, "SECRET_EXPOSURE", "Authentication snapshot exposes disallowed secret fields", { invalidKeys }, "Critical"));
  }
  if (typeof snapshot.partnerId !== "string" || !snapshot.partnerId.trim()) {
    errors.push(createError(validatorId, "PARTNER_ID_MISSING", "Authentication snapshot is missing partnerId", {}, "Critical"));
  }
  if (typeof snapshot.credentialId !== "string" || !snapshot.credentialId.trim()) {
    errors.push(createError(validatorId, "CREDENTIAL_ID_MISSING", "Authentication snapshot is missing credentialId", {}, "Critical"));
  }
  if (typeof snapshot.credentialVersion !== "string" || !snapshot.credentialVersion.trim()) {
    errors.push(createError(validatorId, "CREDENTIAL_VERSION_MISSING", "Authentication snapshot is missing credentialVersion", {}, "Critical"));
  }
  if (!Array.isArray(snapshot.approvedCapabilities) || snapshot.approvedCapabilities.some((value) => typeof value !== "string")) {
    errors.push(createError(validatorId, "CAPABILITIES_INVALID", "Authentication snapshot capabilities are invalid", {}, "Error"));
  }
  if (typeof snapshot.authenticationStatus !== "string" || !snapshot.authenticationStatus.trim()) {
    errors.push(createError(validatorId, "AUTHENTICATION_STATUS_MISSING", "Authentication snapshot is missing authenticationStatus", {}, "Error"));
  }
  return errors;
}

export class AuthenticationValidator extends BaseValidator {
  readonly validatorId = "AuthenticationValidator";
  validate(context: ValidationContext): ValidationResult {
    const errors = authenticationErrors(this.validatorId, context);
    return createResult(this.validatorId, "Authentication", errors.length === 0, errors);
  }
}

export class CredentialPropagationValidator extends BaseValidator {
  readonly validatorId = "CredentialPropagationValidator";
  validate(context: ValidationContext): ValidationResult {
    const errors = authenticationErrors(this.validatorId, context);
    if (errors.length) {
      return createResult(this.validatorId, "Authentication", false, errors);
    }
    const section = authenticationSnapshot(context);
    const propagated = Boolean(section && section.partnerId && section.credentialId && section.credentialVersion);
    return createResult(this.validatorId, "Authentication", propagated, propagated ? [] : [createError(this.validatorId, "CREDENTIAL_PROPAGATION_FAILED", "Authentication snapshot did not propagate", {}, "Critical")]);
  }
}

export class AuthenticationSnapshotValidator extends BaseValidator {
  readonly validatorId = "AuthenticationSnapshotValidator";
  validate(context: ValidationContext): ValidationResult {
    return createResult(this.validatorId, "Authentication", authenticationErrors(this.validatorId, context).length === 0, authenticationErrors(this.validatorId, context));
  }
}

export class CredentialVersionPinningValidator extends BaseValidator {
  readonly validatorId = "CredentialVersionPinningValidator";
  validate(context: ValidationContext): ValidationResult {
    const snapshot = authenticationSnapshot(context);
    const pinnedVersion = String(snapshot?.credentialVersion ?? "").trim();
    const pinned = Boolean(pinnedVersion && snapshot && snapshot.authenticationStatus !== "blocked");
    return createResult(this.validatorId, "Authentication", pinned, pinned ? [] : [createError(this.validatorId, "VERSION_PINNING_FAILED", "Credential version pinning failed", { pinnedVersion }, "Critical")]);
  }
}

export class RotationValidator extends BaseValidator {
  readonly validatorId = "RotationValidator";
  validate(context: ValidationContext): ValidationResult {
    const snapshot = authenticationSnapshot(context);
    const rotationVersion = String(snapshot?.rotationVersion ?? context.metadata.rotationVersion ?? "").trim();
    const valid = Boolean(snapshot && (rotationVersion || context.metadata.rotationVersion == null));
    return createResult(this.validatorId, "Authentication", valid, valid ? [] : [createError(this.validatorId, "ROTATION_INVALID", "Credential rotation state is invalid", { rotationVersion }, "Error")]);
  }
}

export class ResolverValidator extends BaseValidator {
  readonly validatorId = "ResolverValidator";
  validate(context: ValidationContext): ValidationResult {
    const valid = Boolean(authenticationSnapshot(context));
    return createResult(this.validatorId, "Authentication", valid, valid ? [] : [createError(this.validatorId, "RESOLVER_MISSING", "Credential resolver snapshot is missing", {}, "Critical")]);
  }
}

export class SecretExposureValidator extends BaseValidator {
  readonly validatorId = "SecretExposureValidator";
  validate(context: ValidationContext): ValidationResult {
    const snapshot = authenticationSnapshot(context);
    const errors: ValidationError[] = [];
    if (snapshot) {
      const exposed = Object.keys(snapshot).filter((key) => /secret|token|password|key|vault/i.test(key));
      if (exposed.length) {
        errors.push(createError(this.validatorId, "SECRET_EXPOSURE", "Authentication snapshot exposes secret fields", { exposed }, "Critical"));
      }
    }
    return createResult(this.validatorId, "Authentication", errors.length === 0, errors);
  }
}

export class RuntimeAuthenticationValidator extends BaseValidator {
  readonly validatorId = "RuntimeAuthenticationValidator";
  validate(context: ValidationContext): ValidationResult {
    const snapshot = authenticationSnapshot(context);
    const section = sectionOf(context, "runtime");
    const valid = Boolean(snapshot && isRecord(section));
    return createResult(this.validatorId, "Authentication", valid, valid ? [] : [createError(this.validatorId, "RUNTIME_AUTHENTICATION_INVALID", "Runtime authentication is invalid", {}, "Critical")]);
  }
}

export class HealthValidator extends BaseValidator {
  readonly validatorId = "HealthValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "health", ["readiness", "liveness", "components"], context.metadata);
  }
}

export class ReadinessValidator extends BaseValidator {
  readonly validatorId = "ReadinessValidator";
  validate(context: ValidationContext): ValidationResult {
    const section = sectionOf(context, "health");
    const ready = isRecord(section) && section.ready === true;
    return createResult(this.validatorId, context.scope, ready, ready ? [] : [createError(this.validatorId, "READINESS_NOT_READY", "Runtime is not ready", {}, "Critical")], [], context.metadata);
  }
}

export class StartupValidator extends BaseValidator {
  readonly validatorId = "StartupValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateBootstrapOrder(this.validatorId, context);
  }
}

export class ShutdownValidator extends BaseValidator {
  readonly validatorId = "ShutdownValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "bootstrap", ["shutdownSequence", "shutdownOrder"], context.metadata);
  }
}

export class DisasterRecoveryValidator extends BaseValidator {
  readonly validatorId = "DisasterRecoveryValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "recovery", ["plans", "failover", "rollback"], context.metadata);
  }
}

export class BackupValidator extends BaseValidator {
  readonly validatorId = "BackupValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "checkpoint", ["snapshots", "store"], context.metadata);
  }
}

export class RestoreValidator extends BaseValidator {
  readonly validatorId = "RestoreValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "recovery", ["restore", "replay"], context.metadata);
  }
}

export class FailoverValidator extends BaseValidator {
  readonly validatorId = "FailoverValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "recovery", ["failover"], context.metadata);
  }
}

export class ScalabilityValidator extends BaseValidator {
  readonly validatorId = "ScalabilityValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "scalability", ["parallelism", "capacity", "workers"], context.metadata);
  }
}

export class PerformanceValidator extends BaseValidator {
  readonly validatorId = "PerformanceValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "performance", ["latencies", "throughput"], context.metadata);
  }
}

export class LoadValidator extends BaseValidator {
  readonly validatorId = "LoadValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "load", ["capacity", "samples"], context.metadata);
  }
}

export class ConcurrencyValidator extends BaseValidator {
  readonly validatorId = "ConcurrencyValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "concurrency", ["limits", "strategy"], context.metadata);
  }
}

export class DataIntegrityValidator extends BaseValidator {
  readonly validatorId = "DataIntegrityValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "dataIntegrity", ["snapshots", "audit"], context.metadata);
  }
}

export class StateMachineValidator extends BaseValidator {
  readonly validatorId = "StateMachineValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateStateMachine(this.validatorId, context);
  }
}

export class EventReplayValidator extends BaseValidator {
  readonly validatorId = "EventReplayValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "recovery", ["replay", "eventStore"], context.metadata);
  }
}

export class ProjectionValidator extends BaseValidator {
  readonly validatorId = "ProjectionValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "projection", ["publishers", "snapshots"], context.metadata);
  }
}

export class SnapshotValidator extends BaseValidator {
  readonly validatorId = "SnapshotValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "checkpoint", ["snapshots", "store"], context.metadata);
  }
}

export class AuditValidator extends BaseValidator {
  readonly validatorId = "AuditValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "audit", ["entries", "timeline"], context.metadata);
  }
}

export class MetricsValidator extends BaseValidator {
  readonly validatorId = "MetricsValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "metrics", ["registry", "records"], context.metadata);
  }
}

export class LoggingValidator extends BaseValidator {
  readonly validatorId = "LoggingValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "logging", ["entries", "router"], context.metadata);
  }
}

export class TraceValidator extends BaseValidator {
  readonly validatorId = "TraceValidator";
  validate(context: ValidationContext): ValidationResult {
    return validateSectionChain(this.validatorId, context.scope, context, "trace", ["spans", "context"], context.metadata);
  }
}

export class ArchitectureAuditValidator extends BaseValidator {
  readonly validatorId = "ArchitectureAuditValidator";

  validate(context: ValidationContext): ValidationResult {
    const root = process.cwd();
    const targets = [
      "server/src/distribution/runtime/integration/workerRuntime.ts",
      "server/src/distribution/runtime/delivery/deliveryRuntime.ts",
      "server/src/distribution/provider-integration/runtime/nativeDspRuntime.ts",
      "server/src/distribution/royalty/runtime/royaltyRuntime.ts",
      "server/src/distribution/bootstrap/bootstrapManager.ts",
      "server/src/distribution/status-sync/stateSyncRuntime.ts",
    ];
    const forbiddenPatterns: readonly { code: string; pattern: RegExp }[] = [
      { code: "FALLBACK_CONSTRUCTOR", pattern: /constructor\([^)]*=\s*new\s+[A-Z]/s },
      { code: "OPTIONAL_DEPENDENCY", pattern: new RegExp("\\?:\\s*[A-Za-z0-9_<>,\\s\\[\\]|]+") },
      { code: "LAZY_INITIALIZATION", pattern: /lazy\s*=\s*|lazyLoading\s*\?/i },
      { code: "SERVICE_LOCATOR", pattern: /\bresolve\s*\(\s*['"][^'"]+['"]\s*\)/ },
      { code: "SINGLETON", pattern: /\bSingleton\b/ },
      { code: "RUNTIME_OWNED_REPOSITORY", pattern: /createRuntimeRepository\s*\(/ },
      { code: "RUNTIME_OWNED_STORAGE", pattern: /createDefaultDistributedCoordinationBundle\s*\(|new\s+[A-Za-z0-9_]*Storage/i },
      { code: "RUNTIME_OWNED_RUNTIME", pattern: /createTrackSyra[A-Za-z0-9_]*Runtime\s*\(/ },
      { code: "RUNTIME_OWNED_LOGGER", pattern: /new\s+[A-Za-z0-9_]*Logger(?![A-Za-z0-9_])/i },
      { code: "RUNTIME_OWNED_METRICS", pattern: /new\s+[A-Za-z0-9_]*Metrics(?![A-Za-z0-9_])/i },
      { code: "RUNTIME_OWNED_REGISTRY", pattern: /new\s+[A-Za-z0-9_]*Registry(?![A-Za-z0-9_])/i },
      { code: "RUNTIME_OWNED_SCHEDULER", pattern: /new\s+[A-Za-z0-9_]*Scheduler(?![A-Za-z0-9_])/i },
      { code: "RUNTIME_OWNED_PUBLISHER", pattern: /new\s+[A-Za-z0-9_]*Publisher(?![A-Za-z0-9_])/i },
      { code: "DEFAULT_HELPER_CREATION", pattern: /createDefault[A-Za-z0-9_]*\(/ },
    ];

    const findings: string[] = [];
    for (const target of targets) {
      const filePath = join(root, target);
      if (!existsSync(filePath)) {
        continue;
      }
      const source = readFileSync(filePath, "utf8");
      for (const rule of forbiddenPatterns) {
        if (rule.pattern.test(source)) {
          findings.push(`${target}:${rule.code}`);
        }
      }
    }

    const valid = findings.length === 0;
    return createResult(this.validatorId, context.scope, valid, valid ? [] : [
      createError(this.validatorId, "ARCHITECTURE_AUDIT_FAILED", "Distribution architecture audit detected forbidden dependency fallback patterns", { findings }, "Critical"),
    ]);
  }
}

export class ValidationEventPublisherFacade {
  private readonly events: ValidationEvent[] = [];

  publish(event: ValidationEvent): void {
    this.events.push(event);
  }

  list(): readonly ValidationEvent[] {
    return Object.freeze([...this.events]);
  }
}

export function createValidationValidators(validators: readonly Validator[]): readonly Validator[] {
  return Object.freeze([...validators]);
}
