export class ReadModel {
    releaseId;
    version;
    state;
    title;
    artist;
    providerReference;
    updatedAt;
    metadata;
    constructor(input) {
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
