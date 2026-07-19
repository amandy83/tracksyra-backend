import { timingSafeEqual } from "node:crypto";
export class InMemoryTooLostTokenStorage {
    tokenSnapshot = null;
    pendingAuth = null;
    getTokenSnapshot() {
        return this.tokenSnapshot;
    }
    setTokenSnapshot(snapshot) {
        this.tokenSnapshot = snapshot;
    }
    getPendingAuth() {
        return this.pendingAuth;
    }
    setPendingAuth(record) {
        this.pendingAuth = record;
    }
}
export class TooLostTokenManager {
    storage;
    pendingAuthTtlMs;
    refreshSkewMs;
    refreshInFlight = null;
    constructor(options) {
        this.storage = options.storage;
        this.pendingAuthTtlMs = options.pendingAuthTtlMs;
        this.refreshSkewMs = options.refreshSkewMs;
    }
    async createPendingAuth(input) {
        const createdAt = new Date().toISOString();
        const record = {
            state: input.state,
            codeVerifier: input.codeVerifier,
            redirectUri: input.redirectUri,
            scopes: [...input.scopes],
            createdAt,
            expiresAt: new Date(Date.now() + this.pendingAuthTtlMs).toISOString(),
        };
        await this.storage.setPendingAuth(record);
        return record;
    }
    async consumePendingAuth(state) {
        const pending = await this.storage.getPendingAuth();
        if (!pending) {
            throw new Error("Too Lost OAuth state is missing or expired.");
        }
        if (pending.expiresAt && Date.parse(pending.expiresAt) < Date.now()) {
            await this.storage.setPendingAuth(null);
            throw new Error("Too Lost OAuth state has expired.");
        }
        if (!state || !constantTimeEquals(pending.state, state)) {
            throw new Error("Too Lost OAuth state validation failed.");
        }
        await this.storage.setPendingAuth(null);
        return pending;
    }
    async saveTokens(token) {
        const snapshot = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken ?? null,
            expiresAt: token.expiresAt ?? null,
            tokenType: token.tokenType,
            scope: token.scope ?? null,
            updatedAt: new Date().toISOString(),
        };
        await this.storage.setTokenSnapshot(snapshot);
        return snapshot;
    }
    async getTokens() {
        return this.storage.getTokenSnapshot();
    }
    async clearTokens() {
        await this.storage.setTokenSnapshot(null);
    }
    async getAccessToken(refreshFn) {
        const snapshot = await this.storage.getTokenSnapshot();
        if (!snapshot) {
            throw new Error("Too Lost tokens are not available.");
        }
        if (!this.needsRefresh(snapshot)) {
            return snapshot.accessToken;
        }
        const refreshed = await this.refreshToken(refreshFn);
        return refreshed.accessToken;
    }
    async refreshToken(refreshFn) {
        const current = await this.storage.getTokenSnapshot();
        if (!current?.refreshToken) {
            throw new Error("Too Lost refresh token is not available.");
        }
        if (!this.refreshInFlight) {
            this.refreshInFlight = (async () => {
                const nextToken = await refreshFn(current.refreshToken);
                return this.saveTokens({
                    accessToken: nextToken.accessToken,
                    refreshToken: nextToken.refreshToken ?? current.refreshToken,
                    expiresAt: nextToken.expiresAt ?? null,
                    tokenType: nextToken.tokenType,
                    scope: nextToken.scope ?? current.scope,
                });
            })().finally(() => {
                this.refreshInFlight = null;
            });
        }
        return this.refreshInFlight;
    }
    needsRefresh(snapshot) {
        if (!snapshot.expiresAt)
            return false;
        const expiresAt = Date.parse(snapshot.expiresAt);
        if (!Number.isFinite(expiresAt))
            return false;
        return expiresAt <= Date.now() + this.refreshSkewMs;
    }
}
function constantTimeEquals(left, right) {
    if (left.length !== right.length)
        return false;
    return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
