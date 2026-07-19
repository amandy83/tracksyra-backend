import { serializeCanonicalJSON } from "../core/canonicalSerializer";

export class CredentialSerializer {
  serialize(value: unknown): string {
    return serializeCanonicalJSON(value);
  }

  deserialize<T>(value: string): T {
    return JSON.parse(value) as T;
  }
}
