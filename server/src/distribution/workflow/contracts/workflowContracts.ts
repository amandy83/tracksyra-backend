import type {
  WorkflowArchive,
  WorkflowCheckpoint,
  WorkflowCompensation,
  WorkflowContext,
  WorkflowNotification,
  WorkflowProjection,
  WorkflowRecovery,
  WorkflowReport,
  WorkflowStage,
  WorkflowStageName,
  WorkflowTimeline,
  WorkflowTransition,
} from "../types/workflowTypes";
import type { DistributionOrchestrator } from "../../application/services";

export interface WorkflowAssembly {
  assemble(context: WorkflowContext, orchestrator: DistributionOrchestrator): WorkflowPipeline;
}

export interface WorkflowPipeline {
  run(context: WorkflowContext): Promise<WorkflowReport> | WorkflowReport;
  stages(): readonly WorkflowStage[];
  transitions(): readonly WorkflowTransition[];
}

export interface StageRegistry {
  register(stage: WorkflowStage): void;
  resolve(stageName: WorkflowStageName): WorkflowStage | null;
  list(): readonly WorkflowStage[];
}

export interface StageResolver {
  resolve(stageName: WorkflowStageName): WorkflowStage | null;
}

export interface TransitionCoordinator {
  coordinate(transition: WorkflowTransition): Promise<WorkflowTransition> | WorkflowTransition;
}

export interface CheckpointCoordinator {
  create(context: WorkflowContext, stage: WorkflowStageName): WorkflowCheckpoint;
  restore(checkpointId: string): WorkflowCheckpoint | null;
  validate(checkpoint: WorkflowCheckpoint): boolean;
  cleanup(workflowId: string): number;
}

export interface RecoveryCoordinator {
  recover(context: WorkflowContext, checkpoint: WorkflowCheckpoint | null): Promise<WorkflowRecovery> | WorkflowRecovery;
}

export interface CompensationCoordinator {
  compensate(context: WorkflowContext, transition: WorkflowTransition): Promise<WorkflowCompensation> | WorkflowCompensation;
}

export interface NotificationCoordinator {
  notify(notification: WorkflowNotification): Promise<WorkflowNotification> | WorkflowNotification;
}

export interface ProjectionCoordinator {
  project(projection: WorkflowProjection): Promise<WorkflowProjection> | WorkflowProjection;
}

export interface RoyaltyCoordinator {
  process(context: WorkflowContext): Promise<WorkflowReport> | WorkflowReport;
}

export interface ArchiveCoordinator {
  archive(workflowArchive: WorkflowArchive): Promise<WorkflowArchive> | WorkflowArchive;
}

export interface WorkflowMetrics {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface WorkflowLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
