import type { ModuleDescriptor, ServiceDescriptor } from "../types/compositionTypes";

export interface CompositionModuleRegistry {
  register(module: ModuleDescriptor): void;
  resolve(moduleName: string): ModuleDescriptor | null;
  list(): readonly ModuleDescriptor[];
}

export interface CompositionServiceRegistry {
  register(service: ServiceDescriptor): void;
  resolve(serviceId: string): ServiceDescriptor | null;
  list(): readonly ServiceDescriptor[];
}
