import type { CompositionModuleName } from "../types/compositionTypes";

export interface CompositionModuleInstance {
  readonly moduleName: CompositionModuleName;
  readonly initialized: boolean;
}
