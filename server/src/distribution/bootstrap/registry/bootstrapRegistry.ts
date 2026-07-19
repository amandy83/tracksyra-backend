import type { StartupCheckpoint } from "../types/bootstrapTypes";

export interface BootstrapCheckpointRegistry {
  register(checkpoint: StartupCheckpoint): void;
  get(checkpointId: string): StartupCheckpoint | null;
  list(): readonly StartupCheckpoint[];
}
