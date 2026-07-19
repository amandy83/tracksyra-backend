import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
export class SpecificationSerializer {
    serialize(specification) {
        return serializeCanonicalJSON(specification);
    }
    serializeChecksum(specification) {
        return this.serialize(specification);
    }
    deserialize(serialized) {
        return JSON.parse(serialized);
    }
}
