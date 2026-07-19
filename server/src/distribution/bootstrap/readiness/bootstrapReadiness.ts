import type { ReadinessSnapshot } from "../types/bootstrapTypes";
import type { CompositionSnapshot } from "../../composition";

export interface BootstrapReadinessChecker {
  check(snapshot: CompositionSnapshot): Promise<ReadinessSnapshot> | ReadinessSnapshot;
}
