import { join } from "node:path";
export class PreviewClipGenerator {
    storage;
    ffmpeg;
    outputBucket;
    constructor(storage, ffmpeg, outputBucket) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
        this.outputBucket = outputBucket;
    }
    async generate(input) {
        const outputPath = join(input.workDir, "preview-clip.m4a");
        await this.ffmpeg.runFfmpeg([
            "-ss",
            String(input.startSec ?? 30),
            "-t",
            String(input.durationSec ?? 30),
            "-i",
            input.sourcePath,
            "-af",
            "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputPath,
        ]);
        return this.storage.putObject({
            bucket: this.outputBucket,
            key: `users/${input.userId}/audio/${input.assetId}/preview/clip.m4a`,
            body: await this.ffmpeg.read(outputPath),
            contentType: "audio/mp4",
            cacheControl: "private, max-age=31536000, immutable",
        });
    }
}
