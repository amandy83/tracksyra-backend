import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
export class CredentialSerializer {
    serialize(value) {
        return serializeCanonicalJSON(value);
    }
    deserialize(value) {
        return JSON.parse(value);
    }
}
