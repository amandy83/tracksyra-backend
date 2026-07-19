import type { DistributionJobAggregate } from "../../domain";
import type { DistributionExecutionContext } from "../types/context";
import type { ExecutionDispatcher as ExecutionDispatcherInterface, ExecutionPipeline, ExecutionStageName } from "../types";
import { CheckpointManager } from "../checkpoint/checkpoint";
import { ExecutionRouter, JobRouter, PipelineRouter, StageRouter } from "../routing/routing";
import { ExecutionStageRegistry } from "../stages/stages";
import { ExecutionScheduler } from "../scheduler/scheduler";

export class StageDispatcher {
  constructor(
    public readonly stageRegistry: ExecutionStageRegistry,
    private readonly scheduler: ExecutionScheduler,
  ) {}

  async dispatch(stage: ExecutionStageName, context: DistributionExecutionContext, pipeline: ExecutionPipeline): Promise<DistributionExecutionContext> {
    const stageDefinition = this.stageRegistry.get(stage);
    if (!stageDefinition) {
      throw new Error(`Execution stage not registered: ${stage}`);
    }
    const next = await Promise.resolve(stageDefinition.execute(context));
    return this.scheduler.applyStageResult(next, pipeline, stage);
  }
}

export class PipelineDispatcher {
  constructor(
    private readonly stageDispatcher: StageDispatcher,
    private readonly scheduler: ExecutionScheduler,
  ) {}

  async dispatch(pipeline: ExecutionPipeline, context: DistributionExecutionContext): Promise<DistributionExecutionContext> {
    let current = context;
    while (true) {
      const nextStage = this.scheduler.next(current, pipeline, this.stageDispatcher.stageRegistry);
      if (!nextStage) {
        return current;
      }
      current = await this.stageDispatcher.dispatch(nextStage, current, pipeline);
    }
  }
}

export class JobDispatcher {
  constructor(
    private readonly pipelineDispatcher: PipelineDispatcher,
    private readonly router: ExecutionRouter,
  ) {}

  async dispatch(job: DistributionJobAggregate, context: DistributionExecutionContext, pipeline: ExecutionPipeline): Promise<DistributionExecutionContext> {
    const resolved = this.router.resolvePipeline(job, context);
    return await this.pipelineDispatcher.dispatch(resolved ?? pipeline, context);
  }
}

export class ExecutionDispatcher implements ExecutionDispatcherInterface {
  constructor(
    private readonly jobDispatcher: JobDispatcher,
    private readonly checkpointManager: CheckpointManager,
  ) {}

  async dispatch(job: DistributionJobAggregate, context: DistributionExecutionContext, pipeline: ExecutionPipeline): Promise<DistributionExecutionContext> {
    const dispatched = await this.jobDispatcher.dispatch(job, context, pipeline);
    await this.checkpointManager.create(dispatched);
    return dispatched;
  }
}
