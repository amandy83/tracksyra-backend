import type { QueueDispatcher } from "../dispatcher/queueDispatcher";
import { QueueCheckpoint, QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "../types/queueIntegrationTypes";
import type { QueueProducer } from "../producer/queueProducer";

export class BullMQDispatcher implements QueueDispatcher {
  constructor(private readonly producer: QueueProducer) {}

  async dispatch(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> {
    try {
      await this.producer.enqueue(envelope);
      return new QueueExecutionResult({
        success: true,
        failure: false,
        completedStage: context.stage,
        executionTime: Date.now() - Date.parse(context.createdAt),
        nextStage: context.metadata.nextStage ? String(context.metadata.nextStage) : null,
        checkpoint: context.checkpoint
          ? new QueueCheckpoint({
              checkpointId: context.checkpoint.checkpointId,
              executionId: context.checkpoint.executionId,
              queueName: context.checkpoint.queueName,
              stage: context.checkpoint.stage,
              createdAt: context.checkpoint.createdAt,
              completedStages: context.checkpoint.completedStages,
              retryCount: context.checkpoint.retryCount,
              metadata: context.checkpoint.metadata,
            })
          : null,
        warnings: [],
        errors: [],
        metadata: {
          queueName: context.queueName,
          jobId: context.jobId,
        },
      });
    } catch (error) {
      return new QueueExecutionResult({
        success: false,
        failure: true,
        completedStage: context.stage,
        executionTime: Date.now() - Date.parse(context.createdAt),
        nextStage: null,
        checkpoint: context.checkpoint,
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          queueName: context.queueName,
          jobId: context.jobId,
        },
      });
    }
  }
}
