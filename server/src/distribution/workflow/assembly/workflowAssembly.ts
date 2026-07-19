import type { DistributionOrchestrator } from "../../application/services";
import type { ArchiveReleaseCommand, ApproveReleaseCommand, BuildPackageCommand, ImportRoyaltyCommand, ProcessPaymentCommand, SubmitPackageCommand, SubmitReleaseCommand, SyncStatusCommand, ValidateReleaseCommand } from "../../application/commands";
import type { WorkflowAssembly, WorkflowPipeline } from "../contracts/workflowContracts";
import type { WorkflowContext, WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";
import { DEFAULT_WORKFLOW_STAGE_ORDER, WorkflowReport, WorkflowStage, WorkflowTransition } from "../types/workflowTypes";
import { ReleaseId } from "../../domain";

function requestedBy(context: WorkflowContext): string {
  return String(context.metadata.requestedBy ?? context.workflowId);
}

function idempotencyKey(context: WorkflowContext): string {
  return String(context.metadata.idempotencyKey ?? context.workflowId);
}

function stageList(): readonly WorkflowStage[] {
  return DEFAULT_WORKFLOW_STAGE_ORDER.map((name, index) => new WorkflowStage({
    stageId: `${name}:${index}`,
    name,
    dependencies: index === 0 ? [] : [DEFAULT_WORKFLOW_STAGE_ORDER[index - 1]],
  }));
}

function transitionList(): readonly WorkflowTransition[] {
  const stages = DEFAULT_WORKFLOW_STAGE_ORDER;
  return stages.slice(1).map((to, index) => new WorkflowTransition({
    transitionId: `${stages[index]}:${to}`,
    from: stages[index],
    to,
    stage: to,
    validated: true,
    applied: true,
  }));
}

async function runStage(orchestrator: DistributionOrchestrator, context: WorkflowContext, stage: WorkflowStageName): Promise<void> {
  const commandBase = { releaseId: new ReleaseId(context.releaseId), requestedBy: requestedBy(context) };
  switch (stage) {
    case "ArtistSubmit":
    case "SubmissionLock":
    case "ReleaseSnapshot":
      await orchestrator.submit({ ...commandBase, idempotencyKey: idempotencyKey(context) } satisfies SubmitReleaseCommand);
      return;
    case "Validation":
      await orchestrator.validate(commandBase satisfies ValidateReleaseCommand);
      return;
    case "Approval":
      await orchestrator.approve({ releaseId: commandBase.releaseId, approvedBy: commandBase.requestedBy } satisfies ApproveReleaseCommand);
      return;
    case "UniversalMetadata":
      await orchestrator.buildMetadata({ ...commandBase } as BuildPackageCommand);
      return;
    case "PackageBuild":
      await orchestrator.buildPackage({ ...commandBase } as BuildPackageCommand);
      return;
    case "PackageVerification":
      await orchestrator.verifyPackage({ ...commandBase } as BuildPackageCommand);
      return;
    case "CapabilityResolution":
    case "FeatureFlags":
    case "Priority":
    case "ProviderHealth":
    case "ProviderSelection":
      await orchestrator.selectProvider({ releaseId: commandBase.releaseId, providerHint: null, requestedBy: commandBase.requestedBy } satisfies SubmitPackageCommand);
      return;
    case "ProviderAuthentication":
      await orchestrator.authenticateProvider({ releaseId: commandBase.releaseId, providerHint: null, requestedBy: commandBase.requestedBy } satisfies SubmitPackageCommand);
      return;
    case "ExecutionEngine":
    case "Queue":
    case "Runtime":
    case "DSPConnector":
    case "WebhookPolling":
    case "StatusNormalization":
    case "StateMachine":
      await orchestrator.syncStatus(commandBase satisfies SyncStatusCommand);
      return;
    case "ProjectionUpdate":
    case "Dashboard":
    case "Notifications":
      await orchestrator.syncStatus(commandBase satisfies SyncStatusCommand);
      return;
    case "CatalogActive":
      await orchestrator.syncStatus(commandBase satisfies SyncStatusCommand);
      return;
    case "RoyaltyReports":
    case "RoyaltyImport":
      await orchestrator.importRoyalties(commandBase satisfies ImportRoyaltyCommand);
      return;
    case "RevenueCalculation":
      await orchestrator.calculateRevenue(commandBase satisfies ImportRoyaltyCommand);
      return;
    case "PaymentProcessing":
      await orchestrator.processPayments({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy } satisfies ProcessPaymentCommand);
      return;
    case "StatementGeneration":
      await orchestrator.processPayments({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy } satisfies ProcessPaymentCommand);
      return;
    case "ReleaseArchive":
      await orchestrator.archive({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy } satisfies ArchiveReleaseCommand);
      return;
    case "FreezeMetadata":
    case "FreezeAudio":
    case "FreezeArtwork":
    case "VersionSnapshot":
    default:
      return;
  }
}

export class DistributionWorkflowPipeline implements WorkflowPipeline {
  constructor(
    private readonly context: WorkflowContext,
    private readonly orchestrator: DistributionOrchestrator,
  ) {}

  async run(context: WorkflowContext = this.context): Promise<WorkflowReport> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    for (const stage of DEFAULT_WORKFLOW_STAGE_ORDER) {
      try {
        await runStage(this.orchestrator, context, stage);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return new WorkflowReport({
          reportId: `${context.workflowId}:${stage}`,
          workflowId: context.workflowId,
          releaseId: context.releaseId,
          success: false,
          failure: true,
          startedAt,
          errors,
          warnings: [],
        });
      }
    }
    return new WorkflowReport({
      reportId: `${context.workflowId}:completed`,
      workflowId: context.workflowId,
      releaseId: context.releaseId,
      success: true,
      failure: false,
      startedAt,
      warnings: [],
      errors: [],
    });
  }

  stages(): readonly WorkflowStage[] {
    return stageList();
  }

  transitions(): readonly WorkflowTransition[] {
    return transitionList();
  }
}

export class DefaultWorkflowAssembly implements WorkflowAssembly {
  assemble(context: WorkflowContext, orchestrator: DistributionOrchestrator): WorkflowPipeline {
    return new DistributionWorkflowPipeline(context, orchestrator);
  }
}
