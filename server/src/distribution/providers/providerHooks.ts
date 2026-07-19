import type { ProviderContext } from "./providerContext";
import type { ProviderHealth } from "./providerHealth";
import type { ProviderManifest } from "./providerManifest";
import type { ProviderResult } from "./providerResult";
import type { ProviderError } from "./providerError";

export type ProviderHookPayload = Readonly<{
  context: ProviderContext;
  manifest?: ProviderManifest | null;
  result?: ProviderResult | null;
  error?: ProviderError | null;
  payload?: unknown;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ProviderHooks = Readonly<Partial<{
  beforeAuthenticate: (input: ProviderHookPayload) => void | Promise<void>;
  afterAuthenticate: (input: ProviderHookPayload) => void | Promise<void>;
  beforeRefreshCredentials: (input: ProviderHookPayload) => void | Promise<void>;
  afterRefreshCredentials: (input: ProviderHookPayload) => void | Promise<void>;
  beforeValidateRelease: (input: ProviderHookPayload) => void | Promise<void>;
  afterValidateRelease: (input: ProviderHookPayload) => void | Promise<void>;
  beforeValidateAssets: (input: ProviderHookPayload) => void | Promise<void>;
  afterValidateAssets: (input: ProviderHookPayload) => void | Promise<void>;
  beforePreparePackage: (input: ProviderHookPayload) => void | Promise<void>;
  afterPreparePackage: (input: ProviderHookPayload) => void | Promise<void>;
  beforeSubmitRelease: (input: ProviderHookPayload) => void | Promise<void>;
  afterSubmitRelease: (input: ProviderHookPayload) => void | Promise<void>;
  beforeUpdateRelease: (input: ProviderHookPayload) => void | Promise<void>;
  afterUpdateRelease: (input: ProviderHookPayload) => void | Promise<void>;
  beforeTakedownRelease: (input: ProviderHookPayload) => void | Promise<void>;
  afterTakedownRelease: (input: ProviderHookPayload) => void | Promise<void>;
  beforeCheckStatus: (input: ProviderHookPayload) => void | Promise<void>;
  afterCheckStatus: (input: ProviderHookPayload & { health?: ProviderHealth | null }) => void | Promise<void>;
  beforeSyncRelease: (input: ProviderHookPayload) => void | Promise<void>;
  afterSyncRelease: (input: ProviderHookPayload) => void | Promise<void>;
  beforeReceiveWebhook: (input: ProviderHookPayload) => void | Promise<void>;
  afterReceiveWebhook: (input: ProviderHookPayload) => void | Promise<void>;
  beforeHealthCheck: (input: ProviderHookPayload) => void | Promise<void>;
  afterHealthCheck: (input: ProviderHookPayload & { health?: ProviderHealth | null }) => void | Promise<void>;
  beforeDisconnect: (input: ProviderHookPayload) => void | Promise<void>;
  afterDisconnect: (input: ProviderHookPayload) => void | Promise<void>;
  onError: (input: ProviderHookPayload) => void | Promise<void>;
}>>;

