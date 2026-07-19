import {
  BootstrapConfiguration,
  BootstrapPlan,
  BootstrapReport,
  DependencyValidationResult,
  ReadinessSnapshot,
  ShutdownSequence,
  StartupCheckpoint,
  StartupSequence,
} from "./types/bootstrapTypes";
import { DEFAULT_BOOTSTRAP_STARTUP_ORDER } from "./types/bootstrapTypes";
import { HealthSnapshot, CompositionConfiguration, DependencyGraph } from "../composition";
import type { CompositionModuleName } from "../composition";
import { DistributionModuleRegistry, DistributionServiceRegistry } from "../composition";
import { distributionPersistenceBasePath } from "../infrastructure/repositories/persistencePaths";
import { createRuntimeRepository, type RuntimeRepository } from "../infrastructure/repositories/runtime";
import type {
  BootstrapManager,
  StartupCoordinator,
  ShutdownCoordinator,
  OrderingResolver,
  BootstrapRegistry,
  DiagnosticReporter,
  MetricsPublisher,
  BootstrapLogger,
} from "./contracts/bootstrapContracts";

export class DistributionBootstrapRegistry implements BootstrapRegistry {
  constructor(private readonly checkpoints: RuntimeRepository<string, StartupCheckpoint>) {}

  register(checkpoint: StartupCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
  }

  list(): readonly StartupCheckpoint[] {
    return Object.freeze([...this.checkpoints.values()]);
  }
}

export class DistributionBootstrapManager implements BootstrapManager, StartupCoordinator, ShutdownCoordinator, OrderingResolver, DiagnosticReporter, MetricsPublisher, BootstrapLogger {
  private readonly reports: BootstrapReport[] = [];
  private readonly logs: Array<{ level: "debug" | "info" | "warn" | "error"; message: string; context?: Readonly<Record<string, unknown>> }> = [];
  constructor(
    private readonly registry: DistributionBootstrapRegistry,
    private readonly metrics: RuntimeRepository<string, number>,
    private readonly healthSnapshots: RuntimeRepository<string, HealthSnapshot>,
    private readonly dependencyGraphFactory: (configuration: CompositionConfiguration) => DependencyGraph,
  ) {}

  private createPlan(configuration: BootstrapConfiguration): BootstrapPlan {
    return new BootstrapPlan({
      planId: `${configuration.configurationId}:plan`,
      modules: DEFAULT_BOOTSTRAP_STARTUP_ORDER.filter((step) => step !== "Composition") as unknown as readonly CompositionModuleName[],
      environment: configuration.environment,
      timeoutMs: configuration.startupTimeoutMs,
      featureFlags: configuration.featureFlags,
      metadata: configuration.metadata,
    });
  }

  private validatePlan(plan: BootstrapPlan): DependencyValidationResult {
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

  private createReadiness(sequence: StartupSequence, validation: DependencyValidationResult): ReadinessSnapshot {
    return new ReadinessSnapshot({
      snapshotId: `${sequence.sequenceId}:readiness`,
      ready: validation.valid && sequence.modules.length > 0,
      health: this.createHealth(sequence, validation),
      loadedModules: sequence.modules,
      metadata: sequence.metadata,
    });
  }

  private createHealth(sequence: StartupSequence, validation: DependencyValidationResult): HealthSnapshot {
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

  async bootstrap(configuration: BootstrapConfiguration): Promise<BootstrapReport> {
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

  async start(plan: BootstrapPlan): Promise<StartupSequence> {
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

  async shutdown(sequence: ShutdownSequence): Promise<BootstrapReport> {
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

  resolve(configuration: BootstrapConfiguration): Promise<StartupSequence> | StartupSequence {
    return this.start(this.createPlan(configuration));
  }

  report(report: BootstrapReport): void {
    this.reports.push(report);
  }

  increment(metric: string, value = 1, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.metrics.set(metric, (this.metrics.get(metric) ?? 0) + value);
  }

  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.metrics.set(metric, value);
  }

  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.metrics.set(metric, value);
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.logs.push({ level: "debug", message, context });
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.logs.push({ level: "info", message, context });
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.logs.push({ level: "warn", message, context });
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.logs.push({ level: "error", message, context });
  }
}
