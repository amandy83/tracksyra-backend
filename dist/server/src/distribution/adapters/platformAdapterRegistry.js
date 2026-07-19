import { DISTRIBUTION_PLATFORMS } from "../models/distributionTypes.js";
export class UnsupportedPlatformError extends Error {
    platform;
    errorCode = "UNSUPPORTED_PLATFORM";
    retryable = false;
    constructor(platform) {
        super(`Unsupported distribution platform: ${platform}`);
        this.platform = platform;
    }
}
export class PlatformAdapterRegistry {
    adapters = new Map();
    supportedPlatforms;
    fallbackPlatform;
    constructor(supportedPlatforms = DISTRIBUTION_PLATFORMS, fallbackPlatform = "too_lost") {
        this.supportedPlatforms = new Set(supportedPlatforms);
        this.fallbackPlatform = fallbackPlatform;
    }
    register(adapter) {
        if (!this.supportedPlatforms.has(adapter.name)) {
            throw new UnsupportedPlatformError(adapter.name);
        }
        this.adapters.set(adapter.name, adapter);
    }
    get(platform) {
        const adapter = this.adapters.get(platform) ?? (this.fallbackPlatform ? this.adapters.get(this.fallbackPlatform) : undefined);
        if (!adapter)
            throw new UnsupportedPlatformError(platform);
        return adapter;
    }
    has(platform) {
        return this.adapters.has(platform);
    }
    validateSupported(platform) {
        return this.supportedPlatforms.has(platform) || Boolean(this.fallbackPlatform && this.adapters.has(this.fallbackPlatform));
    }
    listSupported() {
        return Array.from(this.supportedPlatforms);
    }
}
