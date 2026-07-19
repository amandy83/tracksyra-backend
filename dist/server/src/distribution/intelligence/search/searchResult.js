export class SearchResult {
    releaseId;
    title;
    artist;
    state;
    providerReference;
    score;
    matchedField;
    metadata;
    constructor(input) {
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
