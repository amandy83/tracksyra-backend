export interface ProviderSerialization {
  serialize<T>(value: T): string;
  deserialize<T>(value: string): T;
}
