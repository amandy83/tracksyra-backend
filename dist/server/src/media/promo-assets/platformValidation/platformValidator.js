import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { logger } from "../../../observability/logger.js";
import { extractVideoMetadata } from "../processing/videoMetadata.js";
import { validateAppleMotionArtwork } from "./appleMotionValidator.js";
import { validateInstagramReels } from "./instagramValidator.js";
import { validateSpotifyCanvas } from "./spotifyCanvasValidator.js";
import { validateTiktokPreview } from "./tiktokValidator.js";
import { validateYoutubeShorts } from "./youtubeShortsValidator.js";
const BUCKET = "promo-assets";
const validators = [
    validateSpotifyCanvas,
    validateAppleMotionArtwork,
    validateYoutubeShorts,
    validateTiktokPreview,
    validateInstagramReels,
];
const log = logger.child({ component: "promo-asset-platform-validator" });
export class PromoAssetPlatformValidationEngine {
    supabase;
    storage;
    ffmpeg;
    constructor(supabase, storage, ffmpeg) {
        this.supabase = supabase;
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }
    async validateAsset(assetId) {
        await this.ffmpeg.requireAvailable();
        const asset = await this.loadAsset(assetId);
        const sourceKey = asset.optimized_url || asset.file_url;
        const tempDir = await mkdtemp(join(tmpdir(), "tracksyra-promo-platform-validation-"));
        const inputPath = join(tempDir, sanitize(basename(sourceKey)) || `${asset.id}.mp4`);
        try {
            const bytes = await this.storage.getObject(BUCKET, sourceKey);
            await writeFile(inputPath, bytes);
            const metadata = await extractVideoMetadata(inputPath, this.ffmpeg);
            const results = validators.map((validator) => validator(metadata));
            await this.persist(asset.id, results);
            log.info("promo asset platform validation completed", { assetId: asset.id, sourceKey });
            return results;
        }
        finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    }
    async loadAsset(assetId) {
        const { data, error } = await this.supabase
            .from("promo_assets")
            .select("id,file_url,optimized_url")
            .eq("id", assetId)
            .single();
        if (error)
            throw error;
        if (!data)
            throw new Error(`Promo asset ${assetId} not found.`);
        return data;
    }
    async persist(assetId, results) {
        const rows = results.map((result) => ({
            promo_asset_id: assetId,
            platform: result.platform,
            status: result.status,
            score: result.score,
            validation_details: result.validationDetails,
            created_at: new Date().toISOString(),
        }));
        const { error } = await this.supabase
            .from("promo_asset_platform_validation")
            .upsert(rows, { onConflict: "promo_asset_id,platform" });
        if (error)
            throw error;
    }
}
export function buildPlatformResult(platform, metadata, failures) {
    const score = clamp(100 - failures.reduce((sum, failure) => sum + failure.penalty, 0));
    const reasons = failures.filter((failure) => failure.severity === "fail").map((failure) => failure.message);
    const warnings = failures.filter((failure) => failure.severity === "warning").map((failure) => failure.message);
    const status = reasons.length > 0 ? "fail" : warnings.length > 0 || score < 100 ? "warning" : "pass";
    return {
        platform,
        status,
        score,
        validationDetails: {
            summary: status === "pass" ? "Fully compatible." : [...reasons, ...warnings].join(" "),
            reasons,
            warnings,
            metadata,
        },
    };
}
export function isMp4Container(metadata) {
    const container = String(metadata.container || "").toLowerCase();
    return container.split(",").some((part) => part === "mp4" || part === "mov" || part === "m4v" || part === "3gp" || part === "3g2" || part === "mj2")
        && container.includes("mp4");
}
export function isH264(metadata) {
    return String(metadata.codec || "").toLowerCase() === "h264";
}
export function isVertical(metadata) {
    return Number(metadata.height || 0) > Number(metadata.width || 0);
}
export function isSquare(metadata) {
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    return width > 0 && height > 0 && Math.abs(width - height) <= 2;
}
export function matchesAspect(metadata, expectedWidth, expectedHeight) {
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (width <= 0 || height <= 0)
        return false;
    return Math.abs(width / height - expectedWidth / expectedHeight) <= 0.04;
}
function clamp(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
function sanitize(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 160);
}
