import type { QueueDispatcher } from "../../queue/integration/dispatcher/queueDispatcher";
import type { ExecutionStageRegistry, ExecutionStageDefinition } from "../stages/stages";
import type { ExecutionStageName } from "../types";
import { ExecutionStageDefinition as StageDefinition } from "../stages/stages";
import type { DistributionExecutionContext } from "../types/context";
import type { QueueEnvelope, QueueExecutionContext } from "../../queue/integration/types/queueIntegrationTypes";
import { QueueExecutionContext as QueueExecutionContextModel, QueueEnvelope as QueueEnvelopeModel } from "../../queue/integration/types/queueIntegrationTypes";

const EXECUTION_STAGE_ORDER: readonly ExecutionStageName[] = [
  "Submission",
  "SubmissionLock",
  "Snapshot",
  "Validation",
  "Approval",
  "MetadataGeneration",
  "PackageBuild",
  "PackageVerification",
  "ProviderResolution",
  "ProviderAuthentication",
  "PackageUpload",
  "ProviderProcessing",
  "StatusNormalization",
  "StateTransition",
  "DashboardProjection",
  "NotificationDispatch",
  "CatalogActivation",
  "RoyaltyImport",
  "RevenueCalculation",
  "PaymentProcessing",
  "StatementGeneration",
  "Archive",
];

function buildEnvelope(context: DistributionExecutionContext): QueueEnvelope {
  return new QueueEnvelopeModel({
    messageId: `${context.executionId}:${context.stage}`,
    type: context.stage,
    body: {
      executionId: context.executionId,
      releaseId: context.release.release.id.value,
      jobId: context.distributionJob.id.value,
      stage: context.stage,
    },
    tracing: {
      traceId: context.executionId,
      correlationId: context.distributionJob.id.value,
      parentSpanId: null,
      spanId: `${context.executionId}:${context.stage}`,
    },
    metadata: {
      executionId: context.executionId,
      stage: context.stage,
      pipelineName: context.executionMetadata.pipelineName ?? "DistributionPipeline",
      workerId: context.executionMetadata.workerId ?? context.executionId,
      orchestrationId: context.executionMetadata.orchestrationId ?? context.executionId,
      completedStages: context.completedStages(),
      idempotencyKey: context.executionMetadata.idempotencyKey ?? context.executionId,
    },
    deliveryAttempt: context.retryCount,
    scheduledAt: null,
  });
}

function buildQueueContext(context: DistributionExecutionContext): QueueExecutionContext {
  return new QueueExecutionContextModel({
    executionId: context.executionId,
    releaseId: context.release.release.id.value,
    jobId: context.distributionJob.id.value,
    queueName: String(context.executionMetadata.queueName ?? "distribution"),
    adapter: "Custom",
    stage: context.stage,
    payload: {
      executionId: context.executionId,
      releaseId: context.release.release.id.value,
      jobId: context.distributionJob.id.value,
      stage: context.stage,
    },
    metadata: {
      executionId: context.executionId,
      pipelineName: context.executionMetadata.pipelineName ?? "DistributionPipeline",
      workerId: context.executionMetadata.workerId ?? context.executionId,
      orchestrationId: context.executionMetadata.orchestrationId ?? context.executionId,
      completedStages: context.completedStages(),
      idempotencyKey: context.executionMetadata.idempotencyKey ?? context.executionId,
    },
    retryCount: context.retryCount,
    createdAt: context.timestamps.startedAt,
    updatedAt: context.timestamps.updatedAt,
    tracing: {
      traceId: context.executionId,
      correlationId: context.distributionJob.id.value,
      parentSpanId: null,
      spanId: `${context.executionId}:${context.stage}`,
    },
  });
}

export function registerDistributionExecutionStages(registry: ExecutionStageRegistry, queueDispatcher: QueueDispatcher): void {
  for (const stage of EXECUTION_STAGE_ORDER) {
    registry.register(
      new StageDefinition({
        name: stage,
        dependencies: [],
        handler: async (context) => {
          const envelope = buildEnvelope(context);
          const queueContext = buildQueueContext(context);
          const result = await queueDispatcher.dispatch(envelope, queueContext);
          if (result.failure) {
            throw new Error(result.errors[0] ?? `Execution stage failed: ${stage}`);
          }
          return context.withExecutionMetadata({
            ...context.executionMetadata,
            lastQueueStage: stage,
            lastQueueExecutionTime: result.executionTime,
            completedStages: context.completedStages(),
          });
        },
      }),
    );
  }
}
