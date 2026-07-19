export class ConnectorAsset {
    assetId;
    releaseId;
    kind;
    uri;
    checksum;
    sizeBytes;
    mediaType;
    metadata;
    constructor(input) {
        this.assetId = input.assetId.trim();
        this.releaseId = input.releaseId.trim();
        this.kind = input.kind.trim();
        this.uri = input.uri.trim();
        this.checksum = input.checksum ?? null;
        this.sizeBytes = input.sizeBytes ?? null;
        this.mediaType = input.mediaType ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.assetId || !this.releaseId || !this.kind || !this.uri) {
            throw new Error("ConnectorAsset requires non-empty assetId, releaseId, kind, and uri");
        }
        Object.freeze(this);
    }
}
