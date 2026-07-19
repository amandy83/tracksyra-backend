import type { DistributionExecutionContext } from "../types/context";
import type { ExecutionPipeline, ExecutionScheduler as ExecutionSchedulerInterface, ExecutionStage, ExecutionStageName, ExecutionStageRegistryLike } from "../types";

function completedStageSet(context: DistributionExecutionContext): ReadonlySet<ExecutionStageName> {
  return new Set(context.completedStages());
}

export class ExecutionScheduler implements ExecutionSchedulerInterface {
  next(context: DistributionExecutionContext, pipeline: ExecutionPipeline, availableStages: ExecutionStageRegistryLike): ExecutionStageName | null {
    const completed = completedStageSet(context);
    for (const stageName of pipeline.stages) {
      if (completed.has(stageName)) {
        continue;
      }
      const stage = availableStages.get(stageName);
      if (!stage) {
        continue;
      }
      if (stage.dependencies.every((dependency) => completed.has(dependency))) {
        return stageName;
      }
    }
    return null;
  }

  applyStageResult(context: DistributionExecutionContext, pipeline: ExecutionPipeline, stage: ExecutionStageName): DistributionExecutionContext {
    const completed = context.completedStages();
    if (completed.includes(stage)) {
      return context;
    }
    return context.withCompletedStage(stage).withStage(stage);
  }
}

