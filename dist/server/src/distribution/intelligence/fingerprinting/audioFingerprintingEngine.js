import { createHash, randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QueueDispatcher } from "../../../queue/queueDispatcher.js";
import { incrementMetric, recordRetry, setMetric, setWorkerHealth } from "../../../queue/metrics.js";
import { queueNames } from "../../../queue/queueNames.js";
import { logger as defaultLogger, serializeError } from "../../../observability/logger.js";
import { Contributor, DistributionVersion, Release, ReleaseId, ReleaseVersion, Track, TerritorySet } from "../../domain/index.js";
function nowIso(now) {
    return now ? now() : new Date().toISOString();
}
function freeze(value) {
    if (Array.isArray(value))
        return Object.freeze([...value]);
    if (value && typeof value === "object")
        return Object.freeze({ ...value });
    return value;
}
function normalizeText(value) {
    if (typeof value !== "string")
        return null;
    const text = value.trim().replace(/\s+/g, " ");
    return text.length ? text : null;
}
function toRecord(value) {
    return value && typeof value === "object" ? freeze(value) : freeze({});
}
function hashText(value) {
    return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
function shortHash(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}
function createId(prefix, parts) {
    return `${prefix}:${shortHash(parts.join("|")).slice(0, 32)}`;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function average(values) {
    if (!values.length)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function percentile(values, fraction) {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = clamp(Math.round((sorted.length - 1) * fraction), 0, sorted.length - 1);
    return sorted[index] ?? 0;
}
function cosineSimilarity(left, right) {
    const length = Math.min(left.length, right.length);
    if (!length)
        return 0;
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < length; index += 1) {
        const l = left[index] ?? 0;
        const r = right[index] ?? 0;
        dot += l * r;
        leftMagnitude += l * l;
        rightMagnitude += r * r;
    }
    const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
    return denominator > 0 ? clamp(dot / denominator, 0, 1) : 0;
}
function normalizedDistance(left, right, scale = 1) {
    const distance = Math.abs(left - right) / Math.max(scale, Math.abs(left), Math.abs(right), 1);
    return clamp(1 - distance, 0, 1);
}
function compareValues(left, right) {
    return cosineSimilarity(left, right);
}
function parseArray(value) {
    return Array.isArray(value) ? value : [];
}
function analyzeBuffer(buffer, sampleRateHz) {
    const samples = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
    const normalized = Array.from(samples, (sample) => sample / 32768);
    const durationSeconds = samples.length / Math.max(1, sampleRateHz);
    const waveformSignature = bucketize(normalized, 128);
    const frames = frameEnergy(normalized, 1024, 512);
    const silenceRatio = frames.length ? frames.filter((value) => value < 0.03).length / frames.length : 0;
    const dynamicRange = percentile(frames, 0.95) - percentile(frames, 0.05);
    const bpm = estimateTempo(frames, sampleRateHz, 512);
    const spectralSignature = goertzelBands(normalized, sampleRateHz, 24);
    const mfccSignature = dctSignature(spectralSignature, 12);
    const rhythmSignature = rhythmIntervals(frames, bpm);
    const frequencySignature = [
        estimateZeroCrossingRate(normalized),
        spectralCentroid(spectralSignature),
        spectralSpread(spectralSignature),
        spectralRolloff(spectralSignature),
    ];
    const metrics = freeze({
        durationSeconds: round(durationSeconds),
        sampleRateHz,
        channels: 1,
        zeroCrossingRate: round(frequencySignature[0] ?? 0),
        silenceRatio: round(silenceRatio),
        dynamicRange: round(dynamicRange),
        bpm: round(bpm),
        confidence: confidenceFromFrames(frames, durationSeconds, silenceRatio),
    });
    const features = freeze({
        waveformSignature: freeze(waveformSignature),
        spectralSignature: freeze(spectralSignature),
        mfccSignature: freeze(mfccSignature),
        tempoSignature: freeze([round(bpm), round(tempoStrength(frames, bpm)), round(tempoVariance(frames, bpm))]),
        rhythmSignature: freeze(rhythmSignature),
        frequencySignature: freeze(frequencySignature.map((value) => round(value))),
    });
    const waveformHash = shortHash(JSON.stringify(features.waveformSignature));
    const spectralHash = shortHash(JSON.stringify(features.spectralSignature));
    const tempoHash = shortHash(JSON.stringify(features.tempoSignature));
    const rhythmHash = shortHash(JSON.stringify(features.rhythmSignature));
    const frequencyHash = shortHash(JSON.stringify(features.frequencySignature));
    const acousticFingerprintHash = hashText({ waveformHash, spectralHash, tempoHash, rhythmHash, frequencyHash, metrics });
    const chromaprintCompatibleHash = `chromaprint-like:${shortHash(JSON.stringify({ spectral: features.spectralSignature, mfcc: features.mfccSignature })).slice(0, 32)}`;
    const overallHash = shortHash(JSON.stringify({ acousticFingerprintHash, chromaprintCompatibleHash, metrics }));
    return freeze({
        metrics,
        features,
        waveformHash,
        spectralHash,
        tempoHash,
        rhythmHash,
        frequencyHash,
        acousticFingerprintHash,
        chromaprintCompatibleHash,
        overallHash,
    });
}
function bucketize(values, buckets) {
    if (!values.length)
        return Array.from({ length: buckets }, () => 0);
    const bucketSize = Math.max(1, Math.floor(values.length / buckets));
    const result = [];
    for (let offset = 0; offset < values.length; offset += bucketSize) {
        const slice = values.slice(offset, offset + bucketSize);
        result.push(average(slice.map((value) => Math.abs(value))));
    }
    while (result.length < buckets)
        result.push(0);
    return result.slice(0, buckets).map((value) => round(value));
}
function frameEnergy(values, frameSize, hopSize) {
    const result = [];
    for (let offset = 0; offset < values.length; offset += hopSize) {
        const frame = values.slice(offset, offset + frameSize);
        if (!frame.length)
            break;
        const energy = Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length);
        result.push(energy);
    }
    return result;
}
function estimateTempo(frames, sampleRateHz, hopSize) {
    if (frames.length < 3)
        return 0;
    const frameRate = sampleRateHz / Math.max(1, hopSize);
    let bestBpm = 0;
    let bestScore = 0;
    for (let bpm = 40; bpm <= 220; bpm += 1) {
        const lag = Math.max(1, Math.round((frameRate * 60) / bpm));
        let score = 0;
        for (let index = lag; index < frames.length; index += 1) {
            score += frames[index] * frames[index - lag];
        }
        if (score > bestScore) {
            bestScore = score;
            bestBpm = bpm;
        }
    }
    return bestBpm;
}
function tempoStrength(frames, bpm) {
    if (!frames.length || bpm <= 0)
        return 0;
    const lag = Math.max(1, Math.round((frames.length / 4) / (bpm / 120)));
    let score = 0;
    for (let index = lag; index < frames.length; index += 1) {
        score += frames[index] * frames[index - lag];
    }
    return score / Math.max(1, frames.length - lag);
}
function tempoVariance(frames, bpm) {
    if (!frames.length || bpm <= 0)
        return 0;
    const peaks = peakIntervals(frames);
    if (peaks.length < 2)
        return 0;
    const mean = average(peaks);
    const variance = average(peaks.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance) / Math.max(1, bpm);
}
function peakIntervals(frames) {
    const peaks = [];
    for (let index = 1; index < frames.length - 1; index += 1) {
        if (frames[index] > frames[index - 1] && frames[index] >= frames[index + 1] && frames[index] > 0.05) {
            peaks.push(index);
        }
    }
    return peaks.slice(1).map((value, index) => value - peaks[index]);
}
function rhythmIntervals(frames, bpm) {
    const intervals = peakIntervals(frames);
    if (!intervals.length) {
        return Array.from({ length: 12 }, () => 0);
    }
    const normalized = intervals.map((value) => value / Math.max(1, bpm));
    return bucketize(normalized, 12);
}
function estimateZeroCrossingRate(values) {
    if (values.length < 2)
        return 0;
    let count = 0;
    for (let index = 1; index < values.length; index += 1) {
        if ((values[index - 1] ?? 0) <= 0 && (values[index] ?? 0) > 0)
            count += 1;
        else if ((values[index - 1] ?? 0) >= 0 && (values[index] ?? 0) < 0)
            count += 1;
    }
    return count / values.length;
}
function spectralCentroid(bands) {
    if (!bands.length)
        return 0;
    const total = bands.reduce((sum, value) => sum + value, 0);
    if (total <= 0)
        return 0;
    return bands.reduce((sum, value, index) => sum + value * index, 0) / total / Math.max(1, bands.length - 1);
}
function spectralSpread(bands) {
    if (!bands.length)
        return 0;
    const centroid = spectralCentroid(bands) * Math.max(1, bands.length - 1);
    const total = bands.reduce((sum, value) => sum + value, 0);
    if (total <= 0)
        return 0;
    const variance = bands.reduce((sum, value, index) => sum + value * (index - centroid) ** 2, 0) / total;
    return Math.sqrt(variance) / Math.max(1, bands.length - 1);
}
function spectralRolloff(bands) {
    if (!bands.length)
        return 0;
    const total = bands.reduce((sum, value) => sum + value, 0);
    let cumulative = 0;
    for (let index = 0; index < bands.length; index += 1) {
        cumulative += bands[index] ?? 0;
        if (cumulative >= total * 0.85) {
            return index / Math.max(1, bands.length - 1);
        }
    }
    return 1;
}
function goertzelBands(values, sampleRateHz, bandCount) {
    const window = values.slice(0, Math.min(values.length, 4096));
    if (!window.length)
        return Array.from({ length: bandCount }, () => 0);
    const startFreq = 40;
    const endFreq = Math.min(8000, sampleRateHz / 2);
    const bands = [];
    for (let index = 0; index < bandCount; index += 1) {
        const fraction = index / Math.max(1, bandCount - 1);
        const freq = startFreq * ((endFreq / startFreq) ** fraction);
        bands.push(round(goertzelMagnitude(window, sampleRateHz, freq)));
    }
    const max = Math.max(...bands, 0) || 1;
    return bands.map((band) => round(band / max));
}
function goertzelMagnitude(values, sampleRateHz, targetFreq) {
    const n = values.length;
    if (!n || targetFreq <= 0)
        return 0;
    const k = Math.round((n * targetFreq) / sampleRateHz);
    const omega = (2 * Math.PI * k) / n;
    const sine = Math.sin(omega);
    const cosine = Math.cos(omega);
    const coeff = 2 * cosine;
    let q0 = 0;
    let q1 = 0;
    let q2 = 0;
    for (const sample of values) {
        q0 = coeff * q1 - q2 + sample;
        q2 = q1;
        q1 = q0;
    }
    return Math.sqrt(q1 * q1 + q2 * q2 - q1 * q2 * coeff) / Math.max(1, n);
}
function dctSignature(values, coefficientCount) {
    const source = values.map((value) => Math.log1p(Math.max(0, value)));
    const n = source.length;
    const result = [];
    for (let k = 0; k < coefficientCount; k += 1) {
        let sum = 0;
        for (let i = 0; i < n; i += 1) {
            sum += (source[i] ?? 0) * Math.cos((Math.PI / n) * (i + 0.5) * k);
        }
        result.push(round(sum / Math.max(1, n)));
    }
    return result;
}
function confidenceFromFrames(frames, durationSeconds, silenceRatio) {
    const energy = average(frames);
    const durationFactor = clamp(durationSeconds / 60, 0.35, 1);
    const silencePenalty = clamp(1 - silenceRatio * 0.5, 0.25, 1);
    return round(clamp(energy * durationFactor * silencePenalty * 2, 0.05, 1));
}
function compareFingerprintRecords(left, right) {
    const waveformSimilarity = compareValues(left.features.waveformSignature, right.features.waveformSignature);
    const spectralSimilarity = compareValues(left.features.spectralSignature, right.features.spectralSignature);
    const tempoSimilarity = compareValues(left.features.tempoSignature, right.features.tempoSignature);
    const rhythmSimilarity = compareValues(left.features.rhythmSignature, right.features.rhythmSignature);
    const frequencySimilarity = compareValues(left.features.frequencySignature, right.features.frequencySignature);
    const pitchSimilarity = normalizedDistance(left.metrics.bpm, right.metrics.bpm, 80);
    const silenceSimilarity = normalizedDistance(left.metrics.silenceRatio, right.metrics.silenceRatio, 1);
    const dynamicRangeSimilarity = normalizedDistance(left.metrics.dynamicRange, right.metrics.dynamicRange, 1);
    const similarityScore = round(waveformSimilarity * 0.22 +
        spectralSimilarity * 0.28 +
        tempoSimilarity * 0.12 +
        rhythmSimilarity * 0.08 +
        frequencySimilarity * 0.14 +
        pitchSimilarity * 0.08 +
        silenceSimilarity * 0.04 +
        dynamicRangeSimilarity * 0.04);
    const confidenceScore = round(clamp((left.metrics.confidence + right.metrics.confidence) / 2 * similarityScore, 0, 1));
    const duplicateType = classifyDuplicate(left, right, similarityScore, confidenceScore);
    const reasons = duplicateReasons(left, right, similarityScore, duplicateType);
    return freeze({
        similarityScore,
        confidenceScore,
        waveformSimilarity,
        spectralSimilarity,
        tempoSimilarity,
        pitchSimilarity,
        silenceSimilarity,
        dynamicRangeSimilarity,
        rhythmSimilarity,
        frequencySimilarity,
        duplicateType,
        reasons,
    });
}
function classifyDuplicate(left, right, similarityScore, confidenceScore) {
    if (left.acousticFingerprintHash === right.acousticFingerprintHash || left.overallHash === right.overallHash)
        return "exact_duplicate";
    const durationRatio = left.metrics.durationSeconds > right.metrics.durationSeconds
        ? right.metrics.durationSeconds / Math.max(1, left.metrics.durationSeconds)
        : left.metrics.durationSeconds / Math.max(1, right.metrics.durationSeconds);
    const artistLeft = normalizeText(left.metadata.primaryArtist ?? left.metadata.artist ?? null) ?? normalizeText(left.metadata.artistName ?? null) ?? "";
    const artistRight = normalizeText(right.metadata.primaryArtist ?? right.metadata.artist ?? null) ?? normalizeText(right.metadata.artistName ?? null) ?? "";
    const sameArtist = artistLeft && artistRight && artistLeft.toLowerCase() === artistRight.toLowerCase();
    const labelLeft = normalizeText(left.metadata.labelName ?? left.metadata.label ?? null) ?? "";
    const labelRight = normalizeText(right.metadata.labelName ?? right.metadata.label ?? null) ?? "";
    const sameLabel = labelLeft && labelRight && labelLeft.toLowerCase() === labelRight.toLowerCase();
    const titleLeft = normalizeText(left.metadata.trackTitle ?? left.metadata.title ?? null) ?? normalizeText(left.metadata.releaseTitle ?? null) ?? "";
    const titleRight = normalizeText(right.metadata.trackTitle ?? right.metadata.title ?? null) ?? normalizeText(right.metadata.releaseTitle ?? null) ?? "";
    const titleSimilar = titleLeft && titleRight && titleLeft.toLowerCase() === titleRight.toLowerCase();
    if (similarityScore >= 0.985 && confidenceScore >= 0.9)
        return "near_duplicate";
    if (sameArtist && sameLabel && similarityScore >= 0.96 && durationRatio >= 0.85 && durationRatio <= 1.15 && (left.metrics.dynamicRange > right.metrics.dynamicRange + 0.08 || right.metrics.dynamicRange > left.metrics.dynamicRange + 0.08))
        return "remaster";
    if (similarityScore >= 0.9 && durationRatio >= 0.55 && durationRatio <= 0.85)
        return "radio_edit";
    if (similarityScore >= 0.9 && durationRatio > 1.15)
        return "extended_mix";
    if (similarityScore >= 0.88 && (left.metrics.zeroCrossingRate > right.metrics.zeroCrossingRate * 1.2 || right.metrics.zeroCrossingRate > left.metrics.zeroCrossingRate * 1.2))
        return "pitch_shifted";
    if (similarityScore >= 0.88 && Math.abs(left.metrics.bpm - right.metrics.bpm) / Math.max(1, left.metrics.bpm, right.metrics.bpm) > 0.15)
        return "time_stretched";
    if (similarityScore >= 0.88 && Math.max(left.metrics.silenceRatio, right.metrics.silenceRatio) > 0.45)
        return "noise_altered";
    if (similarityScore >= 0.9 && durationRatio < 0.75)
        return "partial_upload";
    if (similarityScore >= 0.9 && sameArtist && titleSimilar && durationRatio >= 0.95 && durationRatio <= 1.05)
        return "album_duplicate";
    if (similarityScore >= 0.9 && !sameArtist && titleSimilar)
        return "cover_version";
    if (similarityScore >= 0.9 && typeof right.metadata.remixer === "string" && right.metadata.remixer)
        return "remix";
    if (similarityScore >= 0.9 && !sameArtist && (left.metadata.lyrics || right.metadata.lyrics) && (!left.metadata.lyrics || !right.metadata.lyrics))
        return "instrumental";
    if (similarityScore >= 0.9 && titleLeft.toLowerCase().includes("live"))
        return "live_version";
    if (similarityScore >= 0.9 && /acapella/i.test(titleLeft) && /acapella/i.test(titleRight))
        return "acapella";
    if (similarityScore >= 0.95 && sameLabel && !sameArtist)
        return "cross_label_duplicate";
    if (similarityScore >= 0.95 && !sameArtist && !sameLabel)
        return "cross_artist_duplicate";
    if (similarityScore >= 0.95)
        return "cross_release_duplicate";
    if (confidenceScore >= 0.85 && similarityScore >= 0.92)
        return "lossy_reencode";
    if (confidenceScore >= 0.8 && similarityScore >= 0.9)
        return "near_duplicate";
    return "none";
}
function duplicateReasons(left, right, similarityScore, duplicateType) {
    const reasons = [
        `similarity=${similarityScore.toFixed(3)}`,
        `leftDuration=${left.metrics.durationSeconds.toFixed(2)}`,
        `rightDuration=${right.metrics.durationSeconds.toFixed(2)}`,
        `tempoDelta=${Math.abs(left.metrics.bpm - right.metrics.bpm).toFixed(2)}`,
        `dynamicRangeDelta=${Math.abs(left.metrics.dynamicRange - right.metrics.dynamicRange).toFixed(3)}`,
    ];
    if (duplicateType !== "none") {
        reasons.push(`duplicateType=${duplicateType}`);
    }
    return reasons;
}
function buildFingerprintRecord(fingerprintId, source, analysis, extraMetadata) {
    const releaseId = source.release?.id ?? String(extraMetadata.releaseId ?? "");
    const trackId = source.track?.id ?? (typeof extraMetadata.trackId === "string" ? extraMetadata.trackId : null);
    const metadata = freeze({
        ...toRecord(source.release?.metadata),
        ...toRecord(source.track?.metadata),
        ...toRecord(extraMetadata),
        releaseId,
        trackId,
        assetId: source.assetId,
        sourceUrl: source.sourceUrl,
        title: source.track?.title ?? source.release?.title ?? extraMetadata.title ?? null,
        primaryArtist: source.track?.primaryArtist ?? source.release?.primaryArtist ?? extraMetadata.primaryArtist ?? null,
        labelName: source.release?.labelName ?? extraMetadata.labelName ?? source.release?.metadata?.labelName ?? null,
        isrc: source.track?.isrc ?? extraMetadata.isrc ?? null,
        upc: source.release?.upc ?? extraMetadata.upc ?? null,
    });
    return freeze({
        fingerprintId,
        assetId: source.assetId,
        releaseId,
        trackId,
        generatedAt: nowIso(),
        acousticFingerprintHash: analysis.acousticFingerprintHash,
        chromaprintCompatibleHash: analysis.chromaprintCompatibleHash,
        waveformHash: analysis.waveformHash,
        spectralHash: analysis.spectralHash,
        tempoHash: analysis.tempoHash,
        rhythmHash: analysis.rhythmHash,
        frequencyHash: analysis.frequencyHash,
        overallHash: analysis.overallHash,
        metrics: analysis.metrics,
        features: analysis.features,
        metadata,
    });
}
function parseNumericArray(value, fallbackLength) {
    if (!Array.isArray(value)) {
        return Object.freeze(Array.from({ length: fallbackLength }, () => 0));
    }
    return Object.freeze(value.map((entry) => (typeof entry === "number" && Number.isFinite(entry) ? round(entry) : 0)));
}
function duplicateMatchKindFromComparison(comparison) {
    return comparison.duplicateType ?? "none";
}
function makeDuplicateMatch(input) {
    return freeze({
        matchId: createId("duplicate-match", [input.fingerprint.fingerprintId, input.compared.fingerprintId]),
        fingerprintId: input.fingerprint.fingerprintId,
        releaseId: input.fingerprint.releaseId,
        trackId: input.fingerprint.trackId,
        matchedReleaseId: input.compared.releaseId,
        matchedTrackId: input.compared.trackId,
        matchedFingerprintId: input.compared.fingerprintId,
        duplicateType: duplicateMatchKindFromComparison(input.comparison),
        similarityScore: input.comparison.similarityScore,
        confidenceScore: input.comparison.confidenceScore,
        reasons: freeze([...input.comparison.reasons]),
        evidence: freeze({
            waveformSimilarity: input.comparison.waveformSimilarity,
            spectralSimilarity: input.comparison.spectralSimilarity,
            tempoSimilarity: input.comparison.tempoSimilarity,
            pitchSimilarity: input.comparison.pitchSimilarity,
            silenceSimilarity: input.comparison.silenceSimilarity,
            dynamicRangeSimilarity: input.comparison.dynamicRangeSimilarity,
            rhythmSimilarity: input.comparison.rhythmSimilarity,
            frequencySimilarity: input.comparison.frequencySimilarity,
        }),
        createdAt: nowIso(),
    });
}
function makeSimilarityScore(input) {
    return freeze({
        similarityId: createId("similarity-score", [input.fingerprint.fingerprintId, input.compared.fingerprintId]),
        fingerprintId: input.fingerprint.fingerprintId,
        releaseId: input.fingerprint.releaseId,
        trackId: input.fingerprint.trackId,
        comparedReleaseId: input.compared.releaseId,
        comparedTrackId: input.compared.trackId,
        waveformSimilarity: input.comparison.waveformSimilarity,
        spectralSimilarity: input.comparison.spectralSimilarity,
        tempoSimilarity: input.comparison.tempoSimilarity,
        pitchSimilarity: input.comparison.pitchSimilarity,
        silenceSimilarity: input.comparison.silenceSimilarity,
        dynamicRangeSimilarity: input.comparison.dynamicRangeSimilarity,
        rhythmSimilarity: input.comparison.rhythmSimilarity,
        frequencySimilarity: input.comparison.frequencySimilarity,
        overallSimilarity: input.comparison.similarityScore,
        confidenceScore: input.comparison.confidenceScore,
        createdAt: nowIso(),
    });
}
function buildFraudSignals(fingerprint, duplicates, comparison, rightsSummary) {
    const signals = [];
    const duplicateCount = duplicates.length;
    if (duplicateCount >= 2) {
        signals.push({
            code: "MASS_DUPLICATION",
            severity: duplicateCount >= 5 ? "critical" : "high",
            scoreImpact: duplicateCount >= 5 ? 80 : 55,
            explanation: "Multiple strong duplicate matches were detected for the same recording.",
            metadata: { duplicateCount, fingerprintId: fingerprint.fingerprintId },
        });
    }
    if (comparison?.duplicateType === "exact_duplicate") {
        signals.push({
            code: "ARTIFICIAL_DUPLICATION",
            severity: "high",
            scoreImpact: 60,
            explanation: "Exact duplicate fingerprint collision attempt detected.",
            metadata: { fingerprintId: fingerprint.fingerprintId },
        });
    }
    if (rightsSummary && Number(rightsSummary.conflictCount ?? 0) > 0) {
        signals.push({
            code: "RIGHTS_CONFLICT",
            severity: "medium",
            scoreImpact: 35,
            explanation: "Rights history shows conflicts associated with this release.",
            metadata: rightsSummary,
        });
    }
    if (fingerprint.metrics.silenceRatio > 0.45) {
        signals.push({
            code: "SPAM_CATALOG",
            severity: "medium",
            scoreImpact: 35,
            explanation: "Audio contains excessive silence consistent with spam or placeholder submissions.",
            metadata: { silenceRatio: fingerprint.metrics.silenceRatio },
        });
    }
    if (fingerprint.metrics.confidence < 0.35) {
        signals.push({
            code: "LOW_SIGNAL_QUALITY",
            severity: "low",
            scoreImpact: 15,
            explanation: "Fingerprint signal quality is low and may indicate re-encoded or noisy audio.",
            metadata: { confidence: fingerprint.metrics.confidence },
        });
    }
    return signals;
}
function routeReviewActions(duplicates, fraudSignals, releaseId, trackId) {
    const actions = [];
    if (duplicates.some((entry) => entry.duplicateType !== "none" && entry.confidenceScore >= 0.85)) {
        actions.push("review");
        void QueueDispatcher.enqueueReview({
            releaseId,
            queueId: null,
            stage: "Fingerprint Review",
            reason: "Fingerprint duplicate signal",
            idempotencyKey: `fingerprint:review:${releaseId}:${trackId ?? "release"}`,
        });
    }
    if (duplicates.some((entry) => ["cross_release_duplicate", "cross_label_duplicate", "cross_artist_duplicate", "exact_duplicate", "near_duplicate"].includes(entry.duplicateType))) {
        actions.push("rights");
        void QueueDispatcher.enqueueRightsValidation({
            releaseId,
            trackId,
            reason: "Fingerprint rights validation",
            dsp: null,
            metadata: { duplicateTypes: duplicates.map((entry) => entry.duplicateType) },
            idempotencyKey: `fingerprint:rights:${releaseId}:${trackId ?? "release"}`,
        });
    }
    if (fraudSignals.some((signal) => signal.severity === "high" || signal.severity === "critical")) {
        actions.push("fraud");
        void QueueDispatcher.enqueueAudioFraud({
            type: "DETECT_AUDIO_FRAUD",
            releaseId,
            trackId,
            reason: "Fingerprint fraud detection",
            metadata: { fraudSignals },
            idempotencyKey: `fingerprint:fraud:${releaseId}:${trackId ?? "release"}`,
        });
    }
    if (fraudSignals.length) {
        actions.push("metadata");
        void QueueDispatcher.enqueueValidation({
            releaseId,
            validationType: "metadata",
            reason: "Fingerprint metadata review",
            idempotencyKey: `fingerprint:metadata:${releaseId}:${trackId ?? "release"}`,
        });
    }
    if (fraudSignals.some((signal) => signal.code === "MASS_DUPLICATION" || signal.code === "ARTIFICIAL_DUPLICATION")) {
        actions.push("manual-review");
        void QueueDispatcher.enqueueReview({
            releaseId,
            queueId: null,
            stage: "Manual Review",
            reason: "Manual fingerprint review required",
            idempotencyKey: `fingerprint:manual-review:${releaseId}:${trackId ?? "release"}`,
        });
    }
    return actions;
}
function createCapabilityMatrix() {
    return freeze({
        supportedAudioFormats: freeze(["wav", "flac", "aiff", "mp3", "m4a", "aac", "ogg"]),
        artworkRules: freeze(["square", "minimum_1400", "minimum_3000_for_hi_res", "jpg_png_only"]),
        metadataLimits: freeze({ titleLength: 200, contributorCount: 50, territoryCount: 100, genreCount: 10 }),
        genreMappings: freeze({ hiphop: "Hip-Hop/Rap", rnb: "R&B/Soul", electronic: "Electronic", pop: "Pop", rock: "Rock" }),
        languageMappings: freeze({ en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese" }),
        parentalAdvisoryRules: freeze(["explicit", "clean", "none"]),
        territorySupport: freeze(["WORLD", "US", "CA", "GB", "EU", "IN", "JP", "AU", "NZ", "BR"]),
        deliveryProtocol: "Spotify Ingestion Profile",
        identifierRequirements: freeze(["ISRC", "UPC", "ISWC", "Label", "Artist", "Territories"]),
        lyricsSupport: true,
        canvasSupport: true,
        dolbySupport: true,
        spatialAudioSupport: true,
        videoSupport: true,
    });
}
function createEmptyRecord(input) {
    const zero = freeze({
        waveformSignature: freeze(Array.from({ length: 128 }, () => 0)),
        spectralSignature: freeze(Array.from({ length: 24 }, () => 0)),
        mfccSignature: freeze(Array.from({ length: 12 }, () => 0)),
        tempoSignature: freeze([0, 0, 0]),
        rhythmSignature: freeze(Array.from({ length: 12 }, () => 0)),
        frequencySignature: freeze([0, 0, 0, 0]),
    });
    const metrics = freeze({
        durationSeconds: 0,
        sampleRateHz: 0,
        channels: 0,
        zeroCrossingRate: 0,
        silenceRatio: 1,
        dynamicRange: 0,
        bpm: 0,
        confidence: 0,
    });
    const analysis = freeze({
        metrics,
        features: zero,
        waveformHash: shortHash("empty-waveform"),
        spectralHash: shortHash("empty-spectral"),
        tempoHash: shortHash("empty-tempo"),
        rhythmHash: shortHash("empty-rhythm"),
        frequencyHash: shortHash("empty-frequency"),
        acousticFingerprintHash: shortHash("empty-acoustic"),
        chromaprintCompatibleHash: "chromaprint-like:empty",
        overallHash: shortHash("empty-overall"),
    });
    return buildFingerprintRecord(randomUUID(), {
        release: { id: input.releaseId, userId: "", title: "", primaryArtist: "", metadata: input.metadata ?? {}, tracks: [] },
        track: null,
        assetId: input.assetId,
        sourceUrl: null,
        metadata: input.metadata ?? {},
    }, analysis, input.metadata ?? {});
}
export class AudioFingerprintingEngine {
    deps;
    log;
    capabilityMatrix = createCapabilityMatrix();
    constructor(deps) {
        this.deps = deps;
        this.log = deps.logger ?? defaultLogger.child({ component: "audio-fingerprint-engine" });
    }
    getCapabilities() {
        return this.capabilityMatrix;
    }
    async generateFingerprint(input) {
        const started = Date.now();
        const source = await this.resolveSource(input);
        const releaseReport = await this.deps.enterpriseDistributionService.getCatalogReport(input.releaseId).catch(() => null);
        const rightsReport = await this.deps.enterpriseRightsService.generateRightsReport(input.releaseId).catch(() => null);
        const validation = this.deps.releaseDeliveryEngine?.validateRelease
            ? this.deps.releaseDeliveryEngine.validateRelease(this.toDomainRelease(source.release, source.track))
            : null;
        const sourceBuffer = input.pcmBuffer ?? (source.sourceUrl ? await this.readAudioSource(source.sourceUrl) : null);
        const analysis = sourceBuffer ? analyzeBuffer(sourceBuffer, input.sampleRateHz ?? 11025) : analyzeBuffer(Buffer.alloc(0), input.sampleRateHz ?? 11025);
        const fingerprintRelease = source.release ?? {
            id: input.releaseId,
            userId: "",
            primaryArtist: source.track?.primaryArtist ?? "Unknown Artist",
            title: source.track?.title ?? "Unknown Release",
            metadata: {},
        };
        const transformedRelease = this.deps.metadataTransformer.transform({
            release: fingerprintRelease,
            tracks: source.track ? [source.track] : [],
        });
        const ddexArtifact = this.deps.ddexFoundationService.exportNewRelease(transformedRelease, {
            metadata: { releaseId: input.releaseId, trackId: input.trackId ?? source.track?.id ?? null },
        });
        const legacyFingerprint = source.sourceUrl && !input.pcmBuffer
            ? await this.tryLegacyFingerprint(source.sourceUrl, source.assetId ?? input.assetId ?? input.releaseId, source.track?.id ?? input.trackId ?? null, analysis.waveformHash)
            : null;
        const fingerprint = buildFingerprintRecord(randomUUID(), source, analysis, {
            ...input.metadata,
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            actor: input.actor ?? null,
            correlationId: input.correlationId ?? null,
            validation: validation ? { valid: validation.valid, errors: validation.errors.length, warnings: validation.warnings.length } : null,
            catalogStage: releaseReport?.stage ?? null,
            rightsVerified: rightsReport?.ownershipVerified ?? null,
            transformedReleaseKind: transformedRelease.kind,
            ddexMessageType: ddexArtifact.messageType ?? null,
            legacyFingerprintHash: legacyFingerprint?.acousticFingerprintHash ?? null,
            legacySimilarityScore: legacyFingerprint?.similarityScore ?? null,
        });
        const persistedFingerprint = await this.persistFingerprint(fingerprint, source);
        const candidates = await this.findCandidateFingerprints(fingerprint, source);
        const duplicates = candidates
            .filter((candidate) => candidate.comparison.duplicateType !== "none" || candidate.comparison.similarityScore >= 0.9)
            .map((candidate) => makeDuplicateMatch({ fingerprint: persistedFingerprint, compared: candidate.rowToFingerprint, comparison: candidate.comparison }));
        const similarityScores = candidates.map((candidate) => makeSimilarityScore({ fingerprint: persistedFingerprint, compared: candidate.rowToFingerprint, comparison: candidate.comparison }));
        const fraudSignals = buildFraudSignals(persistedFingerprint, duplicates, candidates[0]?.comparison ?? null, rightsReport ? { conflictCount: rightsReport.conflicts.length, ownershipCount: rightsReport.ownerships.length } : null);
        const reviewActions = routeReviewActions(duplicates, fraudSignals, input.releaseId, input.trackId ?? source.track?.id ?? null);
        const rightsReferences = [
            ...new Set([
                persistedFingerprint.metadata.isrc ? `ISRC:${persistedFingerprint.metadata.isrc}` : null,
                persistedFingerprint.metadata.upc ? `UPC:${persistedFingerprint.metadata.upc}` : null,
                persistedFingerprint.metadata.trackId ? `TRACK:${persistedFingerprint.metadata.trackId}` : null,
                persistedFingerprint.metadata.releaseId ? `RELEASE:${persistedFingerprint.metadata.releaseId}` : null,
            ].filter((value) => Boolean(value))),
        ];
        await this.persistAnalysis({
            fingerprint: persistedFingerprint,
            duplicates,
            similarityScores,
            fraudSignals,
            rightsReport,
            reviewActions,
            durationMs: Date.now() - started,
        });
        incrementMetric("tracksyra_audio_fingerprint_total", { releaseId: input.releaseId });
        if (duplicates.length)
            incrementMetric("tracksyra_audio_duplicate_total", { releaseId: input.releaseId });
        if (fraudSignals.length)
            incrementMetric("tracksyra_audio_fraud_total", { releaseId: input.releaseId });
        setMetric("tracksyra_audio_fingerprint_confidence", { releaseId: input.releaseId }, persistedFingerprint.metrics.confidence);
        this.log.info("audio fingerprint generated", {
            releaseId: input.releaseId,
            trackId: input.trackId ?? source.track?.id ?? null,
            fingerprintId: persistedFingerprint.fingerprintId,
            duplicateCount: duplicates.length,
            fraudCount: fraudSignals.length,
            reviewActions,
            durationMs: Date.now() - started,
        });
        return freeze({
            generatedAt: nowIso(this.deps.now),
            release: source.release,
            track: source.track,
            fingerprint: persistedFingerprint,
            comparison: candidates[0]?.comparison ?? null,
            duplicates: freeze(duplicates),
            similarityScores: freeze(similarityScores),
            fraudSignals: freeze(fraudSignals),
            reviewActions: freeze(reviewActions),
            rightsReferences: freeze(rightsReferences),
            metadata: freeze({
                releaseReport,
                rightsReport,
                validation: validation ? {
                    valid: validation.valid,
                    errorCount: validation.errors.length,
                    warningCount: validation.warnings.length,
                } : null,
            }),
        });
    }
    async compareFingerprint(input) {
        const left = input.left ?? (input.leftFingerprintId ? await this.loadFingerprintRecord(input.leftFingerprintId) : null);
        const right = input.right ?? (input.rightFingerprintId ? await this.loadFingerprintRecord(input.rightFingerprintId) : null);
        if (!left || !right) {
            throw new Error("compareFingerprint requires both fingerprints");
        }
        return compareFingerprintRecords(left, right);
    }
    async findDuplicates(input) {
        const result = await this.generateFingerprint(input);
        return result.duplicates;
    }
    async findSimilarTracks(input) {
        const result = await this.generateFingerprint(input);
        return result.similarityScores.filter((score) => score.overallSimilarity >= 0.7);
    }
    async detectFraud(input) {
        const result = await this.generateFingerprint(input);
        return result.fraudSignals;
    }
    async generateFingerprintReport(releaseId) {
        const rows = await this.loadFingerprintRows(releaseId ?? null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            summary: freeze({
                totalFingerprints: rows.length,
                releaseId: releaseId ?? null,
                exactMatches: rows.filter((row) => row.acoustic_fingerprint_hash === row.overall_hash).length,
            }),
            items: freeze(rows.map((row) => this.rowToRecord(row))),
        });
    }
    async generateDuplicateReport(releaseId) {
        const rows = await this.loadDuplicateRows(releaseId ?? null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            summary: freeze({
                totalDuplicates: rows.length,
                releaseId: releaseId ?? null,
                exactDuplicates: rows.filter((row) => row.duplicateType === "exact_duplicate").length,
            }),
            items: freeze(rows),
        });
    }
    async generateSimilarityReport(releaseId) {
        const rows = await this.loadSimilarityRows(releaseId ?? null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            summary: freeze({
                totalSimilarities: rows.length,
                releaseId: releaseId ?? null,
                averageSimilarity: rows.length ? average(rows.map((row) => row.overallSimilarity)) : 0,
            }),
            items: freeze(rows),
        });
    }
    async generateFraudReport(releaseId) {
        const rows = await this.loadFraudRows(releaseId ?? null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            summary: freeze({
                totalSignals: rows.length,
                releaseId: releaseId ?? null,
                highSeverity: rows.filter((row) => row.severity === "high" || row.severity === "critical").length,
            }),
            items: freeze(rows),
        });
    }
    async generateRightsMatchReport(releaseId) {
        const report = await (releaseId ? this.deps.enterpriseRightsService.generateRightsReport(releaseId) : null);
        const items = report
            ? [
                ...report.ownerships.map((ownership) => ({ kind: "ownership", releaseId: ownership.releaseId, trackId: ownership.trackId, ownerName: ownership.ownerName, rightsScope: ownership.rightsScope, territories: ownership.territories })),
                ...report.licenses.map((license) => ({ kind: "license", releaseId: license.releaseId, trackId: license.trackId, territoryMode: license.territoryMode, dsp: license.dsp, territories: license.territories })),
                ...report.conflicts.map((conflict) => ({ kind: "conflict", releaseId: conflict.releaseId, trackId: conflict.trackId, conflictType: conflict.conflictType, severity: conflict.severity, message: conflict.message })),
            ]
            : [];
        return freeze({
            generatedAt: nowIso(this.deps.now),
            summary: freeze({
                releaseId: releaseId ?? null,
                ownershipVerified: report?.ownershipVerified ?? false,
                chainOfTitleVerified: report?.chainOfTitleVerified ?? false,
                total: items.length,
            }),
            items: freeze(items),
        });
    }
    async generateCatalogDuplicateReport(releaseId) {
        const items = await this.generateDuplicateReport(releaseId ?? null);
        return freeze({
            generatedAt: items.generatedAt,
            summary: items.summary,
            items: items.items,
        });
    }
    async healthCheck() {
        const report = await this.generateFingerprintReport(null);
        const totalFingerprints = Number(report.summary.totalFingerprints ?? 0);
        const healthy = totalFingerprints >= 0;
        setWorkerHealth(queueNames.fingerprintAnalysis, healthy ? "healthy" : "degraded");
        return freeze({
            healthy,
            queue: queueNames.fingerprintAnalysis,
            totalFingerprints,
            generatedAt: report.generatedAt,
        });
    }
    async retry(input) {
        recordRetry(queueNames.fingerprintRetry);
        const result = await this.generateFingerprint(input);
        if (input.error) {
            await this.persistRetry(input, input.error);
        }
        return result;
    }
    async withdraw(input) {
        await this.deps.enterpriseRightsService.withdrawRights({
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            kind: "catalog",
            reason: input.reason,
            actor: input.actor ?? "system",
            correlationId: input.correlationId ?? null,
            metadata: { source: "audio-fingerprint" },
        });
    }
    async restore(input) {
        await this.deps.enterpriseRightsService.registerRights({
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            ownerType: "administrator",
            ownerName: input.actor ?? "system",
            rightsScopes: ["master", "streaming"],
            status: "enabled",
            source: "audio-fingerprint",
            reason: input.reason,
            correlationId: input.correlationId ?? null,
            metadata: { restored: true },
        });
    }
    async audit(input) {
        return this.generateFingerprintReport(input?.releaseId ?? null);
    }
    async generateDashboard(input) {
        switch (input.kind) {
            case "fingerprint":
                return this.generateFingerprintReport(input.releaseId ?? null);
            case "duplicate":
                return this.generateDuplicateReport(input.releaseId ?? null);
            case "similarity":
                return this.generateSimilarityReport(input.releaseId ?? null);
            case "fraud":
                return this.generateFraudReport(input.releaseId ?? null);
            case "catalog-duplicate":
                return this.generateCatalogDuplicateReport(input.releaseId ?? null);
            default:
                return this.generateFingerprintReport(input.releaseId ?? null);
        }
    }
    async resolveSource(input) {
        const bundle = await this.deps.distributionStore.getReleaseWithTracks(input.releaseId);
        const release = bundle?.release ?? null;
        const track = input.trackId ? bundle?.tracks.find((candidate) => candidate.id === input.trackId) ?? null : bundle?.tracks[0] ?? null;
        const assetId = input.assetId ?? await this.resolveAssetId(input.releaseId, input.trackId ?? track?.id ?? null);
        const sourceUrl = input.sourceUrl ?? this.resolveAudioSource(release, track);
        return freeze({
            release,
            track,
            assetId,
            sourceUrl,
            metadata: freeze({
                ...toRecord(input.metadata),
                releaseId: input.releaseId,
                trackId: input.trackId ?? track?.id ?? null,
            }),
        });
    }
    resolveAudioSource(release, track) {
        const trackMetadata = toRecord(track?.metadata);
        const releaseMetadata = toRecord(release?.metadata);
        return normalizeText(track?.audioUrl ?? trackMetadata.audioUrl ?? releaseMetadata.audioUrl ?? releaseMetadata.sourceUrl ?? null);
    }
    async tryLegacyFingerprint(sourceUrl, assetId, trackId, waveformHash) {
        try {
            const workDir = await mkdtemp(join(tmpdir(), `tracksyra-legacy-fingerprint-${assetId}-`));
            const result = await this.deps.audioFingerprintService.fingerprint({
                sourcePath: sourceUrl,
                assetId,
                trackId,
                workDir,
                waveformHash,
            });
            return {
                acousticFingerprintHash: result.acousticFingerprintHash,
                similarityScore: result.similarityScore,
            };
        }
        catch (error) {
            this.log.warn("legacy fingerprint fallback failed", {
                sourceUrl,
                assetId,
                trackId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async resolveAssetId(releaseId, trackId) {
        if (!trackId)
            return null;
        const rows = await this.deps.sql.query(`SELECT id FROM public.media_assets WHERE release_id = :releaseId::uuid AND track_id = :trackId::uuid ORDER BY created_at DESC LIMIT 1`, { releaseId, trackId });
        return rows[0]?.id ?? null;
    }
    toDomainRelease(release, track) {
        const contributor = new Contributor({
            name: release?.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist",
            roles: ["primary_artist"],
            isPrimary: true,
        });
        const domainTrack = new Track({
            id: track?.id ?? `${release?.id ?? track?.releaseId ?? "release"}:track`,
            title: track?.title ?? release?.title ?? "Unknown Track",
            version: track?.version ? new ReleaseVersion(track.version) : null,
            discNumber: 1,
            trackNumber: 1,
            contributors: [contributor],
            territories: new TerritorySet(["WORLD"]),
            isrc: track?.isrc ?? null,
            audioReference: track?.audioUrl ?? null,
            artworkReference: release?.coverArtUrl ?? null,
            explicit: Boolean(track?.explicit ?? false),
            lyrics: track?.lyrics ?? null,
            metadata: { ...(release?.metadata ?? {}), ...(track?.metadata ?? {}) },
        });
        return new Release({
            id: new ReleaseId(release?.id ?? track?.releaseId ?? "release"),
            title: release?.title ?? track?.title ?? "Unknown Release",
            primaryArtist: release?.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist",
            version: release?.version ? new ReleaseVersion(release.version) : null,
            state: "DRAFT",
            contributors: [contributor],
            tracks: [domainTrack],
            label: release?.labelName ?? null,
            upc: release?.upc ?? null,
            releaseDate: release?.releaseDate ?? null,
            originalReleaseDate: release?.originalReleaseDate ?? null,
            territories: new TerritorySet(["WORLD"]),
            distributionVersion: new DistributionVersion("1.0"),
            metadata: { ...(release?.metadata ?? {}), ...(track?.metadata ?? {}) },
        });
    }
    async readAudioSource(sourceUrl) {
        if (/^https?:\/\//i.test(sourceUrl)) {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
                throw new Error(`Unable to download fingerprint audio source: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        return this.deps.ffmpeg.read(sourceUrl);
    }
    async persistFingerprint(fingerprint, source) {
        const fingerprintId = fingerprint.fingerprintId;
        await this.deps.sql.query(`INSERT INTO public.fingerprint_jobs (id, release_id, track_id, asset_id, job_type, status, attempts, max_attempts, metadata)
       VALUES (:id, :releaseId::uuid, :trackId::uuid, :assetId::uuid, 'fingerprint', 'completed', 1, 3, CAST(:metadata AS jsonb))
       ON CONFLICT (id) DO UPDATE SET updated_at = now()`, {
            id: fingerprintId,
            releaseId: fingerprint.releaseId,
            trackId: fingerprint.trackId,
            assetId: fingerprint.assetId,
            metadata: JSON.stringify({ ...fingerprint.metadata, sourceUrl: source.sourceUrl }),
        });
        await this.deps.sql.query(`INSERT INTO public.fingerprint_hashes (
         fingerprint_id,
         hash_type,
         hash_value,
         hash_algorithm,
         hash_strength,
         created_at
       ) VALUES
         (:fingerprintId::uuid, 'acoustic', :acousticHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'chromaprint', :chromaprintHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'waveform', :waveformHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'spectral', :spectralHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'tempo', :tempoHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'rhythm', :rhythmHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'frequency', :frequencyHash, 'sha256', 1, now()),
         (:fingerprintId::uuid, 'overall', :overallHash, 'sha256', 1, now())
       ON CONFLICT DO NOTHING`, {
            fingerprintId,
            acousticHash: fingerprint.acousticFingerprintHash,
            chromaprintHash: fingerprint.chromaprintCompatibleHash,
            waveformHash: fingerprint.waveformHash,
            spectralHash: fingerprint.spectralHash,
            tempoHash: fingerprint.tempoHash,
            rhythmHash: fingerprint.rhythmHash,
            frequencyHash: fingerprint.frequencyHash,
            overallHash: fingerprint.overallHash,
        });
        if (fingerprint.assetId) {
            await this.deps.sql.query(`INSERT INTO public.audio_fingerprints (
           asset_id,
           track_id,
           fingerprint_hash,
           waveform_hash,
           similarity_score,
           duplicate_asset_id,
           duplicate_track_id,
           duplicate_references
         ) VALUES (
           :assetId::uuid,
           CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
           :fingerprintHash,
           :waveformHash,
           :similarityScore,
           NULL,
           NULL,
           CAST(:duplicateReferences AS jsonb)
         )
         ON CONFLICT (asset_id) DO UPDATE SET
           fingerprint_hash = EXCLUDED.fingerprint_hash,
           waveform_hash = EXCLUDED.waveform_hash,
           similarity_score = EXCLUDED.similarity_score,
           duplicate_references = EXCLUDED.duplicate_references`, {
                assetId: fingerprint.assetId,
                trackId: fingerprint.trackId,
                fingerprintHash: fingerprint.acousticFingerprintHash,
                waveformHash: fingerprint.waveformHash,
                similarityScore: fingerprint.metrics.confidence,
                duplicateReferences: JSON.stringify([]),
            });
        }
        await this.deps.sql.query(`INSERT INTO public.audio_signatures (
         fingerprint_id,
         release_id,
         track_id,
         asset_id,
         release_title,
         track_title,
         primary_artist,
         label_name,
         isrc,
         upc,
         duration_seconds,
         sample_rate_hz,
         channels,
         zero_crossing_rate,
         silence_ratio,
         dynamic_range,
         bpm,
         confidence_score,
         acoustic_fingerprint_hash,
         chromaprint_compatible_hash,
         waveform_hash,
         spectral_hash,
         tempo_hash,
         rhythm_hash,
         frequency_hash,
         overall_hash,
         features,
         metrics,
         metadata,
         created_at
       ) VALUES (
         :fingerprintId::uuid,
         :releaseId::uuid,
         CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
         CASE WHEN :assetId IS NULL OR :assetId = '' THEN NULL ELSE :assetId::uuid END,
         :releaseTitle,
         :trackTitle,
         :primaryArtist,
         :labelName,
         :isrc,
         :upc,
         :durationSeconds,
         :sampleRateHz,
         :channels,
         :zeroCrossingRate,
         :silenceRatio,
         :dynamicRange,
         :bpm,
         :confidenceScore,
         :acousticHash,
         :chromaprintHash,
         :waveformHash,
         :spectralHash,
         :tempoHash,
         :rhythmHash,
         :frequencyHash,
         :overallHash,
         CAST(:features AS jsonb),
         CAST(:metrics AS jsonb),
         CAST(:metadata AS jsonb),
         now()
       )
       ON CONFLICT (fingerprint_id) DO UPDATE SET
         release_title = EXCLUDED.release_title,
         track_title = EXCLUDED.track_title,
         primary_artist = EXCLUDED.primary_artist,
         label_name = EXCLUDED.label_name,
         metrics = EXCLUDED.metrics,
         metadata = EXCLUDED.metadata`, {
            fingerprintId,
            releaseId: fingerprint.releaseId,
            trackId: fingerprint.trackId,
            assetId: fingerprint.assetId,
            releaseTitle: fingerprint.metadata.releaseTitle ?? null,
            trackTitle: fingerprint.metadata.title ?? null,
            primaryArtist: fingerprint.metadata.primaryArtist ?? null,
            labelName: fingerprint.metadata.labelName ?? null,
            isrc: fingerprint.metadata.isrc ?? null,
            upc: fingerprint.metadata.upc ?? null,
            durationSeconds: fingerprint.metrics.durationSeconds,
            sampleRateHz: fingerprint.metrics.sampleRateHz,
            channels: fingerprint.metrics.channels,
            zeroCrossingRate: fingerprint.metrics.zeroCrossingRate,
            silenceRatio: fingerprint.metrics.silenceRatio,
            dynamicRange: fingerprint.metrics.dynamicRange,
            bpm: fingerprint.metrics.bpm,
            confidenceScore: fingerprint.metrics.confidence,
            acousticHash: fingerprint.acousticFingerprintHash,
            chromaprintHash: fingerprint.chromaprintCompatibleHash,
            waveformHash: fingerprint.waveformHash,
            spectralHash: fingerprint.spectralHash,
            tempoHash: fingerprint.tempoHash,
            rhythmHash: fingerprint.rhythmHash,
            frequencyHash: fingerprint.frequencyHash,
            overallHash: fingerprint.overallHash,
            features: JSON.stringify(fingerprint.features),
            metrics: JSON.stringify(fingerprint.metrics),
            metadata: JSON.stringify(fingerprint.metadata),
        });
        return fingerprint;
    }
    async persistAnalysis(input) {
        const fingerprint = input.fingerprint;
        for (const duplicate of input.duplicates) {
            await this.deps.sql.query(`INSERT INTO public.duplicate_matches (
           fingerprint_id,
           release_id,
           track_id,
           matched_release_id,
           matched_track_id,
           matched_fingerprint_id,
           duplicate_type,
           similarity_score,
           confidence_score,
           evidence,
           reasons
         ) VALUES (
           :fingerprintId::uuid,
           :releaseId::uuid,
           CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
           :matchedReleaseId::uuid,
           CASE WHEN :matchedTrackId IS NULL OR :matchedTrackId = '' THEN NULL ELSE :matchedTrackId::uuid END,
           CASE WHEN :matchedFingerprintId IS NULL OR :matchedFingerprintId = '' THEN NULL ELSE :matchedFingerprintId::uuid END,
           :duplicateType,
           :similarityScore,
           :confidenceScore,
           CAST(:evidence AS jsonb),
           CAST(:reasons AS jsonb)
         )`, {
                fingerprintId: fingerprint.fingerprintId,
                releaseId: fingerprint.releaseId,
                trackId: fingerprint.trackId,
                matchedReleaseId: duplicate.matchedReleaseId,
                matchedTrackId: duplicate.matchedTrackId,
                matchedFingerprintId: duplicate.matchedFingerprintId,
                duplicateType: duplicate.duplicateType,
                similarityScore: duplicate.similarityScore,
                confidenceScore: duplicate.confidenceScore,
                evidence: JSON.stringify(duplicate.evidence),
                reasons: JSON.stringify(duplicate.reasons),
            });
        }
        for (const similarityScore of input.similarityScores) {
            await this.deps.sql.query(`INSERT INTO public.similarity_scores (
           fingerprint_id,
           release_id,
           track_id,
           compared_release_id,
           compared_track_id,
           waveform_similarity,
           spectral_similarity,
           tempo_similarity,
           pitch_similarity,
           silence_similarity,
           dynamic_range_similarity,
           rhythm_similarity,
           frequency_similarity,
           overall_similarity,
           confidence_score
         ) VALUES (
           :fingerprintId::uuid,
           :releaseId::uuid,
           CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
           :comparedReleaseId::uuid,
           CASE WHEN :comparedTrackId IS NULL OR :comparedTrackId = '' THEN NULL ELSE :comparedTrackId::uuid END,
           :waveformSimilarity,
           :spectralSimilarity,
           :tempoSimilarity,
           :pitchSimilarity,
           :silenceSimilarity,
           :dynamicRangeSimilarity,
           :rhythmSimilarity,
           :frequencySimilarity,
           :overallSimilarity,
           :confidenceScore
         )`, {
                fingerprintId: fingerprint.fingerprintId,
                releaseId: fingerprint.releaseId,
                trackId: fingerprint.trackId,
                comparedReleaseId: similarityScore.comparedReleaseId,
                comparedTrackId: similarityScore.comparedTrackId,
                waveformSimilarity: similarityScore.waveformSimilarity,
                spectralSimilarity: similarityScore.spectralSimilarity,
                tempoSimilarity: similarityScore.tempoSimilarity,
                pitchSimilarity: similarityScore.pitchSimilarity,
                silenceSimilarity: similarityScore.silenceSimilarity,
                dynamicRangeSimilarity: similarityScore.dynamicRangeSimilarity,
                rhythmSimilarity: similarityScore.rhythmSimilarity,
                frequencySimilarity: similarityScore.frequencySimilarity,
                overallSimilarity: similarityScore.overallSimilarity,
                confidenceScore: similarityScore.confidenceScore,
            });
        }
        for (const signal of input.fraudSignals) {
            await this.deps.sql.query(`INSERT INTO public.audio_analysis (
           fingerprint_id,
           release_id,
           track_id,
           analysis_type,
           analysis_score,
           metadata,
           created_at
         ) VALUES (
           :fingerprintId::uuid,
           :releaseId::uuid,
           CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
           :analysisType,
           :analysisScore,
           CAST(:metadata AS jsonb),
           now()
         )`, {
                fingerprintId: fingerprint.fingerprintId,
                releaseId: fingerprint.releaseId,
                trackId: fingerprint.trackId,
                analysisType: signal.code,
                analysisScore: signal.scoreImpact,
                metadata: JSON.stringify({ ...signal.metadata, severity: signal.severity, explanation: signal.explanation }),
            });
        }
        await this.deps.sql.query(`INSERT INTO public.fingerprint_history (
         fingerprint_id,
         release_id,
         track_id,
         action,
         previous_value,
         next_value,
         actor,
         reason,
         correlation_id,
         created_at
       ) VALUES (
         :fingerprintId::uuid,
         :releaseId::uuid,
         CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
         'GENERATED',
         NULL,
         CAST(:nextValue AS jsonb),
         :actor,
         :reason,
         :correlationId,
         now()
       )`, {
            fingerprintId: fingerprint.fingerprintId,
            releaseId: fingerprint.releaseId,
            trackId: fingerprint.trackId,
            nextValue: JSON.stringify({
                fingerprint: fingerprint.acousticFingerprintHash,
                duplicates: input.duplicates.length,
                fraudSignals: input.fraudSignals.length,
                reviewActions: input.reviewActions,
                durationMs: input.durationMs,
            }),
            actor: String(fingerprint.metadata.actor ?? "system"),
            reason: "Fingerprint generated",
            correlationId: String(fingerprint.metadata.correlationId ?? ""),
        });
        await this.deps.sql.query(`INSERT INTO public.fingerprint_audit (
         fingerprint_id,
         aggregate_type,
         aggregate_id,
         action,
         status,
         actor,
         correlation_id,
         ip_address,
         metadata,
         created_at
       ) VALUES (
         :fingerprintId::uuid,
         'audio_fingerprint',
         :aggregateId,
         :action,
         :status,
         :actor,
         :correlationId,
         NULL,
         CAST(:metadata AS jsonb),
         now()
       )`, {
            fingerprintId: fingerprint.fingerprintId,
            aggregateId: fingerprint.releaseId,
            action: "FINGERPRINT_GENERATED",
            status: input.duplicates.length || input.fraudSignals.length ? "UPDATED" : "SUCCESS",
            actor: String(fingerprint.metadata.actor ?? "system"),
            correlationId: String(fingerprint.metadata.correlationId ?? ""),
            metadata: JSON.stringify({
                reviewActions: input.reviewActions,
                duplicates: input.duplicates.length,
                fraudSignals: input.fraudSignals.length,
                durationMs: input.durationMs,
                rightsVerified: input.rightsReport?.ownershipVerified ?? null,
            }),
        });
    }
    async persistRetry(input, error) {
        await this.deps.sql.query(`INSERT INTO public.fingerprint_jobs (
         id,
         release_id,
         track_id,
         asset_id,
         job_type,
         status,
         attempts,
         max_attempts,
         last_error,
         metadata
       ) VALUES (
         :id,
         :releaseId::uuid,
         CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END,
         CASE WHEN :assetId IS NULL OR :assetId = '' THEN NULL ELSE :assetId::uuid END,
         'retry',
         'retrying',
         :attempts,
         3,
         :lastError,
         CAST(:metadata AS jsonb)
       )
       ON CONFLICT (id) DO UPDATE SET
         attempts = EXCLUDED.attempts,
         last_error = EXCLUDED.last_error,
         updated_at = now()`, {
            id: `fingerprint-retry:${input.releaseId}:${input.trackId ?? "release"}`,
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            assetId: input.assetId ?? null,
            attempts: Math.max(1, Number(input.attempt ?? 1)),
            lastError: error instanceof Error ? error.message : String(error),
            metadata: JSON.stringify({ error: serializeError(error), source: "audio-fingerprint-retry" }),
        });
    }
    async findCandidateFingerprints(fingerprint, source) {
        const rows = await this.loadFingerprintRows(null);
        const candidates = [];
        for (const row of rows) {
            if (row.id === fingerprint.fingerprintId)
                continue;
            const compared = this.rowToRecord(row);
            const comparison = compareFingerprintRecords(fingerprint, compared);
            const sameRelease = source.release?.id ? row.release_id === source.release.id : false;
            const sameArtist = source.release?.primaryArtist && row.primary_artist ? source.release.primaryArtist.toLowerCase() === row.primary_artist.toLowerCase() : false;
            if (!sameRelease && !sameArtist && comparison.similarityScore < 0.7 && comparison.duplicateType === "none")
                continue;
            candidates.push({
                row,
                comparison,
                rowToFingerprint: compared,
            });
        }
        candidates.sort((left, right) => right.comparison.similarityScore - left.comparison.similarityScore);
        return candidates.slice(0, 25);
    }
    rowToRecord(row) {
        const features = toRecord(row.features);
        return freeze({
            fingerprintId: row.id,
            assetId: row.asset_id,
            releaseId: row.release_id,
            trackId: row.track_id,
            generatedAt: row.created_at,
            acousticFingerprintHash: row.acoustic_fingerprint_hash,
            chromaprintCompatibleHash: row.chromaprint_compatible_hash,
            waveformHash: row.waveform_hash,
            spectralHash: row.spectral_hash,
            tempoHash: row.tempo_hash,
            rhythmHash: row.rhythm_hash,
            frequencyHash: row.frequency_hash,
            overallHash: row.overall_hash,
            metrics: freeze({
                durationSeconds: Number(row.duration_seconds ?? 0),
                sampleRateHz: Number(row.sample_rate_hz ?? 0),
                channels: Number(row.channels ?? 0),
                zeroCrossingRate: Number(row.zero_crossing_rate ?? 0),
                silenceRatio: Number(row.silence_ratio ?? 0),
                dynamicRange: Number(row.dynamic_range ?? 0),
                bpm: Number(row.bpm ?? 0),
                confidence: Number(row.confidence_score ?? 0),
            }),
            features: freeze({
                waveformSignature: parseNumericArray(features.waveformSignature, 128),
                spectralSignature: parseNumericArray(features.spectralSignature, 24),
                mfccSignature: parseNumericArray(features.mfccSignature, 12),
                tempoSignature: parseNumericArray(features.tempoSignature, 3),
                rhythmSignature: parseNumericArray(features.rhythmSignature, 12),
                frequencySignature: parseNumericArray(features.frequencySignature, 4),
            }),
            metadata: freeze({
                releaseTitle: row.release_title,
                trackTitle: row.track_title,
                primaryArtist: row.primary_artist,
                labelName: row.label_name,
                isrc: row.isrc,
                upc: row.upc,
                sourceMetadata: row.metadata,
            }),
        });
    }
    async loadFingerprintRows(releaseId) {
        const whereClause = releaseId ? "WHERE s.release_id = :releaseId::uuid" : "";
        return this.deps.sql.query(`SELECT
         s.fingerprint_id AS id,
         s.release_id,
         s.track_id,
         s.asset_id,
         s.acoustic_fingerprint_hash,
         s.chromaprint_compatible_hash,
         s.waveform_hash,
         s.spectral_hash,
         s.tempo_hash,
         s.rhythm_hash,
         s.frequency_hash,
         s.overall_hash,
         s.duration_seconds,
         s.sample_rate_hz,
         s.channels,
         s.zero_crossing_rate,
         s.silence_ratio,
         s.dynamic_range,
         s.bpm,
         s.confidence_score,
         s.release_title,
         s.track_title,
         s.primary_artist,
         s.label_name,
         s.isrc,
         s.upc,
         s.features,
         s.created_at::text AS created_at,
         s.metadata
       FROM public.audio_signatures s
       ${whereClause}
       ORDER BY s.created_at DESC`, releaseId ? { releaseId } : {});
    }
    async loadDuplicateRows(releaseId) {
        const whereClause = releaseId ? "WHERE dm.release_id = :releaseId::uuid" : "";
        const rows = await this.deps.sql.query(`SELECT
         dm.id AS match_id,
         dm.fingerprint_id,
         dm.release_id,
         dm.track_id,
         dm.matched_release_id,
         dm.matched_track_id,
         dm.matched_fingerprint_id,
         dm.duplicate_type,
         dm.similarity_score,
         dm.confidence_score,
         dm.reasons,
         dm.evidence,
         dm.created_at::text AS created_at
       FROM public.duplicate_matches dm
       ${whereClause}
       ORDER BY dm.created_at DESC`, releaseId ? { releaseId } : {});
        return rows.map((row) => freeze({
            matchId: row.match_id,
            fingerprintId: row.fingerprint_id,
            releaseId: row.release_id,
            trackId: row.track_id,
            matchedReleaseId: row.matched_release_id,
            matchedTrackId: row.matched_track_id,
            matchedFingerprintId: row.matched_fingerprint_id,
            duplicateType: row.duplicate_type,
            similarityScore: Number(row.similarity_score ?? 0),
            confidenceScore: Number(row.confidence_score ?? 0),
            reasons: freeze(parseArray(row.reasons).map((reason) => String(reason))),
            evidence: freeze(toRecord(row.evidence)),
            createdAt: row.created_at,
        }));
    }
    async loadSimilarityRows(releaseId) {
        const whereClause = releaseId ? "WHERE ss.release_id = :releaseId::uuid" : "";
        const rows = await this.deps.sql.query(`SELECT
         ss.id AS similarity_id,
         ss.fingerprint_id,
         ss.release_id,
         ss.track_id,
         ss.compared_release_id,
         ss.compared_track_id,
         ss.waveform_similarity,
         ss.spectral_similarity,
         ss.tempo_similarity,
         ss.pitch_similarity,
         ss.silence_similarity,
         ss.dynamic_range_similarity,
         ss.rhythm_similarity,
         ss.frequency_similarity,
         ss.overall_similarity,
         ss.confidence_score,
         ss.created_at::text AS created_at
       FROM public.similarity_scores ss
       ${whereClause}
       ORDER BY ss.created_at DESC`, releaseId ? { releaseId } : {});
        return rows.map((row) => freeze({
            similarityId: row.similarity_id,
            fingerprintId: row.fingerprint_id,
            releaseId: row.release_id,
            trackId: row.track_id,
            comparedReleaseId: row.compared_release_id,
            comparedTrackId: row.compared_track_id,
            waveformSimilarity: Number(row.waveform_similarity ?? 0),
            spectralSimilarity: Number(row.spectral_similarity ?? 0),
            tempoSimilarity: Number(row.tempo_similarity ?? 0),
            pitchSimilarity: Number(row.pitch_similarity ?? 0),
            silenceSimilarity: Number(row.silence_similarity ?? 0),
            dynamicRangeSimilarity: Number(row.dynamic_range_similarity ?? 0),
            rhythmSimilarity: Number(row.rhythm_similarity ?? 0),
            frequencySimilarity: Number(row.frequency_similarity ?? 0),
            overallSimilarity: Number(row.overall_similarity ?? 0),
            confidenceScore: Number(row.confidence_score ?? 0),
            createdAt: row.created_at,
        }));
    }
    async loadFraudRows(releaseId) {
        const whereClause = releaseId ? "WHERE aa.release_id = :releaseId::uuid" : "";
        const rows = await this.deps.sql.query(`SELECT
         aa.analysis_type AS code,
         CASE
           WHEN aa.analysis_score >= 90 THEN 'critical'
           WHEN aa.analysis_score >= 70 THEN 'high'
           WHEN aa.analysis_score >= 35 THEN 'medium'
           ELSE 'low'
         END AS severity,
         aa.analysis_score AS score_impact,
         COALESCE(aa.metadata ->> 'explanation', aa.analysis_type) AS explanation,
         aa.metadata
       FROM public.audio_analysis aa
       ${whereClause}
       ORDER BY aa.created_at DESC`, releaseId ? { releaseId } : {});
        return rows.map((row) => freeze({
            code: row.code,
            severity: row.severity,
            scoreImpact: Number(row.score_impact ?? 0),
            explanation: row.explanation,
            metadata: freeze(toRecord(row.metadata)),
        }));
    }
    async loadFingerprintRecord(fingerprintId) {
        const rows = await this.loadFingerprintRows(null);
        const row = rows.find((entry) => entry.id === fingerprintId) ?? null;
        return row ? this.rowToRecord(row) : null;
    }
}
function round(value) {
    return Math.round(value * 1000) / 1000;
}
