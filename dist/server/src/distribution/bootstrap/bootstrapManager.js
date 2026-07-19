import { BootstrapConfiguration, BootstrapPlan, BootstrapReport, DependencyValidationResult, ReadinessSnapshot, StartupSequence, } from "./types/bootstrapTypes.js";
import { DEFAULT_BOOTSTRAP_STARTUP_ORDER } from "./types/bootstrapTypes.js";
import { HealthSnapshot, CompositionConfiguration } from "../composition/index.js";
export class DistributionBootstrapRegistry {
    checkpoints;
    constructor(checkpoints) {
        this.checkpoints = checkpoints;
    }
    register(checkpoint) {
        this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    }
    list() {
        return Object.freeze([...this.checkpoints.values()]);
    }
}
export class DistributionBootstrapManager {
    registry;
    metrics;
    healthSnapshots;
    dependencyGraphFactory;
    reports = [];
    logs = [];
    constructor(registry, metrics, healthSnapshots, dependencyGraphFactory) {
        this.registry = registry;
        this.metrics = metrics;
        this.healthSnapshots = healthSnapshots;
        this.dependencyGraphFactory = dependencyGraphFactory;
    }
    createPlan(configuration) {
        return new BootstrapPlan({
            planId: `${configuration.configurationId}:plan`,
            modules: DEFAULT_BOOTSTRAP_STARTUP_ORDER.filter((step) => step !== "Composition"),
            environment: configuration.environment,
            timeoutMs: configuration.startupTimeoutMs,
            featureFlags: configuration.featureFlags,
            metadata: configuration.metadata,
        });
    }
    validatePlan(plan) {
        const graph = this.dependencyGraphFactory(new CompositionConfiguration({
            compositionId: `${plan.planId}:composition`,
            environment: plan.environment,
            lazyLoading: false,
            featureFlags: plan.featureFlags,
            metadata: plan.metadata,
        }));
        const missingModules = plan.modules.filter((module) => !graph.modules.some((descriptor) => descriptor.moduleName === module));
        return new DependencyValidationResult({
            validationId: `${plan.planId}:validation`,
            valid: missingModules.length === 0,
            errors: missingModules.length ? [`Missing modules: ${missingModules.join(", ")}`] : [],
            warnings: [],
            graph,
            metadata: plan.metadata,
        });
    }
    createReadiness(sequence, validation) {
        return new ReadinessSnapshot({
            snapshotId: `${sequence.sequenceId}:readiness`,
            ready: validation.valid && sequence.modules.length > 0,
            health: this.createHealth(sequence, validation),
            loadedModules: sequence.modules,
            metadata: sequence.metadata,
        });
    }
    createHealth(sequence, validation) {
        const health = new HealthSnapshot({
            snapshotId: `${sequence.sequenceId}:health`,
            healthy: validation.valid,
            moduleCount: sequence.modules.length,
            unhealthyModuleCount: validation.valid ? 0 : 1,
            details: {
                sequenceId: sequence.sequenceId,
                valid: validation.valid,
            },
            metadata: sequence.metadata,
        });
        this.healthSnapshots.set(health.snapshotId, health);
        return health;
    }
    async bootstrap(configuration) {
        const plan = this.createPlan(configuration);
        const validation = this.validatePlan(plan);
        const sequence = await this.start(plan);
        const readiness = this.createReadiness(sequence, validation);
        return new BootstrapReport({
            reportId: `${configuration.configurationId}:report`,
            configuration,
            plan,
            startupSequence: sequence,
            validation,
            readiness,
            startedAt: sequence.startedAt,
            completedAt: new Date().toISOString(),
            success: validation.valid && readiness.ready,
            failure: !(validation.valid && readiness.ready),
            warnings: validation.warnings,
            errors: validation.errors,
            metadata: configuration.metadata,
        });
    }
    async start(plan) {
        const sequence = new StartupSequence({
            sequenceId: `${plan.planId}:startup`,
            plan,
            modules: plan.modules,
            startedAt: new Date().toISOString(),
            metadata: plan.metadata,
        });
        sequence.modules.forEach((moduleName, index) => {
            this.registry.register({
                checkpointId: `${sequence.sequenceId}:${moduleName}:${index}`,
                sequenceId: sequence.sequenceId,
                moduleName,
                stage: `start:${moduleName}`,
                createdAt: new Date().toISOString(),
                metadata: sequence.metadata,
            });
        });
        return sequence;
    }
    async shutdown(sequence) {
        const configuration = new BootstrapConfiguration({
            configurationId: `${sequence.sequenceId}:configuration`,
            environment: "production",
            startupTimeoutMs: sequence.timeoutMs,
            shutdownTimeoutMs: sequence.timeoutMs,
            dependencyValidationEnabled: true,
            gracefulShutdown: sequence.graceful,
            featureFlags: {},
            metadata: sequence.metadata,
        });
        return new BootstrapReport({
            reportId: `${sequence.sequenceId}:shutdown`,
            configuration,
            shutdownSequence: sequence,
            startedAt: sequence.initiatedAt,
            completedAt: new Date().toISOString(),
            success: true,
            failure: false,
            warnings: [],
            errors: [],
            metadata: sequence.metadata,
        });
    }
    resolve(configuration) {
        return this.start(this.createPlan(configuration));
    }
    report(report) {
        this.reports.push(report);
    }
    increment(metric, value = 1, tags) {
        void tags;
        this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
    }
    observe(metric, value, tags) {
        void tags;
        this.metrics.set(metric, value);
    }
    gauge(metric, value, tags) {
        void tags;
        this.metrics.set(metric, value);
    }
    debug(message, context) {
        this.logs.push({ level: "debug", message, context });
    }
    info(message, context) {
        this.logs.push({ level: "info", message, context });
    }
    warn(message, context) {
        this.logs.push({ level: "warn", message, context });
    }
    error(message, context) {
        this.logs.push({ level: "error", message, context });
    }
}
