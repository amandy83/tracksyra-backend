export class DistributionExecutionEngine {
    coordinator;
    constructor(coordinator) {
        this.coordinator = coordinator;
    }
    execute(job, context, pipeline) {
        return this.coordinator.execute(job, context, pipeline);
    }
}
