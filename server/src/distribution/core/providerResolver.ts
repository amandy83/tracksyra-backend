import type { DistributionContext } from "./distributionContext";
import { DistributionError } from "./distributionError";
import type { DistributionProvider, DistributionProviderSubmission } from "./distributionProvider";
import { ProviderRegistry } from "./providerRegistry";

export type ProviderResolverOptions = {
  defaultProvider?: string | null;
  preferredProviders?: readonly string[];
};

export class ProviderResolver {
  constructor(
    private readonly registry: ProviderRegistry<DistributionProvider>,
    private readonly options: ProviderResolverOptions = {},
  ) {}

  resolve(context: DistributionContext, requestedProvider?: string | null): DistributionProvider {
    const requested = requestedProvider ?? context.provider ?? null;
    if (requested && this.registry.has(requested)) {
      const provider = this.registry.get(requested);
      if (provider.supports(context)) return provider;
      throw new DistributionError({
        code: "PROVIDER_NOT_SUPPORTED",
        message: `Provider does not support the provided context: ${requested}`,
        provider: requested,
        retryable: false,
      });
    }

    for (const candidate of this.options.preferredProviders ?? []) {
      if (!this.registry.has(candidate)) continue;
      const provider = this.registry.get(candidate);
      if (provider.supports(context)) return provider;
    }

    if (this.options.defaultProvider && this.registry.has(this.options.defaultProvider)) {
      const provider = this.registry.get(this.options.defaultProvider);
      if (provider.supports(context)) return provider;
    }

    const supported = this.registry.list().find((provider) => provider.supports(context));
    if (supported) return supported;

    throw new DistributionError({
      code: "PROVIDER_NOT_FOUND",
      message: `No distribution provider available for ${context.provider}`,
      provider: context.provider,
      retryable: false,
    });
  }
}

export function createProviderSubmissionMetadata(
  provider: DistributionProvider,
  submission: DistributionProviderSubmission,
): Record<string, unknown> {
  return {
    provider: provider.name,
    providerReferenceId: submission.providerReferenceId ?? null,
    status: submission.status,
    ...(submission.metadata ?? {}),
  };
}

