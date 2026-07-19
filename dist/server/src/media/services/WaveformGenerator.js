import { createHash } from "node:crypto";
import { join } from "node:path";
export class WaveformGenerator {
    storage;
    ffmpeg;
    outputBucket;
    constructor(storage, ffmpeg, outputBucket) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
        this.outputBucket = outputBucket;
    }
    async generate(input) {
        const pcmPath = join(input.workDir, "waveform.pcm");
        const points = input.points ?? 1200;
        await this.ffmpeg.runFfmpeg(["-i", input.sourcePath, "-ac", "1", "-ar", "8000", "-f", "s16le", pcmPath]);
        const pcm = await this.ffmpeg.read(pcmPath);
        const waveform = buildWaveform(pcm, points);
        const hash = createHash("sha256").update(JSON.stringify(waveform.map((p) => [round(p.min), round(p.max), round(p.rms)]))).digest("hex");
        const body = JSON.stringify({ version: 1, sampleRate: 8000, points: waveform });
        const object = await this.storage.putObject({
            bucket: this.outputBucket,
            key: `users/${input.userId}/audio/${input.assetId}/waveform/waveform.json`,
            body: Buffer.from(body),
            contentType: "application/json",
            cacheControl: "private, max-age=31536000, immutable",
        });
        return { hash, points: waveform, object };
    }
}
function buildWaveform(pcm, pointCount) {
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const bucketSize = Math.max(1, Math.floor(samples.length / pointCount));
    const points = [];
    for (let offset = 0; offset < samples.length; offset += bucketSize) {
        let min = 1;
        let max = -1;
        let sumSq = 0;
        let count = 0;
        for (let i = offset; i < Math.min(offset + bucketSize, samples.length); i += 1) {
            const value = samples[i] / 32768;
            min = Math.min(min, value);
            max = Math.max(max, value);
            sumSq += value * value;
            count += 1;
        }
        points.push({ t: offset / samples.length, min: round(min), max: round(max), rms: round(Math.sqrt(sumSq / Math.max(count, 1))) });
    }
    return points;
}
function round(value) {
    return Math.round(value * 10000) / 10000;
}
