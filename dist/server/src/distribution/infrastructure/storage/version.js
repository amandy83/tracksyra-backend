export class DefaultStorageVersion {
    version;
    createdAt;
    metadata;
    constructor(version, createdAt = new Date().toISOString(), metadata = {}) {
        this.version = version;
        this.createdAt = createdAt;
        this.metadata = metadata;
        Object.freeze(this.metadata);
        Object.freeze(this);
    }
}
