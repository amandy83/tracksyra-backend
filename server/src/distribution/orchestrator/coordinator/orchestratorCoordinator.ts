import type {
  ApprovalCoordinator,
  ArchiveCoordinator,
  CheckpointCoordinator,
  DistributionOrchestrator,
  ExecutionCoordinator,
  LifecycleCoordinator,
  MetadataCoordinator,
  PackageCoordinator,
  PipelineCoordinator,
  ProviderCoordinator,
  RecoveryCoordinator,
  RoyaltyCoordinator,
  StatusCoordinator,
  SubmissionCoordinator,
  ValidationCoordinator,
} from "../contracts/orchestratorContracts";

export interface OrchestratorCoordinatorSet {
  readonly distribution: DistributionOrchestrator;
  readonly submission: SubmissionCoordinator;
  readonly validation: ValidationCoordinator;
  readonly approval: ApprovalCoordinator;
  readonly metadata: MetadataCoordinator;
  readonly package: PackageCoordinator;
  readonly provider: ProviderCoordinator;
  readonly execution: ExecutionCoordinator;
  readonly status: StatusCoordinator;
  readonly royalty: RoyaltyCoordinator;
  readonly archive: ArchiveCoordinator;
  readonly pipeline: PipelineCoordinator;
  readonly recovery: RecoveryCoordinator;
  readonly checkpoint: CheckpointCoordinator;
  readonly lifecycle: LifecycleCoordinator;
}

export interface OrchestratorCoordinatorResolver {
  resolve(): OrchestratorCoordinatorSet;
}

export interface OrchestratorCoordinatorRegistry {
  register(coordinator: OrchestratorCoordinatorSet): void;
  get(): OrchestratorCoordinatorSet | null;
}
