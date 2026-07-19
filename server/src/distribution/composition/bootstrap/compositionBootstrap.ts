import type { BootstrapContext, BootstrapResult } from "../types/compositionTypes";

export interface CompositionBootstrapManager {
  bootstrap(context: BootstrapContext): Promise<BootstrapResult> | BootstrapResult;
}
