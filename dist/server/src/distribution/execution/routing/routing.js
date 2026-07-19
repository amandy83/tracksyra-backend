import { ArchivePipeline, ApprovalPipeline, AuthenticationPipeline, DashboardPipeline, MetadataPipeline, NotificationPipeline, PackagingPipeline, PaymentPipeline, ProviderProcessingPipeline, ProviderSelectionPipeline, RoyaltyPipeline, StatusPipeline, SubmissionPipeline, ValidationPipeline, VerificationPipeline, UploadPipeline } from "../pipeline/pipeline.js";
export class JobRouter {
    resolve(job, context) {
        const configured = context.executionMetadata.pipelineName;
        if (typeof configured === "string") {
            return configured;
        }
        return job.state === "PENDING" ? "SubmissionPipeline" : "StatusPipeline";
    }
}
export class StageRouter {
    resolve(stage, registry) {
        return registry.get(stage);
    }
}
export class PipelineRouter {
    pipelines = new Map([
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
    resolve(name) {
        const pipeline = this.pipelines.get(name);
        if (!pipeline) {
            throw new Error(`Unknown execution pipeline: ${name}`);
        }
        return pipeline;
    }
}
export class ExecutionRouter {
    jobRouter;
    stageRouter;
    pipelineRouter;
    stageRegistry;
    constructor(jobRouter, stageRouter, pipelineRouter, stageRegistry) {
        this.jobRouter = jobRouter;
        this.stageRouter = stageRouter;
        this.pipelineRouter = pipelineRouter;
        this.stageRegistry = stageRegistry;
    }
    resolvePipeline(job, context) {
        return this.pipelineRouter.resolve(this.jobRouter.resolve(job, context));
    }
    resolveStage(stage) {
        return this.stageRouter.resolve(stage, this.stageRegistry);
    }
}
