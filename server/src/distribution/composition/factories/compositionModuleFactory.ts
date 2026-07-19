import type { ModuleDescriptor } from "../types/compositionTypes";
import type { CompositionModuleInstance } from "../modules/compositionModule";

export interface CompositionModuleFactory {
  create(descriptor: ModuleDescriptor): CompositionModuleInstance | null;
}
