import type { ProviderCapabilities } from "./providerCapabilities";
import type { ProviderConfiguration } from "./providerConfiguration";
import type { ProviderCredentials } from "./providerCredentials";
import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderHealth } from "./providerHealth";
import type { ProviderLifecycle } from "./providerLifecycle";
import type { ProviderManifest } from "./providerManifest";
import type { ProviderResult } from "./providerResult";
import type { ProviderStatus } from "./providerStatus";
import type { ProviderAuthentication } from "./providerAuthentication";
import type { ProviderContext } from "./providerContext";
import type { ProviderHooks } from "./providerHooks";
import type { ProviderLogger } from "./providerLogger";
import type { ProviderMetrics } from "./providerMetrics";
import type { ProviderRetryStrategy } from "./providerRetryStrategy";

export type ProviderOperationInput = Readonly<{
  context: ProviderContext;
  manifest?: ProviderManifest | null;
  payload?: unknown;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ProviderWebhookInput = ProviderOperationInput &
  Readonly<{
    headers: Readonly<Record<string, string | readonly string[] | undefined>>;
    rawBody?: string | Uint8Array | Buffer | null;
    signature?: string | null;
    eventName?: string | null;
  }>;

export interface DistributionProvider {
  readonly name: string;
  readonly version: string;
  readonly status: ProviderStatus;
  readonly lifecycle: ProviderLifecycle;
  readonly configuration: ProviderConfiguration;
  readonly credentials: ProviderCredentials | null;
  readonly capabilities: ProviderCapabilities;
  readonly featureFlags: ProviderFeatureFlags;
  readonly manifest: ProviderManifest | null;
  readonly logger: ProviderLogger;
  readonly metrics: ProviderMetrics;
  readonly hooks: ProviderHooks;
  readonly retryStrategy: ProviderRetryStrategy;

  authenticate(input: ProviderOperationInput): Promise<ProviderAuthentication>;
  refreshCredentials(input: ProviderOperationInput): Promise<ProviderCredentials>;
  validateRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  validateAssets(input: ProviderOperationInput): Promise<ProviderResult>;
  preparePackage(input: ProviderOperationInput): Promise<ProviderManifest>;
  submitRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  updateRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  takedownRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  checkStatus(input: ProviderOperationInput): Promise<ProviderHealth>;
  syncRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  receiveWebhook(input: ProviderWebhookInput): Promise<ProviderResult>;
  healthCheck(input: ProviderOperationInput): Promise<ProviderHealth>;
  disconnect(input: ProviderOperationInput): Promise<void>;
}

