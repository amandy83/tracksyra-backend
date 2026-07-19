import { logger, serializeError } from "../observability/logger.js";
const log = logger.child({ component: "promo-asset-worker" });
export class PromoAssetWorker {
    processor;
    supabase;
    options;
    name = "promo-asset-processing";
    timer = null;
    running = false;
    paused = false;
    closed = false;
    constructor(processor, supabase, options) {
        this.processor = processor;
        this.supabase = supabase;
        this.options = options;
    }
    async start() {
        await this.processor.startupCheck();
        void this.tick();
        this.timer = setInterval(() => void this.tick(), this.options.pollIntervalMs);
        return this;
    }
    async pause() {
        this.paused = true;
    }
    async resume() {
        this.paused = false;
        void this.tick();
    }
    async close() {
        this.closed = true;
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async tick() {
        if (this.running || this.paused || this.closed)
            return;
        this.running = true;
        try {
            const job = await this.claimJob();
            if (!job)
                return;
            await this.processJob(job);
        }
        catch (error) {
            log.error("promo asset worker tick failed", { error: serializeError(error) });
        }
        finally {
            this.running = false;
        }
    }
    async claimJob() {
        const { data, error } = await this.supabase.rpc("claim_next_promo_asset_job");
        if (error)
            throw error;
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        return rows[0] || null;
    }
    async processJob(job) {
        log.info("promo asset job started", { jobId: job.id, assetId: job.promo_asset_id });
        try {
            await this.processor.process(job.promo_asset_id, async (progress) => {
                await this.updateJob(job.id, { progress });
            });
            await this.updateJob(job.id, {
                status: "completed",
                progress: 100,
                completed_at: new Date().toISOString(),
            });
            log.info("promo asset job completed", { jobId: job.id, assetId: job.promo_asset_id });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await Promise.all([
                this.updateJob(job.id, {
                    status: "failed",
                    completed_at: new Date().toISOString(),
                    error_message: message,
                }),
                this.markAssetFailed(job.promo_asset_id, message),
            ]);
            log.error("promo asset job failed", {
                jobId: job.id,
                assetId: job.promo_asset_id,
                error: serializeError(error),
            });
        }
    }
    async updateJob(jobId, patch) {
        const { error } = await this.supabase.from("promo_asset_jobs").update(patch).eq("id", jobId);
        if (error)
            throw error;
    }
    async markAssetFailed(assetId, message) {
        const { error } = await this.supabase
            .from("promo_assets")
            .update({
            validation_status: "failed",
            approval_status: "rejected",
            rejection_reason: message,
            validation_details: {
                summary: message,
                processing_error: true,
            },
        })
            .eq("id", assetId);
        if (error)
            throw error;
    }
}
export async function registerPromoAssetWorker(worker) {
    await worker.start();
    return worker;
}
