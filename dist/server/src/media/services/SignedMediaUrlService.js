export class SignedMediaUrlService {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async createPlaybackUrl(input) {
        const expiresInSeconds = clamp(input.expiresInSeconds ?? defaultExpiry(input.variantType), 60, 86_400);
        const url = await this.storage.createSignedUrl({
            bucket: input.bucket,
            key: input.key,
            expiresInSeconds,
            disposition: "inline",
            contentType: input.contentType,
        });
        return {
            url,
            expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
            headers: this.storage.getCdnHeaders(input.variantType),
        };
    }
}
function defaultExpiry(variant) {
    if (variant === "preview_clip" || variant === "aac_preview")
        return 3600;
    if (variant === "waveform_json")
        return 600;
    return 900;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
