import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class ProjectionCheckpoint {
  readonly checkpointId: string;
  readonly releaseId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly replayCursor: string | null;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    checkpointId: string;
    releaseId: string;
    version: number;
    createdAt?: string;
    replayCursor?: string | null;
    metadata?: ProjectionMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.releaseId = input.releaseId.trim();
    this.version = input.version;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.replayCursor = input.replayCursor ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.checkpointId || !this.releaseId || !Number.isInteger(this.version) || this.version < 1) {
      throw new Error("ProjectionCheckpoint requires valid identifiers and version");
    }
    Object.freeze(this);
  }
}

