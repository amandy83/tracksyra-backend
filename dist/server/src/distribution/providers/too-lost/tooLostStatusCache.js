export class TooLostStatusCache {
    record = null;
    refreshPromise = null;
    freshTtlMs = 10_000;
    staleTtlMs = 60_000;
    getSnapshot(now = Date.now()) {
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
    write(snapshot, source) {
        this.record = {
            snapshot,
            updatedAt: Date.now(),
            source,
            lastError: null,
        };
    }
    invalidate(reason) {
        if (!this.record)
            return;
        this.record.lastError = reason;
    }
    scheduleRefresh(loader, source = "background_refresh") {
        if (this.refreshPromise)
            return this.refreshPromise;
        this.refreshPromise = (async () => {
            try {
                const snapshot = await loader();
                if (snapshot) {
                    this.write(snapshot, source);
                }
            }
            catch (error) {
                this.invalidate(error instanceof Error ? error.message : String(error));
            }
            finally {
                this.refreshPromise = null;
            }
        })();
        return this.refreshPromise;
    }
    isStale(now = Date.now()) {
        if (!this.record)
            return true;
        return now - this.record.updatedAt > this.freshTtlMs;
    }
    hasSnapshot() {
        return Boolean(this.record);
    }
    snapshotSource() {
        return this.record?.source ?? null;
    }
    buildFallbackResponse(reason, now, cacheState, cachedConnectionStatus) {
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
