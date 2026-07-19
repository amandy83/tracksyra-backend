import { QueueCheckpoint, QueueExecutionResult } from "../types/queueIntegrationTypes.js";
export class BullMQDispatcher {
    producer;
    constructor(producer) {
        this.producer = producer;
    }
    async dispatch(envelope, context) {
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
        }
        catch (error) {
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
