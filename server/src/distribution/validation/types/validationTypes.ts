import type {
  CompositionMetadata,
  CompositionModuleName,
  CompositionSnapshot,
  DependencyGraph,
  ModuleDescriptor,
  ServiceDescriptor,
} from "../../composition";
import type {
  BootstrapConfiguration,
  BootstrapPlan,
  BootstrapReport,
  BootstrapStartupStep,
  DependencyValidationResult,
  ReadinessSnapshot,
  ShutdownSequence,
  StartupSequence,
} from "../../bootstrap/types/bootstrapTypes";
import type { CompositionConfiguration, HealthSnapshot } from "../../composition";

export type ValidationScope =
  | "Platform"
  | "Runtime"
  | "Workflow"
  | "Orchestrator"
  | "Queue"
  | "Worker"
  | "Provider"
  | "Connector"
  | "StatusSync"
  | "Royalty"
  | "Observability"
  | "Bootstrap"
  | "Composition"
  | "Dependency"
  | "Configuration"
  | "Security"
  | "Authentication"
  | "Storage"
  | "Repository"
  | "UnitOfWork"
  | "Health"
  | "Readiness"
  | "Startup"
  | "Shutdown"
  | "DisasterRecovery"
  | "Backup"
  | "Restore"
  | "Failover"
  | "Scalability"
  | "Performance"
  | "Load"
  | "Concurrency"
  | "DataIntegrity"
  | "StateMachine"
  | "EventReplay"
  | "Projection"
  | "Snapshot"
  | "Audit"
  | "Metrics"
  | "Logging"
  | "Trace";

export type ValidationSeverity = "Info" | "Warning" | "Error" | "Critical";

export type ValidationMetadata = Readonly<Record<string, unknown>>;

export type ValidationSection = Readonly<Record<string, unknown>> | null;

export type ValidationBucketKey =
  | "composition"
  | "bootstrap"
  | "workflow"
  | "orchestrator"
  | "execution"
  | "queue"
  | "runtime"
  | "provider"
  | "connectors"
  | "statusSync"
  | "royalty"
  | "observability"
  | "security"
  | "authentication"
  | "storage"
  | "repository"
  | "unitOfWork"
  | "health"
  | "recovery"
  | "checkpoint"
  | "projection"
  | "audit"
  | "metrics"
  | "logging"
  | "trace"
  | "stateMachine"
  | "compensation"
  | "performance"
  | "scalability"
  | "load"
  | "concurrency"
  | "dataIntegrity";

function freezeMetadata<T extends ValidationMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function freezeSection<T extends ValidationSection>(value: T): T {
  return (value ? Object.freeze({ ...value }) : null) as T;
}

function freezeList<T>(values: readonly T[] | undefined): readonly T[] {
  return Object.freeze([...(values ?? [])]);
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

export class ValidationContext<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly contextId: string;
  readonly scope: ValidationScope;
  readonly createdAt: string;
  readonly composition: ValidationSection;
  readonly bootstrap: ValidationSection;
  readonly workflow: ValidationSection;
  readonly orchestrator: ValidationSection;
  readonly execution: ValidationSection;
  readonly queue: ValidationSection;
  readonly runtime: ValidationSection;
  readonly provider: ValidationSection;
  readonly connectors: ValidationSection;
  readonly statusSync: ValidationSection;
  readonly royalty: ValidationSection;
  readonly observability: ValidationSection;
  readonly security: ValidationSection;
  readonly authentication: ValidationSection;
  readonly storage: ValidationSection;
  readonly repository: ValidationSection;
  readonly unitOfWork: ValidationSection;
  readonly health: ValidationSection;
  readonly recovery: ValidationSection;
  readonly checkpoint: ValidationSection;
  readonly projection: ValidationSection;
  readonly audit: ValidationSection;
  readonly metrics: ValidationSection;
  readonly logging: ValidationSection;
  readonly trace: ValidationSection;
  readonly stateMachine: ValidationSection;
  readonly compensation: ValidationSection;
  readonly performance: ValidationSection;
  readonly scalability: ValidationSection;
  readonly load: ValidationSection;
  readonly concurrency: ValidationSection;
  readonly dataIntegrity: ValidationSection;
  readonly metadata: TMetadata;

  constructor(input: {
    contextId: string;
    scope: ValidationScope;
    createdAt?: string;
    composition?: ValidationSection;
    bootstrap?: ValidationSection;
    workflow?: ValidationSection;
    orchestrator?: ValidationSection;
    execution?: ValidationSection;
    queue?: ValidationSection;
    runtime?: ValidationSection;
    provider?: ValidationSection;
    connectors?: ValidationSection;
    statusSync?: ValidationSection;
    royalty?: ValidationSection;
    observability?: ValidationSection;
    security?: ValidationSection;
    authentication?: ValidationSection;
    storage?: ValidationSection;
    repository?: ValidationSection;
    unitOfWork?: ValidationSection;
    health?: ValidationSection;
    recovery?: ValidationSection;
    checkpoint?: ValidationSection;
    projection?: ValidationSection;
    audit?: ValidationSection;
    metrics?: ValidationSection;
    logging?: ValidationSection;
    trace?: ValidationSection;
    stateMachine?: ValidationSection;
    compensation?: ValidationSection;
    performance?: ValidationSection;
    scalability?: ValidationSection;
    load?: ValidationSection;
    concurrency?: ValidationSection;
    dataIntegrity?: ValidationSection;
    metadata?: TMetadata;
  }) {
    this.contextId = ensure(input.contextId, "contextId");
    this.scope = input.scope;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.composition = freezeSection(input.composition ?? null);
    this.bootstrap = freezeSection(input.bootstrap ?? null);
    this.workflow = freezeSection(input.workflow ?? null);
    this.orchestrator = freezeSection(input.orchestrator ?? null);
    this.execution = freezeSection(input.execution ?? null);
    this.queue = freezeSection(input.queue ?? null);
    this.runtime = freezeSection(input.runtime ?? null);
    this.provider = freezeSection(input.provider ?? null);
    this.connectors = freezeSection(input.connectors ?? null);
    this.statusSync = freezeSection(input.statusSync ?? null);
    this.royalty = freezeSection(input.royalty ?? null);
    this.observability = freezeSection(input.observability ?? null);
    this.security = freezeSection(input.security ?? null);
    this.authentication = freezeSection(input.authentication ?? null);
    this.storage = freezeSection(input.storage ?? null);
    this.repository = freezeSection(input.repository ?? null);
    this.unitOfWork = freezeSection(input.unitOfWork ?? null);
    this.health = freezeSection(input.health ?? null);
    this.recovery = freezeSection(input.recovery ?? null);
    this.checkpoint = freezeSection(input.checkpoint ?? null);
    this.projection = freezeSection(input.projection ?? null);
    this.audit = freezeSection(input.audit ?? null);
    this.metrics = freezeSection(input.metrics ?? null);
    this.logging = freezeSection(input.logging ?? null);
    this.trace = freezeSection(input.trace ?? null);
    this.stateMachine = freezeSection(input.stateMachine ?? null);
    this.compensation = freezeSection(input.compensation ?? null);
    this.performance = freezeSection(input.performance ?? null);
    this.scalability = freezeSection(input.scalability ?? null);
    this.load = freezeSection(input.load ?? null);
    this.concurrency = freezeSection(input.concurrency ?? null);
    this.dataIntegrity = freezeSection(input.dataIntegrity ?? null);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationPlan<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly planId: string;
  readonly contextId: string;
  readonly scope: ValidationScope;
  readonly validators: readonly string[];
  readonly strict: boolean;
  readonly scheduledAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    planId: string;
    contextId: string;
    scope: ValidationScope;
    validators: readonly string[];
    strict?: boolean;
    scheduledAt?: string;
    metadata?: TMetadata;
  }) {
    this.planId = ensure(input.planId, "planId");
    this.contextId = ensure(input.contextId, "contextId");
    this.scope = input.scope;
    this.validators = freezeList(input.validators);
    this.strict = input.strict ?? true;
    this.scheduledAt = input.scheduledAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationError<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly errorId: string;
  readonly code: string;
  readonly message: string;
  readonly validator: string;
  readonly severity: ValidationSeverity;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    errorId: string;
    code: string;
    message: string;
    validator: string;
    severity?: ValidationSeverity;
    details?: Readonly<Record<string, unknown>>;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.errorId = ensure(input.errorId, "errorId");
    this.code = ensure(input.code, "code");
    this.message = ensure(input.message, "message");
    this.validator = ensure(input.validator, "validator");
    this.severity = input.severity ?? "Error";
    this.details = Object.freeze({ ...(input.details ?? {}) });
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationWarning<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly warningId: string;
  readonly code: string;
  readonly message: string;
  readonly validator: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    warningId: string;
    code: string;
    message: string;
    validator: string;
    details?: Readonly<Record<string, unknown>>;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.warningId = ensure(input.warningId, "warningId");
    this.code = ensure(input.code, "code");
    this.message = ensure(input.message, "message");
    this.validator = ensure(input.validator, "validator");
    this.details = Object.freeze({ ...(input.details ?? {}) });
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationResult<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly resultId: string;
  readonly validator: string;
  readonly valid: boolean;
  readonly errors: readonly ValidationError<TMetadata>[];
  readonly warnings: readonly ValidationWarning<TMetadata>[];
  readonly checkedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    resultId: string;
    validator: string;
    valid: boolean;
    errors?: readonly ValidationError<TMetadata>[];
    warnings?: readonly ValidationWarning<TMetadata>[];
    checkedAt?: string;
    metadata?: TMetadata;
  }) {
    this.resultId = ensure(input.resultId, "resultId");
    this.validator = ensure(input.validator, "validator");
    this.valid = input.valid;
    this.errors = freezeList(input.errors);
    this.warnings = freezeList(input.warnings);
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationSummary<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly summaryId: string;
  readonly totalChecks: number;
  readonly validChecks: number;
  readonly invalidChecks: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly criticalCount: number;
  readonly metadata: TMetadata;

  constructor(input: {
    summaryId: string;
    totalChecks: number;
    validChecks: number;
    invalidChecks: number;
    errorCount?: number;
    warningCount?: number;
    criticalCount?: number;
    metadata?: TMetadata;
  }) {
    this.summaryId = ensure(input.summaryId, "summaryId");
    this.totalChecks = input.totalChecks;
    this.validChecks = input.validChecks;
    this.invalidChecks = input.invalidChecks;
    this.errorCount = input.errorCount ?? 0;
    this.warningCount = input.warningCount ?? 0;
    this.criticalCount = input.criticalCount ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationReport<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly reportId: string;
  readonly scope: ValidationScope;
  readonly summary: ValidationSummary<TMetadata>;
  readonly results: readonly ValidationResult<TMetadata>[];
  readonly valid: boolean;
  readonly errors: readonly ValidationError<TMetadata>[];
  readonly warnings: readonly ValidationWarning<TMetadata>[];
  readonly generatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    reportId: string;
    scope: ValidationScope;
    summary: ValidationSummary<TMetadata>;
    results: readonly ValidationResult<TMetadata>[];
    valid: boolean;
    errors?: readonly ValidationError<TMetadata>[];
    warnings?: readonly ValidationWarning<TMetadata>[];
    generatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.reportId = ensure(input.reportId, "reportId");
    this.scope = input.scope;
    this.summary = input.summary;
    this.results = freezeList(input.results);
    this.valid = input.valid;
    this.errors = freezeList(input.errors);
    this.warnings = freezeList(input.warnings);
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ReadinessReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly ready: boolean;

  constructor(input: ValidationReportInput<TMetadata> & { ready: boolean }) {
    super(input);
    this.ready = input.ready;
    Object.freeze(this);
  }
}

export class HealthReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly healthy: boolean;
  readonly health: HealthSnapshot | null;

  constructor(input: ValidationReportInput<TMetadata> & { healthy: boolean; health?: HealthSnapshot | null }) {
    super(input);
    this.healthy = input.healthy;
    this.health = input.health ?? null;
    Object.freeze(this);
  }
}

export class StartupReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly started: boolean;
  readonly startup: StartupSequence | null;

  constructor(input: ValidationReportInput<TMetadata> & { started: boolean; startup?: StartupSequence | null }) {
    super(input);
    this.started = input.started;
    this.startup = input.startup ?? null;
    Object.freeze(this);
  }
}

export class ShutdownReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly stopped: boolean;
  readonly shutdown: ShutdownSequence | null;

  constructor(input: ValidationReportInput<TMetadata> & { stopped: boolean; shutdown?: ShutdownSequence | null }) {
    super(input);
    this.stopped = input.stopped;
    this.shutdown = input.shutdown ?? null;
    Object.freeze(this);
  }
}

export class DisasterRecoveryReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly recovered: boolean;
  readonly dependencyValidation: DependencyValidationResult | null;

  constructor(input: ValidationReportInput<TMetadata> & { recovered: boolean; dependencyValidation?: DependencyValidationResult | null }) {
    super(input);
    this.recovered = input.recovered;
    this.dependencyValidation = input.dependencyValidation ?? null;
    Object.freeze(this);
  }
}

export class PerformanceReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly performanceScore: number;

  constructor(input: ValidationReportInput<TMetadata> & { performanceScore: number }) {
    super(input);
    this.performanceScore = input.performanceScore;
    Object.freeze(this);
  }
}

export class ScalabilityReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly scalabilityScore: number;

  constructor(input: ValidationReportInput<TMetadata> & { scalabilityScore: number }) {
    super(input);
    this.scalabilityScore = input.scalabilityScore;
    Object.freeze(this);
  }
}

export class SecurityReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly secure: boolean;

  constructor(input: ValidationReportInput<TMetadata> & { secure: boolean }) {
    super(input);
    this.secure = input.secure;
    Object.freeze(this);
  }
}

export class ComplianceReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly compliant: boolean;

  constructor(input: ValidationReportInput<TMetadata> & { compliant: boolean }) {
    super(input);
    this.compliant = input.compliant;
    Object.freeze(this);
  }
}

export class DependencyReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly dependencyCount: number;
  readonly dependencies: readonly CompositionModuleName[];

  constructor(input: ValidationReportInput<TMetadata> & { dependencyCount: number; dependencies: readonly CompositionModuleName[] }) {
    super(input);
    this.dependencyCount = input.dependencyCount;
    this.dependencies = freezeList(input.dependencies);
    Object.freeze(this);
  }
}

export class RuntimeReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly runtimeId: string;

  constructor(input: ValidationReportInput<TMetadata> & { runtimeId: string }) {
    super(input);
    this.runtimeId = ensure(input.runtimeId, "runtimeId");
    Object.freeze(this);
  }
}

export class ProductionReadinessReport<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationReport<TMetadata> {
  readonly productionReady: boolean;
  readonly bootstrap: BootstrapReport | null;

  constructor(input: ValidationReportInput<TMetadata> & { productionReady: boolean; bootstrap?: BootstrapReport | null }) {
    super(input);
    this.productionReady = input.productionReady;
    this.bootstrap = input.bootstrap ?? null;
    Object.freeze(this);
  }
}

export type ValidationGraphContext = Readonly<{
  graph: DependencyGraph | null;
  snapshot: CompositionSnapshot | null;
  configuration: CompositionConfiguration | null;
  modules: readonly ModuleDescriptor[];
  services: readonly ServiceDescriptor[];
}>;

export type ValidationBootstrapContext = Readonly<{
  bootstrapConfiguration: BootstrapConfiguration | null;
  bootstrapPlan: BootstrapPlan | null;
  bootstrapResult: BootstrapReport | null;
  startupSequence: StartupSequence | null;
  shutdownSequence: ShutdownSequence | null;
  startupSteps: readonly BootstrapStartupStep[];
}>;

export type ValidationReportInput<TMetadata extends ValidationMetadata = ValidationMetadata> = Readonly<{
  reportId: string;
  scope: ValidationScope;
  summary: ValidationSummary<TMetadata>;
  results: readonly ValidationResult<TMetadata>[];
  valid: boolean;
  errors?: readonly ValidationError<TMetadata>[];
  warnings?: readonly ValidationWarning<TMetadata>[];
  generatedAt?: string;
  metadata?: TMetadata;
}>;

export type ValidationBaseReportInput<TMetadata extends ValidationMetadata = ValidationMetadata> = ValidationReportInput<TMetadata>;
