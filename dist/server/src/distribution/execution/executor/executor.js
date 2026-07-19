import { DistributionExecutionResult } from "../types/result.js";
import { createExecutionEvent } from "../types/events.js";
export class ExecutionCoordinator {
    stageRegistry;
    scheduler;
    checkpointManager;
    recoveryCoordinator;
    eventPublisher;
    leaseManager;
    constructor(stageRegistry, scheduler, checkpointManager, recoveryCoordinator, eventPublisher, leaseManager) {
        this.stageRegistry = stageRegistry;
        this.scheduler = scheduler;
        this.checkpointManager = checkpointManager;
        this.recoveryCoordinator = recoveryCoordinator;
        this.eventPublisher = eventPublisher;
        this.leaseManager = leaseManager;
    }
    async execute(job, context, pipeline) {
        const startedAt = Date.now();
        const lease = this.leaseManager.acquire(`execution:${context.executionId}`, context.executionId, 15 * 60 * 1000);
        if (!lease) {
            return DistributionExecutionResult.failed({
                completedStage: null,
                executionTime: 0,
                errors: ["Execution lease is unavailable"],
            });
        }
        const startedContext = context.withExecutionMetadata({
            ...context.executionMetadata,
            leaseToken: lease.token.value,
            pipelineName: pipeline.name,
            jobId: job.id.value,
            releaseId: job.releaseId.value,
        });
        await this.eventPublisher.publish(createExecutionEvent("ExecutionStarted", {
            executionId: startedContext.executionId,
            pipeline: pipeline.name,
            stage: startedContext.stage,
            occurredAt: new Date().toISOString(),
            payload: {
                jobId: job.id.value,
                releaseId: job.releaseId.value,
            },
        }));
        let current = startedContext;
        let completedStage = null;
        let checkpoint = current.checkpoint;
        try {
            while (true) {
                current.cancellationToken.throwIfCancelled();
                const nextStage = this.scheduler.next(current, pipeline, this.stageRegistry);
                if (!nextStage) {
                    const executionTime = Date.now() - startedAt;
                    const result = DistributionExecutionResult.succeeded({
                        completedStage,
                        executionTime,
                        nextStage: null,
                        checkpoint,
                    });
                    await this.eventPublisher.publish(createExecutionEvent("ExecutionCompleted", {
                        executionId: current.executionId,
                        pipeline: pipeline.name,
                        stage: current.stage,
                        occurredAt: new Date().toISOString(),
                        payload: {
                            completedStage,
                            executionTime,
                        },
                    }));
                    return result;
                }
                const stage = this.stageRegistry.get(nextStage);
                if (!stage) {
                    return DistributionExecutionResult.failed({
                        completedStage,
                        executionTime: Date.now() - startedAt,
                        errors: [`Execution stage is not registered: ${nextStage}`],
                        checkpoint,
                    });
                }
                await this.eventPublisher.publish(createExecutionEvent("StageStarted", {
                    executionId: current.executionId,
                    pipeline: pipeline.name,
                    stage: nextStage,
                    occurredAt: new Date().toISOString(),
                    payload: { stage: nextStage },
                }));
                const stageContext = current.withStage(nextStage);
                const nextContext = await Promise.resolve(stage.execute(stageContext));
                current = this.scheduler.applyStageResult(nextContext, pipeline, nextStage).withCompletedStage(nextStage);
                completedStage = nextStage;
                checkpoint = await this.checkpointManager.create(current);
                if (checkpoint) {
                    await this.eventPublisher.publish(createExecutionEvent("CheckpointCreated", {
                        executionId: current.executionId,
                        pipeline: pipeline.name,
                        stage: nextStage,
                        occurredAt: checkpoint.createdAt,
                        payload: {
                            checkpointId: checkpoint.checkpointId,
                            stage: nextStage,
                        },
                    }));
                }
                await this.eventPublisher.publish(createExecutionEvent("StageCompleted", {
                    executionId: current.executionId,
                    pipeline: pipeline.name,
                    stage: nextStage,
                    occurredAt: new Date().toISOString(),
                    payload: { stage: nextStage },
                }));
            }
        }
        catch (error) {
            const decision = this.recoveryCoordinator.recover(error, current, checkpoint);
            if (decision.pause) {
                await this.eventPublisher.publish(createExecutionEvent("ExecutionPaused", {
                    executionId: current.executionId,
                    pipeline: pipeline.name,
                    stage: current.stage,
                    occurredAt: new Date().toISOString(),
                    payload: {
                        stage: current.stage,
                        reason: decision.message,
                    },
                }));
            }
            if (decision.resume) {
                await this.eventPublisher.publish(createExecutionEvent("ExecutionRecovered", {
                    executionId: current.executionId,
                    pipeline: pipeline.name,
                    stage: current.stage,
                    occurredAt: new Date().toISOString(),
                    payload: {
                        checkpointId: decision.checkpointId,
                        reason: decision.message,
                    },
                }));
            }
            if (decision.retry) {
                current = current.withRetryCount(current.retryCount + 1);
                checkpoint = checkpoint ?? (await this.checkpointManager.create(current));
                return await this.execute(job, current, pipeline);
            }
            const executionTime = Date.now() - startedAt;
            await this.eventPublisher.publish(createExecutionEvent("ExecutionFailed", {
                executionId: current.executionId,
                pipeline: pipeline.name,
                stage: current.stage,
                occurredAt: new Date().toISOString(),
                payload: {
                    failedStage: current.stage,
                    errors: [decision.message],
                },
            }));
            return DistributionExecutionResult.failed({
                completedStage,
                executionTime,
                checkpoint,
                errors: [decision.message],
            });
        }
        finally {
            this.leaseManager.release(lease);
        }
    }
}
