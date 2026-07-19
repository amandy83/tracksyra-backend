function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
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
]);
export class BootstrapPlan {
    planId;
    modules;
    environment;
    timeoutMs;
    featureFlags;
    metadata;
    constructor(input) {
        this.planId = input.planId.trim();
        this.modules = Object.freeze([...(input.modules ?? [])]);
        this.environment = input.environment;
        this.timeoutMs = input.timeoutMs ?? 0;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.planId) {
            throw new Error("BootstrapPlan.planId must not be empty");
        }
        if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 0) {
            throw new Error("BootstrapPlan.timeoutMs must be non-negative");
        }
        Object.freeze(this);
    }
}
export class StartupSequence {
    sequenceId;
    plan;
    modules;
    startedAt;
    metadata;
    constructor(input) {
        this.sequenceId = input.sequenceId.trim();
        this.plan = input.plan;
        this.modules = Object.freeze([...(input.modules ?? input.plan.modules)]);
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.sequenceId) {
            throw new Error("StartupSequence.sequenceId must not be empty");
        }
        Object.freeze(this);
    }
}
export class ShutdownSequence {
    sequenceId;
    modules;
    initiatedAt;
    graceful;
    timeoutMs;
    metadata;
    constructor(input) {
        this.sequenceId = input.sequenceId.trim();
        this.modules = Object.freeze([...(input.modules ?? [])]);
        this.initiatedAt = input.initiatedAt ?? new Date().toISOString();
        this.graceful = input.graceful ?? true;
        this.timeoutMs = input.timeoutMs ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.sequenceId) {
            throw new Error("ShutdownSequence.sequenceId must not be empty");
        }
        if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 0) {
            throw new Error("ShutdownSequence.timeoutMs must be non-negative");
        }
        Object.freeze(this);
    }
}
export class ModuleInitialization {
    initializationId;
    moduleName;
    dependencies;
    startupHooks;
    readinessChecks;
    shutdownHooks;
    healthProbes;
    initializedAt;
    lifecycle;
    metadata;
    constructor(input) {
        this.initializationId = input.initializationId.trim();
        this.moduleName = input.moduleName;
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.startupHooks = Object.freeze([...(input.startupHooks ?? [])]);
        this.readinessChecks = Object.freeze([...(input.readinessChecks ?? [])]);
        this.shutdownHooks = Object.freeze([...(input.shutdownHooks ?? [])]);
        this.healthProbes = Object.freeze([...(input.healthProbes ?? [])]);
        this.initializedAt = input.initializedAt ?? new Date().toISOString();
        this.lifecycle = input.lifecycle ?? "Created";
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.initializationId) {
            throw new Error("ModuleInitialization.initializationId must not be empty");
        }
        Object.freeze(this);
    }
}
export class DependencyValidationResult {
    validationId;
    valid;
    errors;
    warnings;
    validatedAt;
    graph;
    metadata;
    constructor(input) {
        this.validationId = input.validationId.trim();
        this.valid = input.valid;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.validatedAt = input.validatedAt ?? new Date().toISOString();
        this.graph = input.graph ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.validationId) {
            throw new Error("DependencyValidationResult.validationId must not be empty");
        }
        Object.freeze(this);
    }
}
export class StartupCheckpoint {
    checkpointId;
    sequenceId;
    moduleName;
    stage;
    createdAt;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.sequenceId = input.sequenceId.trim();
        this.moduleName = input.moduleName;
        this.stage = input.stage.trim();
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.checkpointId || !this.sequenceId || !this.stage) {
            throw new Error("StartupCheckpoint requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class ReadinessSnapshot {
    snapshotId;
    ready;
    checkedAt;
    health;
    loadedModules;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.ready = input.ready;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.health = input.health ?? null;
        this.loadedModules = Object.freeze([...(input.loadedModules ?? [])]);
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.snapshotId) {
            throw new Error("ReadinessSnapshot.snapshotId must not be empty");
        }
        Object.freeze(this);
    }
}
export class EnvironmentSnapshot {
    snapshotId;
    environment;
    configuration;
    observedAt;
    variables;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.environment = input.environment;
        this.configuration = input.configuration ?? null;
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.variables = Object.freeze({ ...(input.variables ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.snapshotId) {
            throw new Error("EnvironmentSnapshot.snapshotId must not be empty");
        }
        Object.freeze(this);
    }
}
export class BootstrapConfiguration {
    configurationId;
    environment;
    startupTimeoutMs;
    shutdownTimeoutMs;
    dependencyValidationEnabled;
    gracefulShutdown;
    featureFlags;
    metadata;
    constructor(input) {
        this.configurationId = input.configurationId.trim();
        this.environment = input.environment;
        this.startupTimeoutMs = input.startupTimeoutMs ?? 0;
        this.shutdownTimeoutMs = input.shutdownTimeoutMs ?? 0;
        this.dependencyValidationEnabled = input.dependencyValidationEnabled ?? true;
        this.gracefulShutdown = input.gracefulShutdown ?? true;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class BootstrapReport {
    reportId;
    configuration;
    plan;
    startupSequence;
    shutdownSequence;
    validation;
    readiness;
    startedAt;
    completedAt;
    success;
    failure;
    errors;
    warnings;
    metadata;
    constructor(input) {
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
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
