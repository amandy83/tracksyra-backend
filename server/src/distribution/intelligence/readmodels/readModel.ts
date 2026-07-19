import type { DistributionStatus } from "../distributionStatus";
import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class ReadModel {
  readonly releaseId: string;
  readonly version: number;
  readonly state: DistributionStatus;
  readonly title: string;
  readonly artist: string;
  readonly providerReference: string | null;
  readonly updatedAt: string;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    version: number;
    state: DistributionStatus;
    title: string;
    artist: string;
    providerReference?: string | null;
    updatedAt?: string;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.version = input.version;
    this.state = input.state;
    this.title = input.title.trim();
    this.artist = input.artist.trim();
    this.providerReference = input.providerReference ?? null;
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.title || !this.artist || !Number.isInteger(this.version) || this.version < 1) {
      throw new Error("ReadModel requires valid releaseId, title, artist, and version");
    }
    Object.freeze(this);
  }
}

