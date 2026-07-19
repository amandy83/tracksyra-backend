export type ProviderAuthentication = Readonly<{
  authenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  scope: readonly string[];
  expiresAt: Date | null;
  providerAccountId: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

