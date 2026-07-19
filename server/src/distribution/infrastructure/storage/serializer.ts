import { serializeCanonicalJSON } from "../../core/canonicalSerializer";

export interface StorageSerializer {
  serialize<TValue>(value: TValue): string;
  deserialize<TValue>(payload: string): TValue;
}

export class JsonStorageSerializer implements StorageSerializer {
  serialize<TValue>(value: TValue): string {
    return serializeCanonicalJSON(value);
  }

  deserialize<TValue>(payload: string): TValue {
    return JSON.parse(payload) as TValue;
  }
}
