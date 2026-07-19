import { createHash } from "node:crypto";
import { stableSerialize } from "./metadataUtils.js";
export class MetadataHasher {
    version;
    constructor(version = "1.0") {
        this.version = version;
    }
    hash(model) {
        return createHash("sha256").update(stableSerialize(model)).digest("hex");
    }
    fingerprint(model) {
        return Object.freeze({
            algorithm: "sha256",
            version: this.version,
            value: this.hash(model),
            createdAt: new Date(),
        });
    }
}
