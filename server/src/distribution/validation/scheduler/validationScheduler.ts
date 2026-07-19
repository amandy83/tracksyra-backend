import type { ValidationScheduler } from "../contracts/validationContracts";
import { ValidationContext, ValidationPlan } from "../types/validationTypes";

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
] as readonly string[]);

export class ValidationSchedulerImpl implements ValidationScheduler {
  schedule(context: ValidationContext, plan?: ValidationPlan | null): ValidationPlan {
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
