import type { DistributionContext } from "../core/distributionContext";
import type { ProviderAuthentication } from "./providerAuthentication";
import type { ProviderCapabilities } from "./providerCapabilities";
import type { ProviderConfiguration } from "./providerConfiguration";
import type { ProviderCredentials } from "./providerCredentials";
import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderHooks } from "./providerHooks";
import type { ProviderLifecycle } from "./providerLifecycle";
import type { ProviderLogger } from "./providerLogger";
import type { ProviderMetrics } from "./providerMetrics";
import type { ProviderManifest } from "./providerManifest";

export type ProviderContext = Readonly<{
  provider: string;
  version: string;
  configuration: ProviderConfiguration;
  credentials: ProviderCredentials | null;
  authentication: ProviderAuthentication | null;
  capabilities: ProviderCapabilities;
  featureFlags: ProviderFeatureFlags;
  lifecycle: ProviderLifecycle;
  logger: ProviderLogger;
  metrics: ProviderMetrics;
  hooks: ProviderHooks;
  distributionContext: DistributionContext | null;
  manifest: ProviderManifest | null;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: Date;
}>;

