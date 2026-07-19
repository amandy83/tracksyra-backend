import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { logger } from "../../observability/logger.js";
export function registerMediaProcessingWorker(engine, options = {}) {
    return createWorker(queueNames.mediaProcessing, async (job) => {
        logger.info("media processing job started", { component: "media-worker", jobId: job.id, assetId: job.data.input.assetId });
        return engine.processAudio(job.data.input);
    }, options);
}
export function registerArtworkProcessingWorker(engine, options = {}) {
    return createWorker(queueNames.artworkProcessing, async (job) => {
        logger.info("artwork processing job started", { component: "media-worker", jobId: job.id, assetId: job.data.input.assetId });
        return engine.processArtwork(job.data.input);
    }, options);
}
export function registerWaveformGenerationWorker(engine, options = {}) {
    return createWorker(queueNames.waveformGeneration, async (job) => {
        logger.info("waveform generation job started", { component: "media-worker", jobId: job.id, assetId: job.data.input.assetId });
        return engine.generateWaveform(job.data.input);
    }, options);
}
export function registerFingerprintAnalysisWorker(engine, options = {}) {
    return createWorker(queueNames.fingerprintAnalysis, async (job) => {
        logger.info("fingerprint analysis job started", { component: "media-worker", jobId: job.id, assetId: job.data.input.assetId });
        return engine.analyzeFingerprint(job.data.input);
    }, options);
}
