import { serializeCanonicalJSON } from "../../core/canonicalSerializer.js";
export class ValidationSerializer {
    serialize(value) {
        return serializeCanonicalJSON(value);
    }
    deserializeContext(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializePlan(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializeResult(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializeReport(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializeSummary(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializeError(payload) {
        return Object.freeze(JSON.parse(payload));
    }
    deserializeWarning(payload) {
        return Object.freeze(JSON.parse(payload));
    }
}
