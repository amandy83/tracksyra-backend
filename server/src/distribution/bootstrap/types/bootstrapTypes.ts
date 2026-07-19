import type {
  CompositionConfiguration,
  CompositionEnvironment,
  CompositionLifecycleState,
  CompositionMetadata,
  CompositionModuleName,
  CompositionSnapshot,
  DependencyGraph,
  HealthSnapshot,
  ModuleDescriptor,
} from "../../composition";

function freezeMetadata<T extends CompositionMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export type BootstrapStartupStep = "Composition" | CompositionModuleName;

export const DEFAULT_BOOTSTRAP_STARTUP_ORDER = Object.freeze([
  "Composition",
  "Infrastructure",
  "Observability",
  "QueueIntegration",
  "RuntimeIntegration",
  "ProviderIntegration",
  "PartnerOnboarding",
  "StatusSync",
  "Intelligence",
  "Royalty",
  "Workflow",
  "Orchestrator",
  "ExecutionEngine",
  "Application",
] as readonly BootstrapStartupStep[]);

export class BootstrapPlan<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly planId: string;
  readonly modules: readonly CompositionModuleName[];
  readonly environment: CompositionEnvironment;
  readonly timeoutMs: number;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly metadata: TMetadata;

  constructor(input: {
    planId: string;
    modules: readonly CompositionModuleName[];
    environment: CompositionEnvironment;
    timeoutMs?: number;
    featureFlags?: Readonly<Record<string, boolean>>;
    metadata?: TMetadata;
  }) {
    this.planId = input.planId.trim();
    this.modules = Object.freeze([...(input.modules ?? [])]);
    this.environment = input.environment;
    this.timeoutMs = input.timeoutMs ?? 0;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.planId) {
      throw new Error("BootstrapPlan.planId must not be empty");
    }
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 0) {
      throw new Error("BootstrapPlan.timeoutMs must be non-negative");
    }
    Object.freeze(this);
  }
}

export class StartupSequence<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly sequenceId: string;
  readonly plan: BootstrapPlan<TMetadata>;
  readonly modules: readonly CompositionModuleName[];
  readonly startedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    sequenceId: string;
    plan: BootstrapPlan<TMetadata>;
    modules?: readonly CompositionModuleName[];
    startedAt?: string;
    metadata?: TMetadata;
  }) {
    this.sequenceId = input.sequenceId.trim();
    this.plan = input.plan;
    this.modules = Object.freeze([...(input.modules ?? input.plan.modules)]);
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.sequenceId) {
      throw new Error("StartupSequence.sequenceId must not be empty");
    }
    Object.freeze(this);
  }
}

export class ShutdownSequence<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly sequenceId: string;
  readonly modules: readonly CompositionModuleName[];
  readonly initiatedAt: string;
  readonly graceful: boolean;
  readonly timeoutMs: number;
  readonly metadata: TMetadata;

  constructor(input: {
    sequenceId: string;
    modules: readonly CompositionModuleName[];
    initiatedAt?: string;
    graceful?: boolean;
    timeoutMs?: number;
    metadata?: TMetadata;
  }) {
    this.sequenceId = input.sequenceId.trim();
    this.modules = Object.freeze([...(input.modules ?? [])]);
    this.initiatedAt = input.initiatedAt ?? new Date().toISOString();
    this.graceful = input.graceful ?? true;
    this.timeoutMs = input.timeoutMs ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.sequenceId) {
      throw new Error("ShutdownSequence.sequenceId must not be empty");
    }
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 0) {
      throw new Error("ShutdownSequence.timeoutMs must be non-negative");
    }
    Object.freeze(this);
  }
}

export class ModuleInitialization<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly initializationId: string;
  readonly moduleName: CompositionModuleName;
  readonly dependencies: readonly CompositionModuleName[];
  readonly startupHooks: readonly string[];
  readonly readinessChecks: readonly string[];
  readonly shutdownHooks: readonly string[];
  readonly healthProbes: readonly string[];
  readonly initializedAt: string;
  readonly lifecycle: CompositionLifecycleState;
  readonly metadata: TMetadata;

  constructor(input: {
    initializationId: string;
    moduleName: CompositionModuleName;
    dependencies?: readonly CompositionModuleName[];
    startupHooks?: readonly string[];
    readinessChecks?: readonly string[];
    shutdownHooks?: readonly string[];
    healthProbes?: readonly string[];
    initializedAt?: string;
    lifecycle?: CompositionLifecycleState;
    metadata?: TMetadata;
  }) {
    this.initializationId = input.initializationId.trim();
    this.moduleName = input.moduleName;
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.startupHooks = Object.freeze([...(input.startupHooks ?? [])]);
    this.readinessChecks = Object.freeze([...(input.readinessChecks ?? [])]);
    this.shutdownHooks = Object.freeze([...(input.shutdownHooks ?? [])]);
    this.healthProbes = Object.freeze([...(input.healthProbes ?? [])]);
    this.initializedAt = input.initializedAt ?? new Date().toISOString();
    this.lifecycle = input.lifecycle ?? "Created";
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.initializationId) {
      throw new Error("ModuleInitialization.initializationId must not be empty");
    }
    Object.freeze(this);
  }
}

export class DependencyValidationResult<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly validationId: string;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly validatedAt: string;
  readonly graph: DependencyGraph<TMetadata> | null;
  readonly metadata: TMetadata;

  constructor(input: {
    validationId: string;
    valid: boolean;
    errors?: readonly string[];
    warnings?: readonly string[];
    validatedAt?: string;
    graph?: DependencyGraph<TMetadata> | null;
    metadata?: TMetadata;
  }) {
    this.validationId = input.validationId.trim();
    this.valid = input.valid;
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.validatedAt = input.validatedAt ?? new Date().toISOString();
    this.graph = input.graph ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.validationId) {
      throw new Error("DependencyValidationResult.validationId must not be empty");
    }
    Object.freeze(this);
  }
}

export class StartupCheckpoint<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly checkpointId: string;
  readonly sequenceId: string;
  readonly moduleName: CompositionModuleName;
  readonly stage: string;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    checkpointId: string;
    sequenceId: string;
    moduleName: CompositionModuleName;
    stage: string;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.sequenceId = input.sequenceId.trim();
    this.moduleName = input.moduleName;
    this.stage = input.stage.trim();
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.checkpointId || !this.sequenceId || !this.stage) {
      throw new Error("StartupCheckpoint requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class ReadinessSnapshot<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly snapshotId: string;
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly health: HealthSnapshot | null;
  readonly loadedModules: readonly CompositionModuleName[];
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    ready: boolean;
    checkedAt?: string;
    health?: HealthSnapshot | null;
    loadedModules?: readonly CompositionModuleName[];
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.ready = input.ready;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.health = input.health ?? null;
    this.loadedModules = Object.freeze([...(input.loadedModules ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId) {
      throw new Error("ReadinessSnapshot.snapshotId must not be empty");
    }
    Object.freeze(this);
  }
}

export class EnvironmentSnapshot<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly snapshotId: string;
  readonly environment: CompositionEnvironment;
  readonly configuration: CompositionConfiguration<TMetadata> | null;
  readonly observedAt: string;
  readonly variables: Readonly<Record<string, string | undefined>>;
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    environment: CompositionEnvironment;
    configuration?: CompositionConfiguration<TMetadata> | null;
    observedAt?: string;
    variables?: Readonly<Record<string, string | undefined>>;
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.environment = input.environment;
    this.configuration = input.configuration ?? null;
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.variables = Object.freeze({ ...(input.variables ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId) {
      throw new Error("EnvironmentSnapshot.snapshotId must not be empty");
    }
    Object.freeze(this);
  }
}

export class BootstrapConfiguration<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly configurationId: string;
  readonly environment: CompositionEnvironment;
  readonly startupTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
  readonly dependencyValidationEnabled: boolean;
  readonly gracefulShutdown: boolean;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly metadata: TMetadata;

  constructor(input: {
    configurationId: string;
    environment: CompositionEnvironment;
    startupTimeoutMs?: number;
    shutdownTimeoutMs?: number;
    dependencyValidationEnabled?: boolean;
    gracefulShutdown?: boolean;
    featureFlags?: Readonly<Record<string, boolean>>;
    metadata?: TMetadata;
  }) {
    this.configurationId = input.configurationId.trim();
    this.environment = input.environment;
    this.startupTimeoutMs = input.startupTimeoutMs ?? 0;
    this.shutdownTimeoutMs = input.shutdownTimeoutMs ?? 0;
    this.dependencyValidationEnabled = input.dependencyValidationEnabled ?? true;
    this.gracefulShutdown = input.gracefulShutdown ?? true;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.configurationId) {
      throw new Error("BootstrapConfiguration.configurationId must not be empty");
    }
    const values = [this.startupTimeoutMs, this.shutdownTimeoutMs];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("BootstrapConfiguration timeout values must be non-negative");
    }
    Object.freeze(this);
  }
}

export class BootstrapReport<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly reportId: string;
  readonly configuration: BootstrapConfiguration<TMetadata>;
  readonly plan: BootstrapPlan<TMetadata> | null;
  readonly startupSequence: StartupSequence<TMetadata> | null;
  readonly shutdownSequence: ShutdownSequence<TMetadata> | null;
  readonly validation: DependencyValidationResult<TMetadata> | null;
  readonly readiness: ReadinessSnapshot<TMetadata> | null;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly success: boolean;
  readonly failure: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata: TMetadata;

  constructor(input: {
    reportId: string;
    configuration: BootstrapConfiguration<TMetadata>;
    plan?: BootstrapPlan<TMetadata> | null;
    startupSequence?: StartupSequence<TMetadata> | null;
    shutdownSequence?: ShutdownSequence<TMetadata> | null;
    validation?: DependencyValidationResult<TMetadata> | null;
    readiness?: ReadinessSnapshot<TMetadata> | null;
    startedAt: string;
    completedAt?: string;
    success: boolean;
    failure: boolean;
    errors?: readonly string[];
    warnings?: readonly string[];
    metadata?: TMetadata;
  }) {
    this.reportId = input.reportId.trim();
    this.configuration = input.configuration;
    this.plan = input.plan ?? null;
    this.startupSequence = input.startupSequence ?? null;
    this.shutdownSequence = input.shutdownSequence ?? null;
    this.validation = input.validation ?? null;
    this.readiness = input.readiness ?? null;
    this.startedAt = input.startedAt;
    this.completedAt = input.completedAt ?? new Date().toISOString();
    this.success = input.success;
    this.failure = input.failure;
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.reportId) {
      throw new Error("BootstrapReport.reportId must not be empty");
    }
    if (!this.success && !this.failure) {
      throw new Error("BootstrapReport must be success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("BootstrapReport cannot be both success and failure");
    }
    Object.freeze(this);
  }
}
