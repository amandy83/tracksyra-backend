export class ReleaseProjection {
    releaseId;
    title;
    artist;
    state;
    version;
    providerReference;
    updatedAt;
    metadata;
    constructor(input) {
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
