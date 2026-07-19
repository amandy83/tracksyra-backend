import type {
  BootstrapContext,
  BootstrapResult,
  CompositionConfiguration,
  CompositionSnapshot,
  DependencyGraph,
  HealthSnapshot,
  ModuleDescriptor,
  ServiceDescriptor,
  ValidationReport,
} from "../types/compositionTypes";

export interface CompositionRoot {
  bootstrap(context: BootstrapContext): Promise<BootstrapResult> | BootstrapResult;
}

export interface DependencyContainer {
  register<T>(token: string, value: T): void;
  resolve<T>(token: string): T | null;
  has(token: string): boolean;
  list(): readonly string[];
}

export interface ServiceRegistry {
  register(service: ServiceDescriptor): void;
  resolve(serviceId: string): ServiceDescriptor | null;
  list(): readonly ServiceDescriptor[];
}

export interface ModuleRegistry {
  register(module: ModuleDescriptor): void;
  resolve(moduleName: string): ModuleDescriptor | null;
  list(): readonly ModuleDescriptor[];
}

export interface ModuleBuilder {
  build(configuration: CompositionConfiguration): DependencyGraph;
}

export interface ModuleFactory {
  create(descriptor: ModuleDescriptor): unknown;
}

export interface ConfigurationProvider {
  load(): Promise<CompositionConfiguration | null> | CompositionConfiguration | null;
  save(configuration: CompositionConfiguration): Promise<void> | void;
}

export interface DependencyResolver {
  resolve(graph: DependencyGraph, overrides?: Readonly<Record<string, unknown>>): readonly ModuleDescriptor[];
}

export interface LifecycleManager {
  create(configuration: CompositionConfiguration): CompositionSnapshot;
  start(snapshot: CompositionSnapshot): CompositionSnapshot;
  run(snapshot: CompositionSnapshot): CompositionSnapshot;
  stop(snapshot: CompositionSnapshot): CompositionSnapshot;
  fail(snapshot: CompositionSnapshot): CompositionSnapshot;
}

export interface BootstrapManager {
  bootstrap(context: BootstrapContext): Promise<BootstrapResult> | BootstrapResult;
}

export interface StartupValidator {
  validate(snapshot: CompositionSnapshot): Promise<ValidationReport> | ValidationReport;
}

export interface HealthRegistry {
  register(snapshot: HealthSnapshot): void;
  resolve(snapshotId: string): HealthSnapshot | null;
  list(): readonly HealthSnapshot[];
}

export interface DiagnosticRegistry {
  record(report: ValidationReport): void;
  list(): readonly ValidationReport[];
}

export interface MetricsRegistry {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface LoggerRegistry {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
