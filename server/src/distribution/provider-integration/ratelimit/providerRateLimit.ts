export interface ProviderRateLimitManager {
  evaluate(providerName: string): Promise<unknown> | unknown;
}
