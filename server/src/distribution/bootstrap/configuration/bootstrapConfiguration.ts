import type { BootstrapConfiguration } from "../types/bootstrapTypes";

export interface BootstrapConfigurationLoader {
  load(): Promise<BootstrapConfiguration> | BootstrapConfiguration;
}
