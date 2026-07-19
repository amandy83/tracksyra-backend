export class StageDispatcher {
    stageRegistry;
    scheduler;
    constructor(stageRegistry, scheduler) {
        this.stageRegistry = stageRegistry;
        this.scheduler = scheduler;
    }
    async dispatch(stage, context, pipeline) {
        const stageDefinition = this.stageRegistry.get(stage);
        if (!stageDefinition) {
            throw new Error(`Execution stage not registered: ${stage}`);
        }
        const next = await Promise.resolve(stageDefinition.execute(context));
        return this.scheduler.applyStageResult(next, pipeline, stage);
    }
}
export class PipelineDispatcher {
    stageDispatcher;
    scheduler;
    constructor(stageDispatcher, scheduler) {
        this.stageDispatcher = stageDispatcher;
        this.scheduler = scheduler;
    }
    async dispatch(pipeline, context) {
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
    pipelineDispatcher;
    router;
    constructor(pipelineDispatcher, router) {
        this.pipelineDispatcher = pipelineDispatcher;
        this.router = router;
    }
    async dispatch(job, context, pipeline) {
        const resolved = this.router.resolvePipeline(job, context);
        return await this.pipelineDispatcher.dispatch(resolved ?? pipeline, context);
    }
}
export class ExecutionDispatcher {
    jobDispatcher;
    checkpointManager;
    constructor(jobDispatcher, checkpointManager) {
        this.jobDispatcher = jobDispatcher;
        this.checkpointManager = checkpointManager;
    }
    async dispatch(job, context, pipeline) {
        const dispatched = await this.jobDispatcher.dispatch(job, context, pipeline);
        await this.checkpointManager.create(dispatched);
        return dispatched;
    }
}
