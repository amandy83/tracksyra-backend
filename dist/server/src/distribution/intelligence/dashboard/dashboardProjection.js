export class DashboardProjection {
    releaseId;
    title;
    artist;
    state;
    providerReference;
    summary;
    updatedAt;
    metadata;
    constructor(input) {
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
