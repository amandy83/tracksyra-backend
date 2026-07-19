import { enqueueWithDefaults } from "./queueFactory.js";
import { createJobTrace } from "./jobTypes.js";
import { queueNames } from "./queueNames.js";
function resolveReleaseId(job) {
    const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
    if (explicit)
        return explicit;
    const releaseId = job.release?.id;
    const fallback = typeof releaseId === "string" ? releaseId.trim() : releaseId?.value?.trim() ?? "";
    if (fallback)
        return fallback;
    throw new Error("Queue job releaseId is required.");
}
function withResolvedReleaseId(job, trace) {
    return { ...job, ...trace, releaseId: resolveReleaseId(job) };
}
export const QueueDispatcher = {
    enqueueDistribution(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `distribution:${job.distributionJob.id}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.distribution, "distribution.execute", { ...job, ...trace });
    },
    enqueueBackup(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `backup:${job.backupMode}:${job.requestedBy || "system"}:${job.scheduledFor || "immediate"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "system",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.backup, "backup.create", { ...job, ...trace });
    },
    enqueueIncrementalBackup(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `backup:incremental:${job.previousBackupId || "latest"}:${job.requestedBy || "system"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "system",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.incrementalBackup, "backup.incremental", { ...job, ...trace });
    },
    enqueueBackupVerification(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `backup:verify:${job.backupId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "system",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.backupVerification, "backup.verify", { ...job, ...trace });
    },
    enqueueRestore(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `backup:restore:${job.backupId}:${job.targetPointInTime || "latest"}:${job.simulate ?? true}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "system",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.restore, "backup.restore", { ...job, ...trace });
    },
    enqueueRecoveryAudit(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `backup:audit:${job.eventType || "recovery-plan-generated"}:${job.backupId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "system",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.recoveryAudit, "backup.audit", { ...job, ...trace });
    },
    enqueueRoyalty(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty:${job.input.trackId}:${job.input.eventId || "snapshot"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.royalty, "royalty.recalculate", { ...job, ...trace });
    },
    enqueueRoyaltyCalculation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-calc:${job.input.trackId || job.input.releaseId || "catalog"}:${job.input.periodStart || "all"}:${job.input.periodEnd || "all"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.royaltyCalculation, "royalty.calculate", { ...job, ...trace });
    },
    enqueueStatement(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-statement:${job.input.payeeId}:${job.input.periodStart}:${job.input.periodEnd}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.statement, "royalty.statement.generate", { ...job, ...trace });
    },
    enqueueCurrency(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-currency:${job.input.fromCurrency}:${job.input.toCurrency}:${job.input.amount}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.currency, "royalty.currency.convert", { ...job, ...trace });
    },
    enqueueTax(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-tax:${job.input.payeeId}:${job.input.amount}:${job.input.jurisdiction || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tax, "royalty.tax.calculate", { ...job, ...trace });
    },
    enqueueReserve(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-reserve:${job.input.payeeId}:${job.input.amount}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.reserve, "royalty.reserve.apply", { ...job, ...trace });
    },
    enqueueAdjustment(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-adjustment:${job.input.payeeId}:${job.input.adjustmentType}:${job.input.amount}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.adjustment, "royalty.adjustment.apply", { ...job, ...trace });
    },
    enqueuePayment(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-payment:${job.statementId}:${job.approverId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.payment, "royalty.payment.release", { ...job, ...trace });
    },
    enqueueForecast(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-forecast:${job.input.payeeId || "global"}:${job.input.currency}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.forecast, "royalty.forecast.generate", { ...job, ...trace });
    },
    enqueueRoyaltyAudit(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-audit:${job.currency}:${job.payeeId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "royalties",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.royaltyAudit, "royalty.audit.generate", { ...job, ...trace });
    },
    enqueueRoyaltyRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `royalty-retry:${job.queueName}:${job.jobId || "unknown"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.royaltyRetry, "royalty.retry", { ...job, ...trace });
    },
    enqueueFraud(job) {
        const entity = job.streamEvent?.event_id || job.royaltySpike?.trackId || job.distributionAnomaly?.trackId || "unknown";
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `fraud:${job.type}:${entity}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "fraud",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.fraud, "fraud.score", { ...job, ...trace });
    },
    enqueueAnalytics(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `analytics:${job.type}:${job.artistId || job.platform || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "analytics",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.analytics, "analytics.refresh", { ...job, ...trace });
    },
    enqueueReview(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `review:${job.releaseId}:${job.stage || "default"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "review",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.review, "review.enqueue", { ...job, ...trace });
    },
    enqueueRightsValidation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `rights-validation:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "rights",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.rightsValidation, "rights.validate", { ...job, ...trace });
    },
    enqueueValidation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `validation:${job.releaseId}:${job.validationType || "metadata"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "validation",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.validation, "validation.enqueue", { ...job, ...trace });
    },
    enqueueMetadataValidation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:validate:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "metadata",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataValidation, "metadata.validate", { ...job, ...trace });
    },
    enqueueMetadataNormalization(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:normalize:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "metadata",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataNormalization, "metadata.normalize", { ...job, ...trace });
    },
    enqueueMetadataRepair(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:repair:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "metadata",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataRepair, "metadata.repair", { ...job, ...trace });
    },
    enqueueMetadataRecommendation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:recommend:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "metadata",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataRecommendation, "metadata.recommend", { ...job, ...trace });
    },
    enqueueMetadataAudit(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:audit:${job.releaseId || "release"}:${job.trackId || job.reportKind || "report"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "metadata",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataAudit, "metadata.audit", { ...job, ...trace });
    },
    enqueueMetadataRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `metadata:retry:${job.releaseId}:${job.trackId || "release"}:${job.attempt || 0}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metadataRetry, "metadata.retry", { ...job, ...trace });
    },
    enqueueReleaseScheduler(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `release:schedule:${job.releaseId}:${job.trackId || "release"}:${String(job.scheduledFor ?? "")}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.releaseScheduler, "release.schedule", { ...job, ...trace });
    },
    enqueueDeliveryOrchestration(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:orchestrate:${job.releaseId}:${job.trackId || "release"}:${job.batchId || "batch"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deliveryOrchestration, "delivery.orchestrate", { ...job, ...trace });
    },
    enqueueDeliveryRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:retry:${job.releaseId}:${job.trackId || "release"}:${job.attempt || 0}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deliveryRetry, "delivery.retry", { ...job, ...trace });
    },
    enqueueRollback(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `release:rollback:${job.releaseId}:${job.trackId || "release"}:${job.packageId || "package"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.rollback, "release.rollback", { ...job, ...trace });
    },
    enqueueApproval(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `release:approval:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.approval, "release.approve", { ...job, ...trace });
    },
    enqueueAutomation(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `release:automation:${job.releaseId}:${job.trackId || "release"}:${job.ruleName || "rule"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.automation, "release.automate", { ...job, ...trace });
    },
    enqueueDeliveryAudit(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:audit:${job.releaseId || "release"}:${job.trackId || job.reportKind || "report"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deliveryAudit, "delivery.audit", { ...job, ...trace });
    },
    enqueueWebhookProcessing(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:webhook:${job.releaseId}:${job.trackId || "release"}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deliveryWebhook, "delivery.webhook", { ...job, ...trace });
    },
    enqueueSpotifyWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `spotify:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.spotifyWebhook, "spotify.webhook", { ...job, ...trace });
    },
    enqueueYouTubeDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubeDelivery, "youtubemusic.delivery", { ...job, ...trace });
    },
    enqueueYouTubePolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubePolling, "youtubemusic.polling", { ...job, ...trace });
    },
    enqueueYouTubeRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubeRetry, "youtubemusic.retry", { ...job, ...trace });
    },
    enqueueYouTubeWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubeWebhook, "youtubemusic.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueYouTubeHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubeHealth, "youtubemusic.health", withResolvedReleaseId(job, trace));
    },
    enqueueYouTubeContentId(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `youtube-music:content-id:${job.releaseId}:${job.operation || "sync"}:${job.assetId || job.claimId || "asset"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.youtubeContentId, "youtubemusic.content-id", withResolvedReleaseId(job, trace));
    },
    enqueueAmazonMusicDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `amazon-music:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.amazonMusicDelivery, "amazonmusic.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueAmazonMusicPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `amazon-music:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.amazonMusicPolling, "amazonmusic.polling", withResolvedReleaseId(job, trace));
    },
    enqueueAmazonMusicRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `amazon-music:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.amazonMusicRetry, "amazonmusic.retry", withResolvedReleaseId(job, trace));
    },
    enqueueAmazonMusicWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `amazon-music:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.amazonMusicWebhook, "amazonmusic.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueAmazonMusicHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `amazon-music:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.amazonMusicHealth, "amazonmusic.health", withResolvedReleaseId(job, trace));
    },
    enqueueDeezerDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `deezer:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deezerDelivery, "deezer.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueDeezerPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `deezer:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deezerPolling, "deezer.polling", withResolvedReleaseId(job, trace));
    },
    enqueueDeezerRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `deezer:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deezerRetry, "deezer.retry", withResolvedReleaseId(job, trace));
    },
    enqueueDeezerWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `deezer:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deezerWebhook, "deezer.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueDeezerHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `deezer:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deezerHealth, "deezer.health", withResolvedReleaseId(job, trace));
    },
    enqueueTidalDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tidal:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tidalDelivery, "tidal.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueTidalPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tidal:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tidalPolling, "tidal.polling", withResolvedReleaseId(job, trace));
    },
    enqueueTidalRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tidal:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tidalRetry, "tidal.retry", withResolvedReleaseId(job, trace));
    },
    enqueueTidalWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tidal:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tidalWebhook, "tidal.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueTidalHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tidal:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tidalHealth, "tidal.health", withResolvedReleaseId(job, trace));
    },
    enqueueJioSaavnDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `jio-saavn:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.jioSaavnDelivery, "jiosaavn.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueJioSaavnPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `jio-saavn:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.jioSaavnPolling, "jiosaavn.polling", withResolvedReleaseId(job, trace));
    },
    enqueueJioSaavnRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `jio-saavn:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.jioSaavnRetry, "jiosaavn.retry", withResolvedReleaseId(job, trace));
    },
    enqueueJioSaavnWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `jio-saavn:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.jioSaavnWebhook, "jiosaavn.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueJioSaavnHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `jio-saavn:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.jioSaavnHealth, "jiosaavn.health", withResolvedReleaseId(job, trace));
    },
    enqueueAnghamiDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `anghami:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.anghamiDelivery, "anghami.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueAnghamiPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `anghami:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.anghamiPolling, "anghami.polling", withResolvedReleaseId(job, trace));
    },
    enqueueAnghamiRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `anghami:retry:${job.releaseId}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.anghamiRetry, "anghami.retry", withResolvedReleaseId(job, trace));
    },
    enqueueAnghamiWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `anghami:webhook:${job.releaseId}:${job.eventType}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.anghamiWebhook, "anghami.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueAnghamiHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `anghami:health:${job.releaseId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.anghamiHealth, "anghami.health", withResolvedReleaseId(job, trace));
    },
    enqueueBoomplayDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `boomplay:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.boomplayDelivery, "boomplay.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueBoomplayPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `boomplay:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.boomplayPolling, "boomplay.polling", withResolvedReleaseId(job, trace));
    },
    enqueueBoomplayRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `boomplay:retry:${job.releaseId}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.boomplayRetry, "boomplay.retry", withResolvedReleaseId(job, trace));
    },
    enqueueBoomplayWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `boomplay:webhook:${job.releaseId}:${job.eventType}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.boomplayWebhook, "boomplay.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueBoomplayHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `boomplay:health:${job.releaseId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.boomplayHealth, "boomplay.health", withResolvedReleaseId(job, trace));
    },
    enqueueTikTokDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tiktok:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tiktokDelivery, "tiktok.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueTikTokPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tiktok:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tiktokPolling, "tiktok.polling", withResolvedReleaseId(job, trace));
    },
    enqueueTikTokRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tiktok:retry:${job.releaseId}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tiktokRetry, "tiktok.retry", withResolvedReleaseId(job, trace));
    },
    enqueueTikTokWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tiktok:webhook:${job.releaseId}:${job.eventType}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tiktokWebhook, "tiktok.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueTikTokHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `tiktok:health:${job.releaseId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.tiktokHealth, "tiktok.health", withResolvedReleaseId(job, trace));
    },
    enqueueMetaDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `meta:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metaDelivery, "meta.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueMetaPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `meta:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metaPolling, "meta.polling", withResolvedReleaseId(job, trace));
    },
    enqueueMetaRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `meta:retry:${job.releaseId}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metaRetry, "meta.retry", withResolvedReleaseId(job, trace));
    },
    enqueueMetaWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `meta:webhook:${job.releaseId}:${job.eventType}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metaWebhook, "meta.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueMetaHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `meta:health:${job.releaseId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.metaHealth, "meta.health", withResolvedReleaseId(job, trace));
    },
    enqueueAppleMusicDelivery(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `apple-music:delivery:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.appleMusicDelivery, "applemusic.delivery", withResolvedReleaseId(job, trace));
    },
    enqueueAppleMusicPolling(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `apple-music:polling:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.appleMusicPolling, "applemusic.polling", withResolvedReleaseId(job, trace));
    },
    enqueueAppleMusicRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `apple-music:retry:${job.releaseId}:${job.trackId || "release"}:${job.deliveryQueueId || "queue"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.appleMusicRetry, "applemusic.retry", withResolvedReleaseId(job, trace));
    },
    enqueueAppleMusicWebhook(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `apple-music:webhook:${job.releaseId}:${job.eventType}:${job.source || "source"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.appleMusicWebhook, "applemusic.webhook", withResolvedReleaseId(job, trace));
    },
    enqueueAppleMusicHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `apple-music:health:${job.releaseId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.appleMusicHealth, "applemusic.health", withResolvedReleaseId(job, trace));
    },
    enqueueDeliveryHealth(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:health:${job.releaseId || "release"}:${job.trackId || "track"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.deliveryHealth, "delivery.health", { ...job, ...trace });
    },
    enqueueSla(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `delivery:sla:${job.releaseId || "release"}:${job.trackId || "track"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "distribution",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.sla, "delivery.sla", { ...job, ...trace });
    },
    enqueueRealtime(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `realtime:${job.type}:${job.event?.event_id || job.artistId || "global"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId,
            sourceSystem: job.sourceSystem || "realtime",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.realtime, "realtime.publish", { ...job, ...trace });
    },
    enqueueMediaProcessing(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `media:audio:${job.input.assetId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.input.userId,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.mediaProcessing, "media.audio.process", { ...job, ...trace });
    },
    enqueueArtworkProcessing(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `media:artwork:${job.input.assetId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.input.userId,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.artworkProcessing, "media.artwork.process", { ...job, ...trace });
    },
    enqueueWaveformGeneration(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `media:waveform:${job.input.assetId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.input.userId,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.waveformGeneration, "media.waveform.generate", { ...job, ...trace });
    },
    enqueueFingerprintAnalysis(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `media:fingerprint:${job.input.assetId}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.input.userId,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.fingerprintAnalysis, "media.fingerprint.analyze", { ...job, ...trace });
    },
    enqueueFingerprint(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `fingerprint:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.fingerprint, "fingerprint.generate", withResolvedReleaseId(job, trace));
    },
    enqueueDuplicateDetection(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `duplicate:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.duplicate, "fingerprint.duplicate", withResolvedReleaseId(job, trace));
    },
    enqueueSimilarity(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `similarity:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "media",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.similarity, "fingerprint.similarity", withResolvedReleaseId(job, trace));
    },
    enqueueAudioFraud(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `audio-fraud:${job.releaseId}:${job.trackId || "release"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "fraud",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.audioFraud, "fingerprint.fraud", withResolvedReleaseId(job, trace));
    },
    enqueueFingerprintRetry(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `fingerprint-retry:${job.releaseId}:${job.trackId || "release"}:${job.attempt || 0}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.fingerprintRetry, "fingerprint.retry", withResolvedReleaseId(job, trace));
    },
    enqueueFingerprintAudit(job) {
        const trace = createJobTrace({
            idempotencyKey: job.idempotencyKey || `fingerprint-audit:${job.releaseId || "release"}:${job.fingerprintId || "report"}`,
            traceId: job.traceId,
            correlationId: job.correlationId,
            actorUserId: job.actorUserId ?? job.release?.userId ?? null,
            sourceSystem: job.sourceSystem || "worker",
            createdAt: job.createdAt,
        });
        return enqueueWithDefaults(queueNames.fingerprintAudit, "fingerprint.audit", { ...job, ...trace });
    },
};
