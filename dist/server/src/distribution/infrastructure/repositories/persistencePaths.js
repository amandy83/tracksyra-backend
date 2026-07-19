import { join } from "node:path";
export function distributionPersistenceBasePath() {
    return join(process.cwd(), "server", ".track-syra-state");
}
export function createPersistentDistributionMap(repository, namespace, name, factory) {
    return factory(repository, namespace, name, (key) => String(key), (key) => key);
}
