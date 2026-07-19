import type { UniversalRelease } from "./metadataTypes";
import { deepFreeze, stableSerialize } from "./metadataUtils";

export type UniversalSerializedMetadata = Readonly<{
  version: string;
  payload: string;
}>;

export class UniversalSerializer {
  serialize(model: UniversalRelease): string {
    return stableSerialize(model);
  }

  serializeBundle(model: UniversalRelease): UniversalSerializedMetadata {
    return Object.freeze({
      version: model.version,
      payload: this.serialize(model),
    });
  }

  deserialize(input: string | UniversalSerializedMetadata): UniversalRelease {
    const payload = typeof input === "string" ? input : input.payload;
    const parsed = JSON.parse(payload) as UniversalRelease;
    return deepFreeze(parsed);
  }
}

