function completedStageSet(context) {
    return new Set(context.completedStages());
}
export class ExecutionScheduler {
    next(context, pipeline, availableStages) {
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
    applyStageResult(context, pipeline, stage) {
        const completed = context.completedStages();
        if (completed.includes(stage)) {
            return context;
        }
        return context.withCompletedStage(stage).withStage(stage);
    }
}
