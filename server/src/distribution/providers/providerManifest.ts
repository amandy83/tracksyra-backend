import type { DistributionStatus } from "../core/distributionStatus";
import type { ProviderCapabilities } from "./providerCapabilities";
import type { ProviderConfiguration } from "./providerConfiguration";
import type { ProviderCredentials } from "./providerCredentials";
import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderLifecycle } from "./providerLifecycle";
import type { ProviderStatus } from "./providerStatus";

export type ProviderManifest = Readonly<{
  id: string;
  provider: string;
  version: string;
  releaseId: string;
  trackId: string | null;
  priority: number;
  status: ProviderStatus;
  distributionStatus: DistributionStatus;
  capabilities: ProviderCapabilities;
  configuration: ProviderConfiguration;
  credentials: ProviderCredentials | null;
  lifecycle: ProviderLifecycle;
  featureFlags: ProviderFeatureFlags;
  assets: readonly {
    name: string;
    kind: string;
    path: string | null;
    url: string | null;
    contentType: string | null;
    sizeBytes: number | null;
    checksum: string | null;
  }[];
  metadata: Readonly<Record<string, unknown>>;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
}>;

