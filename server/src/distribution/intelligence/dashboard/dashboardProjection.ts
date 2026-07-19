import type { DistributionStatus } from "../distributionStatus";
import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class DashboardProjection {
  readonly releaseId: string;
  readonly title: string;
  readonly artist: string;
  readonly state: DistributionStatus;
  readonly providerReference: string | null;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    title: string;
    artist: string;
    state: DistributionStatus;
    providerReference?: string | null;
    summary?: Readonly<Record<string, unknown>>;
    updatedAt?: string;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.title = input.title.trim();
    this.artist = input.artist.trim();
    this.state = input.state;
    this.providerReference = input.providerReference ?? null;
    this.summary = Object.freeze({ ...(input.summary ?? {}) });
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.title || !this.artist) {
      throw new Error("DashboardProjection requires releaseId, title, and artist");
    }
    Object.freeze(this);
  }
}

