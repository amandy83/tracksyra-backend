import type { BootstrapPlan, StartupSequence } from "../types/bootstrapTypes";

export interface BootstrapOrderingResolver {
  resolve(plan: BootstrapPlan): Promise<StartupSequence> | StartupSequence;
}
