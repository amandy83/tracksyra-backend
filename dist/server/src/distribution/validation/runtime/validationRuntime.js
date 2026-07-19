import { ValidationContext, } from "../types/validationTypes.js";
function cloneContext(context, scope) {
    return new ValidationContext({
        contextId: context.contextId,
        scope,
        createdAt: context.createdAt,
        composition: context.composition,
        bootstrap: context.bootstrap,
        workflow: context.workflow,
        orchestrator: context.orchestrator,
        execution: context.execution,
        queue: context.queue,
        runtime: context.runtime,
        provider: context.provider,
        connectors: context.connectors,
        statusSync: context.statusSync,
        royalty: context.royalty,
        observability: context.observability,
        security: context.security,
        authentication: context.authentication,
        storage: context.storage,
        repository: context.repository,
        unitOfWork: context.unitOfWork,
        health: context.health,
        recovery: context.recovery,
        checkpoint: context.checkpoint,
        projection: context.projection,
        audit: context.audit,
        metrics: context.metrics,
        logging: context.logging,
        trace: context.trace,
        stateMachine: context.stateMachine,
        compensation: context.compensation,
        performance: context.performance,
        scalability: context.scalability,
        load: context.load,
        concurrency: context.concurrency,
        dataIntegrity: context.dataIntegrity,
        metadata: context.metadata,
    });
}
export class ValidationRuntimeEngine {
    registry;
    pipeline;
    scheduler;
    coordinator;
    logger;
    metrics;
    serializer;
    configurationProvider;
    eventPublisher;
    validators;
    platformValidator;
    runtimeValidator;
    workflowValidator;
    orchestratorValidator;
    queueValidator;
    workerValidator;
    providerValidator;
    connectorValidator;
    statusSyncValidator;
    royaltyValidator;
    observabilityValidator;
    bootstrapValidator;
    compositionValidator;
    dependencyValidator;
    configurationValidator;
    securityValidator;
    authenticationValidator;
    storageValidator;
    storageConsistencyValidator;
    repositoryValidator;
    repositoryConsistencyValidator;
    unitOfWorkValidator;
    aggregateIsolationValidator;
    credentialPropagationValidator;
    authenticationSnapshotValidator;
    credentialVersionPinningValidator;
    rotationValidator;
    resolverValidator;
    secretExposureValidator;
    runtimeAuthenticationValidator;
    healthValidator;
    readinessValidator;
    startupValidator;
    shutdownValidator;
    disasterRecoveryValidator;
    backupValidator;
    restoreValidator;
    failoverValidator;
    scalabilityValidator;
    performanceValidator;
    loadValidator;
    concurrencyValidator;
    dataIntegrityValidator;
    stateMachineValidator;
    eventReplayValidator;
    projectionValidator;
    snapshotValidator;
    auditValidator;
    metricsValidator;
    loggingValidator;
    traceValidator;
    constructor(dependencies) {
        this.logger = dependencies.logger;
        this.metrics = dependencies.metrics;
        this.serializer = dependencies.serializer;
        this.eventPublisher = dependencies.eventPublisher;
        this.configurationProvider = dependencies.configurationProvider;
        this.registry = dependencies.registry;
        this.scheduler = dependencies.scheduler;
        this.pipeline = dependencies.pipeline;
        this.coordinator = dependencies.coordinator;
        this.validators = dependencies.validators;
        [
            this.platformValidator,
            this.runtimeValidator,
            this.workflowValidator,
            this.orchestratorValidator,
            this.queueValidator,
            this.workerValidator,
            this.providerValidator,
            this.connectorValidator,
            this.statusSyncValidator,
            this.royaltyValidator,
            this.observabilityValidator,
            this.bootstrapValidator,
            this.compositionValidator,
            this.dependencyValidator,
            this.configurationValidator,
            this.securityValidator,
            this.authenticationValidator,
            this.storageValidator,
            this.storageConsistencyValidator,
            this.repositoryValidator,
            this.repositoryConsistencyValidator,
            this.unitOfWorkValidator,
            this.aggregateIsolationValidator,
            this.credentialPropagationValidator,
            this.authenticationSnapshotValidator,
            this.credentialVersionPinningValidator,
            this.rotationValidator,
            this.resolverValidator,
            this.secretExposureValidator,
            this.runtimeAuthenticationValidator,
            this.healthValidator,
            this.readinessValidator,
            this.startupValidator,
            this.shutdownValidator,
            this.disasterRecoveryValidator,
            this.backupValidator,
            this.restoreValidator,
            this.failoverValidator,
            this.scalabilityValidator,
            this.performanceValidator,
            this.loadValidator,
            this.concurrencyValidator,
            this.dataIntegrityValidator,
            this.stateMachineValidator,
            this.eventReplayValidator,
            this.projectionValidator,
            this.snapshotValidator,
            this.auditValidator,
            this.metricsValidator,
            this.loggingValidator,
            this.traceValidator,
        ] = dependencies.validators;
        for (const validator of this.validators) {
            this.registry.register(validator);
        }
    }
    validate(context, plan) {
        return this.coordinator.coordinate(context, plan ?? null);
    }
    validateScope(scope, context, plan) {
        return this.coordinator.coordinate(cloneContext(context, scope), plan ?? null);
    }
}
