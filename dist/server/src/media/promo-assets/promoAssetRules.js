export const PROMO_ASSET_RULES = {
    spotify_canvas: {
        label: "Spotify Canvas",
        minDurationSeconds: 3,
        maxDurationSeconds: 8,
        aspectRatio: "9:16",
        maxBytes: 100 * 1024 * 1024,
    },
    apple_motion_artwork: {
        label: "Apple Motion Artwork",
        minDurationSeconds: 3,
        maxDurationSeconds: 30,
        aspectRatio: "1:1",
        maxBytes: 100 * 1024 * 1024,
    },
    youtube_shorts: {
        label: "YouTube Shorts Promo",
        minDurationSeconds: 1,
        maxDurationSeconds: 60,
        aspectRatio: "9:16",
        maxBytes: 100 * 1024 * 1024,
    },
    tiktok_preview: {
        label: "TikTok Preview Video",
        minDurationSeconds: 1,
        maxDurationSeconds: 60,
        aspectRatio: "9:16",
        maxBytes: 100 * 1024 * 1024,
    },
    instagram_reel: {
        label: "Instagram Reels Promo",
        minDurationSeconds: 1,
        maxDurationSeconds: 90,
        aspectRatio: "9:16",
        maxBytes: 100 * 1024 * 1024,
    },
};
export function isPromoAssetType(value) {
    return value in PROMO_ASSET_RULES;
}
