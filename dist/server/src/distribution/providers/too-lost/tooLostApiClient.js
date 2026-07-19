import { normalizeTooLostError } from "./tooLostError.js";
import { refreshTooLostOAuthToken } from "./tooLostOAuth.js";
export class TooLostApiClient {
    config;
    credentials;
    httpClient;
    constructor(config, credentials, httpClient = fetch) {
        this.config = config;
        this.credentials = credentials;
        this.httpClient = httpClient;
    }
    async requestJson(path, init = {}) {
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
    async request(path, init = {}) {
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
    async uploadBinary(url, body, headers = {}) {
        return this.httpClient(url, {
            method: "PUT",
            body,
            headers,
        });
    }
    async ensureAccessToken() {
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
    async refreshAccessToken(refreshToken) {
        try {
            const token = await refreshTooLostOAuthToken({ refreshToken, config: this.config, httpClient: this.httpClient });
            void this.credentials.refreshConnectionStatus("token_refresh");
            return token;
        }
        catch (error) {
            await this.credentials.updateProviderSyncStatus({
                syncStatus: "refresh_failed",
                lastSyncAt: null,
                isEnabled: true,
                lastError: error instanceof Error ? error.message : String(error),
            });
            throw normalizeTooLostError(error);
        }
    }
    async refreshAccessTokenIfPossible() {
        const credentials = await this.credentials.loadTokenSet();
        if (!credentials?.refreshToken)
            return false;
        const token = await this.refreshAccessToken(credentials.refreshToken);
        await this.persistToken(token, credentials);
        return true;
    }
    async persistToken(token, current) {
        await this.credentials.storeTokenSet(token, {
            connectedAccountId: current?.connectedAccountId ?? null,
            connectedAccountName: current?.connectedAccountName ?? null,
            connectedAccountEmail: current?.connectedAccountEmail ?? null,
        });
        void this.credentials.refreshConnectionStatus("token_refresh");
    }
}
function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return { raw: value };
    }
}
