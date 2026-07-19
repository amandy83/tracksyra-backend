import type { CompositionConfiguration } from "../types/compositionTypes";

export interface CompositionConfigurationStore {
  load(): Promise<CompositionConfiguration | null> | CompositionConfiguration | null;
  save(configuration: CompositionConfiguration): Promise<void> | void;
  list(): Promise<readonly CompositionConfiguration[]> | readonly CompositionConfiguration[];
}
