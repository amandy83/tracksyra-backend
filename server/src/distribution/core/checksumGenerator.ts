import { createHash } from "node:crypto";
import { serializeCanonicalJSON } from "./canonicalSerializer";

export class ChecksumGenerator {
  generate(input: string | Uint8Array | Buffer): string {
    return createHash("sha256").update(serializeCanonicalJSON(input), "utf8").digest("hex");
  }

  generateObject(input: unknown): string {
    return this.generate(input as string | Uint8Array | Buffer);
  }
}
