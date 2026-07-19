import type { ExecutionStage, ExecutionStageName, ExecutionStageRegistryLike } from "../types";

export type ExecutionStageHandler = (context: import("../types/context").DistributionExecutionContext) => Promise<import("../types/context").DistributionExecutionContext> | import("../types/context").DistributionExecutionContext;

export class ExecutionStageDefinition implements ExecutionStage {
  readonly name: ExecutionStageName;
  readonly dependencies: readonly ExecutionStageName[];

  constructor(input: { name: ExecutionStageName; dependencies?: readonly ExecutionStageName[]; handler: ExecutionStageHandler }) {
    this.name = input.name;
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.handler = input.handler;
    Object.freeze(this);
  }

  private readonly handler: ExecutionStageHandler;

  execute(context: import("../types/context").DistributionExecutionContext): Promise<import("../types/context").DistributionExecutionContext> | import("../types/context").DistributionExecutionContext {
    return this.handler(context);
  }
}

export class ExecutionStageRegistry implements ExecutionStageRegistryLike {
  private readonly stages = new Map<ExecutionStageName, ExecutionStage>();

  register(stage: ExecutionStage): void {
    this.stages.set(stage.name, stage);
  }

  get(stage: ExecutionStageName): ExecutionStage | null {
    return this.stages.get(stage) ?? null;
  }

  has(stage: ExecutionStageName): boolean {
    return this.stages.has(stage);
  }

  list(): readonly ExecutionStage[] {
    return Object.freeze([...this.stages.values()]);
  }
}

