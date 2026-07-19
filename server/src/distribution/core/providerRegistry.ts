import { DistributionError } from "./distributionError";

export interface DistributionProviderLike {
  readonly name: string;
}

export class ProviderRegistry<TProvider extends DistributionProviderLike = DistributionProviderLike> {
  private readonly providers = new Map<string, TProvider>();

  register(provider: TProvider): void {
    this.providers.set(provider.name, provider);
  }

  has(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  get(providerName: string): TProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new DistributionError({
        code: "PROVIDER_NOT_FOUND",
        message: `Provider not found: ${providerName}`,
        provider: providerName,
      });
    }
    return provider;
  }

  list(): readonly TProvider[] {
    return [...this.providers.values()];
  }
}

