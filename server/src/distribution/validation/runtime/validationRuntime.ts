import {
  ValidationConfigurationProvider as ValidationConfigurationProviderContract,
  ValidationCoordinator as ValidationCoordinatorContract,
  ValidationEventPublisher as ValidationEventPublisherContract,
  ValidationLogger as ValidationLoggerContract,
  ValidationMetrics as ValidationMetricsContract,
  ValidationPipeline as ValidationPipelineContract,
  ValidationRegistry as ValidationRegistryContract,
  ValidationRuntime as ValidationRuntimeContract,
  ValidationScheduler as ValidationSchedulerContract,
  Validator,
} from "../contracts/validationContracts";
import { ValidationConfiguration } from "../configuration/validationConfiguration";
import { ValidationSerializer } from "../serialization/validationSerializer";
import {
  ValidationContext,
  ValidationPlan,
  ValidationScope,
} from "../types/validationTypes";
import {
  PlatformValidator,
  RuntimeValidator,
  WorkflowValidator,
  OrchestratorValidator,
  QueueValidator,
  WorkerValidator,
  ProviderValidator,
  ConnectorValidator,
  StatusSyncValidator,
  RoyaltyValidator,
  ObservabilityValidator,
  BootstrapValidator,
  CompositionValidator,
  DependencyValidator,
  ConfigurationValidator,
  SecurityValidator,
  AuthenticationValidator,
  StorageValidator,
  StorageConsistencyValidator,
  RepositoryValidator,
  RepositoryConsistencyValidator,
  UnitOfWorkValidator,
  AggregateIsolationValidator,
  CredentialPropagationValidator,
  AuthenticationSnapshotValidator,
  CredentialVersionPinningValidator,
  RotationValidator,
  ResolverValidator,
  SecretExposureValidator,
  RuntimeAuthenticationValidator,
  HealthValidator,
  ReadinessValidator,
  StartupValidator,
  ShutdownValidator,
  DisasterRecoveryValidator,
  BackupValidator,
  RestoreValidator,
  FailoverValidator,
  ScalabilityValidator,
  PerformanceValidator,
  LoadValidator,
  ConcurrencyValidator,
  DataIntegrityValidator,
  StateMachineValidator,
  EventReplayValidator,
  ProjectionValidator,
  SnapshotValidator,
  AuditValidator,
  MetricsValidator,
  LoggingValidator,
  TraceValidator,
} from "./validationValidators";

function cloneContext(context: ValidationContext, scope: ValidationScope): ValidationContext {
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

export type ValidationRuntimeDependencies = Readonly<{
  configuration: ValidationConfiguration;
  logger: ValidationLoggerContract;
  metrics: ValidationMetricsContract;
  serializer: ValidationSerializer;
  configurationProvider: ValidationConfigurationProviderContract;
  eventPublisher: ValidationEventPublisherContract;
  registry: ValidationRegistryContract;
  pipeline: ValidationPipelineContract;
  scheduler: ValidationSchedulerContract;
  coordinator: ValidationCoordinatorContract;
  validators: readonly Validator[];
}>;

export class ValidationRuntimeEngine implements ValidationRuntimeContract {
  readonly registry: ValidationRegistryContract;
  readonly pipeline: ValidationPipelineContract;
  readonly scheduler: ValidationSchedulerContract;
  readonly coordinator: ValidationCoordinatorContract;
  readonly logger: ValidationLoggerContract;
  readonly metrics: ValidationMetricsContract;
  readonly serializer: ValidationSerializer;
  readonly configurationProvider: ValidationConfigurationProviderContract;
  readonly eventPublisher: ValidationEventPublisherContract;
  readonly validators: readonly Validator[];

  readonly platformValidator: PlatformValidator;
  readonly runtimeValidator: RuntimeValidator;
  readonly workflowValidator: WorkflowValidator;
  readonly orchestratorValidator: OrchestratorValidator;
  readonly queueValidator: QueueValidator;
  readonly workerValidator: WorkerValidator;
  readonly providerValidator: ProviderValidator;
  readonly connectorValidator: ConnectorValidator;
  readonly statusSyncValidator: StatusSyncValidator;
  readonly royaltyValidator: RoyaltyValidator;
  readonly observabilityValidator: ObservabilityValidator;
  readonly bootstrapValidator: BootstrapValidator;
  readonly compositionValidator: CompositionValidator;
  readonly dependencyValidator: DependencyValidator;
  readonly configurationValidator: ConfigurationValidator;
  readonly securityValidator: SecurityValidator;
  readonly authenticationValidator: AuthenticationValidator;
  readonly storageValidator: StorageValidator;
  readonly storageConsistencyValidator: StorageConsistencyValidator;
  readonly repositoryValidator: RepositoryValidator;
  readonly repositoryConsistencyValidator: RepositoryConsistencyValidator;
  readonly unitOfWorkValidator: UnitOfWorkValidator;
  readonly aggregateIsolationValidator: AggregateIsolationValidator;
  readonly credentialPropagationValidator: CredentialPropagationValidator;
  readonly authenticationSnapshotValidator: AuthenticationSnapshotValidator;
  readonly credentialVersionPinningValidator: CredentialVersionPinningValidator;
  readonly rotationValidator: RotationValidator;
  readonly resolverValidator: ResolverValidator;
  readonly secretExposureValidator: SecretExposureValidator;
  readonly runtimeAuthenticationValidator: RuntimeAuthenticationValidator;
  readonly healthValidator: HealthValidator;
  readonly readinessValidator: ReadinessValidator;
  readonly startupValidator: StartupValidator;
  readonly shutdownValidator: ShutdownValidator;
  readonly disasterRecoveryValidator: DisasterRecoveryValidator;
  readonly backupValidator: BackupValidator;
  readonly restoreValidator: RestoreValidator;
  readonly failoverValidator: FailoverValidator;
  readonly scalabilityValidator: ScalabilityValidator;
  readonly performanceValidator: PerformanceValidator;
  readonly loadValidator: LoadValidator;
  readonly concurrencyValidator: ConcurrencyValidator;
  readonly dataIntegrityValidator: DataIntegrityValidator;
  readonly stateMachineValidator: StateMachineValidator;
  readonly eventReplayValidator: EventReplayValidator;
  readonly projectionValidator: ProjectionValidator;
  readonly snapshotValidator: SnapshotValidator;
  readonly auditValidator: AuditValidator;
  readonly metricsValidator: MetricsValidator;
  readonly loggingValidator: LoggingValidator;
  readonly traceValidator: TraceValidator;

  constructor(dependencies: ValidationRuntimeDependencies) {
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
    ] = dependencies.validators as [
      PlatformValidator,
      RuntimeValidator,
      WorkflowValidator,
      OrchestratorValidator,
      QueueValidator,
      WorkerValidator,
      ProviderValidator,
      ConnectorValidator,
      StatusSyncValidator,
      RoyaltyValidator,
      ObservabilityValidator,
      BootstrapValidator,
      CompositionValidator,
      DependencyValidator,
      ConfigurationValidator,
      SecurityValidator,
      AuthenticationValidator,
      StorageValidator,
      StorageConsistencyValidator,
      RepositoryValidator,
      RepositoryConsistencyValidator,
      UnitOfWorkValidator,
      AggregateIsolationValidator,
      CredentialPropagationValidator,
      AuthenticationSnapshotValidator,
      CredentialVersionPinningValidator,
      RotationValidator,
      ResolverValidator,
      SecretExposureValidator,
      RuntimeAuthenticationValidator,
      HealthValidator,
      ReadinessValidator,
      StartupValidator,
      ShutdownValidator,
      DisasterRecoveryValidator,
      BackupValidator,
      RestoreValidator,
      FailoverValidator,
      ScalabilityValidator,
      PerformanceValidator,
      LoadValidator,
      ConcurrencyValidator,
      DataIntegrityValidator,
      StateMachineValidator,
      EventReplayValidator,
      ProjectionValidator,
      SnapshotValidator,
      AuditValidator,
      MetricsValidator,
      LoggingValidator,
      TraceValidator,
    ];
    for (const validator of this.validators) {
      this.registry.register(validator);
    }
  }

  validate(context: ValidationContext, plan?: ValidationPlan | null) {
    return this.coordinator.coordinate(context, plan ?? null);
  }

  validateScope(scope: ValidationScope, context: ValidationContext, plan?: ValidationPlan | null) {
    return this.coordinator.coordinate(cloneContext(context, scope), plan ?? null);
  }
}
