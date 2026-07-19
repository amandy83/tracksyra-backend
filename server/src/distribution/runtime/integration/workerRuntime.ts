import { ReleaseId } from "../../domain";
import type { DistributionApplicationDependencies } from "../../application/dependencyTypes";
import { ActivateCatalog } from "../../application";
import { DistributionOrchestrator } from "../../application/services";
import type {
  CancellationService,
  CheckpointService,
  ConcurrencyController,
  HeartbeatService,
  LeaseService,
  PipelineExecutor,
  RecoveryService,
  WorkerConfigurationProvider,
  WorkerDispatcher,
  WorkerExecutor,
  WorkerFactory,
  WorkerHealthChecker,
  WorkerLogger,
  WorkerMiddleware,
  WorkerRegistry,
  WorkerRunner,
  WorkerRuntime,
  WorkerScheduler,
  WorkerMetricsCollector,
  WorkerMiddlewareNext,
} from "./contracts/workerRuntimeContracts";
import type {
  WorkerCheckpoint,
  WorkerConfiguration,
  WorkerExecutionContext,
  WorkerExecutionRequest,
  WorkerExecutionResult,
  WorkerHeartbeat,
  WorkerHealthStatus,
  WorkerLease,
  WorkerMetadata,
  WorkerPipelineExecution,
  WorkerRecovery,
  WorkerStatistics,
} from "./types/workerIntegrationTypes";
import {
  WorkerCheckpoint as WorkerCheckpointModel,
  WorkerConfiguration as WorkerConfigurationModel,
  WorkerExecutionContext as WorkerExecutionContextModel,
  WorkerExecutionRequest as WorkerExecutionRequestModel,
  WorkerExecutionResult as WorkerExecutionResultModel,
  WorkerHeartbeat as WorkerHeartbeatModel,
  WorkerHealthStatus as WorkerHealthStatusModel,
  WorkerLease as WorkerLeaseModel,
  WorkerPipelineExecution as WorkerPipelineExecutionModel,
  WorkerRecovery as WorkerRecoveryModel,
  WorkerStatistics as WorkerStatisticsModel,
} from "./types/workerIntegrationTypes";
import { QueueCheckpoint as QueueCheckpointModel } from "../../queue/integration/types/queueIntegrationTypes";
import type { RuntimeRepository } from "../../infrastructure/repositories/runtime";

export type WorkerRepositoryBundle = Readonly<{
  configurations: RuntimeRepository<string, WorkerConfiguration>;
  workers: RuntimeRepository<string, WorkerRuntime>;
  leases: RuntimeRepository<string, WorkerLease>;
  heartbeats: RuntimeRepository<string, WorkerHeartbeat>;
  checkpoints: RuntimeRepository<string, WorkerCheckpoint>;
  recoveries: RuntimeRepository<string, WorkerRecovery>;
  cancellations: RuntimeRepository<string, { readonly workerId: string; readonly executionId: string; readonly reason: string | null; readonly cancelledAt: string }>;
  activeExecutions: RuntimeRepository<string, string>;
  health: RuntimeRepository<string, WorkerHealthStatus>;
  statistics: RuntimeRepository<string, WorkerStatistics>;
  metrics: RuntimeRepository<string, number>;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function isoPlus(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function buildConfiguration(input: Partial<WorkerConfiguration> & { workerId: string; queueName: string }): WorkerConfiguration {
  return new WorkerConfigurationModel({
    configurationId: `${input.workerId}:configuration`,
    workerId: input.workerId,
    queueName: input.queueName,
    enabled: input.enabled ?? true,
    concurrency: input.concurrency ?? 1,
    heartbeatIntervalMs: input.heartbeatIntervalMs ?? 15_000,
    checkpointIntervalMs: input.checkpointIntervalMs ?? 15_000,
    leaseDurationMs: input.leaseDurationMs ?? 60_000,
    restartOnFailure: input.restartOnFailure ?? true,
    metadata: input.metadata ?? {},
  });
}

function cloneExecutionContext(
  context: WorkerExecutionContext,
  patch: Partial<{
    stage: string;
    state: WorkerExecutionContext["state"];
    retryCount: number;
    lease: WorkerLease | null;
    heartbeat: WorkerHeartbeat | null;
    checkpoint: WorkerCheckpoint | null;
    recovery: WorkerRecovery | null;
    pipelineExecution: WorkerPipelineExecution | null;
    cancellationRequested: boolean;
    cancellationReason: string | null;
  }> = {},
): WorkerExecutionContext {
  return new WorkerExecutionContextModel({
    workerId: context.workerId,
    orchestrationId: context.orchestrationId,
    executionId: context.executionId,
    releaseId: context.releaseId,
    jobId: context.jobId,
    queueName: context.queueName,
    pipelineName: context.pipelineName,
    stage: patch.stage ?? context.stage,
    state: patch.state ?? context.state,
    retryCount: patch.retryCount ?? context.retryCount,
    lease: patch.lease ?? context.lease,
    heartbeat: patch.heartbeat ?? context.heartbeat,
    checkpoint: patch.checkpoint ?? context.checkpoint,
    recovery: patch.recovery ?? context.recovery,
    queueEnvelope: context.queueEnvelope,
    pipelineExecution: patch.pipelineExecution ?? context.pipelineExecution,
    startedAt: context.startedAt,
    updatedAt: nowIso(),
    completedAt: context.completedAt,
    cancellationRequested: patch.cancellationRequested ?? context.cancellationRequested,
    cancellationReason: patch.cancellationReason ?? context.cancellationReason,
    metadata: context.metadata,
  });
}

function buildPipelineExecution(context: WorkerExecutionContext): WorkerPipelineExecution {
  return new WorkerPipelineExecutionModel({
    pipelineExecutionId: `${context.executionId}:pipeline`,
    workerId: context.workerId,
    executionId: context.executionId,
    pipelineName: context.pipelineName,
    currentStage: context.stage,
    completedStages: context.pipelineExecution?.completedStages ?? [],
    pendingStages: context.pipelineExecution?.pendingStages ?? [],
    startedAt: context.startedAt,
    updatedAt: context.updatedAt,
    finishedAt: context.completedAt,
    metadata: context.metadata,
  });
}

function buildStatistics(
  workerId: string,
  executionId: string,
  executionDurationMs: number,
  retryCount: number,
  checkpointCount: number,
  recoveryCount: number,
  failureCount: number,
  heartbeatLatencyMs: number,
  workerUtilization: number,
): WorkerStatistics {
  return new WorkerStatisticsModel({
    workerId,
    executionId,
    executionDurationMs,
    retryCount,
    checkpointCount,
    recoveryCount,
    failureCount,
    heartbeatLatencyMs,
    workerUtilization,
    sampledAt: nowIso(),
    metadata: { workerId, executionId },
  });
}

function buildHealth(workerId: string, healthy: boolean, details: Readonly<Record<string, unknown>> = {}): WorkerHealthStatus {
  return new WorkerHealthStatusModel({
    statusId: `${workerId}:health:${Date.now()}`,
    workerId,
    state: healthy ? "Healthy" : "Unhealthy",
    healthy,
    checkedAt: nowIso(),
    details,
    metadata: details,
  });
}

export class DistributionWorkerLogger implements WorkerLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.debug(`[distribution-runtime] ${message}`, context ?? {});
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.info(`[distribution-runtime] ${message}`, context ?? {});
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.warn(`[distribution-runtime] ${message}`, context ?? {});
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.error(`[distribution-runtime] ${message}`, context ?? {});
  }
}

export class DistributionWorkerMetricsCollector implements WorkerMetricsCollector {
  private readonly stats = new Map<string, WorkerStatistics>();
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly observations = new Map<string, number[]>();

  increment(metric: string, value = 1, tags?: Readonly<Record<string, string | number | boolean>>): void {
    const key = this.key(metric, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    const key = this.key(metric, tags);
    const current = this.observations.get(key) ?? [];
    current.push(value);
    this.observations.set(key, current);
  }

  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    this.gauges.set(this.key(metric, tags), value);
  }

  snapshot(workerId: string): Promise<WorkerStatistics> | WorkerStatistics {
    return this.stats.get(workerId) ?? buildStatistics(workerId, workerId, 0, 0, 0, 0, 0, 0, 0);
  }

  record(statistics: WorkerStatistics): void {
    this.stats.set(statistics.workerId, statistics);
  }

  private key(metric: string, tags?: Readonly<Record<string, string | number | boolean>>): string {
    return tags ? `${metric}:${JSON.stringify(tags)}` : metric;
  }
}

export class DistributionWorkerConfigurationProvider implements WorkerConfigurationProvider {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  load(workerId: string): Promise<WorkerConfiguration | null> | WorkerConfiguration | null {
    return this.state.configurations.get(workerId) ?? null;
  }

  save(configuration: WorkerConfiguration): Promise<void> | void {
    this.state.configurations.set(configuration.workerId, configuration);
  }

  list(): Promise<readonly WorkerConfiguration[]> | readonly WorkerConfiguration[] {
    return Object.freeze([...this.state.configurations.values()]);
  }
}

export class DistributionWorkerRegistry implements WorkerRegistry {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  register(worker: WorkerRuntime): void {
    const typedWorker = worker as WorkerRuntime & { readonly workerId?: string; readonly configuration?: WorkerConfiguration };
    const workerId = typedWorker.workerId?.trim() || `worker:${this.state.workers.size + 1}`;
    const configuration = typedWorker.configuration ?? buildConfiguration({ workerId, queueName: "distribution" });
    this.state.workers.set(workerId, worker);
    this.state.configurations.set(workerId, configuration);
  }

  resolve(workerId: string): WorkerRuntime | null {
    return this.state.workers.get(workerId) ?? null;
  }

  list(): readonly WorkerRuntime[] {
    return Object.freeze([...this.state.workers.values()]);
  }
}

export class DistributionWorkerLeaseService implements LeaseService {
  constructor(private readonly state: WorkerRepositoryBundle, private readonly leaseDurationMs = 60_000) {}

  acquire(resource: string, owner: string, workerId: string, executionId: string): Promise<WorkerLease | null> | WorkerLease | null {
    const current = this.state.leases.get(resource);
    if (current && current.expiresAt > nowIso()) {
      return null;
    }
    const lease = new WorkerLeaseModel({
      leaseId: `${resource}:${executionId}:${Date.now()}`,
      workerId,
      executionId,
      resource,
      owner,
      acquiredAt: nowIso(),
      expiresAt: isoPlus(this.leaseDurationMs),
      renewCount: 0,
      metadata: { resource, workerId, executionId, owner },
    });
    this.state.leases.set(resource, lease);
    return lease;
  }

  renew(lease: WorkerLease): Promise<WorkerLease | null> | WorkerLease | null {
    const renewed = new WorkerLeaseModel({
      leaseId: lease.leaseId,
      workerId: lease.workerId,
      executionId: lease.executionId,
      resource: lease.resource,
      owner: lease.owner,
      acquiredAt: lease.acquiredAt,
      expiresAt: isoPlus(this.leaseDurationMs),
      renewCount: lease.renewCount + 1,
      metadata: lease.metadata,
    });
    this.state.leases.set(lease.resource, renewed);
    return renewed;
  }

  release(lease: WorkerLease): Promise<boolean> | boolean {
    const current = this.state.leases.get(lease.resource);
    if (!current || current.leaseId !== lease.leaseId) {
      return false;
    }
    this.state.leases.delete(lease.resource);
    return true;
  }

  expire(lease: WorkerLease): Promise<boolean> | boolean {
    return this.release(lease);
  }
}

export class DistributionWorkerHeartbeatService implements HeartbeatService {
  constructor(private readonly state: WorkerRepositoryBundle, private readonly heartbeatIntervalMs = 15_000) {}

  start(lease: WorkerLease): Promise<WorkerHeartbeat> | WorkerHeartbeat {
    const heartbeat = new WorkerHeartbeatModel({
      heartbeatId: `${lease.workerId}:${lease.executionId}:${Date.now()}`,
      workerId: lease.workerId,
      executionId: lease.executionId,
      queueName: lease.resource,
      occurredAt: nowIso(),
      expiresAt: isoPlus(this.heartbeatIntervalMs),
      latencyMs: 0,
      metadata: lease.metadata,
    });
    this.state.heartbeats.set(lease.workerId, heartbeat);
    return heartbeat;
  }

  renew(heartbeat: WorkerHeartbeat): Promise<WorkerHeartbeat> | WorkerHeartbeat {
    const renewed = new WorkerHeartbeatModel({
      heartbeatId: heartbeat.heartbeatId,
      workerId: heartbeat.workerId,
      executionId: heartbeat.executionId,
      queueName: heartbeat.queueName,
      occurredAt: nowIso(),
      expiresAt: isoPlus(this.heartbeatIntervalMs),
      latencyMs: heartbeat.latencyMs,
      metadata: heartbeat.metadata,
    });
    this.state.heartbeats.set(heartbeat.workerId, renewed);
    return renewed;
  }

  stop(heartbeat: WorkerHeartbeat): Promise<boolean> | boolean {
    return this.state.heartbeats.delete(heartbeat.workerId);
  }

  isExpired(heartbeat: WorkerHeartbeat): boolean {
    return heartbeat.expiresAt <= nowIso();
  }
}

export class DistributionWorkerCheckpointService implements CheckpointService {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  create(context: WorkerExecutionContext, stage: string): Promise<WorkerCheckpoint> | WorkerCheckpoint {
    const checkpoint = new WorkerCheckpointModel({
      checkpointId: `${context.executionId}:${stage}:${Date.now()}`,
      workerId: context.workerId,
      executionId: context.executionId,
      stage,
      queueCheckpoint: new QueueCheckpointModel({
        checkpointId: `${context.executionId}:${stage}:${Date.now()}`,
        executionId: context.executionId,
        queueName: context.queueName,
        stage,
        createdAt: nowIso(),
        completedStages: context.pipelineExecution?.completedStages ?? [],
        retryCount: context.retryCount,
        metadata: context.metadata,
      }),
      createdAt: nowIso(),
      completedStages: context.pipelineExecution?.completedStages ?? [],
      retryCount: context.retryCount,
      metadata: context.metadata,
    });
    this.state.checkpoints.set(checkpoint.checkpointId, checkpoint);
    return checkpoint;
  }

  restore(workerId: string, executionId: string, checkpointId: string): Promise<WorkerCheckpoint | null> | WorkerCheckpoint | null {
    const checkpoint = this.state.checkpoints.get(checkpointId) ?? null;
    return checkpoint && checkpoint.workerId === workerId && checkpoint.executionId === executionId ? checkpoint : null;
  }

  validate(checkpoint: WorkerCheckpoint): boolean {
    return Boolean(checkpoint.checkpointId && checkpoint.workerId && checkpoint.executionId && checkpoint.stage);
  }

  cleanup(workerId: string, executionId: string): Promise<number> | number {
    let removed = 0;
    for (const [key, value] of this.state.checkpoints.entries()) {
      if (value.workerId === workerId && value.executionId === executionId) {
        this.state.checkpoints.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

export class DistributionWorkerRecoveryService implements RecoveryService {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  recover(context: WorkerExecutionContext, checkpoint: WorkerCheckpoint | null): Promise<WorkerRecovery> | WorkerRecovery {
    const recovery = new WorkerRecoveryModel({
      recoveryId: `${context.workerId}:${context.executionId}:recovery:${Date.now()}`,
      workerId: context.workerId,
      executionId: context.executionId,
      checkpoint,
      resumed: Boolean(checkpoint),
      reason: checkpoint ? "Checkpoint restore" : null,
      recoveredAt: nowIso(),
      metadata: context.metadata,
    });
    this.state.recoveries.set(recovery.recoveryId, recovery);
    return recovery;
  }
}

export class DistributionWorkerCancellationService implements CancellationService {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  request(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext {
    const cancelled = cloneExecutionContext(context, {
      cancellationRequested: true,
      cancellationReason: reason,
      state: "Cancelled",
    });
    this.state.cancellations.set(context.executionId, {
      workerId: context.workerId,
      executionId: context.executionId,
      reason,
      cancelledAt: nowIso(),
    });
    return cancelled;
  }

  cancel(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext {
    return this.request(context, reason);
  }

  isCancelled(context: WorkerExecutionContext): boolean {
    return context.cancellationRequested;
  }
}

export class DistributionWorkerConcurrencyController implements ConcurrencyController {
  constructor(private readonly state: WorkerRepositoryBundle) {}

  canRun(context: WorkerExecutionContext): boolean {
    const active = this.state.activeExecutions.get(context.releaseId);
    return !active || active === context.executionId;
  }

  acquire(context: WorkerExecutionContext): Promise<boolean> | boolean {
    if (!this.canRun(context)) {
      return false;
    }
    this.state.activeExecutions.set(context.releaseId, context.executionId);
    return true;
  }

  release(context: WorkerExecutionContext): Promise<boolean> | boolean {
    const active = this.state.activeExecutions.get(context.releaseId);
    if (active !== context.executionId) {
      return false;
    }
    this.state.activeExecutions.delete(context.releaseId);
    return true;
  }

  resolveConflict(context: WorkerExecutionContext, conflicting: WorkerExecutionContext): string {
    return `Conflict between ${context.executionId} and ${conflicting.executionId} for release ${context.releaseId}`;
  }
}

export class DistributionWorkerHealthChecker implements WorkerHealthChecker {
  constructor(
    private readonly configurationProvider: WorkerConfigurationProvider,
    private readonly state: WorkerRepositoryBundle,
  ) {}

  check(configuration: WorkerConfiguration): Promise<WorkerHealthStatus> | WorkerHealthStatus {
    const healthy = configuration.enabled && configuration.concurrency >= 1;
    const health = buildHealth(configuration.workerId, healthy, {
      queueName: configuration.queueName,
      concurrency: configuration.concurrency,
      enabled: configuration.enabled,
    });
    this.state.health.set(configuration.workerId, health);
    return health;
  }

  async probe(workerId: string): Promise<WorkerHealthStatus> {
    const configuration = await Promise.resolve(this.configurationProvider.load(workerId));
    return this.check(configuration ?? buildConfiguration({ workerId, queueName: "distribution" }));
  }
}

export class DistributionWorkerScheduler implements WorkerScheduler {
  schedule(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null {
    return pipeline.currentStage ?? pipeline.pendingStages[0] ?? context.stage;
  }

  next(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null {
    const stages = pipeline.pendingStages.length ? [...pipeline.pendingStages] : pipeline.currentStage ? [pipeline.currentStage] : [context.stage];
    const currentIndex = stages.findIndex((stage) => stage === context.stage);
    return currentIndex >= 0 ? stages[currentIndex + 1] ?? null : stages[0] ?? null;
  }
}

export class DistributionWorkerMiddlewareChain {
  private readonly middlewares: WorkerMiddleware[] = [];

  use(middleware: WorkerMiddleware): void {
    this.middlewares.push(middleware);
  }

  list(): readonly WorkerMiddleware[] {
    return Object.freeze([...this.middlewares]);
  }

  async handle(
    request: WorkerExecutionRequest,
    context: WorkerExecutionContext,
    terminal: WorkerMiddlewareNext,
  ): Promise<WorkerExecutionResult> {
    const invoke = async (index: number): Promise<WorkerExecutionResult> => {
      const middleware = this.middlewares[index];
      if (!middleware) {
        return await Promise.resolve(terminal.handle(request, context));
      }
      return await Promise.resolve(
        middleware.handle(request, context, {
          handle: (nextRequest: WorkerExecutionRequest, nextContext: WorkerExecutionContext) => invoke(index + 1),
        }),
      );
    };

    return await invoke(0);
  }
}

export class DistributionWorkerExecutor implements WorkerExecutor {
  constructor(
    private readonly orchestrator: DistributionOrchestrator,
    private readonly dependencies: DistributionApplicationDependencies,
    private readonly logger: WorkerLogger,
    private readonly metrics: DistributionWorkerMetricsCollector,
    private readonly leaseService: LeaseService,
    private readonly heartbeatService: HeartbeatService,
    private readonly checkpointService: CheckpointService,
    private readonly recoveryService: RecoveryService,
    private readonly cancellationService: CancellationService,
    private readonly concurrencyController: ConcurrencyController,
    private readonly scheduler: WorkerScheduler,
  ) {}

  async execute(context: WorkerExecutionContext): Promise<WorkerExecutionResult> {
    const startedAt = Date.now();
    const lease = await Promise.resolve(this.leaseService.acquire(context.queueName, context.workerId, context.workerId, context.executionId));

    if (!lease) {
      return new WorkerExecutionResultModel({
        success: false,
        failure: true,
        executionId: context.executionId,
        workerId: context.workerId,
        completedStage: context.stage,
        executionTime: Date.now() - startedAt,
        nextStage: null,
        checkpoint: context.checkpoint,
        errors: ["Worker lease is unavailable"],
        warnings: [],
        metadata: context.metadata,
      });
    }

    const heartbeat = await Promise.resolve(this.heartbeatService.start(lease));
    const runtimeContext = cloneExecutionContext(context, {
      lease,
      heartbeat,
      pipelineExecution: context.pipelineExecution ?? buildPipelineExecution(context),
    });

    if (this.cancellationService.isCancelled(runtimeContext)) {
      await Promise.resolve(this.leaseService.release(lease));
      return new WorkerExecutionResultModel({
        success: false,
        failure: true,
        executionId: runtimeContext.executionId,
        workerId: runtimeContext.workerId,
        completedStage: runtimeContext.stage,
        executionTime: Date.now() - startedAt,
        nextStage: null,
        checkpoint: runtimeContext.checkpoint,
        errors: [runtimeContext.cancellationReason ?? "Worker execution cancelled"],
        warnings: [],
        metadata: runtimeContext.metadata,
      });
    }

    const acquired = await Promise.resolve(this.concurrencyController.acquire(runtimeContext));
    if (!acquired) {
      await Promise.resolve(this.leaseService.release(lease));
      return new WorkerExecutionResultModel({
        success: false,
        failure: true,
        executionId: runtimeContext.executionId,
        workerId: runtimeContext.workerId,
        completedStage: runtimeContext.stage,
        executionTime: Date.now() - startedAt,
        nextStage: null,
        checkpoint: runtimeContext.checkpoint,
        errors: [this.concurrencyController.resolveConflict(runtimeContext, runtimeContext)],
        warnings: [],
        metadata: runtimeContext.metadata,
      });
    }

    try {
      this.logger.info("Worker execution started", {
        workerId: runtimeContext.workerId,
        executionId: runtimeContext.executionId,
        stage: runtimeContext.stage,
        pipelineName: runtimeContext.pipelineName,
      });

      await this.runStage(runtimeContext);
      const checkpoint = await Promise.resolve(this.checkpointService.create(runtimeContext, runtimeContext.stage));
      const executionTime = Date.now() - startedAt;
      const stats = buildStatistics(
        runtimeContext.workerId,
        runtimeContext.executionId,
        executionTime,
        runtimeContext.retryCount,
        1,
        runtimeContext.recovery ? 1 : 0,
        0,
        heartbeat.latencyMs,
        1,
      );
      this.metrics.record(stats);
      this.metrics.observe("worker.execution.duration", executionTime, { workerId: runtimeContext.workerId, stage: runtimeContext.stage });
      return new WorkerExecutionResultModel({
        success: true,
        failure: false,
        executionId: runtimeContext.executionId,
        workerId: runtimeContext.workerId,
        completedStage: runtimeContext.stage,
        executionTime,
        nextStage: runtimeContext.pipelineExecution ? this.scheduler.next(runtimeContext, runtimeContext.pipelineExecution) : null,
        checkpoint,
        warnings: [],
        statistics: stats,
        metadata: {
          ...runtimeContext.metadata,
          pipelineName: runtimeContext.pipelineName,
          stage: runtimeContext.stage,
        },
      });
    } catch (error) {
      const recovery = await Promise.resolve(this.recoveryService.recover(runtimeContext, runtimeContext.checkpoint));
      const checkpoint = runtimeContext.checkpoint ?? (await Promise.resolve(this.checkpointService.create(runtimeContext, runtimeContext.stage)));
      const message = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startedAt;
      const stats = buildStatistics(
        runtimeContext.workerId,
        runtimeContext.executionId,
        executionTime,
        runtimeContext.retryCount + 1,
        1,
        1,
        1,
        heartbeat.latencyMs,
        0,
      );
      this.metrics.record(stats);
      this.metrics.increment("worker.executions.failed", 1, { workerId: runtimeContext.workerId, stage: runtimeContext.stage });
      this.logger.error("Worker execution failed", {
        workerId: runtimeContext.workerId,
        executionId: runtimeContext.executionId,
        stage: runtimeContext.stage,
        error: message,
      });
      return new WorkerExecutionResultModel({
        success: false,
        failure: true,
        executionId: runtimeContext.executionId,
        workerId: runtimeContext.workerId,
        completedStage: runtimeContext.stage,
        executionTime,
        nextStage: null,
        checkpoint,
        errors: [message],
        warnings: [],
        statistics: stats,
        metadata: {
          ...runtimeContext.metadata,
          recoveryId: recovery.recoveryId,
          failedAt: nowIso(),
        },
      });
    } finally {
      await Promise.resolve(this.heartbeatService.stop(heartbeat));
      await Promise.resolve(this.leaseService.release(lease));
      await Promise.resolve(this.concurrencyController.release(runtimeContext));
    }
  }

  private async runStage(context: WorkerExecutionContext): Promise<void> {
    const releaseId = new ReleaseId(context.releaseId);
    const requestedBy = String(context.metadata.requestedBy ?? context.workerId);
    const commandBase = { releaseId, requestedBy };

    switch (context.stage) {
      case "Submission":
      case "SubmissionLock":
      case "Snapshot":
        await this.orchestrator.submit({
          releaseId,
          requestedBy,
          idempotencyKey: String(context.metadata.idempotencyKey ?? context.executionId),
        });
        return;
      case "Validation":
        await this.orchestrator.validate(commandBase);
        return;
      case "Approval":
        await this.orchestrator.approve({ releaseId, approvedBy: requestedBy });
        return;
      case "MetadataGeneration":
        await this.orchestrator.buildMetadata({ releaseId, requestedBy });
        return;
      case "PackageBuild":
        await this.orchestrator.buildPackage({ releaseId, requestedBy });
        return;
      case "PackageVerification":
        await this.orchestrator.verifyPackage({ releaseId, requestedBy });
        return;
      case "ProviderResolution":
        await this.orchestrator.selectProvider({ releaseId, requestedBy });
        return;
      case "ProviderAuthentication":
        await this.orchestrator.authenticateProvider({ releaseId, requestedBy });
        return;
      case "PackageUpload":
        await this.orchestrator.submitPackage({ releaseId, requestedBy });
        return;
      case "ProviderProcessing":
      case "StatusNormalization":
      case "StateTransition":
        await this.orchestrator.syncStatus(commandBase);
        return;
      case "DashboardProjection":
        await this.dependencies.artistDashboard.projectRelease(releaseId);
        return;
      case "NotificationDispatch":
        await this.dependencies.notificationSystem.notify("distribution_stage_completed", {
          releaseId: releaseId.value,
          stage: context.stage,
          pipeline: context.pipelineExecution?.pipelineName ?? context.pipelineName,
        });
        return;
      case "CatalogActivation":
        await new ActivateCatalog(this.dependencies).execute(commandBase);
        return;
      case "RoyaltyImport":
        await this.orchestrator.importRoyalties(commandBase);
        return;
      case "RevenueCalculation":
        await this.orchestrator.calculateRevenue(commandBase);
        return;
      case "PaymentProcessing":
        await this.orchestrator.processPayments({ releaseId, requestedBy });
        return;
      case "StatementGeneration":
        await this.dependencies.notificationSystem.notify("statement_generated", {
          releaseId: releaseId.value,
          executionId: context.executionId,
        });
        return;
      case "Archive":
        await this.orchestrator.archive({ releaseId, requestedBy });
        return;
      default:
        throw new Error(`Unsupported worker stage: ${context.stage}`);
    }
  }
}

export class DistributionPipelineExecutor implements PipelineExecutor {
  constructor(
    private readonly executor: WorkerExecutor,
    private readonly scheduler: WorkerScheduler,
  ) {}

  async execute(pipeline: WorkerPipelineExecution, context: WorkerExecutionContext): Promise<WorkerExecutionResult> {
    const stage = pipeline.currentStage ?? this.scheduler.schedule(context, pipeline) ?? context.stage;
    const pipelineContext = stage === context.stage
      ? context
      : cloneExecutionContext(context, { stage, pipelineExecution: new WorkerPipelineExecutionModel({
          pipelineExecutionId: pipeline.pipelineExecutionId,
          workerId: pipeline.workerId,
          executionId: pipeline.executionId,
          pipelineName: pipeline.pipelineName,
          currentStage: stage,
          completedStages: pipeline.completedStages,
          pendingStages: pipeline.pendingStages,
          startedAt: pipeline.startedAt,
          updatedAt: nowIso(),
          finishedAt: pipeline.finishedAt,
          metadata: pipeline.metadata,
        }) });
    return await Promise.resolve(this.executor.execute(pipelineContext));
  }
}

export class DistributionWorkerDispatcher implements WorkerDispatcher {
  constructor(
    private readonly executor: WorkerExecutor,
    private readonly middleware: DistributionWorkerMiddlewareChain,
  ) {}

  dispatch(request: WorkerExecutionRequest): Promise<void> | void {
    void this.middleware.handle(request, request.executionContext, {
      handle: async (_request: WorkerExecutionRequest, context: WorkerExecutionContext): Promise<WorkerExecutionResult> => {
        await Promise.resolve(this.executor.execute(context));
        return new WorkerExecutionResultModel({
          success: true,
          failure: false,
          executionId: context.executionId,
          workerId: context.workerId,
          completedStage: context.stage,
          executionTime: 0,
          nextStage: null,
          checkpoint: context.checkpoint,
          warnings: [],
          metadata: context.metadata,
        });
      },
    });
  }
}

export class DistributionWorkerRuntime implements WorkerRuntime, WorkerRunner {
  readonly workerId: string;
  readonly configuration: WorkerConfiguration;

  constructor(
    private readonly orchestrator: DistributionOrchestrator,
    private readonly dependencies: DistributionApplicationDependencies,
    private readonly executor: WorkerExecutor,
    private readonly pipelineExecutor: PipelineExecutor,
    private readonly dispatcher: WorkerDispatcher,
    workerId: string,
    configuration: WorkerConfiguration,
  ) {
    this.workerId = workerId;
    this.configuration = configuration;
  }

  run(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult {
    return this.execute(request);
  }

  execute(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult {
    return this.handle(request);
  }

  private async handle(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> {
    const pipeline = request.pipelineExecution ?? buildPipelineExecution(request.executionContext);
    return await Promise.resolve(this.pipelineExecutor.execute(pipeline, request.executionContext));
  }
}

export class DistributionWorkerFactory implements WorkerFactory {
  constructor(private readonly orchestrator: DistributionOrchestrator, private readonly dependencies: DistributionApplicationDependencies) {}

  create(configuration: WorkerConfiguration): WorkerRuntime {
    throw new Error("DistributionWorkerFactory requires explicit runtime injection");
  }
}

export function createWorkerRuntimeHealth(workerId: string, healthy: boolean): WorkerHealthStatus {
  return buildHealth(workerId, healthy);
}

export function createDistributionWorkerConfiguration(input: Partial<WorkerConfiguration> & { workerId: string; queueName: string }): WorkerConfiguration {
  return buildConfiguration(input);
}
