import type { TooLostConnectionStatus } from "./tooLostTypes";

export type TooLostStatusCacheState = "warming" | "fresh" | "stale" | "cached" | "degraded";

export type TooLostStatusResponse = TooLostConnectionStatus & {
  success: true;
  provider: "too_lost";
  cacheAgeMs: number | null;
  cacheState: TooLostStatusCacheState;
  cachedConnectionStatus?: TooLostConnectionStatus["connectionStatus"] | null;
};

export type StatusSource = "bootstrap" | "oauth_callback" | "token_refresh" | "webhook" | "reconnect" | "disconnect" | "sync_now" | "background_refresh" | "status_lookup";

type CacheRecord = {
  snapshot: TooLostConnectionStatus;
  updatedAt: number;
  source: StatusSource;
  lastError: string | null;
};

export class TooLostStatusCache {
  private record: CacheRecord | null = null;
  private refreshPromise: Promise<void> | null = null;
  private readonly freshTtlMs = 10_000;
  private readonly staleTtlMs = 60_000;

  getSnapshot(now = Date.now()): TooLostStatusResponse {
    if (!this.record) {
      return this.buildFallbackResponse(null, now, "warming", null);
    }

    const age = now - this.record.updatedAt;
    const cacheState = this.record.lastError
      ? "degraded"
      : age <= this.freshTtlMs
        ? "fresh"
        : age <= this.staleTtlMs
          ? "stale"
          : "cached";

    if (cacheState === "fresh") {
      const { provider, ...snapshot } = this.record.snapshot;
      void provider;
      return {
        success: true,
        provider: "too_lost",
        ...snapshot,
        cacheAgeMs: age,
        cacheState,
      };
    }

    const { provider, ...snapshot } = this.record.snapshot;
    void provider;
    return {
      success: true,
      provider: "too_lost",
      ...snapshot,
      connectionStatus: "cached",
      distributionStatus: this.record.snapshot.distributionStatus || "connected",
      cacheAgeMs: age,
      cacheState,
      cachedConnectionStatus: this.record.snapshot.connectionStatus,
    };
  }

  write(snapshot: TooLostConnectionStatus, source: StatusSource) {
    this.record = {
      snapshot,
      updatedAt: Date.now(),
      source,
      lastError: null,
    };
  }

  invalidate(reason: string) {
    if (!this.record) return;
    this.record.lastError = reason;
  }

  scheduleRefresh(loader: () => Promise<TooLostConnectionStatus | null>, source: StatusSource = "background_refresh"): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const snapshot = await loader();
        if (snapshot) {
          this.write(snapshot, source);
        }
      } catch (error) {
        this.invalidate(error instanceof Error ? error.message : String(error));
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  isStale(now = Date.now()) {
    if (!this.record) return true;
    return now - this.record.updatedAt > this.freshTtlMs;
  }

  hasSnapshot() {
    return Boolean(this.record);
  }

  snapshotSource() {
    return this.record?.source ?? null;
  }

  private buildFallbackResponse(reason: string | null, now: number, cacheState: TooLostStatusCacheState, cachedConnectionStatus: TooLostConnectionStatus["connectionStatus"] | null): TooLostStatusResponse {
    void reason;
    return {
      success: true,
      provider: "too_lost",
      connected: false,
      connectionStatus: "cached",
      accountStatus: "pending_approval",
      distributionStatus: "connected",
      connectedAccount: {
        id: null,
        name: null,
        email: null,
      },
      lastSyncAt: null,
      lastRefreshAt: null,
      tokenExpiresAt: null,
      oauthStateExpiresAt: null,
      readyForLiveRequests: false,
      canRefresh: false,
      lastError: null,
      cacheAgeMs: 0,
      cacheState,
      cachedConnectionStatus,
    };
  }
}

const tooLostStatusCache = new TooLostStatusCache();

export function getTooLostStatusCache() {
  return tooLostStatusCache;
}
