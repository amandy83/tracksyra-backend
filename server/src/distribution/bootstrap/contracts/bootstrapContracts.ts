import type {
  BootstrapConfiguration,
  BootstrapPlan,
  BootstrapReport,
  DependencyValidationResult,
  EnvironmentSnapshot,
  ModuleInitialization,
  ReadinessSnapshot,
  ShutdownSequence,
  StartupCheckpoint,
  StartupSequence,
} from "../types/bootstrapTypes";
import type { CompositionConfiguration, CompositionSnapshot, HealthSnapshot, ModuleDescriptor } from "../../composition";

export interface BootstrapManager {
  bootstrap(configuration: BootstrapConfiguration): Promise<BootstrapReport> | BootstrapReport;
}

export interface StartupCoordinator {
  start(plan: BootstrapPlan): Promise<StartupSequence> | StartupSequence;
}

export interface ShutdownCoordinator {
  shutdown(sequence: ShutdownSequence): Promise<BootstrapReport> | BootstrapReport;
}

export interface LifecycleController {
  initialize(configuration: BootstrapConfiguration): CompositionSnapshot;
  start(snapshot: CompositionSnapshot): CompositionSnapshot;
  stop(snapshot: CompositionSnapshot): CompositionSnapshot;
}

export interface ModuleInitializer {
  initialize(descriptor: ModuleDescriptor): ModuleInitialization;
}

export interface DependencyValidator {
  validate(configuration: BootstrapConfiguration): Promise<DependencyValidationResult> | DependencyValidationResult;
}

export interface ReadinessChecker {
  check(snapshot: CompositionSnapshot): Promise<ReadinessSnapshot> | ReadinessSnapshot;
}

export interface HealthChecker {
  check(snapshot: CompositionSnapshot): Promise<HealthSnapshot> | HealthSnapshot;
}

export interface EnvironmentProvider {
  load(): Promise<EnvironmentSnapshot> | EnvironmentSnapshot;
}

export interface ConfigurationLoader {
  load(): Promise<BootstrapConfiguration> | BootstrapConfiguration;
}

export interface OrderingResolver {
  resolve(configuration: BootstrapConfiguration): Promise<StartupSequence> | StartupSequence;
}

export interface BootstrapRegistry {
  register(checkpoint: StartupCheckpoint): void;
  list(): readonly StartupCheckpoint[];
}

export interface DiagnosticReporter {
  report(report: BootstrapReport): void;
}

export interface MetricsPublisher {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface BootstrapLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
