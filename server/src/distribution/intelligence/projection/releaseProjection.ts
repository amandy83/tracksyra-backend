import type { DistributionStatus } from "../distributionStatus";
import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class ReleaseProjection {
  readonly releaseId: string;
  readonly title: string;
  readonly artist: string;
  readonly state: DistributionStatus;
  readonly version: number;
  readonly providerReference: string | null;
  readonly updatedAt: string;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    title: string;
    artist: string;
    state: DistributionStatus;
    version?: number;
    providerReference?: string | null;
    updatedAt?: string;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.title = input.title.trim();
    this.artist = input.artist.trim();
    this.state = input.state;
    this.version = input.version ?? 1;
    this.providerReference = input.providerReference ?? null;
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.title || !this.artist || !Number.isInteger(this.version) || this.version < 1) {
      throw new Error("ReleaseProjection requires releaseId, title, artist, and version");
    }
    Object.freeze(this);
  }
}

