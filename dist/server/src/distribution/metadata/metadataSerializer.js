import { deepFreeze, stableSerialize } from "./metadataUtils.js";
export class UniversalSerializer {
    serialize(model) {
        return stableSerialize(model);
    }
    serializeBundle(model) {
        return Object.freeze({
            version: model.version,
            payload: this.serialize(model),
        });
    }
    deserialize(input) {
        const payload = typeof input === "string" ? input : input.payload;
        const parsed = JSON.parse(payload);
        return deepFreeze(parsed);
    }
}
