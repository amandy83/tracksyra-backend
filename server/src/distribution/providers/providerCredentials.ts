import type { ProviderAuthentication } from "./providerAuthentication";

export type ProviderCredentialSecret = Readonly<Record<string, string | number | boolean | null>>;

export type ProviderCredentials = Readonly<{
  credentialId: string;
  provider: string;
  version: string;
  accountId: string | null;
  secret: ProviderCredentialSecret;
  authentication: ProviderAuthentication | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

