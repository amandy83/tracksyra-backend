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
]);
function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
export class ModuleDescriptor {
    moduleName;
    version;
    path;
    dependencies;
    lazy;
    enabled;
    featureFlags;
    replacementOf;
    metadata;
    constructor(input) {
        this.moduleName = input.moduleName;
        this.version = input.version.trim();
        this.path = input.path ?? null;
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.lazy = input.lazy ?? false;
        this.enabled = input.enabled ?? true;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.replacementOf = input.replacementOf ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.version) {
            throw new Error("ModuleDescriptor.version must not be empty");
        }
        Object.freeze(this);
    }
}
export class ServiceDescriptor {
    serviceId;
    moduleName;
    serviceName;
    scope;
    dependencies;
    metadata;
    constructor(input) {
        this.serviceId = input.serviceId.trim();
        this.moduleName = input.moduleName;
        this.serviceName = input.serviceName.trim();
        this.scope = input.scope ?? "Singleton";
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.serviceId || !this.serviceName) {
            throw new Error("ServiceDescriptor requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class DependencyGraph {
    graphId;
    modules;
    services;
    rootModules;
    createdAt;
    metadata;
    constructor(input) {
        this.graphId = input.graphId.trim();
        this.modules = Object.freeze([...(input.modules ?? [])]);
        this.services = Object.freeze([...(input.services ?? [])]);
        this.rootModules = Object.freeze([...(input.rootModules ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.graphId) {
            throw new Error("DependencyGraph.graphId must not be empty");
        }
        Object.freeze(this);
    }
}
export class CompositionConfiguration {
    compositionId;
    environment;
    lazyLoading;
    featureFlags;
    moduleOverrides;
    providerOverrides;
    dependencyOverrides;
    metadata;
    constructor(input) {
        this.compositionId = input.compositionId.trim();
        this.environment = input.environment;
        this.lazyLoading = input.lazyLoading ?? true;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.moduleOverrides = Object.freeze({ ...(input.moduleOverrides ?? {}) });
        this.providerOverrides = Object.freeze({ ...(input.providerOverrides ?? {}) });
        this.dependencyOverrides = Object.freeze({ ...(input.dependencyOverrides ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.compositionId) {
            throw new Error("CompositionConfiguration.compositionId must not be empty");
        }
        Object.freeze(this);
    }
}
export class BootstrapContext {
    bootstrapId;
    configuration;
    graph;
    environment;
    startedAt;
    metadata;
    constructor(input) {
        this.bootstrapId = input.bootstrapId.trim();
        this.configuration = input.configuration;
        this.graph = input.graph;
        this.environment = input.environment;
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.bootstrapId) {
            throw new Error("BootstrapContext.bootstrapId must not be empty");
        }
        Object.freeze(this);
    }
}
export class BootstrapResult {
    bootstrapId;
    success;
    failure;
    startedAt;
    completedAt;
    loadedModules;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.bootstrapId = input.bootstrapId.trim();
        this.success = input.success;
        this.failure = input.failure;
        this.startedAt = input.startedAt;
        this.completedAt = input.completedAt ?? new Date().toISOString();
        this.loadedModules = Object.freeze([...(input.loadedModules ?? [])]);
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class CompositionSnapshot {
    snapshotId;
    graph;
    configuration;
    capturedAt;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.graph = input.graph;
        this.configuration = input.configuration;
        this.capturedAt = input.capturedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.snapshotId) {
            throw new Error("CompositionSnapshot.snapshotId must not be empty");
        }
        Object.freeze(this);
    }
}
export class StartupReport {
    reportId;
    bootstrapResult;
    snapshot;
    generatedAt;
    metadata;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.bootstrapResult = input.bootstrapResult;
        this.snapshot = input.snapshot ?? null;
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.reportId) {
            throw new Error("StartupReport.reportId must not be empty");
        }
        Object.freeze(this);
    }
}
export class ValidationReport {
    validationId;
    valid;
    errors;
    warnings;
    validatedAt;
    metadata;
    constructor(input) {
        this.validationId = input.validationId.trim();
        this.valid = input.valid;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.validatedAt = input.validatedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.validationId) {
            throw new Error("ValidationReport.validationId must not be empty");
        }
        Object.freeze(this);
    }
}
export class HealthSnapshot {
    snapshotId;
    healthy;
    checkedAt;
    moduleCount;
    unhealthyModuleCount;
    details;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.healthy = input.healthy;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.moduleCount = input.moduleCount ?? 0;
        this.unhealthyModuleCount = input.unhealthyModuleCount ?? 0;
        this.details = Object.freeze({ ...(input.details ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
