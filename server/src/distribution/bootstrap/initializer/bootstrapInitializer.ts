import type { ModuleDescriptor } from "../../composition";
import type { ModuleInitialization } from "../types/bootstrapTypes";

export interface BootstrapModuleInitializer {
  initialize(descriptor: ModuleDescriptor): ModuleInitialization;
}
