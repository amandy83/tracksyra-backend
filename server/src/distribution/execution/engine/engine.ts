import type { DistributionJobAggregate } from "../../domain";
import { ExecutionCoordinator } from "../executor/executor";
import type { DistributionExecutionContext } from "../types/context";
import { DistributionExecutionResult } from "../types/result";
import type { ExecutionEngine as ExecutionEngineInterface, ExecutionPipeline } from "../types";

export class DistributionExecutionEngine implements ExecutionEngineInterface {
  constructor(private readonly coordinator: ExecutionCoordinator) {}

  execute(job: DistributionJobAggregate, context: DistributionExecutionContext, pipeline: ExecutionPipeline): Promise<DistributionExecutionResult> {
    return this.coordinator.execute(job, context, pipeline);
  }
}

