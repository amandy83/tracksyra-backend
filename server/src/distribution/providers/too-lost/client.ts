import {
  createTooLostAuthorizationUrl,
  exchangeTooLostAuthorizationCode,
  refreshTooLostAccessToken,
  resolveTooLostOAuthEnvironment,
  TOO_LOST_AUTHORIZATION_URL,
  TOO_LOST_DEFAULT_SCOPES,
  TOO_LOST_TOKEN_URL,
} from "./oauth";
import {
  TooLostTokenManager,
  type TooLostTokenSnapshot,
} from "./tokenManager";

export type TooLostAuthClientOptions = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  scopes?: readonly string[];
  fetchImpl?: typeof fetch;
  tokenManager: TooLostTokenManager;
};

export type TooLostAuthenticatedRequestInput = string | URL | Request;

export class TooLostAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authorizeUrl: string;
  private readonly tokenUrl: string;
  private readonly scopes: readonly string[];
  private readonly fetchImpl: typeof fetch;
  private readonly tokenManager: TooLostTokenManager;

  constructor(options: TooLostAuthClientOptions) {
    const env = resolveTooLostOAuthEnvironment();
    this.clientId = options.clientId ?? env.clientId;
    this.clientSecret = options.clientSecret ?? env.clientSecret;
    this.redirectUri = options.redirectUri ?? env.redirectUri;
    this.authorizeUrl = options.authorizeUrl ?? env.oauthAuthorizeUrl ?? TOO_LOST_AUTHORIZATION_URL;
    this.tokenUrl = options.tokenUrl ?? env.oauthTokenUrl ?? TOO_LOST_TOKEN_URL;
    this.scopes = options.scopes ?? TOO_LOST_DEFAULT_SCOPES;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tokenManager = options.tokenManager;
  }

  async loginUrl(additionalParams: Record<string, string | number | boolean | null | undefined> = {}): Promise<string> {
    this.ensureCredentials();

    const { url, pkce } = createTooLostAuthorizationUrl({
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      authorizeUrl: this.authorizeUrl,
      scopes: this.scopes,
      additionalParams,
    });

    await this.tokenManager.createPendingAuth({
      state: pkce.state,
      codeVerifier: pkce.codeVerifier,
      redirectUri: this.redirectUri,
      scopes: this.scopes,
    });

    return url;
  }

  async handleCallback(code: string, state: string): Promise<TooLostTokenSnapshot> {
    this.ensureCredentials();

    const pending = await this.tokenManager.consumePendingAuth(state);
    if (pending.redirectUri !== this.redirectUri) {
      throw new Error("Too Lost OAuth redirect URI mismatch.");
    }

    const tokens = await exchangeTooLostAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
      tokenUrl: this.tokenUrl,
      fetchImpl: this.fetchImpl,
    });

    return this.tokenManager.saveTokens(tokens);
  }

  async refreshToken(): Promise<TooLostTokenSnapshot> {
    this.ensureCredentials();

    return this.tokenManager.refreshToken((refreshToken) =>
      refreshTooLostAccessToken({
        refreshToken,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        tokenUrl: this.tokenUrl,
        fetchImpl: this.fetchImpl,
      }),
    );
  }

  async getAccessToken(): Promise<string> {
    this.ensureCredentials();

    return this.tokenManager.getAccessToken((refreshToken) =>
      refreshTooLostAccessToken({
        refreshToken,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        tokenUrl: this.tokenUrl,
        fetchImpl: this.fetchImpl,
      }),
    );
  }

  async request(input: TooLostAuthenticatedRequestInput, init: RequestInit = {}): Promise<Response> {
    const accessToken = await this.getAccessToken();
    const request = this.createAuthorizedRequest(input, init, accessToken);
    const response = await this.fetchImpl(request);
    if (response.status !== 401) {
      return response;
    }

    const refreshedToken = await this.refreshToken();
    const retryRequest = this.createAuthorizedRequest(input, init, refreshedToken.accessToken);
    return this.fetchImpl(retryRequest);
  }

  async getTokenSnapshot(): Promise<TooLostTokenSnapshot | null> {
    return this.tokenManager.getTokens();
  }

  async clearTokens(): Promise<void> {
    await this.tokenManager.clearTokens();
  }

  private createAuthorizedRequest(
    input: TooLostAuthenticatedRequestInput,
    init: RequestInit,
    accessToken: string,
  ): Request {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", headers.get("Accept") ?? "application/json");
    return new Request(request, { ...init, headers });
  }

  private ensureCredentials(): void {
    if (!this.clientId) throw new Error("Too Lost client ID is required.");
    if (!this.clientSecret) throw new Error("Too Lost client secret is required.");
    if (!this.redirectUri) throw new Error("Too Lost redirect URI is required.");
  }
}
