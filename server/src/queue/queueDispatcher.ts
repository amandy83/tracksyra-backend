import { enqueueWithDefaults } from "./queueFactory";
import { createJobTrace, type AnalyticsJob, type AmazonMusicDeliveryJob, type AmazonMusicHealthJob, type AmazonMusicPollingJob, type AmazonMusicRetryJob, type AmazonMusicWebhookJob, type AnghamiDeliveryJob, type AnghamiHealthJob, type AnghamiPollingJob, type AnghamiRetryJob, type AnghamiWebhookJob, type AppleMusicDeliveryJob, type AppleMusicHealthJob, type AppleMusicPollingJob, type AppleMusicRetryJob, type AppleMusicWebhookJob, type ArtworkProcessingJob, type AudioFraudJob, type BackupJob, type BackupVerificationJob, type BoomplayDeliveryJob, type BoomplayHealthJob, type BoomplayPollingJob, type BoomplayRetryJob, type BoomplayWebhookJob, type DeezerDeliveryJob, type DeezerHealthJob, type DeezerPollingJob, type DeezerRetryJob, type DeezerWebhookJob, type DeliveryAuditJob, type DeliveryHealthJob, type DeliveryOrchestrationJob, type DeliveryRetryJob, type DeliveryRollbackJob, type DistributionJob, type DuplicateDetectionJob, type FingerprintAnalysisJob, type FingerprintAuditJob, type FingerprintJob, type FingerprintRetryJob, type FraudJob, type IncrementalBackupJob, type JioSaavnDeliveryJob, type JioSaavnHealthJob, type JioSaavnPollingJob, type JioSaavnRetryJob, type JioSaavnWebhookJob, type JobTrace, type MediaProcessingJob, type MetaDeliveryJob, type MetaHealthJob, type MetaPollingJob, type MetaRetryJob, type MetaWebhookJob, type MetadataAuditJob, type MetadataNormalizationJob, type MetadataRecommendationJob, type MetadataRepairJob, type MetadataRetryJob, type MetadataValidationJob, type RecoveryAuditJob, type ReleaseApprovalJob, type ReleaseAutomationJob, type ReleaseSchedulerJob, type RealtimeJob, type ReviewQueueJob, type RestoreJob, type RightsQueueJob, type RoyaltyAdjustmentJob, type RoyaltyAuditJob, type RoyaltyCalculationJob, type RoyaltyCurrencyJob, type RoyaltyForecastJob, type RoyaltyJob, type RoyaltyPaymentJob, type RoyaltyReserveJob, type RoyaltyRetryJob, type RoyaltyStatementJob, type RoyaltyTaxJob, type SlaJob, type SimilarityJob, type SpotifyWebhookJob, type TidalDeliveryJob, type TidalHealthJob, type TidalPollingJob, type TidalRetryJob, type TidalWebhookJob, type TikTokDeliveryJob, type TikTokHealthJob, type TikTokPollingJob, type TikTokRetryJob, type TikTokWebhookJob, type ValidationQueueJob, type WebhookProcessingJob, type WaveformGenerationJob, type YouTubeContentIdJob, type YouTubeDeliveryJob, type YouTubeHealthJob, type YouTubePollingJob, type YouTubeRetryJob, type YouTubeWebhookJob } from "./jobTypes";
import { queueNames } from "./queueNames";

function resolveReleaseId(job: { releaseId?: string | null; release?: { id?: string | { value?: string | null } | null } | null }): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  const fallback = typeof releaseId === "string" ? releaseId.trim() : releaseId?.value?.trim() ?? "";
  if (fallback) return fallback;
  throw new Error("Queue job releaseId is required.");
}

function withResolvedReleaseId<T extends { releaseId?: string | null; release?: { id?: string | { value?: string | null } | null } | null }>(job: T, trace: JobTrace): T & JobTrace & { releaseId: string } {
  return { ...job, ...trace, releaseId: resolveReleaseId(job) };
}

export const QueueDispatcher = {
  enqueueDistribution(job: Omit<DistributionJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBackup(job: Omit<BackupJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueIncrementalBackup(job: Omit<IncrementalBackupJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBackupVerification(job: Omit<BackupVerificationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRestore(job: Omit<RestoreJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRecoveryAudit(job: Omit<RecoveryAuditJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRoyalty(job: Omit<RoyaltyJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRoyaltyCalculation(job: Omit<RoyaltyCalculationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueStatement(job: Omit<RoyaltyStatementJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueCurrency(job: Omit<RoyaltyCurrencyJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTax(job: Omit<RoyaltyTaxJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueReserve(job: Omit<RoyaltyReserveJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAdjustment(job: Omit<RoyaltyAdjustmentJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueuePayment(job: Omit<RoyaltyPaymentJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueForecast(job: Omit<RoyaltyForecastJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRoyaltyAudit(job: Omit<RoyaltyAuditJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRoyaltyRetry(job: Omit<RoyaltyRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueFraud(job: Omit<FraudJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnalytics(job: Omit<AnalyticsJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueReview(job: Omit<ReviewQueueJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRightsValidation(job: Omit<RightsQueueJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueValidation(job: Omit<ValidationQueueJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataValidation(job: Omit<MetadataValidationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataNormalization(job: Omit<MetadataNormalizationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataRepair(job: Omit<MetadataRepairJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataRecommendation(job: Omit<MetadataRecommendationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataAudit(job: Omit<MetadataAuditJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetadataRetry(job: Omit<MetadataRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueReleaseScheduler(job: Omit<ReleaseSchedulerJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeliveryOrchestration(job: Omit<DeliveryOrchestrationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeliveryRetry(job: Omit<DeliveryRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRollback(job: Omit<DeliveryRollbackJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueApproval(job: Omit<ReleaseApprovalJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAutomation(job: Omit<ReleaseAutomationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeliveryAudit(job: Omit<DeliveryAuditJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueWebhookProcessing(job: Omit<WebhookProcessingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueSpotifyWebhook(job: Omit<SpotifyWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubeDelivery(job: Omit<YouTubeDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubePolling(job: Omit<YouTubePollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubeRetry(job: Omit<YouTubeRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubeWebhook(job: Omit<YouTubeWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubeHealth(job: Omit<YouTubeHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueYouTubeContentId(job: Omit<YouTubeContentIdJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAmazonMusicDelivery(job: Omit<AmazonMusicDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAmazonMusicPolling(job: Omit<AmazonMusicPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAmazonMusicRetry(job: Omit<AmazonMusicRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAmazonMusicWebhook(job: Omit<AmazonMusicWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAmazonMusicHealth(job: Omit<AmazonMusicHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeezerDelivery(job: Omit<DeezerDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeezerPolling(job: Omit<DeezerPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeezerRetry(job: Omit<DeezerRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeezerWebhook(job: Omit<DeezerWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeezerHealth(job: Omit<DeezerHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTidalDelivery(job: Omit<TidalDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTidalPolling(job: Omit<TidalPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTidalRetry(job: Omit<TidalRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTidalWebhook(job: Omit<TidalWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTidalHealth(job: Omit<TidalHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueJioSaavnDelivery(job: Omit<JioSaavnDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueJioSaavnPolling(job: Omit<JioSaavnPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueJioSaavnRetry(job: Omit<JioSaavnRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueJioSaavnWebhook(job: Omit<JioSaavnWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueJioSaavnHealth(job: Omit<JioSaavnHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnghamiDelivery(job: Omit<AnghamiDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnghamiPolling(job: Omit<AnghamiPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnghamiRetry(job: Omit<AnghamiRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnghamiWebhook(job: Omit<AnghamiWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAnghamiHealth(job: Omit<AnghamiHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBoomplayDelivery(job: Omit<BoomplayDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBoomplayPolling(job: Omit<BoomplayPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBoomplayRetry(job: Omit<BoomplayRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBoomplayWebhook(job: Omit<BoomplayWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueBoomplayHealth(job: Omit<BoomplayHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTikTokDelivery(job: Omit<TikTokDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTikTokPolling(job: Omit<TikTokPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTikTokRetry(job: Omit<TikTokRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTikTokWebhook(job: Omit<TikTokWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueTikTokHealth(job: Omit<TikTokHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetaDelivery(job: Omit<MetaDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetaPolling(job: Omit<MetaPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetaRetry(job: Omit<MetaRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetaWebhook(job: Omit<MetaWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMetaHealth(job: Omit<MetaHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAppleMusicDelivery(job: Omit<AppleMusicDeliveryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAppleMusicPolling(job: Omit<AppleMusicPollingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAppleMusicRetry(job: Omit<AppleMusicRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAppleMusicWebhook(job: Omit<AppleMusicWebhookJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAppleMusicHealth(job: Omit<AppleMusicHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDeliveryHealth(job: Omit<DeliveryHealthJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueSla(job: Omit<SlaJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueRealtime(job: Omit<RealtimeJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueMediaProcessing(job: Omit<MediaProcessingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueArtworkProcessing(job: Omit<ArtworkProcessingJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueWaveformGeneration(job: Omit<WaveformGenerationJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueFingerprintAnalysis(job: Omit<FingerprintAnalysisJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueFingerprint(job: Omit<FingerprintJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueDuplicateDetection(job: Omit<DuplicateDetectionJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueSimilarity(job: Omit<SimilarityJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueAudioFraud(job: Omit<AudioFraudJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueFingerprintRetry(job: Omit<FingerprintRetryJob, keyof JobTrace> & Partial<JobTrace>) {
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

  enqueueFingerprintAudit(job: Omit<FingerprintAuditJob, keyof JobTrace> & Partial<JobTrace>) {
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
