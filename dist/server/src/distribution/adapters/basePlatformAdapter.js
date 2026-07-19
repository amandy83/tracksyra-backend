export class BasePlatformAdapter {
    logger;
    constructor(options = {}) {
        this.logger = options.logger ?? console;
    }
    async authenticate() {
        this.logger.info("[distribution][adapter] authenticated", { platform: this.name });
    }
    async uploadTrack(input) {
        return this.withAdapterErrors("uploadTrack", async () => {
            throw new Error(`${this.name} adapter must implement a real provider uploadTrack call.`);
        });
    }
    async updateMetadata(input) {
        await this.withAdapterErrors("updateMetadata", async () => {
            this.logger.info("[distribution][adapter] metadata updated", {
                platform: this.name,
                platformTrackId: input.platformTrackId,
                trackId: input.track.id,
            });
        });
    }
    normalizeError(error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            errorCode: `${this.name.toUpperCase()}_ADAPTER_ERROR`,
            message,
            platform: this.name,
            provider: "too_lost",
            retryable: true,
        };
    }
    formatSuccess(platformTrackId, rawResponse) {
        return {
            platformTrackId,
            status: "PUBLISHED",
            rawResponse,
        };
    }
    async withAdapterErrors(operation, fn) {
        try {
            return await fn();
        }
        catch (error) {
            const normalized = this.normalizeError(error);
            this.logger.error("[distribution][adapter] operation failed", {
                operation,
                ...normalized,
            });
            throw normalized;
        }
    }
}
