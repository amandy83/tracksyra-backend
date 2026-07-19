import { join } from "node:path";
export class ArtworkOptimizationService {
    storage;
    ffmpeg;
    outputBucket;
    constructor(storage, ffmpeg, outputBucket) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
        this.outputBucket = outputBucket;
    }
    async validate(path) {
        const issues = [];
        const probe = await this.ffmpeg.probe(path).catch(() => null);
        const stream = probe?.streams?.find((candidate) => typeof candidate === "object" && candidate !== null && "codec_type" in candidate && candidate.codec_type === "video");
        const width = Number(stream?.width ?? 0) || null;
        const height = Number(stream?.height ?? 0) || null;
        if (!width || !height)
            issues.push("Artwork is corrupted or unreadable.");
        if (width !== height)
            issues.push("Artwork must be square.");
        if ((width ?? 0) < 3000 || (height ?? 0) < 3000)
            issues.push("Artwork must be at least 3000x3000.");
        return { ok: issues.length === 0, width, height, issues };
    }
    async optimize(input) {
        const validation = await this.validate(input.sourcePath);
        if (!validation.ok)
            throw new Error(validation.issues.join("; "));
        const thumbnail = join(input.workDir, "thumb.webp");
        const webp = join(input.workDir, "cover.webp");
        const retina = join(input.workDir, "cover-2x.webp");
        await this.ffmpeg.runFfmpeg(["-i", input.sourcePath, "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2", "-c:v", "libwebp", "-quality", "84", thumbnail]);
        await this.ffmpeg.runFfmpeg(["-i", input.sourcePath, "-vf", "scale=1600:1600", "-c:v", "libwebp", "-quality", "88", webp]);
        await this.ffmpeg.runFfmpeg(["-i", input.sourcePath, "-vf", "scale=3000:3000", "-c:v", "libwebp", "-quality", "92", retina]);
        const baseKey = `users/${input.userId}/artwork/${input.assetId}`;
        return {
            thumbnail: await this.upload(`${baseKey}/thumb.webp`, thumbnail),
            webp: await this.upload(`${baseKey}/cover.webp`, webp),
            retina: await this.upload(`${baseKey}/cover-2x.webp`, retina),
            validation,
        };
    }
    moderationHook(_input) {
        return Promise.resolve({ nsfw: false, provider: "placeholder", score: 0 });
    }
    async upload(key, path) {
        return this.storage.putObject({
            bucket: this.outputBucket,
            key,
            body: await this.ffmpeg.read(path),
            contentType: "image/webp",
            cacheControl: "private, max-age=31536000, immutable",
        });
    }
}
