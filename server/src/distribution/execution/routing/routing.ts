import type { DistributionJobAggregate } from "../../domain";
import type { DistributionExecutionContext } from "../types/context";
import type { ExecutionPipeline, ExecutionPipelineName, ExecutionRouter as ExecutionRouterInterface, ExecutionStage, ExecutionStageName } from "../types";
import { ArchivePipeline, ApprovalPipeline, AuthenticationPipeline, DashboardPipeline, MetadataPipeline, NotificationPipeline, PackagingPipeline, PaymentPipeline, ProviderProcessingPipeline, ProviderSelectionPipeline, RoyaltyPipeline, StatusPipeline, SubmissionPipeline, ValidationPipeline, VerificationPipeline, UploadPipeline } from "../pipeline/pipeline";
import { ExecutionStageRegistry } from "../stages/stages";

export class JobRouter {
  resolve(job: DistributionJobAggregate, context: DistributionExecutionContext): ExecutionPipelineName {
    const configured = context.executionMetadata.pipelineName;
    if (typeof configured === "string") {
      return configured as ExecutionPipelineName;
    }
    return job.state === "PENDING" ? "SubmissionPipeline" : "StatusPipeline";
  }
}

export class StageRouter {
  resolve(stage: ExecutionStageName, registry: ExecutionStageRegistry): ExecutionStage | null {
    return registry.get(stage);
  }
}

export class PipelineRouter {
  private readonly pipelines = new Map<ExecutionPipelineName, ExecutionPipeline>([
    ["SubmissionPipeline", new SubmissionPipeline()],
    ["ValidationPipeline", new ValidationPipeline()],
    ["ApprovalPipeline", new ApprovalPipeline()],
    ["MetadataPipeline", new MetadataPipeline()],
    ["PackagingPipeline", new PackagingPipeline()],
    ["VerificationPipeline", new VerificationPipeline()],
    ["ProviderSelectionPipeline", new ProviderSelectionPipeline()],
    ["AuthenticationPipeline", new AuthenticationPipeline()],
    ["UploadPipeline", new UploadPipeline()],
    ["ProviderProcessingPipeline", new ProviderProcessingPipeline()],
    ["StatusPipeline", new StatusPipeline()],
    ["DashboardPipeline", new DashboardPipeline()],
    ["NotificationPipeline", new NotificationPipeline()],
    ["RoyaltyPipeline", new RoyaltyPipeline()],
    ["PaymentPipeline", new PaymentPipeline()],
    ["ArchivePipeline", new ArchivePipeline()],
  ]);

  resolve(name: ExecutionPipelineName): ExecutionPipeline {
    const pipeline = this.pipelines.get(name);
    if (!pipeline) {
      throw new Error(`Unknown execution pipeline: ${name}`);
    }
    return pipeline;
  }
}

export class ExecutionRouter implements ExecutionRouterInterface {
  constructor(
    private readonly jobRouter: JobRouter,
    private readonly stageRouter: StageRouter,
    private readonly pipelineRouter: PipelineRouter,
    private readonly stageRegistry: ExecutionStageRegistry,
  ) {}

  resolvePipeline(job: DistributionJobAggregate, context: DistributionExecutionContext): ExecutionPipeline {
    return this.pipelineRouter.resolve(this.jobRouter.resolve(job, context));
  }

  resolveStage(stage: ExecutionStageName): ExecutionStage | null {
    return this.stageRouter.resolve(stage, this.stageRegistry);
  }
}
