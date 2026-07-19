import { serializeCanonicalJSON } from "../../core/canonicalSerializer.js";
export class JsonStorageSerializer {
    serialize(value) {
        return serializeCanonicalJSON(value);
    }
    deserialize(payload) {
        return JSON.parse(payload);
    }
}
