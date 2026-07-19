import type { BootstrapConfiguration, BootstrapReport } from "../types/bootstrapTypes";
import type { CompositionSnapshot } from "../../composition";

export interface BootstrapLifecycleManager {
  create(configuration: BootstrapConfiguration): CompositionSnapshot;
  start(snapshot: CompositionSnapshot): CompositionSnapshot;
  stop(snapshot: CompositionSnapshot): BootstrapReport;
}
