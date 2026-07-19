import type { DistributionStatus } from "../distributionStatus";
import type { ProjectionMetadata } from "../types/intelligenceTypes";
import { ReadModel } from "../readmodels/readModel";

export class DistributionProjection {
  readonly releaseId: string;
  readonly state: DistributionStatus;
  readonly updatedAt: string;
  readonly version: number;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    state: DistributionStatus;
    updatedAt?: string;
    version?: number;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.state = input.state;
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.version = input.version ?? 1;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !Number.isInteger(this.version) || this.version < 1) {
      throw new Error("DistributionProjection requires a releaseId and positive version");
    }
    Object.freeze(this);
  }

  toReadModel(title: string, artist: string, providerReference: string | null = null): ReadModel {
    return new ReadModel({
      releaseId: this.releaseId,
      version: this.version,
      state: this.state,
      title,
      artist,
      providerReference,
      updatedAt: this.updatedAt,
      metadata: this.metadata,
    });
  }
}

