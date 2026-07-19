import type { BootstrapPlan, StartupSequence } from "../types/bootstrapTypes";

export interface BootstrapStartupCoordinator {
  coordinate(plan: BootstrapPlan): Promise<StartupSequence> | StartupSequence;
}
