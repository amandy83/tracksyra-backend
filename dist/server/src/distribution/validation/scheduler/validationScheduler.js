import { ValidationPlan } from "../types/validationTypes.js";
export const DEFAULT_VALIDATION_ORDER = Object.freeze([
    "PlatformValidator",
    "RuntimeValidator",
    "WorkflowValidator",
    "OrchestratorValidator",
    "QueueValidator",
    "WorkerValidator",
    "ProviderValidator",
    "ConnectorValidator",
    "StatusSyncValidator",
    "RoyaltyValidator",
    "ObservabilityValidator",
    "BootstrapValidator",
    "CompositionValidator",
    "DependencyValidator",
    "ConfigurationValidator",
    "SecurityValidator",
    "HealthValidator",
    "ReadinessValidator",
    "StartupValidator",
    "ShutdownValidator",
    "DisasterRecoveryValidator",
    "BackupValidator",
    "RestoreValidator",
    "FailoverValidator",
    "ScalabilityValidator",
    "PerformanceValidator",
    "LoadValidator",
    "ConcurrencyValidator",
    "DataIntegrityValidator",
    "StateMachineValidator",
    "EventReplayValidator",
    "ProjectionValidator",
    "SnapshotValidator",
    "AuditValidator",
    "MetricsValidator",
    "LoggingValidator",
    "TraceValidator",
]);
export class ValidationSchedulerImpl {
    schedule(context, plan) {
        if (plan) {
            return plan;
        }
        return new ValidationPlan({
            planId: `${context.contextId}:validation-plan`,
            contextId: context.contextId,
            scope: context.scope,
            validators: DEFAULT_VALIDATION_ORDER,
            strict: true,
            metadata: context.metadata,
        });
    }
}
