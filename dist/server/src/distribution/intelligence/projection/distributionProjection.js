import { ReadModel } from "../readmodels/readModel.js";
export class DistributionProjection {
    releaseId;
    state;
    updatedAt;
    version;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.state = input.state;
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.version = input.version ?? 1;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId || !Number.isInteger(this.version) || this.version < 1) {
            throw new Error("DistributionProjection requires a releaseId and positive version");
        }
        Object.freeze(this);
    }
    toReadModel(title, artist, providerReference = null) {
        return new ReadModel({
            releaseId: this.releaseId,
            version: this.version,
            state: this.state,
            title,
            artist,
            providerReference,
            updatedAt: this.updatedAt,
            metadata: this.metadata,
        });
    }
}
