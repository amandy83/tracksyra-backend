import { ReleaseId } from "../../domain/index.js";
import { ActivateCatalog } from "../../application/index.js";
import { WorkerCheckpoint as WorkerCheckpointModel, WorkerConfiguration as WorkerConfigurationModel, WorkerExecutionContext as WorkerExecutionContextModel, WorkerExecutionResult as WorkerExecutionResultModel, WorkerHeartbeat as WorkerHeartbeatModel, WorkerHealthStatus as WorkerHealthStatusModel, WorkerLease as WorkerLeaseModel, WorkerPipelineExecution as WorkerPipelineExecutionModel, WorkerRecovery as WorkerRecoveryModel, WorkerStatistics as WorkerStatisticsModel, } from "./types/workerIntegrationTypes.js";
import { QueueCheckpoint as QueueCheckpointModel } from "../../queue/integration/types/queueIntegrationTypes.js";
function nowIso() {
    return new Date().toISOString();
}
function isoPlus(ms) {
    return new Date(Date.now() + ms).toISOString();
}
function buildConfiguration(input) {
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
function cloneExecutionContext(context, patch = {}) {
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
function buildPipelineExecution(context) {
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
function buildStatistics(workerId, executionId, executionDurationMs, retryCount, checkpointCount, recoveryCount, failureCount, heartbeatLatencyMs, workerUtilization) {
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
function buildHealth(workerId, healthy, details = {}) {
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
export class DistributionWorkerLogger {
    debug(message, context) {
        console.debug(`[distribution-runtime] ${message}`, context ?? {});
    }
    info(message, context) {
        console.info(`[distribution-runtime] ${message}`, context ?? {});
    }
    warn(message, context) {
        console.warn(`[distribution-runtime] ${message}`, context ?? {});
    }
    error(message, context) {
        console.error(`[distribution-runtime] ${message}`, context ?? {});
    }
}
export class DistributionWorkerMetricsCollector {
    stats = new Map();
    counters = new Map();
    gauges = new Map();
    observations = new Map();
    increment(metric, value = 1, tags) {
        const key = this.key(metric, tags);
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    }
    observe(metric, value, tags) {
        const key = this.key(metric, tags);
        const current = this.observations.get(key) ?? [];
        current.push(value);
        this.observations.set(key, current);
    }
    gauge(metric, value, tags) {
        this.gauges.set(this.key(metric, tags), value);
    }
    snapshot(workerId) {
        return this.stats.get(workerId) ?? buildStatistics(workerId, workerId, 0, 0, 0, 0, 0, 0, 0);
    }
    record(statistics) {
        this.stats.set(statistics.workerId, statistics);
    }
    key(metric, tags) {
        return tags ? `${metric}:${JSON.stringify(tags)}` : metric;
    }
}
export class DistributionWorkerConfigurationProvider {
    state;
    constructor(state) {
        this.state = state;
    }
    load(workerId) {
        return this.state.configurations.get(workerId) ?? null;
    }
    save(configuration) {
        this.state.configurations.set(configuration.workerId, configuration);
    }
    list() {
        return Object.freeze([...this.state.configurations.values()]);
    }
}
export class DistributionWorkerRegistry {
    state;
    constructor(state) {
        this.state = state;
    }
    register(worker) {
        const typedWorker = worker;
        const workerId = typedWorker.workerId?.trim() || `worker:${this.state.workers.size + 1}`;
        const configuration = typedWorker.configuration ?? buildConfiguration({ workerId, queueName: "distribution" });
        this.state.workers.set(workerId, worker);
        this.state.configurations.set(workerId, configuration);
    }
    resolve(workerId) {
        return this.state.workers.get(workerId) ?? null;
    }
    list() {
        return Object.freeze([...this.state.workers.values()]);
    }
}
export class DistributionWorkerLeaseService {
    state;
    leaseDurationMs;
    constructor(state, leaseDurationMs = 60_000) {
        this.state = state;
        this.leaseDurationMs = leaseDurationMs;
    }
    acquire(resource, owner, workerId, executionId) {
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
    renew(lease) {
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
    release(lease) {
        const current = this.state.leases.get(lease.resource);
        if (!current || current.leaseId !== lease.leaseId) {
            return false;
        }
        this.state.leases.delete(lease.resource);
        return true;
    }
    expire(lease) {
        return this.release(lease);
    }
}
export class DistributionWorkerHeartbeatService {
    state;
    heartbeatIntervalMs;
    constructor(state, heartbeatIntervalMs = 15_000) {
        this.state = state;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
    }
    start(lease) {
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
    renew(heartbeat) {
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
    stop(heartbeat) {
        return this.state.heartbeats.delete(heartbeat.workerId);
    }
    isExpired(heartbeat) {
        return heartbeat.expiresAt <= nowIso();
    }
}
export class DistributionWorkerCheckpointService {
    state;
    constructor(state) {
        this.state = state;
    }
    create(context, stage) {
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
    restore(workerId, executionId, checkpointId) {
        const checkpoint = this.state.checkpoints.get(checkpointId) ?? null;
        return checkpoint && checkpoint.workerId === workerId && checkpoint.executionId === executionId ? checkpoint : null;
    }
    validate(checkpoint) {
        return Boolean(checkpoint.checkpointId && checkpoint.workerId && checkpoint.executionId && checkpoint.stage);
    }
    cleanup(workerId, executionId) {
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
export class DistributionWorkerRecoveryService {
    state;
    constructor(state) {
        this.state = state;
    }
    recover(context, checkpoint) {
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
export class DistributionWorkerCancellationService {
    state;
    constructor(state) {
        this.state = state;
    }
    request(context, reason) {
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
    cancel(context, reason) {
        return this.request(context, reason);
    }
    isCancelled(context) {
        return context.cancellationRequested;
    }
}
export class DistributionWorkerConcurrencyController {
    state;
    constructor(state) {
        this.state = state;
    }
    canRun(context) {
        const active = this.state.activeExecutions.get(context.releaseId);
        return !active || active === context.executionId;
    }
    acquire(context) {
        if (!this.canRun(context)) {
            return false;
        }
        this.state.activeExecutions.set(context.releaseId, context.executionId);
        return true;
    }
    release(context) {
        const active = this.state.activeExecutions.get(context.releaseId);
        if (active !== context.executionId) {
            return false;
        }
        this.state.activeExecutions.delete(context.releaseId);
        return true;
    }
    resolveConflict(context, conflicting) {
        return `Conflict between ${context.executionId} and ${conflicting.executionId} for release ${context.releaseId}`;
    }
}
export class DistributionWorkerHealthChecker {
    configurationProvider;
    state;
    constructor(configurationProvider, state) {
        this.configurationProvider = configurationProvider;
        this.state = state;
    }
    check(configuration) {
        const healthy = configuration.enabled && configuration.concurrency >= 1;
        const health = buildHealth(configuration.workerId, healthy, {
            queueName: configuration.queueName,
            concurrency: configuration.concurrency,
            enabled: configuration.enabled,
        });
        this.state.health.set(configuration.workerId, health);
        return health;
    }
    async probe(workerId) {
        const configuration = await Promise.resolve(this.configurationProvider.load(workerId));
        return this.check(configuration ?? buildConfiguration({ workerId, queueName: "distribution" }));
    }
}
export class DistributionWorkerScheduler {
    schedule(context, pipeline) {
        return pipeline.currentStage ?? pipeline.pendingStages[0] ?? context.stage;
    }
    next(context, pipeline) {
        const stages = pipeline.pendingStages.length ? [...pipeline.pendingStages] : pipeline.currentStage ? [pipeline.currentStage] : [context.stage];
        const currentIndex = stages.findIndex((stage) => stage === context.stage);
        return currentIndex >= 0 ? stages[currentIndex + 1] ?? null : stages[0] ?? null;
    }
}
export class DistributionWorkerMiddlewareChain {
    middlewares = [];
    use(middleware) {
        this.middlewares.push(middleware);
    }
    list() {
        return Object.freeze([...this.middlewares]);
    }
    async handle(request, context, terminal) {
        const invoke = async (index) => {
            const middleware = this.middlewares[index];
            if (!middleware) {
                return await Promise.resolve(terminal.handle(request, context));
            }
            return await Promise.resolve(middleware.handle(request, context, {
                handle: (nextRequest, nextContext) => invoke(index + 1),
            }));
        };
        return await invoke(0);
    }
}
export class DistributionWorkerExecutor {
    orchestrator;
    dependencies;
    logger;
    metrics;
    leaseService;
    heartbeatService;
    checkpointService;
    recoveryService;
    cancellationService;
    concurrencyController;
    scheduler;
    constructor(orchestrator, dependencies, logger, metrics, leaseService, heartbeatService, checkpointService, recoveryService, cancellationService, concurrencyController, scheduler) {
        this.orchestrator = orchestrator;
        this.dependencies = dependencies;
        this.logger = logger;
        this.metrics = metrics;
        this.leaseService = leaseService;
        this.heartbeatService = heartbeatService;
        this.checkpointService = checkpointService;
        this.recoveryService = recoveryService;
        this.cancellationService = cancellationService;
        this.concurrencyController = concurrencyController;
        this.scheduler = scheduler;
    }
    async execute(context) {
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
            const stats = buildStatistics(runtimeContext.workerId, runtimeContext.executionId, executionTime, runtimeContext.retryCount, 1, runtimeContext.recovery ? 1 : 0, 0, heartbeat.latencyMs, 1);
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
        }
        catch (error) {
            const recovery = await Promise.resolve(this.recoveryService.recover(runtimeContext, runtimeContext.checkpoint));
            const checkpoint = runtimeContext.checkpoint ?? (await Promise.resolve(this.checkpointService.create(runtimeContext, runtimeContext.stage)));
            const message = error instanceof Error ? error.message : String(error);
            const executionTime = Date.now() - startedAt;
            const stats = buildStatistics(runtimeContext.workerId, runtimeContext.executionId, executionTime, runtimeContext.retryCount + 1, 1, 1, 1, heartbeat.latencyMs, 0);
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
        }
        finally {
            await Promise.resolve(this.heartbeatService.stop(heartbeat));
            await Promise.resolve(this.leaseService.release(lease));
            await Promise.resolve(this.concurrencyController.release(runtimeContext));
        }
    }
    async runStage(context) {
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
export class DistributionPipelineExecutor {
    executor;
    scheduler;
    constructor(executor, scheduler) {
        this.executor = executor;
        this.scheduler = scheduler;
    }
    async execute(pipeline, context) {
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
export class DistributionWorkerDispatcher {
    executor;
    middleware;
    constructor(executor, middleware) {
        this.executor = executor;
        this.middleware = middleware;
    }
    dispatch(request) {
        void this.middleware.handle(request, request.executionContext, {
            handle: async (_request, context) => {
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
export class DistributionWorkerRuntime {
    orchestrator;
    dependencies;
    executor;
    pipelineExecutor;
    dispatcher;
    workerId;
    configuration;
    constructor(orchestrator, dependencies, executor, pipelineExecutor, dispatcher, workerId, configuration) {
        this.orchestrator = orchestrator;
        this.dependencies = dependencies;
        this.executor = executor;
        this.pipelineExecutor = pipelineExecutor;
        this.dispatcher = dispatcher;
        this.workerId = workerId;
        this.configuration = configuration;
    }
    run(request) {
        return this.execute(request);
    }
    execute(request) {
        return this.handle(request);
    }
    async handle(request) {
        const pipeline = request.pipelineExecution ?? buildPipelineExecution(request.executionContext);
        return await Promise.resolve(this.pipelineExecutor.execute(pipeline, request.executionContext));
    }
}
export class DistributionWorkerFactory {
    orchestrator;
    dependencies;
    constructor(orchestrator, dependencies) {
        this.orchestrator = orchestrator;
        this.dependencies = dependencies;
    }
    create(configuration) {
        throw new Error("DistributionWorkerFactory requires explicit runtime injection");
    }
}
export function createWorkerRuntimeHealth(workerId, healthy) {
    return buildHealth(workerId, healthy);
}
export function createDistributionWorkerConfiguration(input) {
    return buildConfiguration(input);
}
