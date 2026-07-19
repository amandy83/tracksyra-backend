import { normalizeTooLostError } from "./tooLostError";
import { refreshTooLostOAuthToken, type TooLostConfig, type TooLostOAuthToken } from "./tooLostOAuth";
import { TooLostCredentialStore, type TooLostStoredCredentials } from "./tooLostCredentialStore";

type HttpClient = typeof fetch;

export type TooLostRequestOptions = RequestInit & {
  retryOn401?: boolean;
};

export class TooLostApiClient {
  constructor(
    private readonly config: TooLostConfig,
    private readonly credentials: TooLostCredentialStore,
    private readonly httpClient: HttpClient = fetch,
  ) {}

  async requestJson(path: string, init: TooLostRequestOptions = {}): Promise<unknown> {
    const response = await this.request(path, init);
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;

    if (response.status === 401 && init.retryOn401 !== false) {
      const refreshed = await this.refreshAccessTokenIfPossible();
      if (refreshed) {
        return this.requestJson(path, { ...init, retryOn401: false });
      }
    }

    if (response.status === 429) {
      throw normalizeTooLostError({ status: 429, message: "Too Lost API rate limit exceeded" });
    }

    if (!response.ok) {
      throw normalizeTooLostError({
        status: response.status,
        message: typeof body?.message === "string" ? body.message : response.statusText,
      });
    }

    return body;
  }

  async request(path: string, init: TooLostRequestOptions = {}): Promise<Response> {
    const accessToken = await this.ensureAccessToken();
    return this.httpClient(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  }

  async uploadBinary(url: string, body: RequestInit["body"], headers: RequestInit["headers"] = {}): Promise<Response> {
    return this.httpClient(url, {
      method: "PUT",
      body,
      headers,
    });
  }

  private async ensureAccessToken(): Promise<string> {
    const credentials = await this.credentials.loadTokenSet();
    if (!credentials?.accessToken) {
      throw normalizeTooLostError({ status: 401, message: "Too Lost account is not connected" });
    }

    if (credentials.tokenExpiresAt && new Date(credentials.tokenExpiresAt).getTime() <= Date.now()) {
      if (!credentials.refreshToken) {
        throw normalizeTooLostError({ status: 401, message: "Too Lost access token expired and no refresh token is available" });
      }
      const token = await this.refreshAccessToken(credentials.refreshToken);
      await this.persistToken(token, credentials);
      return token.accessToken;
    }

    return credentials.accessToken;
  }

  private async refreshAccessToken(refreshToken: string): Promise<TooLostOAuthToken> {
    try {
      const token = await refreshTooLostOAuthToken({ refreshToken, config: this.config, httpClient: this.httpClient });
      void this.credentials.refreshConnectionStatus("token_refresh");
      return token;
    } catch (error) {
      await this.credentials.updateProviderSyncStatus({
        syncStatus: "refresh_failed",
        lastSyncAt: null,
        isEnabled: true,
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw normalizeTooLostError(error);
    }
  }

  private async refreshAccessTokenIfPossible(): Promise<boolean> {
    const credentials = await this.credentials.loadTokenSet();
    if (!credentials?.refreshToken) return false;
    const token = await this.refreshAccessToken(credentials.refreshToken);
    await this.persistToken(token, credentials);
    return true;
  }

  private async persistToken(token: TooLostOAuthToken, current: TooLostStoredCredentials | null) {
    await this.credentials.storeTokenSet(token, {
      connectedAccountId: current?.connectedAccountId ?? null,
      connectedAccountName: current?.connectedAccountName ?? null,
      connectedAccountEmail: current?.connectedAccountEmail ?? null,
    });
    void this.credentials.refreshConnectionStatus("token_refresh");
  }
}

type TooLostJsonBody = Readonly<Record<string, unknown>> & {
  message?: string;
  raw?: string;
};

function safeJsonParse(value: string): TooLostJsonBody {
  try {
    return JSON.parse(value) as TooLostJsonBody;
  } catch {
    return { raw: value };
  }
}
