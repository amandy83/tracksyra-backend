import { DISTRIBUTION_PLATFORMS, } from "../models/distributionTypes.js";
import { DistributionStatus } from "../intelligence/index.js";
export class DistributionEngine {
    deps;
    platforms;
    logger;
    constructor(deps) {
        this.deps = deps;
        this.platforms = deps.platforms ?? DISTRIBUTION_PLATFORMS;
        this.logger = deps.logger ?? console;
    }
    async distributeRelease(releaseId) {
        const result = await this.deps.store.getReleaseWithTracks(releaseId);
        if (!result)
            throw new Error(`Release not found: ${releaseId}`);
        const jobs = [];
        for (const track of result.tracks) {
            jobs.push(...(await this.createJobsForTrack(track)));
        }
        this.logger.info("[distribution] release queued", {
            releaseId,
            trackCount: result.tracks.length,
            jobCount: jobs.length,
        });
        return jobs;
    }
    async distributeTrack(trackId) {
        const result = await this.deps.store.getTrackWithRelease(trackId);
        if (!result)
            throw new Error(`Track not found: ${trackId}`);
        const jobs = await this.createJobsForTrack(result.track);
        this.logger.info("[distribution] track queued", {
            releaseId: result.release.id,
            trackId,
            jobCount: jobs.length,
        });
        return jobs;
    }
    async createJobsForTrack(track) {
        const jobs = [];
        for (const platform of this.platforms) {
            if (this.deps.adapterRegistry && !this.deps.adapterRegistry.validateSupported(platform)) {
                this.logger.error("[distribution] unsupported platform skipped", { platform, trackId: track.id });
                continue;
            }
            await this.deps.store.ensurePlatformDelivery({
                releaseId: track.releaseId,
                trackId: track.id,
                userId: track.userId,
                platform,
            });
            const job = await this.deps.store.createDistributionJob({
                releaseId: track.releaseId,
                trackId: track.id,
                platform,
            });
            if (!job)
                continue;
            await this.deps.intelligenceStore?.appendStateHistory({
                jobId: job.id,
                releaseId: track.releaseId,
                trackId: track.id,
                platform,
                nextStatus: DistributionStatus.PENDING,
                source: "ENGINE",
                metadata: { queuedAt: job.createdAt.toISOString() },
            });
            await this.deps.queue.enqueue(job);
            jobs.push(job);
        }
        return jobs;
    }
}
