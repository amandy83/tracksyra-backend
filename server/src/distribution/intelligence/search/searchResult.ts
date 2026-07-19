import type { DistributionStatus } from "../distributionStatus";
import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class SearchResult {
  readonly releaseId: string;
  readonly title: string;
  readonly artist: string;
  readonly state: DistributionStatus;
  readonly providerReference: string | null;
  readonly score: number;
  readonly matchedField: string | null;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    title: string;
    artist: string;
    state: DistributionStatus;
    providerReference?: string | null;
    score: number;
    matchedField?: string | null;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.title = input.title.trim();
    this.artist = input.artist.trim();
    this.state = input.state;
    this.providerReference = input.providerReference ?? null;
    this.score = input.score;
    this.matchedField = input.matchedField ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.title || !this.artist || !Number.isFinite(this.score)) {
      throw new Error("SearchResult requires releaseId, title, artist, and score");
    }
    Object.freeze(this);
  }
}

