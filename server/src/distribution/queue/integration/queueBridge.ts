import type { QueueDispatcher as QueueDispatcherContract } from "./dispatcher/queueDispatcher";
import type { QueueCheckpoint, QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "./types/queueIntegrationTypes";
import { QueueCheckpoint as QueueCheckpointModel, QueueExecutionContext as QueueExecutionContextModel, QueueEnvelope as QueueEnvelopeModel, QueueExecutionResult as QueueExecutionResultModel } from "./types/queueIntegrationTypes";
import type { WorkerRuntime } from "../../runtime/integration/contracts/workerRuntimeContracts";
import type { WorkerExecutionContext, WorkerExecutionRequest, WorkerExecutionResult, WorkerPipelineExecution } from "../../runtime/integration/types/workerIntegrationTypes";
import { WorkerLease as WorkerLeaseModel, WorkerExecutionRequest as WorkerExecutionRequestModel, WorkerExecutionContext as WorkerExecutionContextModel, WorkerPipelineExecution as WorkerPipelineExecutionModel } from "../../runtime/integration/types/workerIntegrationTypes";

function buildPipelineExecution(context: QueueExecutionContext): WorkerPipelineExecution {
  return new WorkerPipelineExecutionModel({
    pipelineExecutionId: `${context.executionId}:pipeline`,
    workerId: context.metadata.workerId ? String(context.metadata.workerId) : context.executionId,
    executionId: context.executionId,
    pipelineName: String(context.metadata.pipelineName ?? `${context.stage}Pipeline`),
    currentStage: context.stage,
    completedStages: Array.isArray(context.metadata.completedStages) ? (context.metadata.completedStages as readonly string[]) : [],
    pendingStages: [],
    metadata: context.metadata,
  });
}

function buildWorkerContext(context: QueueExecutionContext): WorkerExecutionContext {
  const lease = context.lease
    ? new WorkerLeaseModel({
        leaseId: context.lease.leaseId,
        workerId: String(context.metadata.workerId ?? context.executionId),
        executionId: context.executionId,
        resource: context.lease.resource,
        owner: context.lease.owner,
        acquiredAt: context.lease.acquiredAt,
        expiresAt: context.lease.expiresAt,
        renewCount: context.lease.renewCount,
        metadata: context.lease.metadata,
      })
    : null;

  return new WorkerExecutionContextModel({
    workerId: String(context.metadata.workerId ?? context.executionId),
    orchestrationId: String(context.metadata.orchestrationId ?? context.executionId),
    executionId: context.executionId,
    releaseId: context.releaseId,
    jobId: context.jobId,
    queueName: context.queueName,
    pipelineName: String(context.metadata.pipelineName ?? `${context.stage}Pipeline`),
    stage: context.stage,
    state: "Running",
    retryCount: context.retryCount,
    queueEnvelope: null,
    startedAt: context.createdAt,
    updatedAt: context.updatedAt,
    metadata: context.metadata,
    checkpoint: null,
    heartbeat: null,
    lease,
    pipelineExecution: null,
  });
}

function mapExecutionResult(result: WorkerExecutionResult): QueueExecutionResult {
  const checkpoint = result.checkpoint
    ? new QueueCheckpointModel({
        checkpointId: result.checkpoint.checkpointId,
        executionId: result.checkpoint.executionId,
        queueName: "distribution",
        stage: result.checkpoint.stage,
        createdAt: result.checkpoint.createdAt,
        completedStages: result.checkpoint.completedStages,
        retryCount: result.checkpoint.retryCount,
        metadata: result.checkpoint.metadata,
      })
    : null;

  return new QueueExecutionResultModel({
    success: result.success,
    failure: result.failure,
    completedStage: result.completedStage,
    executionTime: result.executionTime,
    nextStage: result.nextStage,
    checkpoint,
    errors: result.errors,
    warnings: result.warnings,
    metadata: result.metadata,
  });
}

export class DistributionQueueDispatcher implements QueueDispatcherContract {
  constructor(private readonly workerRuntime: WorkerRuntime) {}

  dispatch(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> | QueueExecutionResult {
    return this.handle(envelope, context);
  }

  private async handle(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> {
    const request: WorkerExecutionRequest = new WorkerExecutionRequestModel({
      requestId: envelope.messageId,
      executionContext: buildWorkerContext(context),
      queueEnvelope: envelope,
      pipelineExecution: buildPipelineExecution(context),
      requestedAt: context.createdAt,
      metadata: context.metadata,
    });

    const result = await Promise.resolve(this.workerRuntime.execute(request));
    return mapExecutionResult(result);
  }
}
