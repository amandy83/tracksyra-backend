import type { EnvironmentSnapshot } from "../types/bootstrapTypes";

export interface BootstrapEnvironmentProvider {
  load(): Promise<EnvironmentSnapshot> | EnvironmentSnapshot;
}
