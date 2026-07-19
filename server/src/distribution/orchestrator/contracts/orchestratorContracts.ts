import type { OrchestratorContext, OrchestrationResult } from "../types/orchestratorTypes";
import type { OrchestratorPipeline } from "../pipeline/orchestratorPipeline";
import type { OrchestratorStage } from "../stage/orchestratorStage";
import type { OrchestratorExecution } from "../execution/orchestratorExecution";
import type { OrchestratorCheckpoint } from "../checkpoint/orchestratorCheckpoint";
import type { OrchestratorRecovery } from "../recovery/orchestratorRecovery";
import type { OrchestratorLifecycle } from "../lifecycle/orchestratorLifecycle";

export interface DistributionOrchestrator {
  orchestrate(context: OrchestratorContext): Promise<OrchestrationResult> | OrchestrationResult;
}

export interface SubmissionCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface ValidationCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface ApprovalCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface MetadataCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface PackageCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface ProviderCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface ExecutionCoordinator {
  coordinate(execution: OrchestratorExecution): Promise<OrchestratorExecution> | OrchestratorExecution;
}

export interface StatusCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface RoyaltyCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface ArchiveCoordinator {
  coordinate(context: OrchestratorContext): Promise<OrchestratorContext> | OrchestratorContext;
}

export interface PipelineCoordinator {
  coordinate(pipeline: OrchestratorPipeline): Promise<void> | void;
}

export interface RecoveryCoordinator {
  recover(orchestrationId: string, releaseId: string, checkpoint?: OrchestratorCheckpoint | null): Promise<OrchestratorRecovery> | OrchestratorRecovery;
}

export interface CheckpointCoordinator {
  create(stage: string, orchestrationId: string, releaseId: string): OrchestratorCheckpoint;
  restore(checkpointId: string): OrchestratorCheckpoint | null;
  validate(checkpoint: OrchestratorCheckpoint): boolean;
  cleanup(orchestrationId: string): number;
}

export interface LifecycleCoordinator {
  create(orchestrationId: string, releaseId: string): OrchestratorLifecycle;
  reserve(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  start(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  running(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  checkpointing(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  complete(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  fail(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  cancel(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
  recover(lifecycle: OrchestratorLifecycle): OrchestratorLifecycle;
}

export interface OrchestratorMetricsPublisher {
  record(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface OrchestratorLoggerPort {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
