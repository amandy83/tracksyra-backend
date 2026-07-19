import { DEFAULT_WORKFLOW_STAGE_ORDER, WorkflowReport, WorkflowStage, WorkflowTransition } from "../types/workflowTypes.js";
import { ReleaseId } from "../../domain/index.js";
function requestedBy(context) {
    return String(context.metadata.requestedBy ?? context.workflowId);
}
function idempotencyKey(context) {
    return String(context.metadata.idempotencyKey ?? context.workflowId);
}
function stageList() {
    return DEFAULT_WORKFLOW_STAGE_ORDER.map((name, index) => new WorkflowStage({
        stageId: `${name}:${index}`,
        name,
        dependencies: index === 0 ? [] : [DEFAULT_WORKFLOW_STAGE_ORDER[index - 1]],
    }));
}
function transitionList() {
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
async function runStage(orchestrator, context, stage) {
    const commandBase = { releaseId: new ReleaseId(context.releaseId), requestedBy: requestedBy(context) };
    switch (stage) {
        case "ArtistSubmit":
        case "SubmissionLock":
        case "ReleaseSnapshot":
            await orchestrator.submit({ ...commandBase, idempotencyKey: idempotencyKey(context) });
            return;
        case "Validation":
            await orchestrator.validate(commandBase);
            return;
        case "Approval":
            await orchestrator.approve({ releaseId: commandBase.releaseId, approvedBy: commandBase.requestedBy });
            return;
        case "UniversalMetadata":
            await orchestrator.buildMetadata({ ...commandBase });
            return;
        case "PackageBuild":
            await orchestrator.buildPackage({ ...commandBase });
            return;
        case "PackageVerification":
            await orchestrator.verifyPackage({ ...commandBase });
            return;
        case "CapabilityResolution":
        case "FeatureFlags":
        case "Priority":
        case "ProviderHealth":
        case "ProviderSelection":
            await orchestrator.selectProvider({ releaseId: commandBase.releaseId, providerHint: null, requestedBy: commandBase.requestedBy });
            return;
        case "ProviderAuthentication":
            await orchestrator.authenticateProvider({ releaseId: commandBase.releaseId, providerHint: null, requestedBy: commandBase.requestedBy });
            return;
        case "ExecutionEngine":
        case "Queue":
        case "Runtime":
        case "DSPConnector":
        case "WebhookPolling":
        case "StatusNormalization":
        case "StateMachine":
            await orchestrator.syncStatus(commandBase);
            return;
        case "ProjectionUpdate":
        case "Dashboard":
        case "Notifications":
            await orchestrator.syncStatus(commandBase);
            return;
        case "CatalogActive":
            await orchestrator.syncStatus(commandBase);
            return;
        case "RoyaltyReports":
        case "RoyaltyImport":
            await orchestrator.importRoyalties(commandBase);
            return;
        case "RevenueCalculation":
            await orchestrator.calculateRevenue(commandBase);
            return;
        case "PaymentProcessing":
            await orchestrator.processPayments({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy });
            return;
        case "StatementGeneration":
            await orchestrator.processPayments({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy });
            return;
        case "ReleaseArchive":
            await orchestrator.archive({ releaseId: commandBase.releaseId, requestedBy: commandBase.requestedBy });
            return;
        case "FreezeMetadata":
        case "FreezeAudio":
        case "FreezeArtwork":
        case "VersionSnapshot":
        default:
            return;
    }
}
export class DistributionWorkflowPipeline {
    context;
    orchestrator;
    constructor(context, orchestrator) {
        this.context = context;
        this.orchestrator = orchestrator;
    }
    async run(context = this.context) {
        const startedAt = new Date().toISOString();
        const errors = [];
        for (const stage of DEFAULT_WORKFLOW_STAGE_ORDER) {
            try {
                await runStage(this.orchestrator, context, stage);
            }
            catch (error) {
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
    stages() {
        return stageList();
    }
    transitions() {
        return transitionList();
    }
}
export class DefaultWorkflowAssembly {
    assemble(context, orchestrator) {
        return new DistributionWorkflowPipeline(context, orchestrator);
    }
}
