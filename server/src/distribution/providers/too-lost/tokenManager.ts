import { timingSafeEqual } from "node:crypto";

import type { TooLostOAuthToken } from "./tooLostTypes";

export type TooLostTokenSnapshot = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  tokenType: TooLostOAuthToken["tokenType"];
  scope: string | null;
  updatedAt: string;
};

export type TooLostPendingAuthRecord = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  scopes: readonly string[];
  createdAt: string;
  expiresAt: string;
};

export interface TooLostTokenStorage {
  getTokenSnapshot(): Promise<TooLostTokenSnapshot | null> | TooLostTokenSnapshot | null;
  setTokenSnapshot(snapshot: TooLostTokenSnapshot | null): Promise<void> | void;
  getPendingAuth(): Promise<TooLostPendingAuthRecord | null> | TooLostPendingAuthRecord | null;
  setPendingAuth(record: TooLostPendingAuthRecord | null): Promise<void> | void;
}

export class InMemoryTooLostTokenStorage implements TooLostTokenStorage {
  private tokenSnapshot: TooLostTokenSnapshot | null = null;
  private pendingAuth: TooLostPendingAuthRecord | null = null;

  getTokenSnapshot(): TooLostTokenSnapshot | null {
    return this.tokenSnapshot;
  }

  setTokenSnapshot(snapshot: TooLostTokenSnapshot | null): void {
    this.tokenSnapshot = snapshot;
  }

  getPendingAuth(): TooLostPendingAuthRecord | null {
    return this.pendingAuth;
  }

  setPendingAuth(record: TooLostPendingAuthRecord | null): void {
    this.pendingAuth = record;
  }
}

export type TooLostTokenManagerOptions = {
  storage?: TooLostTokenStorage;
  pendingAuthTtlMs?: number;
  refreshSkewMs?: number;
};

export class TooLostTokenManager {
  private readonly storage: TooLostTokenStorage;
  private readonly pendingAuthTtlMs: number;
  private readonly refreshSkewMs: number;
  private refreshInFlight: Promise<TooLostTokenSnapshot> | null = null;

  constructor(options: Required<TooLostTokenManagerOptions>) {
    this.storage = options.storage;
    this.pendingAuthTtlMs = options.pendingAuthTtlMs;
    this.refreshSkewMs = options.refreshSkewMs;
  }

  async createPendingAuth(input: {
    state: string;
    codeVerifier: string;
    redirectUri: string;
    scopes: readonly string[];
  }): Promise<TooLostPendingAuthRecord> {
    const createdAt = new Date().toISOString();
    const record: TooLostPendingAuthRecord = {
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

  async consumePendingAuth(state: string): Promise<TooLostPendingAuthRecord> {
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

  async saveTokens(token: TooLostOAuthToken): Promise<TooLostTokenSnapshot> {
    const snapshot: TooLostTokenSnapshot = {
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

  async getTokens(): Promise<TooLostTokenSnapshot | null> {
    return this.storage.getTokenSnapshot();
  }

  async clearTokens(): Promise<void> {
    await this.storage.setTokenSnapshot(null);
  }

  async getAccessToken(refreshFn: (refreshToken: string) => Promise<TooLostOAuthToken>): Promise<string> {
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

  async refreshToken(refreshFn: (refreshToken: string) => Promise<TooLostOAuthToken>): Promise<TooLostTokenSnapshot> {
    const current = await this.storage.getTokenSnapshot();
    if (!current?.refreshToken) {
      throw new Error("Too Lost refresh token is not available.");
    }

    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        const nextToken = await refreshFn(current.refreshToken as string);
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

  private needsRefresh(snapshot: TooLostTokenSnapshot): boolean {
    if (!snapshot.expiresAt) return false;
    const expiresAt = Date.parse(snapshot.expiresAt);
    if (!Number.isFinite(expiresAt)) return false;
    return expiresAt <= Date.now() + this.refreshSkewMs;
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
