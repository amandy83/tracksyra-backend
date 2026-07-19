import type { ProviderLifecycleStage } from "./providerStatus";

export type ProviderLifecycle = Readonly<{
  provider: string;
  version: string;
  stage: ProviderLifecycleStage;
  createdAt: Date;
  lastTransitionAt: Date;
  history: readonly {
    stage: ProviderLifecycleStage;
    transitionedAt: Date;
    reason?: string | null;
  }[];
  metadata: Readonly<Record<string, unknown>>;
}>;

