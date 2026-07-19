import { ProviderError } from "./providerError.js";
export class DefaultProviderFactory {
    create(input) {
        if (input.entry.provider)
            return input.entry.provider;
        if (input.entry.factory)
            return input.entry.factory.create(input);
        throw new ProviderError({
            code: "NOT_FOUND",
            message: `No provider instance or factory registered for ${input.entry.name}@${input.entry.version}`,
            provider: input.entry.name,
            version: input.entry.version,
            retryable: false,
        });
    }
}
