import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderRateLimit } from "./providerRateLimit";
import type { ProviderStatus } from "./providerStatus";

export type ProviderOperation =
  | "authenticate"
  | "refreshCredentials"
  | "validateRelease"
  | "validateAssets"
  | "preparePackage"
  | "submitRelease"
  | "updateRelease"
  | "takedownRelease"
  | "checkStatus"
  | "syncRelease"
  | "receiveWebhook"
  | "healthCheck"
  | "disconnect";

export type ProviderCapabilities = Readonly<{
  operations: readonly ProviderOperation[];
  supportedStatuses: readonly ProviderStatus[];
  supportsWebhookDelivery: boolean;
  supportsPolling: boolean;
  supportsTakedown: boolean;
  supportsMetadataUpdate: boolean;
  supportsAssetValidation: boolean;
  supportsRetryAfterHeader: boolean;
  supportedAssetKinds: readonly string[];
  supportedPackageKinds: readonly string[];
  supportedFormats: readonly string[];
  featureFlags: ProviderFeatureFlags;
  rateLimit?: ProviderRateLimit | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

