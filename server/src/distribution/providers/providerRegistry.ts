import type { ProviderCapabilities } from "./providerCapabilities";
import type { DistributionProvider } from "./distributionProvider";
import { ProviderError } from "./providerError";
import type { ProviderFactory, ProviderRegistryEntry, ProviderFactoryInput } from "./providerFactory";
import { ProviderValidator } from "./providerValidator";
import { ProviderStatus } from "./providerStatus";

export type ProviderDiscoverySource<TProvider extends DistributionProvider = DistributionProvider> =
  | ProviderRegistryEntry<TProvider>
  | readonly ProviderRegistryEntry<TProvider>[]
  | AsyncIterable<ProviderRegistryEntry<TProvider>>
  | Promise<ProviderRegistryEntry<TProvider> | readonly ProviderRegistryEntry<TProvider>[]>
  | (() => Promise<ProviderRegistryEntry<TProvider> | readonly ProviderRegistryEntry<TProvider>[] | AsyncIterable<ProviderRegistryEntry<TProvider>>>);

export type ProviderRegistryOptions<TProvider extends DistributionProvider = DistributionProvider> = Readonly<{
  factory: ProviderFactory<TProvider>;
  validator: ProviderValidator;
  services: Readonly<Record<string, unknown>>;
}>;

export class ProviderRegistry<TProvider extends DistributionProvider = DistributionProvider> {
  private readonly entries = new Map<string, Map<string, ProviderRegistryEntry<TProvider>>>();
  private readonly factory: ProviderFactory<TProvider>;
  private readonly validator: ProviderValidator;
  private readonly services: Readonly<Record<string, unknown>>;

  constructor(options: ProviderRegistryOptions<TProvider>) {
    this.factory = options.factory;
    this.validator = options.validator;
    this.services = Object.freeze({ ...options.services });
  }

  register(input: ProviderRegistryEntry<TProvider>): ProviderRegistryEntry<TProvider> {
    this.validator.assertValid(this.validator.validateConfiguration(input.configuration), input.name, input.version);
    this.validator.assertValid(this.validator.validateCredentials(input.credentials), input.name, input.version);
    this.validator.assertValid(this.validator.validateCapabilities(input.capabilities), input.name, input.version);
    const byName = this.entries.get(input.name) ?? new Map<string, ProviderRegistryEntry<TProvider>>();
    const next: ProviderRegistryEntry<TProvider> = Object.freeze({
      ...input,
      registeredAt: input.registeredAt ?? new Date(),
      updatedAt: new Date(),
    });
    byName.set(input.version, next);
    this.entries.set(input.name, byName);
    return next;
  }

  registerMany(inputs: readonly ProviderRegistryEntry<TProvider>[]): readonly ProviderRegistryEntry<TProvider>[] {
    return inputs.map((entry) => this.register(entry));
  }

  async discover(source: ProviderDiscoverySource<TProvider>): Promise<readonly ProviderRegistryEntry<TProvider>[]> {
    const resolved = await resolveDiscoverySource(source);
    if (isAsyncIterable(resolved)) {
      const discovered: ProviderRegistryEntry<TProvider>[] = [];
      for await (const entry of resolved as AsyncIterable<ProviderRegistryEntry<TProvider>>) discovered.push(this.register(entry));
      return discovered;
    }
    if (Array.isArray(resolved)) return this.registerMany(resolved);
    return [this.register(resolved as ProviderRegistryEntry<TProvider>)];
  }

  has(name: string, version?: string): boolean {
    if (version) return Boolean(this.entries.get(name)?.has(version));
    return Boolean(this.entries.get(name)?.size);
  }

  list(): readonly ProviderRegistryEntry<TProvider>[] {
    return [...this.entries.values()].flatMap((versions) => [...versions.values()]);
  }

  listByName(name: string): readonly ProviderRegistryEntry<TProvider>[] {
    return [...(this.entries.get(name)?.values() ?? [])];
  }

  listByCapability(capability: keyof ProviderCapabilities | string): readonly ProviderRegistryEntry<TProvider>[] {
    return this.list().filter((entry) => hasCapability(entry.capabilities, capability));
  }

  listByFeatureFlag(flag: string, enabled = true): readonly ProviderRegistryEntry<TProvider>[] {
    return this.list().filter((entry) => Boolean(entry.featureFlags[flag]) === enabled);
  }

  listByStatus(status: ProviderStatus): readonly ProviderRegistryEntry<TProvider>[] {
    return this.list().filter((entry) => entry.status === status);
  }

  listHealthy(): readonly ProviderRegistryEntry<TProvider>[] {
    return this.list().filter((entry) => entry.health?.healthy ?? false);
  }

  resolve(name: string, version?: string): ProviderRegistryEntry<TProvider> {
    const entries = this.listByName(name);
    if (!entries.length) throw notFound(name);
    const selected = version ? entries.find((entry) => entry.version === version) : pickBestEntry(entries);
    if (!selected) throw notFound(`${name}@${version ?? "latest"}`);
    return selected;
  }

  resolveFallback(name: string, version?: string): ProviderRegistryEntry<TProvider> {
    const primary = this.resolve(name, version);
    if (primary.provider && primary.status !== ProviderStatus.DISABLED) return primary;
    if (primary.fallbackProvider && this.has(primary.fallbackProvider)) return this.resolve(primary.fallbackProvider);
    const healthy = this.listHealthy().filter((entry) => entry.name !== name);
    const ranked = healthy.sort(compareEntries);
    if (ranked.length) return ranked[0];
    return primary;
  }

  async create(name: string, version?: string): Promise<TProvider> {
    const entry = this.resolve(name, version);
    const provider = entry.provider ?? (await this.factory.create({ entry, services: this.services } as ProviderFactoryInput<TProvider>));
    if (provider !== entry.provider) {
      this.entries.get(entry.name)?.set(entry.version, Object.freeze({ ...entry, provider, updatedAt: new Date() }));
    }
    return provider;
  }
}

function pickBestEntry<TProvider extends DistributionProvider>(entries: readonly ProviderRegistryEntry<TProvider>[]): ProviderRegistryEntry<TProvider> | null {
  const sorted = [...entries].sort(compareEntries);
  return sorted[0] ?? null;
}

function compareEntries<TProvider extends DistributionProvider>(
  a: ProviderRegistryEntry<TProvider>,
  b: ProviderRegistryEntry<TProvider>,
): number {
  if (a.status !== b.status) {
    if (a.status === ProviderStatus.READY) return -1;
    if (b.status === ProviderStatus.READY) return 1;
    if (a.status === ProviderStatus.DEGRADED) return -1;
    if (b.status === ProviderStatus.DEGRADED) return 1;
  }

  if (a.priority !== b.priority) return b.priority - a.priority;
  const versionComparison = compareVersions(a.version, b.version);
  if (versionComparison !== 0) return versionComparison;
  return a.updatedAt.getTime() - b.updatedAt.getTime();
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10))
    .map((value) => (Number.isFinite(value) ? value : 0));
}

function hasCapability(capabilities: ProviderCapabilities, capability: keyof ProviderCapabilities | string): boolean {
  if (capability === "operations") return capabilities.operations.length > 0;
  if (capability === "supportedStatuses") return capabilities.supportedStatuses.length > 0;
  if (capability === "rateLimit") return Boolean(capabilities.rateLimit);
  if (capability === "featureFlags") return Object.keys(capabilities.featureFlags).length > 0;
  if (capability in capabilities) return Boolean((capabilities as Record<string, unknown>)[capability]);
  return capabilities.operations.includes(capability as never) || capabilities.supportedStatuses.some((status) => status === capability);
}

function notFound(identifier: string): ProviderError {
  return new ProviderError({
    code: "NOT_FOUND",
    message: `Provider not found: ${identifier}`,
    provider: identifier,
    retryable: false,
  });
}

async function resolveDiscoverySource<TProvider extends DistributionProvider>(
  source: ProviderDiscoverySource<TProvider>,
): Promise<ProviderRegistryEntry<TProvider> | readonly ProviderRegistryEntry<TProvider>[] | AsyncIterable<ProviderRegistryEntry<TProvider>>> {
  if (typeof source === "function") return resolveDiscoverySource(await source());
  return source instanceof Promise ? resolveDiscoverySource(await source) : source;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return Boolean(value && typeof value === "object" && Symbol.asyncIterator in value);
}
