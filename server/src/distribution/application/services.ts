import type { ReleaseId } from "../domain";
import type {
  ApproveReleaseCommand,
  ArchiveReleaseCommand,
  BuildPackageCommand,
  ImportRoyaltyCommand,
  ProcessPaymentCommand,
  SubmitPackageCommand,
  SubmitReleaseCommand,
  SyncStatusCommand,
  ValidateReleaseCommand,
} from "./commands";
import {
  ApproveRelease,
  ArchiveRelease,
  AuthenticateProvider,
  BuildDistributionPackage,
  BuildUniversalMetadata,
  CancelDistribution,
  CalculateRevenue,
  ImportRoyalties,
  ProcessPayments,
  ProcessProviderStatus,
  RequestTakedown,
  SelectProvider,
  SubmitPackage,
  SubmitReleaseForDistribution,
  SyncDistributionStatus,
  ValidateRelease,
  VerifyDistributionPackage,
} from "./useCases";

export type DistributionApplicationUseCases = Readonly<{
  submitRelease: SubmitReleaseForDistribution;
  validateRelease: ValidateRelease;
  approveRelease: ApproveRelease;
  buildUniversalMetadata: BuildUniversalMetadata;
  buildDistributionPackage: BuildDistributionPackage;
  verifyDistributionPackage: VerifyDistributionPackage;
  selectProvider: SelectProvider;
  authenticateProvider: AuthenticateProvider;
  submitPackage: SubmitPackage;
  syncDistributionStatus: SyncDistributionStatus;
  importRoyalties: ImportRoyalties;
  calculateRevenue: CalculateRevenue;
  processPayments: ProcessPayments;
  archiveRelease: ArchiveRelease;
  cancelDistribution: CancelDistribution;
  requestTakedown: RequestTakedown;
}>;

export class DistributionOrchestrator {
  constructor(private readonly useCases: DistributionApplicationUseCases) {}

  async submit(command: SubmitReleaseCommand) {
    return await this.useCases.submitRelease.execute(command);
  }

  async validate(command: ValidateReleaseCommand) {
    return await this.useCases.validateRelease.execute(command);
  }

  async approve(command: ApproveReleaseCommand) {
    return await this.useCases.approveRelease.execute(command);
  }

  async buildMetadata(command: BuildPackageCommand) {
    return await this.useCases.buildUniversalMetadata.execute(command);
  }

  async buildPackage(command: BuildPackageCommand) {
    return await this.useCases.buildDistributionPackage.execute(command);
  }

  async verifyPackage(command: BuildPackageCommand) {
    return await this.useCases.verifyDistributionPackage.execute(command);
  }

  async selectProvider(command: SubmitPackageCommand) {
    return await this.useCases.selectProvider.execute(command);
  }

  async authenticateProvider(command: SubmitPackageCommand) {
    return await this.useCases.authenticateProvider.execute(command);
  }

  async submitPackage(command: SubmitPackageCommand) {
    return await this.useCases.submitPackage.execute(command);
  }

  async syncStatus(command: SyncStatusCommand) {
    return await this.useCases.syncDistributionStatus.execute(command);
  }

  async importRoyalties(command: ImportRoyaltyCommand) {
    return await this.useCases.importRoyalties.execute(command);
  }

  async calculateRevenue(command: ImportRoyaltyCommand) {
    return await this.useCases.calculateRevenue.execute(command);
  }

  async processPayments(command: ProcessPaymentCommand) {
    return await this.useCases.processPayments.execute(command);
  }

  async archive(command: ArchiveReleaseCommand) {
    return await this.useCases.archiveRelease.execute(command);
  }

  async cancel(releaseId: ReleaseId, requestedBy: string, reason: string) {
    return await this.useCases.cancelDistribution.execute({ releaseId, requestedBy, reason });
  }

  async requestTakedown(releaseId: ReleaseId, requestedBy: string, reason: string) {
    return await this.useCases.requestTakedown.execute({ releaseId, requestedBy, reason });
  }
}

export class DistributionCoordinator {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  submit(command: SubmitReleaseCommand) { return this.orchestrator.submit(command); }
  validate(command: ValidateReleaseCommand) { return this.orchestrator.validate(command); }
  approve(command: ApproveReleaseCommand) { return this.orchestrator.approve(command); }
}

export class DistributionPipeline {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  execute(command: SubmitReleaseCommand) {
    return this.orchestrator.submit(command);
  }
}

export class DistributionLifecycleService {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  submit(command: SubmitReleaseCommand) { return this.orchestrator.submit(command); }
  archive(command: ArchiveReleaseCommand) { return this.orchestrator.archive(command); }
}

export class SubmissionCoordinator {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  submit(command: SubmitReleaseCommand) { return this.orchestrator.submit(command); }
  validate(command: ValidateReleaseCommand) { return this.orchestrator.validate(command); }
}

export class PackageCoordinator {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  buildMetadata(command: BuildPackageCommand) { return this.orchestrator.buildMetadata(command); }
  buildPackage(command: BuildPackageCommand) { return this.orchestrator.buildPackage(command); }
  verifyPackage(command: BuildPackageCommand) { return this.orchestrator.verifyPackage(command); }
}

export class ProviderCoordinator {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  selectProvider(command: SubmitPackageCommand) { return this.orchestrator.selectProvider(command); }
  authenticateProvider(command: SubmitPackageCommand) { return this.orchestrator.authenticateProvider(command); }
  submitPackage(command: SubmitPackageCommand) { return this.orchestrator.submitPackage(command); }
  syncStatus(command: SyncStatusCommand) { return this.orchestrator.syncStatus(command); }
}

export class RoyaltyCoordinator {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  importRoyalties(command: ImportRoyaltyCommand) { return this.orchestrator.importRoyalties(command); }
  calculateRevenue(command: ImportRoyaltyCommand) { return this.orchestrator.calculateRevenue(command); }
  processPayments(command: ProcessPaymentCommand) { return this.orchestrator.processPayments(command); }
}
