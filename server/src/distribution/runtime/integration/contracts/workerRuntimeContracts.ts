import type {
  WorkerCheckpoint,
  WorkerConfiguration,
  WorkerExecutionContext,
  WorkerExecutionRequest,
  WorkerExecutionResult,
  WorkerHeartbeat,
  WorkerHealthStatus,
  WorkerLease,
  WorkerPipelineExecution,
  WorkerRecovery,
  WorkerStatistics,
} from "../types/workerIntegrationTypes";

export interface WorkerRuntime {
  execute(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerRunner {
  run(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerExecutor {
  execute(context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerDispatcher {
  dispatch(request: WorkerExecutionRequest): Promise<void> | void;
}

export interface WorkerRegistry {
  register(worker: WorkerRuntime): void;
  resolve(workerId: string): WorkerRuntime | null;
  list(): readonly WorkerRuntime[];
}

export interface WorkerFactory {
  create(configuration: WorkerConfiguration): WorkerRuntime;
}

export interface PipelineExecutor {
  execute(pipeline: WorkerPipelineExecution, context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerScheduler {
  schedule(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null;
  next(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null;
}

export interface HeartbeatService {
  start(lease: WorkerLease): Promise<WorkerHeartbeat> | WorkerHeartbeat;
  renew(heartbeat: WorkerHeartbeat): Promise<WorkerHeartbeat> | WorkerHeartbeat;
  stop(heartbeat: WorkerHeartbeat): Promise<boolean> | boolean;
  isExpired(heartbeat: WorkerHeartbeat): boolean;
}

export interface LeaseService {
  acquire(resource: string, owner: string, workerId: string, executionId: string): Promise<WorkerLease | null> | WorkerLease | null;
  renew(lease: WorkerLease): Promise<WorkerLease | null> | WorkerLease | null;
  release(lease: WorkerLease): Promise<boolean> | boolean;
  expire(lease: WorkerLease): Promise<boolean> | boolean;
}

export interface CheckpointService {
  create(context: WorkerExecutionContext, stage: string): Promise<WorkerCheckpoint> | WorkerCheckpoint;
  restore(workerId: string, executionId: string, checkpointId: string): Promise<WorkerCheckpoint | null> | WorkerCheckpoint | null;
  validate(checkpoint: WorkerCheckpoint): boolean;
  cleanup(workerId: string, executionId: string): Promise<number> | number;
}

export interface RecoveryService {
  recover(context: WorkerExecutionContext, checkpoint: WorkerCheckpoint | null): Promise<WorkerRecovery> | WorkerRecovery;
}

export interface CancellationService {
  request(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext;
  cancel(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext;
  isCancelled(context: WorkerExecutionContext): boolean;
}

export interface ConcurrencyController {
  canRun(context: WorkerExecutionContext): boolean;
  acquire(context: WorkerExecutionContext): Promise<boolean> | boolean;
  release(context: WorkerExecutionContext): Promise<boolean> | boolean;
  resolveConflict(context: WorkerExecutionContext, conflicting: WorkerExecutionContext): string;
}

export interface WorkerMiddleware {
  handle(
    request: WorkerExecutionRequest,
    context: WorkerExecutionContext,
    next: WorkerMiddlewareNext,
  ): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerMiddlewareNext {
  handle(request: WorkerExecutionRequest, context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerHealthChecker {
  check(configuration: WorkerConfiguration): Promise<WorkerHealthStatus> | WorkerHealthStatus;
  probe(workerId: string): Promise<WorkerHealthStatus> | WorkerHealthStatus;
}

export interface WorkerMetricsCollector {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  snapshot(workerId: string): Promise<WorkerStatistics> | WorkerStatistics;
}

export interface WorkerLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface WorkerConfigurationProvider {
  load(workerId: string): Promise<WorkerConfiguration | null> | WorkerConfiguration | null;
  save(configuration: WorkerConfiguration): Promise<void> | void;
  list(): Promise<readonly WorkerConfiguration[]> | readonly WorkerConfiguration[];
}
