export type CompositionModuleName =
  | "Domain"
  | "Application"
  | "Infrastructure"
  | "ProviderFramework"
  | "UniversalMetadataEngine"
  | "PackagingEngine"
  | "ExecutionEngine"
  | "Queue"
  | "QueueIntegration"
  | "Runtime"
  | "RuntimeIntegration"
  | "StatusSync"
  | "DSPConnectors"
  | "ProviderIntegration"
  | "PartnerOnboarding"
  | "Intelligence"
  | "Royalty"
  | "Observability"
  | "Orchestrator"
  | "Workflow"
  | "Bootstrap";

export const DEFAULT_COMPOSITION_MODULE_ORDER = Object.freeze([
  "Domain",
  "Application",
  "Infrastructure",
  "ProviderFramework",
  "UniversalMetadataEngine",
  "PackagingEngine",
  "ExecutionEngine",
  "Queue",
  "QueueIntegration",
  "Runtime",
  "RuntimeIntegration",
  "StatusSync",
  "DSPConnectors",
  "ProviderIntegration",
  "PartnerOnboarding",
  "Intelligence",
  "Royalty",
  "Observability",
  "Orchestrator",
  "Workflow",
  "Bootstrap",
] as readonly CompositionModuleName[]);

export type CompositionEnvironment = "development" | "test" | "staging" | "production" | string;

export type CompositionLifecycleState =
  | "Created"
  | "Bootstrapping"
  | "Validated"
  | "Running"
  | "Degraded"
  | "Failed"
  | "Stopped";

export type CompositionFeatureFlags = Readonly<Record<string, boolean>>;
export type CompositionMetadata = Readonly<Record<string, unknown>>;

function freezeMetadata<T extends CompositionMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export class ModuleDescriptor<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly moduleName: CompositionModuleName;
  readonly version: string;
  readonly path: string | null;
  readonly dependencies: readonly CompositionModuleName[];
  readonly lazy: boolean;
  readonly enabled: boolean;
  readonly featureFlags: CompositionFeatureFlags;
  readonly replacementOf: CompositionModuleName | null;
  readonly metadata: TMetadata;

  constructor(input: {
    moduleName: CompositionModuleName;
    version: string;
    path?: string | null;
    dependencies?: readonly CompositionModuleName[];
    lazy?: boolean;
    enabled?: boolean;
    featureFlags?: CompositionFeatureFlags;
    replacementOf?: CompositionModuleName | null;
    metadata?: TMetadata;
  }) {
    this.moduleName = input.moduleName;
    this.version = input.version.trim();
    this.path = input.path ?? null;
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.lazy = input.lazy ?? false;
    this.enabled = input.enabled ?? true;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.replacementOf = input.replacementOf ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.version) {
      throw new Error("ModuleDescriptor.version must not be empty");
    }
    Object.freeze(this);
  }
}

export class ServiceDescriptor<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly serviceId: string;
  readonly moduleName: CompositionModuleName;
  readonly serviceName: string;
  readonly scope: "Singleton" | "Scoped" | "Transient" | "Lazy";
  readonly dependencies: readonly string[];
  readonly metadata: TMetadata;

  constructor(input: {
    serviceId: string;
    moduleName: CompositionModuleName;
    serviceName: string;
    scope?: "Singleton" | "Scoped" | "Transient" | "Lazy";
    dependencies?: readonly string[];
    metadata?: TMetadata;
  }) {
    this.serviceId = input.serviceId.trim();
    this.moduleName = input.moduleName;
    this.serviceName = input.serviceName.trim();
    this.scope = input.scope ?? "Singleton";
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.serviceId || !this.serviceName) {
      throw new Error("ServiceDescriptor requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class DependencyGraph<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly graphId: string;
  readonly modules: readonly ModuleDescriptor<TMetadata>[];
  readonly services: readonly ServiceDescriptor<TMetadata>[];
  readonly rootModules: readonly CompositionModuleName[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    graphId: string;
    modules: readonly ModuleDescriptor<TMetadata>[];
    services?: readonly ServiceDescriptor<TMetadata>[];
    rootModules?: readonly CompositionModuleName[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.graphId = input.graphId.trim();
    this.modules = Object.freeze([...(input.modules ?? [])]);
    this.services = Object.freeze([...(input.services ?? [])]);
    this.rootModules = Object.freeze([...(input.rootModules ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.graphId) {
      throw new Error("DependencyGraph.graphId must not be empty");
    }
    Object.freeze(this);
  }
}

export class CompositionConfiguration<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly compositionId: string;
  readonly environment: CompositionEnvironment;
  readonly lazyLoading: boolean;
  readonly featureFlags: CompositionFeatureFlags;
  readonly moduleOverrides: Readonly<Partial<Record<CompositionModuleName, Partial<ModuleDescriptor<TMetadata>>>>>;
  readonly providerOverrides: Readonly<Record<string, string>>;
  readonly dependencyOverrides: Readonly<Record<string, readonly string[]>>;
  readonly metadata: TMetadata;

  constructor(input: {
    compositionId: string;
    environment: CompositionEnvironment;
    lazyLoading?: boolean;
    featureFlags?: CompositionFeatureFlags;
    moduleOverrides?: Readonly<Partial<Record<CompositionModuleName, Partial<ModuleDescriptor<TMetadata>>>>>;
    providerOverrides?: Readonly<Record<string, string>>;
    dependencyOverrides?: Readonly<Record<string, readonly string[]>>;
    metadata?: TMetadata;
  }) {
    this.compositionId = input.compositionId.trim();
    this.environment = input.environment;
    this.lazyLoading = input.lazyLoading ?? true;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.moduleOverrides = Object.freeze({ ...(input.moduleOverrides ?? {}) });
    this.providerOverrides = Object.freeze({ ...(input.providerOverrides ?? {}) });
    this.dependencyOverrides = Object.freeze({ ...(input.dependencyOverrides ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.compositionId) {
      throw new Error("CompositionConfiguration.compositionId must not be empty");
    }
    Object.freeze(this);
  }
}

export class BootstrapContext<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly bootstrapId: string;
  readonly configuration: CompositionConfiguration<TMetadata>;
  readonly graph: DependencyGraph<TMetadata>;
  readonly environment: CompositionEnvironment;
  readonly startedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    bootstrapId: string;
    configuration: CompositionConfiguration<TMetadata>;
    graph: DependencyGraph<TMetadata>;
    environment: CompositionEnvironment;
    startedAt?: string;
    metadata?: TMetadata;
  }) {
    this.bootstrapId = input.bootstrapId.trim();
    this.configuration = input.configuration;
    this.graph = input.graph;
    this.environment = input.environment;
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.bootstrapId) {
      throw new Error("BootstrapContext.bootstrapId must not be empty");
    }
    Object.freeze(this);
  }
}

export class BootstrapResult<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly bootstrapId: string;
  readonly success: boolean;
  readonly failure: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly loadedModules: readonly CompositionModuleName[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata: TMetadata;

  constructor(input: {
    bootstrapId: string;
    success: boolean;
    failure: boolean;
    startedAt: string;
    completedAt?: string;
    loadedModules?: readonly CompositionModuleName[];
    errors?: readonly string[];
    warnings?: readonly string[];
    metadata?: TMetadata;
  }) {
    this.bootstrapId = input.bootstrapId.trim();
    this.success = input.success;
    this.failure = input.failure;
    this.startedAt = input.startedAt;
    this.completedAt = input.completedAt ?? new Date().toISOString();
    this.loadedModules = Object.freeze([...(input.loadedModules ?? [])]);
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.bootstrapId) {
      throw new Error("BootstrapResult.bootstrapId must not be empty");
    }
    if (!this.success && !this.failure) {
      throw new Error("BootstrapResult must be success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("BootstrapResult cannot be both success and failure");
    }
    Object.freeze(this);
  }
}

export class CompositionSnapshot<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly snapshotId: string;
  readonly graph: DependencyGraph<TMetadata>;
  readonly configuration: CompositionConfiguration<TMetadata>;
  readonly capturedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    graph: DependencyGraph<TMetadata>;
    configuration: CompositionConfiguration<TMetadata>;
    capturedAt?: string;
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.graph = input.graph;
    this.configuration = input.configuration;
    this.capturedAt = input.capturedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId) {
      throw new Error("CompositionSnapshot.snapshotId must not be empty");
    }
    Object.freeze(this);
  }
}

export class StartupReport<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly reportId: string;
  readonly bootstrapResult: BootstrapResult<TMetadata>;
  readonly snapshot: CompositionSnapshot<TMetadata> | null;
  readonly generatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    reportId: string;
    bootstrapResult: BootstrapResult<TMetadata>;
    snapshot?: CompositionSnapshot<TMetadata> | null;
    generatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.reportId = input.reportId.trim();
    this.bootstrapResult = input.bootstrapResult;
    this.snapshot = input.snapshot ?? null;
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.reportId) {
      throw new Error("StartupReport.reportId must not be empty");
    }
    Object.freeze(this);
  }
}

export class ValidationReport<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly validationId: string;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly validatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    validationId: string;
    valid: boolean;
    errors?: readonly string[];
    warnings?: readonly string[];
    validatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.validationId = input.validationId.trim();
    this.valid = input.valid;
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.validatedAt = input.validatedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.validationId) {
      throw new Error("ValidationReport.validationId must not be empty");
    }
    Object.freeze(this);
  }
}

export class HealthSnapshot<TMetadata extends CompositionMetadata = CompositionMetadata> {
  readonly snapshotId: string;
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly moduleCount: number;
  readonly unhealthyModuleCount: number;
  readonly details: Readonly<Record<string, unknown>>;
  readonly metadata: TMetadata;

  constructor(input: {
    snapshotId: string;
    healthy: boolean;
    checkedAt?: string;
    moduleCount?: number;
    unhealthyModuleCount?: number;
    details?: Readonly<Record<string, unknown>>;
    metadata?: TMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.healthy = input.healthy;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.moduleCount = input.moduleCount ?? 0;
    this.unhealthyModuleCount = input.unhealthyModuleCount ?? 0;
    this.details = Object.freeze({ ...(input.details ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.snapshotId) {
      throw new Error("HealthSnapshot.snapshotId must not be empty");
    }
    const values = [this.moduleCount, this.unhealthyModuleCount];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("HealthSnapshot numeric values must be non-negative");
    }
    Object.freeze(this);
  }
}
