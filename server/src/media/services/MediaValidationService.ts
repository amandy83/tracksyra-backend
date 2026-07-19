import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { AudioCodec, AudioQualityMetadata, MediaValidationIssue, MediaValidationResult } from "../models";
import { logger, serializeError } from "../../observability/logger";
import { FfmpegRunner } from "./ffmpeg";

const ALLOWED_AUDIO_EXTENSIONS = new Set([".wav", ".flac"]);
const REJECTED_AUDIO_EXTENSIONS = new Set([".mp3", ".aac", ".m4a", ".ogg", ".wma", ".aiff", ".aif"]);
const ALLOWED_AUDIO_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/flac", "audio/x-flac"]);
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const MIN_AUDIO_BYTES = 1 * 1024 * 1024;
const MIN_DURATION_SEC = 30;
const MAX_DURATION_SEC = 60 * 60 * 3;
const MIN_SAMPLE_RATE_HZ = 44_100;
const MIN_BIT_DEPTH = 16;
const MAX_SILENCE_RATIO = 0.35;

export class MediaValidationService {
  private readonly log = logger.child({ component: "media-validation" });

  constructor(private readonly ffmpeg: FfmpegRunner) {}

  validateUploadEnvelope(input: { filename: string; mimeType: string; sizeBytes: number }): MediaValidationIssue[] {
    const issues: MediaValidationIssue[] = [];
    const ext = extname(input.filename).toLowerCase();
    this.log.info("audio upload envelope received", {
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      extension: ext || null,
    });
    if (REJECTED_AUDIO_EXTENSIONS.has(ext)) issues.push(error("rejected_format", "Audio masters must be WAV or FLAC. MP3, AAC, M4A, OGG, WMA, and AIFF are rejected."));
    else if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) issues.push(error("unsupported_extension", "Audio masters must be WAV or FLAC."));
    if (!ALLOWED_AUDIO_MIME_TYPES.has(input.mimeType.toLowerCase())) issues.push(error("unsupported_mime", "Audio MIME type is not allowed."));
    if (input.sizeBytes > MAX_AUDIO_BYTES) issues.push(error("oversized_file", "Audio file exceeds the 500 MB limit."));
    if (input.sizeBytes <= MIN_AUDIO_BYTES) issues.push(error("file_too_small", "Audio file must be larger than 1 MB."));
    if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
      issues.push(error("path_traversal", "Audio filename contains unsafe path characters."));
    }
    if (/\.(exe|dll|bat|cmd|sh|msi|scr|ps1)$/i.test(input.filename)) issues.push(error("executable_upload", "Executable uploads are blocked."));
    this.log.info("audio upload envelope validation result", {
      filename: input.filename,
      ok: issues.length === 0,
      issues,
    });
    return issues;
  }

  async validateAudioFile(path: string, envelope: { filename: string; mimeType: string; sizeBytes: number }): Promise<MediaValidationResult> {
    const issues = this.validateUploadEnvelope(envelope);
    if (issues.some((issue) => issue.severity === "error")) {
      this.log.warn("audio file rejected before probe", {
        path,
        filename: envelope.filename,
        mimeType: envelope.mimeType,
        sizeBytes: envelope.sizeBytes,
        issues,
      });
      return { ok: false, issues };
    }

    try {
      this.log.info("audio file probe started", {
        path,
        filename: envelope.filename,
        mimeType: envelope.mimeType,
        sizeBytes: envelope.sizeBytes,
      });
      const probe = await this.ffmpeg.probe(path);
      const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");
      if (!audioStream) {
        const noStreamIssues = [error("no_audio_stream", "File does not contain a decodable audio stream.")];
        this.log.warn("audio file probe result rejected", {
          path,
          filename: envelope.filename,
          issues: noStreamIssues,
        });
        return { ok: false, issues: noStreamIssues };
      }

      const loudness = await this.ffmpeg.analyzeLoudness(path).catch(() => ({ lufs: null, peakDb: null }));
      const durationSec = readNumber(audioStream.duration) ?? readNumber(probe.format?.duration) ?? 0;
      const bitrateKbps = Math.round((readNumber(audioStream.bit_rate) ?? readNumber(probe.format?.bit_rate) ?? 0) / 1000) || null;
      const sampleRateHz = Math.round(readNumber(audioStream.sample_rate) ?? 0);
      const channels = audioStream.channels ?? 0;
      const bitDepth = readBitDepth(audioStream);
      const codec = normalizeCodec(audioStream.codec_name || probe.format?.format_name);
      const peakDb = loudness.peakDb;
      const hasClipping = peakDb !== null && peakDb >= -0.1;
      const silenceRatio = await this.estimateSilenceRatio(path).catch(() => 0);

      if (durationSec < MIN_DURATION_SEC) issues.push(error("duration_too_short", `Audio duration must be at least ${MIN_DURATION_SEC} seconds.`));
      if (durationSec > MAX_DURATION_SEC) issues.push(error("duration_too_long", "Audio duration exceeds the 3 hour limit."));
      if (sampleRateHz < MIN_SAMPLE_RATE_HZ) issues.push(error("sample_rate_too_low", "Audio sample rate must be at least 44.1 kHz."));
      if (channels !== 2) issues.push(error("not_stereo", "Audio must be stereo."));
      if (bitDepth !== null && bitDepth < MIN_BIT_DEPTH) issues.push(error("bit_depth_too_low", "Audio bit depth must be at least 16-bit."));
      if (bitDepth === null && codec === "wav") issues.push(error("bit_depth_unknown", "WAV bit depth could not be verified."));
      if (hasClipping) issues.push(error("clipping_detected", "Audio contains clipping and must be fixed before distribution."));
      if (silenceRatio > MAX_SILENCE_RATIO) issues.push(error("excessive_silence", "Audio contains too much silence for distribution."));
      if (bitrateKbps !== null && codec === "mp3" && bitrateKbps < 120) issues.push(error("bitrate_too_low", "MP3 bitrate is too low for distribution."));

      const metadata: AudioQualityMetadata = {
        bitrateKbps,
        durationSec: round(durationSec),
        codec,
        sampleRateHz,
        channels,
        bitDepth,
        lufs: loudness.lufs,
        bpm: null,
        peakDb,
        hasClipping,
        silenceRatio: round(silenceRatio),
        corruptedFrames: 0,
      };

      const ok = !issues.some((issue) => issue.severity === "error");
      this.log.info("audio file probe result", {
        path,
        filename: envelope.filename,
        ok,
        metadata,
        issues,
      });
      return { ok, issues, metadata };
    } catch (err) {
      if (isMissingProbeBinary(err)) {
        this.log.warn("audio probe binary missing; falling back to container header validation", {
          path,
          filename: envelope.filename,
          mimeType: envelope.mimeType,
          sizeBytes: envelope.sizeBytes,
          error: serializeError(err),
        });
        return this.validateFromContainer(path, envelope);
      }
      const issue = error("corrupted_frames", err instanceof Error ? err.message : "Audio could not be decoded.");
      this.log.error("audio file validation failed", {
        path,
        filename: envelope.filename,
        error: serializeError(err),
        issue,
      });
      return { ok: false, issues: [issue] };
    }
  }

  private async validateFromContainer(path: string, envelope: { filename: string; mimeType: string; sizeBytes: number }): Promise<MediaValidationResult> {
    const bytes = await readFile(path);
    const ext = extname(envelope.filename).toLowerCase();
    const header = ext === ".flac" ? readFlacHeader(bytes) : readWavHeader(bytes);
    if (!header.ok) {
      this.log.warn("audio container fallback rejected", {
        path,
        filename: envelope.filename,
        mimeType: envelope.mimeType,
        sizeBytes: envelope.sizeBytes,
        errors: header.errors,
      });
      return { ok: false, issues: header.errors.map((message) => error("container_validation_failed", message)) };
    }

    const metadata: AudioQualityMetadata = {
      bitrateKbps: null,
      durationSec: round(header.meta.durationSec),
      codec: header.meta.codec,
      sampleRateHz: header.meta.sampleRateHz,
      channels: header.meta.channels,
      bitDepth: header.meta.bitDepth,
      lufs: null,
      bpm: null,
      peakDb: null,
      hasClipping: false,
      silenceRatio: 0,
      corruptedFrames: 0,
    };

    const issues: MediaValidationIssue[] = [];
    if (metadata.durationSec < MIN_DURATION_SEC) issues.push(error("duration_too_short", `Audio duration must be at least ${MIN_DURATION_SEC} seconds.`));
    if (metadata.durationSec > MAX_DURATION_SEC) issues.push(error("duration_too_long", "Audio duration exceeds the 3 hour limit."));
    if (metadata.sampleRateHz < MIN_SAMPLE_RATE_HZ) issues.push(error("sample_rate_too_low", "Audio sample rate must be at least 44.1 kHz."));
    if (metadata.channels !== 2) issues.push(error("not_stereo", "Audio must be stereo."));
    if ((metadata.bitDepth ?? 0) < MIN_BIT_DEPTH) issues.push(error("bit_depth_too_low", "Audio bit depth must be at least 16-bit."));

    const ok = !issues.some((issue) => issue.severity === "error");
    this.log.info("audio container fallback result", {
      path,
      filename: envelope.filename,
      ok,
      metadata,
      issues,
    });
    return { ok, issues, metadata };
  }

  private async estimateSilenceRatio(path: string): Promise<number> {
    const result = await this.ffmpeg.runFfmpeg(["-i", path, "-af", "silencedetect=n=-50dB:d=1", "-f", "null", "-"], 5 * 60 * 1000);
    const starts = [...result.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...result.stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => Number(m[2]));
    if (!starts.length && !ends.length) return 0;
    const totalSilence = ends.reduce((sum, value) => sum + value, 0);
    const probe = await this.ffmpeg.probe(path);
    const duration = readNumber(probe.format?.duration) ?? 0;
    return duration > 0 ? totalSilence / duration : 0;
  }
}

function normalizeCodec(value?: string): AudioCodec {
  const codec = (value || "").toLowerCase();
  if (codec.includes("mp3")) return "mp3";
  if (codec.includes("flac")) return "flac";
  if (codec.includes("aiff") || codec.includes("aif")) return "aiff";
  if (codec.includes("aac")) return "aac";
  if (codec.includes("ogg") || codec.includes("vorbis") || codec.includes("opus")) return "ogg";
  if (codec.includes("wma")) return "wma";
  if (codec.includes("wav") || codec.includes("pcm")) return "wav";
  return "unknown";
}

function readBitDepth(stream: Record<string, unknown>): number | null {
  const direct = readNumber(stream.bits_per_sample) ?? readNumber(stream.bits_per_raw_sample);
  if (direct && direct > 0) return direct;
  const sampleFmt = String(stream.sample_fmt || "").toLowerCase();
  const match = sampleFmt.match(/(?:s|u|flt|dbl)(\d+)/);
  if (match) return Number(match[1]);
  return null;
}

function readWavHeader(bytes: Buffer):
  | { ok: true; meta: { codec: AudioCodec; durationSec: number; sampleRateHz: number; channels: number; bitDepth: number } }
  | { ok: false; errors: string[] } {
  if (bytes.length < 44) return { ok: false, errors: ["WAV header is truncated or corrupted."] };
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WAVE") {
    return { ok: false, errors: ["File header is not valid WAV."] };
  }

  let offset = 12;
  let fmtOffset = -1;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = bytes.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") fmtOffset = offset;
    if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (fmtOffset < 0) return { ok: false, errors: ["WAV fmt chunk is missing."] };
  if (dataOffset < 0 || dataSize <= 0) return { ok: false, errors: ["WAV data chunk is missing."] };

  const audioFormat = bytes.readUInt16LE(fmtOffset + 8);
  const channels = bytes.readUInt16LE(fmtOffset + 10);
  const sampleRateHz = bytes.readUInt32LE(fmtOffset + 12);
  const bitDepth = bytes.readUInt16LE(fmtOffset + 22);
  const bytesPerSample = channels * (bitDepth / 8);
  const durationSec = sampleRateHz > 0 && bytesPerSample > 0 ? dataSize / (sampleRateHz * bytesPerSample) : 0;

  return {
    ok: true,
    meta: {
      codec: audioFormat === 1 ? "wav" : "unknown",
      durationSec,
      sampleRateHz,
      channels,
      bitDepth,
    },
  };
}

function readFlacHeader(bytes: Buffer):
  | { ok: true; meta: { codec: AudioCodec; durationSec: number; sampleRateHz: number; channels: number; bitDepth: number } }
  | { ok: false; errors: string[] } {
  if (bytes.length < 42 || bytes.subarray(0, 4).toString("ascii") !== "fLaC") {
    return { ok: false, errors: ["File header is not valid FLAC."] };
  }
  const blockType = bytes[4] & 0x7f;
  const blockLength = (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  if (blockType !== 0 || blockLength < 34 || bytes.length < 8 + blockLength) {
    return { ok: false, errors: ["FLAC STREAMINFO header is missing or corrupted."] };
  }

  const streamInfo = bytes.subarray(8, 8 + blockLength);
  const sampleRateHz = (streamInfo[10] << 12) | (streamInfo[11] << 4) | (streamInfo[12] >> 4);
  const channels = ((streamInfo[12] & 0x0e) >> 1) + 1;
  const bitDepth = (((streamInfo[12] & 0x01) << 4) | (streamInfo[13] >> 4)) + 1;
  const totalSamples = ((streamInfo[13] & 0x0f) * 0x100000000)
    + (streamInfo[14] * 0x1000000)
    + (streamInfo[15] * 0x10000)
    + (streamInfo[16] * 0x100)
    + streamInfo[17];
  const durationSec = sampleRateHz > 0 ? totalSamples / sampleRateHz : 0;

  return {
    ok: true,
    meta: {
      codec: "flac",
      durationSec,
      sampleRateHz,
      channels,
      bitDepth,
    },
  };
}

function isMissingProbeBinary(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /ENOENT|ffprobe/i.test(error.message);
}

function error(code: string, message: string): MediaValidationIssue {
  return { code, severity: "error", message };
}

function readNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
