export class ConnectorCapabilities {
    connectorId;
    categories;
    uploadModes;
    territories;
    languages;
    features;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.categories = Object.freeze([...(input.categories ?? [])]);
        this.uploadModes = Object.freeze([...(input.uploadModes ?? [])]);
        this.territories = Object.freeze([...(input.territories ?? [])]);
        this.languages = Object.freeze([...(input.languages ?? [])]);
        this.features = Object.freeze([...(input.features ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId) {
            throw new Error("ConnectorCapabilities.connectorId must not be empty");
        }
        Object.freeze(this);
    }
}
