import { createHash } from "node:crypto";
import type { UniversalRelease, UniversalMetadataVersion } from "./metadataTypes";
import { stableSerialize } from "./metadataUtils";

export type MetadataFingerprint = Readonly<{
  algorithm: "sha256";
  version: UniversalMetadataVersion;
  value: string;
  createdAt: Date;
}>;

export class MetadataHasher {
  constructor(private readonly version: UniversalMetadataVersion = "1.0") {}

  hash(model: UniversalRelease): string {
    return createHash("sha256").update(stableSerialize(model)).digest("hex");
  }

  fingerprint(model: UniversalRelease): MetadataFingerprint {
    return Object.freeze({
      algorithm: "sha256",
      version: this.version,
      value: this.hash(model),
      createdAt: new Date(),
    });
  }
}

