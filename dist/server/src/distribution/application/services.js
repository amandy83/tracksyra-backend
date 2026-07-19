export class DistributionOrchestrator {
    useCases;
    constructor(useCases) {
        this.useCases = useCases;
    }
    async submit(command) {
        return await this.useCases.submitRelease.execute(command);
    }
    async validate(command) {
        return await this.useCases.validateRelease.execute(command);
    }
    async approve(command) {
        return await this.useCases.approveRelease.execute(command);
    }
    async buildMetadata(command) {
        return await this.useCases.buildUniversalMetadata.execute(command);
    }
    async buildPackage(command) {
        return await this.useCases.buildDistributionPackage.execute(command);
    }
    async verifyPackage(command) {
        return await this.useCases.verifyDistributionPackage.execute(command);
    }
    async selectProvider(command) {
        return await this.useCases.selectProvider.execute(command);
    }
    async authenticateProvider(command) {
        return await this.useCases.authenticateProvider.execute(command);
    }
    async submitPackage(command) {
        return await this.useCases.submitPackage.execute(command);
    }
    async syncStatus(command) {
        return await this.useCases.syncDistributionStatus.execute(command);
    }
    async importRoyalties(command) {
        return await this.useCases.importRoyalties.execute(command);
    }
    async calculateRevenue(command) {
        return await this.useCases.calculateRevenue.execute(command);
    }
    async processPayments(command) {
        return await this.useCases.processPayments.execute(command);
    }
    async archive(command) {
        return await this.useCases.archiveRelease.execute(command);
    }
    async cancel(releaseId, requestedBy, reason) {
        return await this.useCases.cancelDistribution.execute({ releaseId, requestedBy, reason });
    }
    async requestTakedown(releaseId, requestedBy, reason) {
        return await this.useCases.requestTakedown.execute({ releaseId, requestedBy, reason });
    }
}
export class DistributionCoordinator {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    submit(command) { return this.orchestrator.submit(command); }
    validate(command) { return this.orchestrator.validate(command); }
    approve(command) { return this.orchestrator.approve(command); }
}
export class DistributionPipeline {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    execute(command) {
        return this.orchestrator.submit(command);
    }
}
export class DistributionLifecycleService {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    submit(command) { return this.orchestrator.submit(command); }
    archive(command) { return this.orchestrator.archive(command); }
}
export class SubmissionCoordinator {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    submit(command) { return this.orchestrator.submit(command); }
    validate(command) { return this.orchestrator.validate(command); }
}
export class PackageCoordinator {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    buildMetadata(command) { return this.orchestrator.buildMetadata(command); }
    buildPackage(command) { return this.orchestrator.buildPackage(command); }
    verifyPackage(command) { return this.orchestrator.verifyPackage(command); }
}
export class ProviderCoordinator {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    selectProvider(command) { return this.orchestrator.selectProvider(command); }
    authenticateProvider(command) { return this.orchestrator.authenticateProvider(command); }
    submitPackage(command) { return this.orchestrator.submitPackage(command); }
    syncStatus(command) { return this.orchestrator.syncStatus(command); }
}
export class RoyaltyCoordinator {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    importRoyalties(command) { return this.orchestrator.importRoyalties(command); }
    calculateRevenue(command) { return this.orchestrator.calculateRevenue(command); }
    processPayments(command) { return this.orchestrator.processPayments(command); }
}
