import { DistributionError } from "./distributionError.js";
export class ProviderResolver {
    registry;
    options;
    constructor(registry, options = {}) {
        this.registry = registry;
        this.options = options;
    }
    resolve(context, requestedProvider) {
        const requested = requestedProvider ?? context.provider ?? null;
        if (requested && this.registry.has(requested)) {
            const provider = this.registry.get(requested);
            if (provider.supports(context))
                return provider;
            throw new DistributionError({
                code: "PROVIDER_NOT_SUPPORTED",
                message: `Provider does not support the provided context: ${requested}`,
                provider: requested,
                retryable: false,
            });
        }
        for (const candidate of this.options.preferredProviders ?? []) {
            if (!this.registry.has(candidate))
                continue;
            const provider = this.registry.get(candidate);
            if (provider.supports(context))
                return provider;
        }
        if (this.options.defaultProvider && this.registry.has(this.options.defaultProvider)) {
            const provider = this.registry.get(this.options.defaultProvider);
            if (provider.supports(context))
                return provider;
        }
        const supported = this.registry.list().find((provider) => provider.supports(context));
        if (supported)
            return supported;
        throw new DistributionError({
            code: "PROVIDER_NOT_FOUND",
            message: `No distribution provider available for ${context.provider}`,
            provider: context.provider,
            retryable: false,
        });
    }
}
export function createProviderSubmissionMetadata(provider, submission) {
    return {
        provider: provider.name,
        providerReferenceId: submission.providerReferenceId ?? null,
        status: submission.status,
        ...(submission.metadata ?? {}),
    };
}
