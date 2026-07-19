import { join } from "node:path";
import type { StorageRepository } from "../storage/repository";
import type { RuntimeRepository, RuntimeRepositoryFactory } from "./runtime";

export function distributionPersistenceBasePath(): string {
  return join(process.cwd(), "server", ".track-syra-state");
}

export function createPersistentDistributionMap<K, V>(
  repository: StorageRepository<Readonly<{ version: number; updatedAt: string; entries: readonly (readonly [string, V])[]; metadata: Readonly<Record<string, unknown>> }>>,
  namespace: string,
  name: string,
  factory: RuntimeRepositoryFactory<K, V>,
): RuntimeRepository<K, V> {
  return factory(repository, namespace, name, (key) => String(key), (key) => key as unknown as K);
}
