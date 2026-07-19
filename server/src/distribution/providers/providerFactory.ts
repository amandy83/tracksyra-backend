import type { ProviderCapabilities } from "./providerCapabilities";
import type { ProviderConfiguration } from "./providerConfiguration";
import type { ProviderCredentials } from "./providerCredentials";
import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderHealth } from "./providerHealth";
import type { DistributionProvider } from "./distributionProvider";
import type { ProviderStatus } from "./providerStatus";
import { ProviderError } from "./providerError";

export type ProviderRegistryEntry<TProvider extends DistributionProvider = DistributionProvider> = Readonly<{
  id: string;
  name: string;
  version: string;
  priority: number;
  fallbackProvider: string | null;
  provider: TProvider | null;
  factory: ProviderFactory<TProvider> | null;
  capabilities: ProviderCapabilities;
  configuration: ProviderConfiguration;
  credentials: ProviderCredentials | null;
  featureFlags: ProviderFeatureFlags;
  status: ProviderStatus;
  health: ProviderHealth | null;
  dependencies: Readonly<Record<string, unknown>>;
  tags: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
  registeredAt: Date;
  updatedAt: Date;
}>;

export type ProviderFactoryInput<TProvider extends DistributionProvider = DistributionProvider> = Readonly<{
  entry: ProviderRegistryEntry<TProvider>;
  services: Readonly<Record<string, unknown>>;
}>;

export interface ProviderFactory<TProvider extends DistributionProvider = DistributionProvider> {
  create(input: ProviderFactoryInput<TProvider>): Promise<TProvider> | TProvider;
}

export class DefaultProviderFactory implements ProviderFactory {
  create<TProvider extends DistributionProvider>(input: ProviderFactoryInput<TProvider>): Promise<TProvider> | TProvider {
    if (input.entry.provider) return input.entry.provider;
    if (input.entry.factory) return input.entry.factory.create(input);
    throw new ProviderError({
      code: "NOT_FOUND",
      message: `No provider instance or factory registered for ${input.entry.name}@${input.entry.version}`,
      provider: input.entry.name,
      version: input.entry.version,
      retryable: false,
    });
  }
}

