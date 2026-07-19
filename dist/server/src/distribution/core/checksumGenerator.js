import { createHash } from "node:crypto";
import { serializeCanonicalJSON } from "./canonicalSerializer.js";
export class ChecksumGenerator {
    generate(input) {
        return createHash("sha256").update(serializeCanonicalJSON(input), "utf8").digest("hex");
    }
    generateObject(input) {
        return this.generate(input);
    }
}
