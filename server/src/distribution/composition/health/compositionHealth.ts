import type { HealthSnapshot } from "../types/compositionTypes";

export interface CompositionHealthRegistry {
  register(snapshot: HealthSnapshot): void;
  resolve(snapshotId: string): HealthSnapshot | null;
  list(): readonly HealthSnapshot[];
}
