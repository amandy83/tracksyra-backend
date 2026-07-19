import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../observability/logger";
import type { MediaStorageAdapter } from "../../storage/mediaStorage";
import { FfmpegService } from "./ffmpegService";
import { generatePromoThumbnail } from "./thumbnailGenerator";
import { extractVideoMetadata, type PromoVideoMetadata } from "./videoMetadata";
import { PromoAssetPlatformValidationEngine } from "../platformValidation/platformValidator";

type PromoAssetRow = {
  id: string;
  user_id: string;
  file_url: string;
  file_size: number;
  mime_type: string;
};

export type PromoAssetProcessingResult = {
  metadata: PromoVideoMetadata;
  thumbnailUrl: string;
  optimizedUrl: string;
};

const BUCKET = "promo-assets";
const log = logger.child({ component: "promo-asset-processor" });

export class PromoAssetVideoProcessor {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly storage: MediaStorageAdapter,
    private readonly ffmpeg: FfmpegService,
    private readonly platformValidation: PromoAssetPlatformValidationEngine,
  ) {}

  async startupCheck() {
    return this.ffmpeg.checkAvailability();
  }

  async process(assetId: string, onProgress: (progress: number) => Promise<void> = async () => undefined): Promise<PromoAssetProcessingResult> {
    await this.ffmpeg.requireAvailable();

    const asset = await this.loadAsset(assetId);
    const tempDir = await mkdtemp(join(tmpdir(), "tracksyra-promo-processing-"));
    const safeBase = sanitize(basename(asset.file_url)) || `${asset.id}.mp4`;
    const inputPath = join(tempDir, safeBase);
    const thumbnailPath = join(tempDir, `${asset.id}-thumbnail.jpg`);
    const optimizedPath = join(tempDir, `${asset.id}-optimized.mp4`);

    try {
      const bytes = await this.storage.getObject(BUCKET, asset.file_url);
      await writeFile(inputPath, bytes);
      await onProgress(25);

      const metadata = await extractVideoMetadata(inputPath, this.ffmpeg);
      await generatePromoThumbnail(inputPath, thumbnailPath, this.ffmpeg);
      await onProgress(50);

      await this.transcodeOptimizedMp4(inputPath, optimizedPath);
      await onProgress(75);

      const thumbnailUrl = `${asset.user_id}/thumbnails/${asset.id}.jpg`;
      const optimizedUrl = `${asset.user_id}/optimized/${asset.id}.mp4`;
      const [thumbnailBytes, optimizedBytes] = await Promise.all([
        readFile(thumbnailPath),
        readFile(optimizedPath),
      ]);

      await Promise.all([
        this.storage.putObject({
          bucket: BUCKET,
          key: thumbnailUrl,
          body: thumbnailBytes,
          contentType: "image/jpeg",
        }),
        this.storage.putObject({
          bucket: BUCKET,
          key: optimizedUrl,
          body: optimizedBytes,
          contentType: "video/mp4",
        }),
      ]);

      await this.updateAsset(asset.id, metadata, thumbnailUrl, optimizedUrl);
      await onProgress(90);
      await this.platformValidation.validateAsset(asset.id);
      await onProgress(100);
      log.info("promo asset processed", { assetId: asset.id, thumbnailUrl, optimizedUrl });
      return { metadata, thumbnailUrl, optimizedUrl };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async loadAsset(assetId: string): Promise<PromoAssetRow> {
    const { data, error } = await this.supabase
      .from("promo_assets")
      .select("id,user_id,file_url,file_size,mime_type")
      .eq("id", assetId)
      .single<PromoAssetRow>();
    if (error) throw error;
    if (!data) throw new Error(`Promo asset ${assetId} not found.`);
    return data;
  }

  private async transcodeOptimizedMp4(inputPath: string, outputPath: string) {
    await this.ffmpeg.runFfmpeg([
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  }

  private async updateAsset(assetId: string, metadata: PromoVideoMetadata, thumbnailUrl: string, optimizedUrl: string) {
    const { error } = await this.supabase
      .from("promo_assets")
      .update({
        thumbnail_url: thumbnailUrl,
        optimized_url: optimizedUrl,
        duration_seconds: metadata.durationSeconds,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        bitrate: metadata.bitrate,
        codec: metadata.codec,
        audio_codec: metadata.audioCodec,
        file_size: metadata.fileSize,
        validation_status: "passed",
        approval_status: "under_review",
        validation_details: {
          summary: "Promo asset FFmpeg processing completed.",
          metadata,
        },
      })
      .eq("id", assetId);
    if (error) throw error;
  }
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 160);
}
