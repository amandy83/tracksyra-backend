import type { StorageMetadata } from "../../storage/storageTypes";

export type RuntimeRepositoryPage<TValue> = Readonly<{
  items: readonly (readonly [string, TValue])[];
  total: number;
  offset: number;
  limit: number;
}>;

export type RuntimeRepositorySnapshot<TValue> = Readonly<{
  version: number;
  updatedAt: string;
  entries: readonly (readonly [string, TValue])[];
  metadata: StorageMetadata;
}>;

export type RuntimeRepositoryBatchOperation<TValue> = Readonly<{
  set?: readonly (readonly [string, TValue])[];
  delete?: readonly string[];
  metadata?: StorageMetadata;
}>;
