import { BootstrapResult, DependencyGraph, ModuleDescriptor, ServiceDescriptor, } from "./types/compositionTypes.js";
import { DEFAULT_COMPOSITION_MODULE_ORDER } from "./types/compositionTypes.js";
import { BullMQQueueFactory, BullMQQueueRegistry } from "../queue/integration/bullmq/index.js";
import { DistributionQueueDispatcher } from "../queue/integration/queueBridge.js";
import { registerDistributionExecutionStages } from "../execution/wiring/executionWiring.js";
import { ExecutionStageRegistry } from "../execution/stages/stages.js";
import { DistributionWorkerConfigurationProvider, DistributionWorkerExecutor, DistributionWorkerFactory, DistributionWorkerHealthChecker, DistributionWorkerLogger, DistributionWorkerMetricsCollector, DistributionWorkerRegistry, DistributionWorkerRuntime, } from "../runtime/integration/index.js";
import { TrackSyraDspRuntimeEngine, TrackSyraDspRuntimeStore, TrackSyraDspRegistry, TrackSyraDspIntegrationRegistryFacade, TrackSyraDspFactory, TrackSyraDspResolver, TrackSyraDspRouter, TrackSyraDspLifecycleManager, TrackSyraDspAuthenticationManager, TrackSyraDspSessionManager, TrackSyraDspCredentialManager, TrackSyraDspCapabilityResolver, TrackSyraDspSelector, TrackSyraDspHealthManager, TrackSyraDspUploadManager, TrackSyraDspAssetManager, TrackSyraDspMetadataManager, TrackSyraDspCatalogManager, TrackSyraDspStatusManager, TrackSyraDspWebhookManager, TrackSyraDspPollingManager, TrackSyraDspRoyaltyManager, TrackSyraDspReportManager, TrackSyraDspTakedownManager, TrackSyraDspRateLimitManager, TrackSyraDspRetryManager, TrackSyraDspMetricsCollector, TrackSyraDspLogger, TrackSyraDspConfigurationProvider, TrackSyraDspEventPublisher, } from "../provider-integration/runtime/index.js";
import { ExponentialProviderRetryStrategy } from "../providers/providerRetryStrategy.js";
import { ProviderStatusMapper } from "../providers/providerStatusMapper.js";
import { DefaultConnectorResolver, InMemoryConnectorRegistry, OFFICIAL_DSP_CONNECTORS, OfficialDspConnectorFactory, } from "../connectors/index.js";
import { PlatformAdapterRegistry } from "../adapters/platformAdapterRegistry.js";
import { TooLostAdapter } from "../providers/too-lost/tooLostAdapter.js";
import { OFFICIAL_DSP_PARTNERS, PartnerOnboardingRuntimeEngine, PartnerOnboardingRegistry, PartnerOnboardingCredentialsStore, PartnerOnboardingDocumentationRegistry, PartnerOnboardingActivationResolver, TrackSyraPartnerOnboardingRuntime, } from "../partner-onboarding/index.js";
import { AuthenticationContext, CredentialAudit, CredentialAuditPublisher, CredentialAccessPolicy, CredentialBinding, CredentialConfiguration, CredentialBackupManager, CredentialDecryptor, CredentialEncryptor, CredentialExecutionScope, CredentialFactory, CredentialHealthPublisher, CredentialHealthChecker, CredentialInjectionPipeline, CredentialLogger, CredentialMetrics, CredentialMetricsPublisher, CredentialRecoveryManager, CredentialRefreshCoordinator, CredentialRegistry, CredentialResolverMiddleware, CredentialResolver, CredentialRotator, CredentialVersionBinding, CredentialVersionManager, CredentialVersionPinning, CredentialRotationPolicy, CredentialValidator, CredentialVault, CredentialExpiryGuard, CredentialRevocationGuard, CredentialConsistencyValidator, createTrackSyraCredentialService, CredentialSerializer, } from "../partner-credentials/index.js";
import { TrackSyraConflictResolver, TrackSyraPollingDispatcher, TrackSyraPollingExecutor, TrackSyraPollingHealthMonitor, TrackSyraPollingProcessor, TrackSyraPollingRegistry, TrackSyraPollingStrategyResolver, TrackSyraProjectionUpdater, TrackSyraReconciliationEngine, TrackSyraStatusEventPublisher, TrackSyraStatusMapper, TrackSyraStatusLogger, TrackSyraStatusMetrics, TrackSyraStatusScheduler, TrackSyraStatusNormalizer, TrackSyraTimelineUpdater, TrackSyraTransitionValidator, TrackSyraWebhookAuthenticationVerifier, TrackSyraWebhookAuditLogger, TrackSyraWebhookDeadLetterRouter, TrackSyraWebhookDispatcher, TrackSyraWebhookEventParser, TrackSyraWebhookDuplicateDetector, TrackSyraWebhookFailureRecovery, TrackSyraWebhookEventOrdering, TrackSyraWebhookPayloadValidator, TrackSyraWebhookProcessor, TrackSyraWebhookReceiver, TrackSyraWebhookRegistry, TrackSyraWebhookRetryQueue, TrackSyraWebhookReplayProtection, TrackSyraWebhookRouter, TrackSyraWebhookSignatureVerifier, TrackSyraWebhookValidator, TrackSyraStatusSyncRuntimeEngine, } from "../status-sync/runtime/index.js";
import { DistributionStatusSyncEngineBridge } from "../status-sync/statusSyncBridge.js";
import { ProjectionPublisher, StateHistoryManager, StateRegistry, StateSnapshotManager, StateSyncRuntimeEngine, StateVersionManager, TimelineBuilder, TimelinePublisher, } from "../status-sync/stateSyncRuntime.js";
import { AdjustmentManager as RoyaltyAdjustmentManager, ArtistStatements as RoyaltyArtistStatements, AnalyticsPublisher as RoyaltyAnalyticsPublisher, AuditTrail as RoyaltyAuditTrail, BatchImportEngine as RoyaltyBatchImportEngine, ConflictResolver as RoyaltyConflictResolver, CurrencyConversionEngine as RoyaltyCurrencyConversionEngine, CurrencyNormalizer as RoyaltyCurrencyNormalizer, DefaultExchangeRateProvider as RoyaltyExchangeRateProvider, DefaultTaxCalculator as RoyaltyTaxCalculator, DistributorReports as RoyaltyDistributorReports, DuplicateDetection as RoyaltyDuplicateDetection, FinancialHistory as RoyaltyFinancialHistory, HoldManager as RoyaltyHoldManager, IncrementalImport as RoyaltyIncrementalImport, ImportRecovery as RoyaltyImportRecovery, LabelStatements as RoyaltyLabelStatements, LedgerBuilder as RoyaltyLedgerBuilder, ManualImport as RoyaltyManualImport, ProductNormalizer as RoyaltyProductNormalizer, ReportImportManager as RoyaltyReportImportManager, ReportNormalizer as RoyaltyReportNormalizer, ReportParser as RoyaltyReportParser, RevenueAllocator as RoyaltyRevenueAllocator, RevenueCalculator as RoyaltyRevenueCalculator, RevenueDashboard as RoyaltyRevenueDashboard, RoyaltyHealthChecker as RoyaltyHealthChecker, RoyaltyLifecycleManager as RoyaltyLifecycleManager, RoyaltyLogger as RoyaltyLogger, RoyaltyMetrics as RoyaltyMetrics, RoyaltyReconciliationEngine as RoyaltyReconciliationEngine, RoyaltyRegistry as RoyaltyRegistry, RoyaltyResolver as RoyaltyResolver, RoyaltyCoordinator as RoyaltyCoordinator, RoyaltyRuntimeEngine as RoyaltyRuntimeEngine, ScheduledImport as RoyaltyScheduledImport, SettlementManager as RoyaltySettlementManager, StatementGenerator as RoyaltyStatementGenerator, TerritoryNormalizer as RoyaltyTerritoryNormalizer, VersionManager as RoyaltyVersionManager, } from "../royalty/runtime/index.js";
import { AlertDispatcher, AlertEngine, AlertRules, AuditLogManager, BottleneckDetector, ComponentHealthRegistry, CorrelationIdManager, CPUAnalyzer, DeadlockDetection, DependencyDiagnostics, DiagnosticRuntime, DistributedTraceRuntime, DistributionDashboard, ErrorLogManager, EscalationPolicies, FailureAnalyzer, ConfigurationValidator, HealthRuntime, HealthRuntimeReporter, IncidentTimeline, LogAggregator, LogContextManager, LogRouter, MemoryAnalyzer, RuntimeCounters, ParentChildSpanResolver, MetricsRegistry, Gauges, Histograms, MetricsRuntime, ObservabilityEventPublisherFacade, LivenessEngine, PipelineTraceBuilder, PipelinePerformanceAnalyzer, ProviderDashboard, QueueDashboard, QueueMetrics as ObservabilityQueueMetrics, QueuePerformanceMonitor, ReadinessEngine, RequestIdGenerator, RuntimeDashboard, RuntimeIncidentManager, RuntimeLogSink, RuntimeMonitoringReporter, RuntimeProfiler, RuntimeStatistics, RuntimeDiagnostics, ObservabilityRuntime, RoyaltyDashboard, RoyaltyMetrics as ObservabilityRoyaltyMetrics, SecurityLogManager, StateSyncDashboard, StateSyncMetrics as ObservabilityStateSyncMetrics, StructuredLogger, SystemDashboard, StartupValidator, Timers, RecoveryAnalyzer, ShutdownValidator, SpanManager, ThroughputAnalyzer, RuntimeTracePublisher, WorkerDashboard, WorkerMetrics as ObservabilityWorkerMetrics, WorkerPerformanceMonitor, DSPRuntimeMetrics as ObservabilityDSPRuntimeMetrics, WorkflowMetrics as ObservabilityWorkflowMetrics, DependencyHealthAnalyzer, } from "../observability/runtime/index.js";
import { DspProtocolActivationGuard, DspProtocolCompressionService, DspProtocolErrorParser, DspProtocolManifestBuilder, DspProtocolProtocolHealthChecker, DspProtocolRateLimiter, DspProtocolRegistryImpl, DspProtocolRequestBuilder, DspProtocolResolverImpl, DspProtocolResponseParser, DspProtocolRuntimeFacade, DspProtocolRuntimeImpl, DspProtocolRuntimeLogger, DspProtocolRuntimeMetrics, DspProtocolRetryEngine, DspProtocolSignatureValidator, DspProtocolSessionManager, DspProtocolStatusParser, createTrackSyraDspProtocolRuntime } from "../dsp-runtime/index.js";
import { SpecificationAudit, SpecificationCache, SpecificationCapabilityResolver, SpecificationCompatibilityChecker, SpecificationConfiguration, SpecificationEnvironmentResolver, SpecificationHealthChecker, SpecificationIntegrityValidator, SpecificationLoader, SpecificationLogger, SpecificationMetrics, SpecificationParser, SpecificationRegistry, SpecificationRepository, SpecificationResolver, SpecificationSchemaValidator, SpecificationSerializer, SpecificationSignatureValidator, SpecificationRetryPolicy, SpecificationValidator, SpecificationVersionManager, SpecificationActivationManager, } from "../dsp-specification/index.js";
import { createTrackSyraDeliveryRuntime } from "../runtime/delivery/index.js";
import { createPublishingStandardsRuntime } from "../publishing/index.js";
import { BackupDisasterRecoveryService } from "../backup/index.js";
import { createEnterpriseRightsRuntime, registerRightsAuditQueueWorker, registerRightsConflictQueueWorker, registerRightsLicenseExpirationQueueWorker, registerRightsTerritorySyncQueueWorker, registerRightsValidationQueueWorker, registerRightsWithdrawalQueueWorker, } from "../rights/index.js";
import { HealthStatus } from "../observability/health/healthStatus.js";
import { ValidationRuntimeEngine } from "../validation/runtime/index.js";
import * as ValidationValidators from "../validation/runtime/validationValidators.js";
import { ValidationCoordinatorImpl, ValidationPipelineImpl, ValidationRegistryImpl, ValidationSchedulerImpl, ValidationSerializer, RuntimeValidationLogger, RuntimeValidationMetrics, } from "../validation/index.js";
import { ValidationConfiguration } from "../validation/configuration/validationConfiguration.js";
import { distributionPersistenceBasePath } from "../infrastructure/repositories/persistencePaths.js";
import { DefaultCheckpointOwnership, DefaultDistributedLeaderElection, DefaultDuplicateExecutionPrevention, DefaultExecutionFencing, DefaultExecutionTokenService, DefaultHeartbeatOwnership, DefaultLeaseOwnership, DefaultRecoveryOwnership, DefaultStaleLeaseDetection, DefaultWorkerOwnership, DefaultStorageEngine, DefaultStorageFactory, DefaultStorageHealthChecker, DefaultStorageLogger, DefaultStorageMetrics, DefaultStorageRegistry, AdapterStorageRepository, FileStorageAdapter, JsonStorageSerializer, } from "../infrastructure/storage/index.js";
import { RuntimeRepository } from "../infrastructure/repositories/runtime/index.js";
import { createClient } from "@supabase/supabase-js";
import { createLogger } from "../../observability/logger.js";
import { loadRuntimeEnv } from "../../config/envLoader.js";
import { WorkerRuntime as QueueWorkerRuntimeClass, createQueueSchedulers } from "../../workers/runtime/workerRuntime.js";
import { WorkerSupervisor } from "../../workers/runtime/workerSupervisor.js";
import { registerEmailWorker } from "../../workers/email/emailWorker.js";
import { registerRoyaltyWorker } from "../../workers/royalties/royaltyWorker.js";
import { registerAdjustmentWorker as registerRoyaltyAdjustmentWorker, registerCurrencyWorker as registerRoyaltyCurrencyWorker, registerForecastWorker as registerRoyaltyForecastWorker, registerPaymentWorker as registerRoyaltyPaymentWorker, registerRoyaltyAuditWorker, registerRoyaltyCalculationWorker, registerRoyaltyRetryWorker, registerReserveWorker as registerRoyaltyReserveWorker, registerStatementWorker, registerTaxWorker as registerRoyaltyTaxWorker, } from "../../workers/royalties/royaltyAccountingWorkers.js";
import { registerFraudWorker } from "../../workers/fraud/fraudWorker.js";
import { registerAnalyticsWorker } from "../../workers/analytics/analyticsWorker.js";
import { registerRealtimeWorker } from "../../workers/realtime/realtimeWorker.js";
import { registerMediaProcessingWorker, registerArtworkProcessingWorker, registerWaveformGenerationWorker, registerFingerprintAnalysisWorker } from "../../media/workers/mediaWorkers.js";
import { PromoAssetWorker, registerPromoAssetWorker } from "../../workers/promoAssetWorker.js";
import { registerAuditQueueWorker, registerDeliveryQueueWorker, registerFraudReviewQueueWorker, registerReviewQueueWorker, registerRetryQueueWorker, registerTakedownQueueWorker, registerValidationQueueWorker, registerWithdrawalQueueWorker } from "../../workers/enterprise/enterpriseWorkers.js";
import { registerBackupWorker, registerBackupVerificationWorker, registerIncrementalBackupWorker, registerRecoveryAuditWorker, registerRestoreWorker } from "../../workers/enterprise/backupWorkers.js";
import { registerDuplicateDetectionWorker, registerFingerprintAuditWorker, registerFingerprintRetryWorker, registerFingerprintWorker, registerFraudAudioWorker, registerSimilarityWorker } from "../../workers/fingerprinting/fingerprintWorkers.js";
import { registerMetadataAuditWorker, registerMetadataNormalizationWorker, registerMetadataRecommendationWorker, registerMetadataRepairWorker, registerMetadataRetryWorker, registerMetadataValidationWorker } from "../../workers/metadata/metadataWorkers.js";
import { ReleaseAutomationEngine } from "../workflow/releaseAutomationEngine.js";
import { PackageAssets, PackageAudit, PackageBuilder, PackageComparator, PackageDirector, PackageFingerprint, PackageIntegrity, PackageLayout, PackageMetadata, PackageMetrics, PackageSerializer, PackageStreamWriter, PackageValidator, PackageVersionInfo, } from "../packaging/index.js";
import { ReleaseDeliveryEngine } from "../core/releaseDeliveryEngine.js";
import { ChecksumGenerator } from "../core/checksumGenerator.js";
import { DSPConnectorFramework, createConnectorCapabilityMatrix, AmazonMusicEnterpriseService, DeezerEnterpriseService, JioSaavnEnterpriseService, AnghamiEnterpriseService, BoomplayEnterpriseService, TikTokEnterpriseService, MetaRightsEnterpriseService, TidalEnterpriseService, YouTubeEnterpriseService } from "../connectors/framework/index.js";
import { registerDeliveryAuditWorker, registerDeliveryHealthWorker, registerDeliveryOrchestratorWorker, registerDeliveryRollbackWorker, registerDeliveryRetryWorker, registerReleaseApprovalWorker, registerReleaseAutomationWorker, registerReleaseSchedulerWorker, registerSLAWorker, registerWebhookProcessingWorker, } from "../../workers/release-automation/releaseAutomationWorkers.js";
import { registerAmazonMusicDeliveryWorker, registerAmazonMusicHealthWorker, registerAmazonMusicPollingWorker, registerAmazonMusicRetryWorker, registerAmazonMusicWebhookWorker, AmazonMusicDeliveryWorker, AmazonMusicHealthWorker, AmazonMusicPollingWorker, AmazonMusicRetryWorker, AmazonMusicWebhookWorker, } from "../../workers/dsp/amazonMusicWorkers.js";
import { registerDeezerDeliveryWorker, registerDeezerHealthWorker, registerDeezerPollingWorker, registerDeezerRetryWorker, registerDeezerWebhookWorker, DeezerDeliveryWorker, DeezerHealthWorker, DeezerPollingWorker, DeezerRetryWorker, DeezerWebhookWorker, } from "../../workers/dsp/deezerMusicWorkers.js";
import { registerJioSaavnDeliveryWorker, registerJioSaavnHealthWorker, registerJioSaavnPollingWorker, registerJioSaavnRetryWorker, registerJioSaavnWebhookWorker, JioSaavnDeliveryWorker, JioSaavnHealthWorker, JioSaavnPollingWorker, JioSaavnRetryWorker, JioSaavnWebhookWorker, } from "../../workers/dsp/jioSaavnWorkers.js";
import { registerAnghamiDeliveryWorker, registerAnghamiHealthWorker, registerAnghamiPollingWorker, registerAnghamiRetryWorker, registerAnghamiWebhookWorker, AnghamiDeliveryWorker, AnghamiHealthWorker, AnghamiPollingWorker, AnghamiRetryWorker, AnghamiWebhookWorker, } from "../../workers/dsp/anghamiWorkers.js";
import { registerBoomplayDeliveryWorker, registerBoomplayHealthWorker, registerBoomplayPollingWorker, registerBoomplayRetryWorker, registerBoomplayWebhookWorker, BoomplayDeliveryWorker, BoomplayHealthWorker, BoomplayPollingWorker, BoomplayRetryWorker, BoomplayWebhookWorker, } from "../../workers/dsp/boomplayWorkers.js";
import { registerTikTokDeliveryWorker, registerTikTokHealthWorker, registerTikTokPollingWorker, registerTikTokRetryWorker, registerTikTokWebhookWorker, TikTokDeliveryWorker, TikTokHealthWorker, TikTokPollingWorker, TikTokRetryWorker, TikTokWebhookWorker, } from "../../workers/dsp/tiktokWorkers.js";
import { registerMetaDeliveryWorker, registerMetaHealthWorker, registerMetaPollingWorker, registerMetaRetryWorker, registerMetaWebhookWorker, MetaDeliveryWorker, MetaHealthWorker, MetaPollingWorker, MetaRetryWorker, MetaWebhookWorker, } from "../../workers/dsp/metaRightsManagerWorkers.js";
import { registerTidalDeliveryWorker, registerTidalHealthWorker, registerTidalPollingWorker, registerTidalRetryWorker, registerTidalWebhookWorker, TidalDeliveryWorker, TidalHealthWorker, TidalPollingWorker, TidalRetryWorker, TidalWebhookWorker, } from "../../workers/dsp/tidalMusicWorkers.js";
import { registerYouTubeContentIdWorker, registerYouTubeDeliveryWorker, registerYouTubeHealthWorker, registerYouTubePollingWorker, registerYouTubeRetryWorker, registerYouTubeWebhookWorker, YouTubeContentIdWorker, YouTubeDeliveryWorker, YouTubeHealthWorker, YouTubePollingWorker, YouTubeRetryWorker, YouTubeWebhookWorker, } from "../../workers/dsp/youtubeMusicWorkers.js";
import { registerPayoutJobProcessor } from "../../payouts/queue/payoutJobProcessor.js";
import { DistributionWorker, registerDistributionQueueWorker } from "../queue/distributionWorker.js";
import { createSequelize, SequelizeSqlExecutor } from "../services/sequelizeSqlExecutor.js";
import { SqlDistributionStore } from "../services/distributionStore.js";
import { DistributionIdGenerator } from "../idGenerator.js";
import { createDistributionAudioUrlResolver } from "../services/distributionMediaResolver.js";
import { EnterpriseDistributionService } from "../admin/enterpriseDistributionService.js";
import { EnterpriseOperationsService } from "../admin/enterpriseOperationsService.js";
import { RoyaltyStore } from "../../royalties/services/royaltyStore.js";
import { RoyaltyEngine } from "../../royalties/core/royaltyEngine.js";
import { RoyaltyAccountingService } from "../../royalties/accounting/royaltyAccountingService.js";
import { RoyaltyStatementGenerator as RoyaltyDocumentGenerator } from "../../royalties/statements/statementGenerator.js";
import { FraudStore } from "../../fraud/services/fraudStore.js";
import { FraudDetectionEngine } from "../../fraud/detectors/fraudDetectionEngine.js";
import { FraudFeatureExtractor } from "../../fraud/detectors/featureExtractor.js";
import { FraudRuleEngine } from "../../fraud/rules/index.js";
import { StreamAnalyticsService } from "../../analytics/streams/streamAnalyticsService.js";
import { RevenueAnalyticsService } from "../../analytics/revenue/revenueAnalyticsService.js";
import { FraudAnalyticsService } from "../../fraud/analytics/fraudAnalyticsService.js";
import { DistributionAnalyticsService } from "../../distribution/analytics/distributionAnalyticsService.js";
import { DistributionIntelligenceStore, RetryEngine } from "../intelligence/index.js";
import { RealtimeEventStore } from "../../realtime/events/realtimeEventStore.js";
import { EventBus } from "../../realtime/events/eventBus.js";
import { LiveDashboardService } from "../../realtime/liveDashboardService.js";
import { MediaProcessingEngine } from "../../media/services/MediaProcessingEngine.js";
import { AudioFingerprintService } from "../../media/services/AudioFingerprintService.js";
import { AudioTranscodingService } from "../../media/services/AudioTranscodingService.js";
import { ArtworkOptimizationService } from "../../media/services/ArtworkOptimizationService.js";
import { MediaValidationService } from "../../media/services/MediaValidationService.js";
import { PreviewClipGenerator } from "../../media/services/PreviewClipGenerator.js";
import { WaveformGenerator } from "../../media/services/WaveformGenerator.js";
import { MetadataTransformer } from "../metadata/metadataTransformer.js";
import { MetadataComparator } from "../metadata/metadataComparator.js";
import { MetadataHasher } from "../metadata/metadataHasher.js";
import { MetadataValidator } from "../metadata/metadataValidator.js";
import { DdexCompressionService, DdexErnMapper, DdexFoundationService, DdexMeadMapper, DdexRinMapper, DdexValidator, DdexXmlSerializer } from "../ddex/index.js";
import { AudioFingerprintingEngine } from "../intelligence/fingerprinting/index.js";
import { MetadataIntelligenceEngine } from "../intelligence/metadata/index.js";
import { S3CompatibleMediaStorageAdapter, SupabaseMediaStorageAdapter } from "../../media/storage/mediaStorage.js";
import { FfmpegService as PromoAssetFfmpegService } from "../../media/promo-assets/processing/ffmpegService.js";
import { PromoAssetVideoProcessor } from "../../media/promo-assets/processing/videoProcessor.js";
import { PromoAssetPlatformValidationEngine } from "../../media/promo-assets/platformValidation/platformValidator.js";
import { readQueueEnvironment } from "../../queue/redis.js";
import { PayoutEngine } from "../../payouts/core/payoutEngine.js";
import { PayoutRequestService } from "../../payouts/services/payoutRequestService.js";
import { PayoutService } from "../../payouts/services/payoutService.js";
import { createWalletService } from "../../wallet/services/walletService.js";
import { PayoutWalletService } from "../../payments/payouts/services/payoutWalletService.js";
import { AdminRecoveryService } from "../../admin/recoveryService.js";
import { PasswordResetService } from "../../auth/passwordResetService.js";
import { ResendWebhookService } from "../../webhooks/resendWebhookService.js";
import { TooLostCredentialStore, TooLostIntegrationService } from "../providers/too-lost/index.js";
import { TooLostApiClient } from "../providers/too-lost/tooLostApiClient.js";
import { TooLostWebhookController } from "../webhooks/index.js";
import { FfmpegRunner } from "../../media/services/ffmpeg.js";
import { LockLease, LockToken } from "../infrastructure/locking/locking.js";
import { DefaultAggregateConflictResolver, DefaultAggregateLockManager, DefaultAggregateVersionTracker, DefaultRepositoryLifetimeManager, DefaultUnitOfWork, DefaultUnitOfWorkFactory, DefaultUnitOfWorkManager, DefaultRepositoryScope, } from "../infrastructure/unit-of-work/index.js";
import { DefaultAggregateFactoryProvider, DefaultAggregateProvider, DefaultDependencyProvider, DefaultLifetimeProvider, DefaultRepositoryProvider, DefaultRuntimeFactoryProvider, DefaultRuntimeProvider, DefaultServiceProvider, DefaultStorageProvider, DefaultUnitOfWorkProvider, } from "./providers/index.js";
export class DistributionDependencyContainer {
    values = new Map();
    currentConfiguration = null;
    register(token, value) {
        this.values.set(token, value);
    }
    resolve(token) {
        return (this.values.get(token) ?? null);
    }
    has(token) {
        return this.values.has(token);
    }
    override(token, value) {
        this.values.set(token, value);
    }
    list() {
        return Object.freeze([...this.values.keys()]);
    }
    setConfiguration(configuration) {
        this.currentConfiguration = configuration;
    }
    configuration() {
        return this.currentConfiguration;
    }
}
export class DistributionModuleRegistry {
    modules = new Map();
    register(module) {
        this.modules.set(module.moduleName, module);
    }
    resolve(moduleName) {
        return this.modules.get(moduleName) ?? null;
    }
    list() {
        return Object.freeze([...this.modules.values()]);
    }
    registerAll(modules) {
        for (const module of modules) {
            this.register(module);
        }
    }
}
export class DistributionServiceRegistry {
    services = new Map();
    register(service) {
        this.services.set(service.serviceId, service);
    }
    resolve(serviceId) {
        return this.services.get(serviceId) ?? null;
    }
    list() {
        return Object.freeze([...this.services.values()]);
    }
    registerAll(services) {
        for (const service of services) {
            this.register(service);
        }
    }
}
export function createDistributionDependencyGraph(configuration) {
    const modules = DEFAULT_COMPOSITION_MODULE_ORDER.map((moduleName, index) => new ModuleDescriptor({
        moduleName,
        version: configuration.compositionId || "1.0.0",
        dependencies: index === 0 ? [] : [DEFAULT_COMPOSITION_MODULE_ORDER[index - 1]],
        lazy: Boolean(configuration.lazyLoading),
        enabled: true,
        featureFlags: configuration.featureFlags,
        metadata: { environment: configuration.environment },
    }));
    return new DependencyGraph({
        graphId: `${configuration.compositionId}:graph`,
        modules,
        rootModules: ["Domain", "Application", "Infrastructure", "Orchestrator", "Workflow", "Bootstrap"],
        metadata: { compositionId: configuration.compositionId },
    });
}
function createDefaultServices(modules) {
    return modules.map((module) => new ServiceDescriptor({
        serviceId: `${module.moduleName}:service`,
        moduleName: module.moduleName,
        serviceName: `${module.moduleName}Service`,
        scope: "Singleton",
        dependencies: [],
        metadata: {
            moduleName: module.moduleName,
            lazy: module.lazy,
            replacementOf: module.replacementOf,
        },
    }));
}
function seedRegistries(state, context) {
    const queueRegistry = new BullMQQueueRegistry();
    const queueFactory = new BullMQQueueFactory(queueRegistry);
    const storageRegistry = new DefaultStorageRegistry();
    storageRegistry.register("default", new FileStorageAdapter(distributionPersistenceBasePath()));
    const storageAdapter = storageRegistry.resolve("default");
    const storageEngine = new DefaultStorageEngine(new Map([["default", storageAdapter]]), (adapter) => new AdapterStorageRepository(adapter));
    const runtimeStorageRepository = storageEngine.repository("default");
    const storageFactory = new DefaultStorageFactory(storageRegistry, (adapters) => new DefaultStorageEngine(adapters, (adapter) => new AdapterStorageRepository(adapter)));
    const storageSerializer = new JsonStorageSerializer();
    const storageLogger = new DefaultStorageLogger();
    const storageMetrics = new DefaultStorageMetrics();
    const storageHealth = new DefaultStorageHealthChecker(() => storageEngine.health());
    const runtimeRepositoryFactory = (repository, namespace, name, serializeKey, deserializeKey) => new RuntimeRepository(repository, namespace, name, serializeKey, deserializeKey);
    const workerRepositories = {
        configurations: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-configurations"),
        workers: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-workers"),
        leases: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-leases"),
        heartbeats: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-heartbeats"),
        checkpoints: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-checkpoints"),
        recoveries: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-recoveries"),
        cancellations: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-cancellations"),
        activeExecutions: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-active-executions"),
        health: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-health"),
        statistics: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-statistics"),
        metrics: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "worker-metrics"),
    };
    const workerConfigurationProvider = new DistributionWorkerConfigurationProvider(workerRepositories);
    const workerLogger = new DistributionWorkerLogger();
    const workerMetrics = new DistributionWorkerMetricsCollector();
    const workerRegistry = new DistributionWorkerRegistry(workerRepositories);
    const runtimeFactory = () => {
        throw new Error("DistributionWorkerRuntime must be constructed through explicit DI");
    };
    state.container.setConfiguration(context.configuration);
    state.container.register("composition.configuration", context.configuration);
    state.container.register("composition.graph", context.graph);
    state.container.register("composition.snapshot", context);
    state.container.register("composition.modules", context.graph.modules);
    state.container.register("composition.services", state.services);
    state.container.register("storage.registry", storageRegistry);
    state.container.register("storage.engine", storageEngine);
    state.container.register("storage.factory", storageFactory);
    state.container.register("storage.adapter", storageAdapter);
    state.container.register("storage.repository", storageEngine.repository("default"));
    state.container.register("storage.serializer", storageSerializer);
    state.container.register("storage.metrics", storageMetrics);
    state.container.register("storage.logger", storageLogger);
    state.container.register("storage.health", storageHealth);
    state.container.register("repository.runtimeFactory", runtimeRepositoryFactory);
    state.container.register("repository.runtimeRepositoryFactory", runtimeRepositoryFactory);
    const repositoryScope = new DefaultRepositoryScope("distribution", "scoped", { compositionId: context.configuration.compositionId });
    const repositoryLifetimeManager = new DefaultRepositoryLifetimeManager();
    repositoryLifetimeManager.register("default", "scoped");
    const aggregateLockManager = new DefaultAggregateLockManager();
    const aggregateVersionTracker = new DefaultAggregateVersionTracker();
    const aggregateConflictResolver = new DefaultAggregateConflictResolver();
    const unitOfWork = new DefaultUnitOfWork("distribution-unit-of-work", aggregateVersionTracker, aggregateConflictResolver, aggregateLockManager, null, null, repositoryLifetimeManager);
    const unitOfWorkFactory = new DefaultUnitOfWorkFactory(unitOfWork);
    const unitOfWorkManager = new DefaultUnitOfWorkManager(unitOfWorkFactory);
    state.container.register("unitOfWork.scope", repositoryScope);
    state.container.register("unitOfWork.manager", unitOfWorkManager);
    state.container.register("unitOfWork.factory", unitOfWorkFactory);
    state.container.register("unitOfWork.instance", unitOfWork);
    state.container.register("unitOfWork.repositoryLifetimeManager", repositoryLifetimeManager);
    state.container.register("unitOfWork.aggregateLockManager", aggregateLockManager);
    state.container.register("unitOfWork.aggregateVersionTracker", aggregateVersionTracker);
    state.container.register("unitOfWork.aggregateConflictResolver", aggregateConflictResolver);
    const leaseOwnership = new DefaultLeaseOwnership();
    const storageCoordination = {
        lock: new (class {
            leases;
            constructor(leases) {
                this.leases = leases;
            }
            acquire(resource, owner, ttlMs) {
                const lease = this.leases.claim(resource, owner, ttlMs);
                return Promise.resolve(lease ? new LockLease({ token: new LockToken(lease.leaseId), resource: lease.resource, owner: lease.owner, acquiredAt: lease.acquiredAt, expiresAt: lease.expiresAt }) : null);
            }
            release(resource, token) {
                return Promise.resolve(this.leases.release(resource, token.value));
            }
            renew(resource, token, ttlMs) {
                const renewed = this.leases.renew(resource, token.value, ttlMs);
                return Promise.resolve(renewed ? new LockLease({ token, resource: renewed.resource, owner: renewed.owner, acquiredAt: renewed.acquiredAt, expiresAt: renewed.expiresAt }) : null);
            }
        })(leaseOwnership),
        leaderElection: new DefaultDistributedLeaderElection(),
        leaseOwnership,
        workerOwnership: new DefaultWorkerOwnership(),
        fencing: new DefaultExecutionFencing(),
        duplicateExecutionPrevention: new DefaultDuplicateExecutionPrevention(),
        checkpointOwnership: new DefaultCheckpointOwnership(),
        recoveryOwnership: new DefaultRecoveryOwnership(),
        staleLeaseDetection: new DefaultStaleLeaseDetection(leaseOwnership),
        heartbeatOwnership: new DefaultHeartbeatOwnership(),
        executionTokens: new DefaultExecutionTokenService(),
    };
    state.container.register("storage.coordination", storageCoordination);
    state.container.register("storage.coordination.lock", storageCoordination.lock);
    state.container.register("storage.coordination.leaderElection", storageCoordination.leaderElection);
    state.container.register("storage.coordination.leaseOwnership", storageCoordination.leaseOwnership);
    state.container.register("storage.coordination.workerOwnership", storageCoordination.workerOwnership);
    state.container.register("storage.coordination.fencing", storageCoordination.fencing);
    state.container.register("storage.coordination.duplicateExecutionPrevention", storageCoordination.duplicateExecutionPrevention);
    state.container.register("storage.coordination.checkpointOwnership", storageCoordination.checkpointOwnership);
    state.container.register("storage.coordination.recoveryOwnership", storageCoordination.recoveryOwnership);
    state.container.register("storage.coordination.staleLeaseDetection", storageCoordination.staleLeaseDetection);
    state.container.register("storage.coordination.heartbeatOwnership", storageCoordination.heartbeatOwnership);
    state.container.register("storage.coordination.executionTokens", storageCoordination.executionTokens);
    const repositoryProvider = new DefaultRepositoryProvider(state.container);
    const storageProvider = new DefaultStorageProvider(state.container);
    const unitOfWorkProvider = new DefaultUnitOfWorkProvider(state.container);
    const runtimeProvider = new DefaultRuntimeProvider(state.container);
    const serviceProvider = new DefaultServiceProvider(state.container);
    const aggregateProvider = new DefaultAggregateProvider(state.container);
    const dependencyProvider = new DefaultDependencyProvider(state.container);
    const lifetimeProvider = new DefaultLifetimeProvider(state.container);
    const runtimeFactoryProvider = new DefaultRuntimeFactoryProvider(state.container);
    const aggregateFactoryProvider = new DefaultAggregateFactoryProvider(state.container);
    state.container.register("provider.repository", repositoryProvider);
    state.container.register("provider.storage", storageProvider);
    state.container.register("provider.unitOfWork", unitOfWorkProvider);
    state.container.register("provider.runtime", runtimeProvider);
    state.container.register("provider.service", serviceProvider);
    state.container.register("provider.aggregate", aggregateProvider);
    state.container.register("provider.dependency", dependencyProvider);
    state.container.register("provider.lifetime", lifetimeProvider);
    state.container.register("provider.runtimeFactory", runtimeFactoryProvider);
    state.container.register("provider.aggregateFactory", aggregateFactoryProvider);
    state.container.register("queue.registry", queueRegistry);
    state.container.register("queue.factory", queueFactory);
    state.container.register("queue.adapter.bullmq.registry", queueRegistry);
    state.container.register("queue.adapter.bullmq.factory", queueFactory);
    state.container.register("runtime.workerRuntimeFactory", runtimeFactory);
    state.container.register("runtime.workerRegistry", workerRegistry);
    state.container.register("runtime.workerLogger", workerLogger);
    state.container.register("runtime.workerMetrics", workerMetrics);
    state.container.register("runtime.workerConfigurationProvider", workerConfigurationProvider);
    state.container.register("runtime.workerFactoryClass", DistributionWorkerFactory);
    state.container.register("runtime.workerExecutorClass", DistributionWorkerExecutor);
    state.container.register("runtime.workerRuntimeClass", DistributionWorkerRuntime);
    state.container.register("runtime.workerHealthChecker", new DistributionWorkerHealthChecker(workerConfigurationProvider, workerRepositories));
    const createDistributionRuntimeRepository = (name) => runtimeRepositoryFactory(runtimeStorageRepository, "distribution", name);
    const partnerRepositories = {
        states: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-states"),
        credentials: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-credentials"),
        documentation: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-documentation"),
        contacts: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-contacts"),
        agreements: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-agreements"),
        metadata: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-metadata"),
        requirements: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-requirements"),
        checklists: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-checklists"),
        validationRules: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "partner-validation-rules"),
    };
    const partnerOnboardingRuntimeEngine = new PartnerOnboardingRuntimeEngine(partnerRepositories, {});
    const partnerOnboardingRegistry = new PartnerOnboardingRegistry(partnerOnboardingRuntimeEngine);
    const partnerOnboardingCredentialsStore = new PartnerOnboardingCredentialsStore(partnerOnboardingRuntimeEngine);
    const partnerOnboardingDocumentationRegistry = new PartnerOnboardingDocumentationRegistry(partnerOnboardingRuntimeEngine);
    const partnerOnboardingActivationResolver = new PartnerOnboardingActivationResolver(partnerOnboardingRuntimeEngine);
    const partnerOnboardingRuntime = new TrackSyraPartnerOnboardingRuntime(partnerOnboardingRuntimeEngine, partnerOnboardingRegistry, partnerOnboardingCredentialsStore, partnerOnboardingDocumentationRegistry, partnerOnboardingActivationResolver);
    const observabilityLogSink = new RuntimeLogSink();
    const observabilityCorrelationIds = new CorrelationIdManager();
    const observabilityRequestIds = new RequestIdGenerator();
    const observabilityLogContexts = new LogContextManager();
    const observabilityLogger = new StructuredLogger(observabilityLogSink, observabilityRequestIds, observabilityCorrelationIds, observabilityLogContexts);
    const observabilityLogRouter = new LogRouter(observabilityLogger, observabilityLogSink);
    const observabilityLogAggregator = new LogAggregator();
    const observabilityAuditLogManager = new AuditLogManager();
    const observabilitySecurityLogManager = new SecurityLogManager();
    const observabilityErrorLogManager = new ErrorLogManager();
    const observabilityMetricsRegistry = new MetricsRegistry(new RuntimeCounters(), new Gauges(), new Histograms(), new Timers());
    const observabilityMetricsRuntime = new MetricsRuntime(observabilityMetricsRegistry);
    const observabilityQueueMetrics = new ObservabilityQueueMetrics();
    const observabilityWorkerMetrics = new ObservabilityWorkerMetrics();
    const observabilityDspRuntimeMetrics = new ObservabilityDSPRuntimeMetrics();
    const observabilityRoyaltyMetrics = new ObservabilityRoyaltyMetrics();
    const observabilityStateSyncMetrics = new ObservabilityStateSyncMetrics();
    const observabilityWorkflowMetrics = new ObservabilityWorkflowMetrics();
    const observabilitySpanManager = new SpanManager();
    const observabilityParentChildSpanResolver = new ParentChildSpanResolver();
    const observabilityPipelineTraceBuilder = new PipelineTraceBuilder();
    const observabilityRuntimeTracePublisher = new RuntimeTracePublisher();
    const observabilityTraceRuntime = new DistributedTraceRuntime(observabilitySpanManager, observabilityParentChildSpanResolver, observabilityPipelineTraceBuilder, observabilityRuntimeTracePublisher);
    const observabilityComponentHealthRegistry = new ComponentHealthRegistry();
    const observabilityReadinessEngine = new ReadinessEngine();
    const observabilityLivenessEngine = new LivenessEngine();
    const observabilityStartupValidator = new StartupValidator();
    const observabilityShutdownValidator = new ShutdownValidator();
    const observabilityDependencyHealthAnalyzer = new DependencyHealthAnalyzer();
    const observabilityHealthRuntime = new HealthRuntime(observabilityComponentHealthRegistry, observabilityReadinessEngine, observabilityLivenessEngine, observabilityStartupValidator, observabilityShutdownValidator, observabilityDependencyHealthAnalyzer);
    const observabilityAlertRules = new AlertRules();
    const observabilityIncidentTimeline = new IncidentTimeline();
    const observabilityEscalationPolicies = new EscalationPolicies();
    const observabilityIncidentManager = new RuntimeIncidentManager();
    const observabilityAlertDispatcher = new AlertDispatcher(observabilityIncidentManager, observabilityEscalationPolicies);
    const observabilityAlertEngine = new AlertEngine(observabilityAlertDispatcher, observabilityAlertRules);
    const observabilityRuntimeProfiler = new RuntimeProfiler();
    const observabilityBottleneckDetector = new BottleneckDetector();
    const observabilityPipelinePerformanceAnalyzer = new PipelinePerformanceAnalyzer(observabilityBottleneckDetector);
    const observabilityQueuePerformanceMonitor = new QueuePerformanceMonitor();
    const observabilityWorkerPerformanceMonitor = new WorkerPerformanceMonitor();
    const observabilityMemoryAnalyzer = new MemoryAnalyzer();
    const observabilityCpuAnalyzer = new CPUAnalyzer();
    const observabilityThroughputAnalyzer = new ThroughputAnalyzer();
    const observabilityDependencyDiagnostics = new DependencyDiagnostics();
    const observabilityRuntimeDiagnostics = new RuntimeDiagnostics();
    const observabilityFailureAnalyzer = new FailureAnalyzer();
    const observabilityRecoveryAnalyzer = new RecoveryAnalyzer();
    const observabilityDeadlockDetection = new DeadlockDetection();
    const observabilityConfigurationValidator = new ConfigurationValidator();
    const observabilityDiagnosticRuntime = new DiagnosticRuntime(observabilityDependencyDiagnostics, observabilityRuntimeDiagnostics, observabilityFailureAnalyzer, observabilityRecoveryAnalyzer, observabilityDeadlockDetection, observabilityConfigurationValidator, observabilityLogger, observabilityMetricsRuntime, observabilityHealthRuntime);
    const observabilityRuntimeDashboard = new RuntimeDashboard();
    const observabilityWorkerDashboard = new WorkerDashboard();
    const observabilityQueueDashboard = new QueueDashboard();
    const observabilityProviderDashboard = new ProviderDashboard();
    const observabilityDistributionDashboard = new DistributionDashboard();
    const observabilityRoyaltyDashboard = new RoyaltyDashboard();
    const observabilityStateSyncDashboard = new StateSyncDashboard();
    const observabilitySystemDashboard = new SystemDashboard();
    const observabilityRuntimeStatistics = new RuntimeStatistics();
    const observabilityRuntimeMonitoringReporter = new RuntimeMonitoringReporter();
    const observabilityHealthReporter = new HealthRuntimeReporter();
    const observabilityEventPublisher = new ObservabilityEventPublisherFacade();
    const observabilityRuntimeDependencies = {
        logSink: observabilityLogSink,
        correlationIdManager: observabilityCorrelationIds,
        requestIdGenerator: observabilityRequestIds,
        logContextManager: observabilityLogContexts,
        logger: observabilityLogger,
        logRouter: observabilityLogRouter,
        logAggregator: observabilityLogAggregator,
        auditLogManager: observabilityAuditLogManager,
        securityLogManager: observabilitySecurityLogManager,
        errorLogManager: observabilityErrorLogManager,
        metricsRuntime: observabilityMetricsRuntime,
        metricsRegistry: observabilityMetricsRegistry,
        queueMetrics: observabilityQueueMetrics,
        workerMetrics: observabilityWorkerMetrics,
        dspRuntimeMetrics: observabilityDspRuntimeMetrics,
        royaltyMetrics: observabilityRoyaltyMetrics,
        stateSyncMetrics: observabilityStateSyncMetrics,
        workflowMetrics: observabilityWorkflowMetrics,
        traceRuntime: observabilityTraceRuntime,
        componentHealthRegistry: observabilityComponentHealthRegistry,
        healthRuntime: observabilityHealthRuntime,
        alertRules: observabilityAlertRules,
        incidentTimeline: observabilityIncidentTimeline,
        escalationPolicies: observabilityEscalationPolicies,
        incidentManager: observabilityIncidentManager,
        alertDispatcher: observabilityAlertDispatcher,
        alertEngine: observabilityAlertEngine,
        runtimeProfiler: observabilityRuntimeProfiler,
        pipelinePerformanceAnalyzer: observabilityPipelinePerformanceAnalyzer,
        queuePerformanceMonitor: observabilityQueuePerformanceMonitor,
        workerPerformanceMonitor: observabilityWorkerPerformanceMonitor,
        memoryAnalyzer: observabilityMemoryAnalyzer,
        cpuAnalyzer: observabilityCpuAnalyzer,
        throughputAnalyzer: observabilityThroughputAnalyzer,
        bottleneckDetector: observabilityBottleneckDetector,
        dependencyDiagnostics: observabilityDependencyDiagnostics,
        runtimeDiagnostics: observabilityRuntimeDiagnostics,
        failureAnalyzer: observabilityFailureAnalyzer,
        recoveryAnalyzer: observabilityRecoveryAnalyzer,
        deadlockDetection: observabilityDeadlockDetection,
        configurationValidator: observabilityConfigurationValidator,
        diagnosticRuntime: observabilityDiagnosticRuntime,
        runtimeDashboard: observabilityRuntimeDashboard,
        workerDashboard: observabilityWorkerDashboard,
        queueDashboard: observabilityQueueDashboard,
        providerDashboard: observabilityProviderDashboard,
        distributionDashboard: observabilityDistributionDashboard,
        royaltyDashboard: observabilityRoyaltyDashboard,
        stateSyncDashboard: observabilityStateSyncDashboard,
        systemDashboard: observabilitySystemDashboard,
        runtimeStatistics: observabilityRuntimeStatistics,
        runtimeMonitoringReporter: observabilityRuntimeMonitoringReporter,
        healthReporter: observabilityHealthReporter,
        observabilityEventPublisher,
    };
    const observabilityRuntime = new ObservabilityRuntime(observabilityRuntimeDependencies);
    const credentialRepositories = {
        bundles: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "credential-bundles"),
        versions: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "credential-versions"),
        metrics: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "credential-metrics"),
    };
    const credentialConfiguration = new CredentialConfiguration({
        environment: context.configuration.environment === "production" ? "production" : "sandbox",
        defaultVersion: "1.0.0",
        encryptionSecret: null,
        metadata: { compositionId: context.configuration.compositionId, environment: context.configuration.environment },
    });
    const credentialSerializer = new CredentialSerializer();
    const credentialVault = new CredentialVault(credentialConfiguration, credentialConfiguration.encryptionSecret ?? null);
    const credentialEncryptor = new CredentialEncryptor(credentialVault);
    const credentialDecryptor = new CredentialDecryptor(credentialVault);
    const credentialVersionManager = new CredentialVersionManager();
    const credentialRegistry = new CredentialRegistry(credentialRepositories);
    const credentialLogger = new CredentialLogger(observabilityRuntime.logger);
    const credentialMetrics = new CredentialMetrics(credentialRepositories.metrics);
    const credentialAudit = new CredentialAudit();
    const credentialFactory = new CredentialFactory(credentialEncryptor, credentialVersionManager, (credentials, environment) => new CredentialAccessPolicy({
        policyId: `${credentials.credentialsId}:access`,
        allowedRoles: ["distribution-admin", "distribution-service"],
        allowedEnvironments: [environment.environment],
    }), (credentials) => new CredentialRotationPolicy({
        policyId: `${credentials.credentialsId}:rotation`,
        autoRotate: credentialConfiguration.rotationEnabled,
        rotationIntervalMs: 30 * 24 * 60 * 60_000,
        expiresAfterMs: credentials.payload.expiresAt ? Math.max(0, new Date(credentials.payload.expiresAt).getTime() - Date.now()) : null,
    }));
    const credentialValidator = new CredentialValidator(credentialDecryptor);
    const credentialBackupManager = new CredentialBackupManager(credentialRegistry, credentialSerializer);
    const credentialRecoveryManager = new CredentialRecoveryManager(credentialRegistry, credentialSerializer, (value) => new CredentialAccessPolicy(value), (value) => new CredentialRotationPolicy(value));
    const credentialHealthChecker = new CredentialHealthChecker(credentialRegistry, credentialValidator, credentialLogger);
    const credentialRotator = new CredentialRotator(credentialFactory, credentialRegistry, credentialLogger, credentialMetrics);
    const credentialResolver = new CredentialResolver(credentialRegistry, credentialValidator);
    const credentialService = createTrackSyraCredentialService({
        metadata: credentialConfiguration,
        serializer: credentialSerializer,
        vault: credentialVault,
        encryptor: credentialEncryptor,
        decryptor: credentialDecryptor,
        versionManager: credentialVersionManager,
        registry: credentialRegistry,
        logger: credentialLogger,
        metrics: credentialMetrics,
        audit: credentialAudit,
        factory: credentialFactory,
        validator: credentialValidator,
        backupManager: credentialBackupManager,
        recoveryManager: credentialRecoveryManager,
        healthChecker: credentialHealthChecker,
        rotator: credentialRotator,
        resolver: credentialResolver,
    });
    const providerRepositories = {
        configurations: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "provider-configurations"),
        records: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "provider-records"),
        entries: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "provider-entries"),
        metrics: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "provider-metrics"),
    };
    const providerRuntimeDependencies = {
        initialConfigurations: [],
        credentialResolver: credentialService.resolver,
        store: new TrackSyraDspRuntimeStore(providerRepositories),
        repositories: providerRepositories,
        statusMapper: new ProviderStatusMapper(),
        retryStrategy: new ExponentialProviderRetryStrategy({
            maxAttempts: 5,
            baseDelayMs: 1_000,
            maxDelayMs: 30 * 60_000,
            jitterRatio: 0.15,
        }),
    };
    const providerRuntime = new TrackSyraDspRuntimeEngine(providerRuntimeDependencies);
    const providerRegistry = new TrackSyraDspRegistry(providerRuntime);
    const providerRegistryFacade = new TrackSyraDspIntegrationRegistryFacade(providerRuntime);
    const providerFactory = new TrackSyraDspFactory(providerRuntime);
    const providerResolver = new TrackSyraDspResolver(providerRuntime);
    const providerRouter = new TrackSyraDspRouter(providerRuntime);
    const providerLifecycleManager = new TrackSyraDspLifecycleManager(providerRuntime);
    const providerAuthenticationManager = new TrackSyraDspAuthenticationManager(providerRuntime);
    const providerSessionManager = new TrackSyraDspSessionManager(providerRuntime);
    const providerCredentialManager = new TrackSyraDspCredentialManager(providerRuntime);
    const providerCapabilityResolver = new TrackSyraDspCapabilityResolver(providerRuntime);
    const providerSelector = new TrackSyraDspSelector(providerRuntime);
    const providerHealthManager = new TrackSyraDspHealthManager(providerRuntime);
    const providerUploadManager = new TrackSyraDspUploadManager(providerRuntime);
    const providerAssetManager = new TrackSyraDspAssetManager(providerRuntime);
    const providerMetadataManager = new TrackSyraDspMetadataManager(providerRuntime);
    const providerCatalogManager = new TrackSyraDspCatalogManager(providerRuntime);
    const providerStatusManager = new TrackSyraDspStatusManager(providerRuntime);
    const providerWebhookManager = new TrackSyraDspWebhookManager(providerRuntime);
    const providerPollingManager = new TrackSyraDspPollingManager(providerRuntime);
    const providerRoyaltyManager = new TrackSyraDspRoyaltyManager(providerRuntime);
    const providerReportManager = new TrackSyraDspReportManager(providerRuntime);
    const providerTakedownManager = new TrackSyraDspTakedownManager(providerRuntime);
    const providerRateLimitManager = new TrackSyraDspRateLimitManager(providerRuntime);
    const providerRetryManager = new TrackSyraDspRetryManager(providerRuntime);
    const providerMetricsCollector = new TrackSyraDspMetricsCollector(providerRuntime);
    const providerLogger = new TrackSyraDspLogger(providerRuntime);
    const providerConfigurationProvider = new TrackSyraDspConfigurationProvider(providerRuntime);
    const providerEventPublisher = new TrackSyraDspEventPublisher(providerRuntime);
    const dspProtocolRegistry = new DspProtocolRegistryImpl();
    const specificationConfiguration = new SpecificationConfiguration({
        environment: context.configuration.environment === "production" ? "production" : "sandbox",
        defaultVersion: "1.0.0",
        featureFlags: context.configuration.featureFlags,
        metadata: { compositionId: context.configuration.compositionId, environment: context.configuration.environment },
    });
    const specificationSerializer = new SpecificationSerializer();
    const specificationParser = new SpecificationParser((input) => new SpecificationRetryPolicy(input));
    const specificationCache = new SpecificationCache();
    const specificationAudit = new SpecificationAudit();
    const specificationMetrics = new SpecificationMetrics();
    const specificationLogger = new SpecificationLogger(observabilityRuntime.logger);
    const specificationRepository = new SpecificationRepository(specificationConfiguration);
    const specificationSchemaValidator = new SpecificationSchemaValidator();
    const specificationIntegrityValidator = new SpecificationIntegrityValidator(specificationSerializer);
    const specificationSignatureValidator = new SpecificationSignatureValidator(specificationConfiguration, specificationSerializer);
    const specificationCapabilityResolver = new SpecificationCapabilityResolver();
    const specificationEnvironmentResolver = new SpecificationEnvironmentResolver(specificationConfiguration);
    const specificationCompatibilityChecker = new SpecificationCompatibilityChecker(specificationEnvironmentResolver, specificationCapabilityResolver);
    const specificationVersionManager = new SpecificationVersionManager();
    const specificationValidator = new SpecificationValidator(specificationSchemaValidator, specificationIntegrityValidator, specificationSignatureValidator, specificationCompatibilityChecker);
    const specificationResolver = new SpecificationResolver(specificationRepository, specificationVersionManager, specificationEnvironmentResolver, specificationCompatibilityChecker, specificationCache);
    const specificationActivationManager = new SpecificationActivationManager(partnerOnboardingRuntime.activationResolver, partnerOnboardingRuntime.registry, partnerOnboardingRuntime.credentialsStore, specificationLogger, specificationMetrics);
    const specificationLoader = new SpecificationLoader(specificationParser, specificationValidator, specificationRepository, specificationAudit, specificationMetrics, specificationLogger);
    const specificationRegistryRef = { current: null };
    const specificationHealthChecker = new SpecificationHealthChecker(() => specificationRegistryRef.current.list(), specificationLogger);
    const specificationRegistry = new SpecificationRegistry({
        configuration: specificationConfiguration,
        serializer: specificationSerializer,
        parser: specificationParser,
        cache: specificationCache,
        audit: specificationAudit,
        metrics: specificationMetrics,
        logger: specificationLogger,
        repository: specificationRepository,
        schemaValidator: specificationSchemaValidator,
        integrityValidator: specificationIntegrityValidator,
        signatureValidator: specificationSignatureValidator,
        capabilityResolver: specificationCapabilityResolver,
        environmentResolver: specificationEnvironmentResolver,
        compatibilityChecker: specificationCompatibilityChecker,
        versionManager: specificationVersionManager,
        validator: specificationValidator,
        resolver: specificationResolver,
        activationManager: specificationActivationManager,
        loader: specificationLoader,
        healthChecker: specificationHealthChecker,
    });
    specificationRegistryRef.current = specificationRegistry;
    const dspProtocolRuntimeFactory = () => createTrackSyraDspProtocolRuntime({
        protocolName: "TrackSyraDSPProtocol",
        version: "1.0.0",
        registry: dspProtocolRegistry,
        resolver: new DspProtocolResolverImpl(dspProtocolRegistry),
        specificationRegistry,
        activationGate: partnerOnboardingRuntime.activationResolver,
        activationGuard: new DspProtocolActivationGuard(partnerOnboardingRuntime.activationResolver, partnerOnboardingRuntime.registry, credentialService.resolver),
        partnerRegistry: partnerOnboardingRuntime.registry,
        credentialResolver: credentialService.resolver,
        partnerConfigurationProvider: providerConfigurationProvider,
        logger: observabilityRuntime.logger,
        metrics: observabilityRuntime.metricsRuntime,
        eventPublisher: observabilityRuntime.observabilityEventPublisher,
        healthChecker: partnerOnboardingRuntime.activationResolver,
        capabilityResolver: providerCapabilityResolver,
        configuration: context.configuration,
        runtimeRegistry: dspProtocolRegistry,
        sessions: new DspProtocolSessionManager(),
        manifestBuilder: new DspProtocolManifestBuilder(),
        requestBuilder: new DspProtocolRequestBuilder(),
        responseParser: new DspProtocolResponseParser(),
        statusParser: new DspProtocolStatusParser(),
        errorParser: new DspProtocolErrorParser(),
        rateLimiter: new DspProtocolRateLimiter(100, 60_000),
        compression: new DspProtocolCompressionService(),
        encryption: null,
        retryEngine: new DspProtocolRetryEngine(1_000, 2, 5 * 60_000, 0.15),
        signatureValidator: new DspProtocolSignatureValidator(),
        loggerAdapter: new DspProtocolRuntimeLogger(observabilityRuntime.logger),
        metricsAdapter: new DspProtocolRuntimeMetrics(observabilityRuntime.metricsRuntime),
        protocolHealthChecker: new DspProtocolProtocolHealthChecker(dspProtocolRegistry, partnerOnboardingRuntime.activationResolver),
        runtimeFactory: (protocolName, version, dependencies) => new DspProtocolRuntimeFacade(new DspProtocolRuntimeImpl(protocolName, version, dependencies)),
    });
    state.container.register("provider.integration.runtime", providerRuntime);
    state.container.register("provider.integration.runtimeFactory", () => new TrackSyraDspRuntimeEngine(providerRuntimeDependencies));
    state.container.register("provider.integration.engine", providerRuntime);
    state.container.register("provider.integration.registry", providerRegistry);
    state.container.register("provider.integration.registry.facade", providerRegistryFacade);
    state.container.register("provider.integration.factory", providerFactory);
    state.container.register("provider.integration.resolver", providerResolver);
    state.container.register("provider.integration.router", providerRouter);
    state.container.register("provider.integration.lifecycle", providerLifecycleManager);
    state.container.register("provider.integration.authentication", providerAuthenticationManager);
    state.container.register("provider.integration.sessions", providerSessionManager);
    state.container.register("provider.integration.credentials", providerCredentialManager);
    state.container.register("provider.integration.capabilities", providerCapabilityResolver);
    state.container.register("provider.integration.selection", providerSelector);
    state.container.register("provider.integration.health", providerHealthManager);
    state.container.register("provider.integration.upload", providerUploadManager);
    state.container.register("provider.integration.assets", providerAssetManager);
    state.container.register("provider.integration.metadata", providerMetadataManager);
    state.container.register("provider.integration.catalog", providerCatalogManager);
    state.container.register("provider.integration.status", providerStatusManager);
    state.container.register("provider.integration.webhooks", providerWebhookManager);
    state.container.register("provider.integration.polling", providerPollingManager);
    state.container.register("provider.integration.royalty", providerRoyaltyManager);
    state.container.register("provider.integration.reports", providerReportManager);
    state.container.register("provider.integration.takedown", providerTakedownManager);
    state.container.register("provider.integration.rateLimit", providerRateLimitManager);
    state.container.register("provider.integration.retry", providerRetryManager);
    state.container.register("provider.integration.metrics", providerMetricsCollector);
    state.container.register("provider.integration.logging", providerLogger);
    state.container.register("provider.integration.configuration", providerConfigurationProvider);
    state.container.register("provider.integration.events", providerEventPublisher);
    state.container.register("partner.onboarding.runtime", partnerOnboardingRuntime);
    state.container.register("partner.onboarding.runtimeFactory", () => new TrackSyraPartnerOnboardingRuntime(new PartnerOnboardingRuntimeEngine(partnerRepositories, {}), new PartnerOnboardingRegistry(partnerOnboardingRuntimeEngine), new PartnerOnboardingCredentialsStore(partnerOnboardingRuntimeEngine), new PartnerOnboardingDocumentationRegistry(partnerOnboardingRuntimeEngine), new PartnerOnboardingActivationResolver(partnerOnboardingRuntimeEngine)));
    state.container.register("partner.onboarding.registry", partnerOnboardingRuntime.registry);
    state.container.register("partner.onboarding.credentialsStore", partnerOnboardingRuntime.credentialsStore);
    state.container.register("partner.onboarding.documentationRegistry", partnerOnboardingRuntime.documentationRegistry);
    state.container.register("partner.onboarding.activationGate", partnerOnboardingRuntime.activationResolver);
    state.container.register("partner.onboarding.validator", partnerOnboardingRuntime.createValidator());
    state.container.register("partner.credentials.configuration", credentialService.metadata);
    state.container.register("partner.credentials.service", credentialService);
    state.container.register("partner.credentials.registry", credentialService.registry);
    state.container.register("partner.credentials.vault", credentialService.vault);
    state.container.register("partner.credentials.encryptor", credentialService.encryptor);
    state.container.register("partner.credentials.decryptor", credentialService.decryptor);
    state.container.register("partner.credentials.factory", credentialService.factory);
    state.container.register("partner.credentials.resolver", credentialService.resolver);
    state.container.register("partner.credentials.validator", credentialService.validator);
    state.container.register("partner.credentials.rotator", credentialService.rotator);
    state.container.register("partner.credentials.versionManager", credentialService.versionManager);
    state.container.register("partner.credentials.backupManager", credentialService.backupManager);
    state.container.register("partner.credentials.recoveryManager", credentialService.recoveryManager);
    state.container.register("partner.credentials.audit", credentialService.audit);
    state.container.register("partner.credentials.metrics", credentialService.metrics);
    state.container.register("partner.credentials.logger", credentialService.logger);
    state.container.register("partner.credentials.healthChecker", credentialService.healthChecker);
    const credentialResolverMiddleware = new CredentialResolverMiddleware(credentialService.resolver);
    const credentialInjectionPipeline = new CredentialInjectionPipeline(credentialResolverMiddleware);
    const credentialRefreshCoordinator = new CredentialRefreshCoordinator(credentialResolverMiddleware);
    const credentialAuditPublisher = new CredentialAuditPublisher();
    const credentialMetricsPublisher = new CredentialMetricsPublisher();
    const credentialHealthPublisher = new CredentialHealthPublisher(true);
    const credentialExpiryGuard = new CredentialExpiryGuard();
    const credentialRevocationGuard = new CredentialRevocationGuard();
    const credentialConsistencyValidator = new CredentialConsistencyValidator();
    state.container.register("credential.authentication.middleware", credentialResolverMiddleware);
    state.container.register("credential.authentication.pipeline", credentialInjectionPipeline);
    state.container.register("credential.execution.scope", (input) => new CredentialExecutionScope(input));
    state.container.register("credential.version.binding", (input) => new CredentialVersionBinding(input));
    state.container.register("credential.version.pinning", (input) => new CredentialVersionPinning(input));
    state.container.register("credential.refresh.coordinator", credentialRefreshCoordinator);
    state.container.register("credential.audit.publisher", credentialAuditPublisher);
    state.container.register("credential.metrics.publisher", credentialMetricsPublisher);
    state.container.register("credential.health.publisher", credentialHealthPublisher);
    state.container.register("credential.expiry.guard", credentialExpiryGuard);
    state.container.register("credential.revocation.guard", credentialRevocationGuard);
    state.container.register("credential.consistency.validator", credentialConsistencyValidator);
    state.container.register("credential.binding.factory", (input) => new CredentialBinding(input));
    state.container.register("credential.authentication.context.factory", (input) => new AuthenticationContext(input));
    state.container.register("dsp.specification.configuration", specificationConfiguration);
    state.container.register("dsp.specification.registry", specificationRegistry);
    state.container.register("dsp.specification.repository", specificationRegistry.repository);
    state.container.register("dsp.specification.resolver", specificationRegistry.resolver);
    state.container.register("dsp.specification.versionManager", specificationRegistry.versionManager);
    state.container.register("dsp.specification.validator", specificationRegistry.validator);
    state.container.register("dsp.specification.schemaValidator", specificationRegistry.schemaValidator);
    state.container.register("dsp.specification.capabilityResolver", specificationRegistry.capabilityResolver);
    state.container.register("dsp.specification.compatibilityChecker", specificationRegistry.compatibilityChecker);
    state.container.register("dsp.specification.environmentResolver", specificationRegistry.environmentResolver);
    state.container.register("dsp.specification.activationManager", specificationRegistry.activationManager);
    state.container.register("dsp.specification.parser", specificationRegistry.parser);
    state.container.register("dsp.specification.serializer", specificationRegistry.serializer);
    state.container.register("dsp.specification.cache", specificationRegistry.cache);
    state.container.register("dsp.specification.signatureValidator", specificationRegistry.signatureValidator);
    state.container.register("dsp.specification.integrityValidator", specificationRegistry.integrityValidator);
    state.container.register("dsp.specification.audit", specificationRegistry.audit);
    state.container.register("dsp.specification.metrics", specificationRegistry.metrics);
    state.container.register("dsp.specification.logger", specificationRegistry.logger);
    state.container.register("dsp.specification.healthChecker", specificationRegistry.healthChecker);
    state.container.register("dsp.specification.runtimeFactory", () => specificationRegistry);
    state.container.register("dsp.protocol.registry", dspProtocolRegistry);
    state.container.register("dsp.protocol.runtimeFactory", dspProtocolRuntimeFactory);
    state.container.register("delivery.runtimeFactory", (dependencies) => createTrackSyraDeliveryRuntime({
        ...dependencies,
        credentialResolver: credentialService.resolver,
    }));
    const connectorRegistry = new InMemoryConnectorRegistry();
    const connectorResolver = new DefaultConnectorResolver(connectorRegistry);
    const connectorFactory = new OfficialDspConnectorFactory({
        providerResolver: providerResolver,
        activationGate: partnerOnboardingRuntime.activationResolver,
        logger: providerLogger,
        metrics: providerMetricsCollector,
    });
    state.container.register("connectors.registry", connectorRegistry);
    state.container.register("connectors.resolver", connectorResolver);
    state.container.register("connectors.factory", connectorFactory);
    state.container.register("connectors.supported", OFFICIAL_DSP_CONNECTORS);
    const statusSyncLogger = new TrackSyraStatusLogger();
    const statusSyncMetrics = new TrackSyraStatusMetrics();
    const statusSyncEventPublisher = new TrackSyraStatusEventPublisher();
    const statusSyncWebhookRegistry = new TrackSyraWebhookRegistry();
    const statusSyncPollingRegistry = new TrackSyraPollingRegistry();
    const statusSyncScheduler = new TrackSyraStatusScheduler();
    const statusSyncMapper = new TrackSyraStatusMapper();
    const statusSyncNormalizer = new TrackSyraStatusNormalizer(statusSyncMapper);
    const statusSyncTransitionValidator = new TrackSyraTransitionValidator();
    const statusSyncConflictResolver = new TrackSyraConflictResolver();
    const statusSyncReconciliationEngine = new TrackSyraReconciliationEngine(statusSyncTransitionValidator, statusSyncConflictResolver);
    const statusSyncProjectionUpdater = new TrackSyraProjectionUpdater();
    const statusSyncTimelineUpdater = new TrackSyraTimelineUpdater();
    const statusSyncDeadLetterRouter = new TrackSyraWebhookDeadLetterRouter();
    const statusSyncRetryQueue = new TrackSyraWebhookRetryQueue();
    const statusSyncFailureRecovery = new TrackSyraWebhookFailureRecovery(statusSyncRetryQueue, statusSyncDeadLetterRouter);
    const statusSyncAuditLogger = new TrackSyraWebhookAuditLogger();
    const statusSyncHealthMonitor = new TrackSyraPollingHealthMonitor();
    const statusSyncWebhookEventParser = new TrackSyraWebhookEventParser();
    const statusSyncWebhookSignatureVerifier = new TrackSyraWebhookSignatureVerifier();
    const statusSyncWebhookAuthenticationVerifier = new TrackSyraWebhookAuthenticationVerifier();
    const statusSyncWebhookPayloadValidator = new TrackSyraWebhookPayloadValidator();
    const statusSyncWebhookReceiver = new TrackSyraWebhookReceiver(statusSyncWebhookEventParser, statusSyncWebhookSignatureVerifier, statusSyncWebhookAuthenticationVerifier, statusSyncWebhookPayloadValidator, statusSyncLogger);
    const statusSyncWebhookValidator = new TrackSyraWebhookValidator(statusSyncWebhookSignatureVerifier, statusSyncWebhookAuthenticationVerifier, statusSyncWebhookPayloadValidator, new TrackSyraWebhookDuplicateDetector(), new TrackSyraWebhookReplayProtection(), new TrackSyraWebhookEventOrdering());
    const statusSyncWebhookRouter = new TrackSyraWebhookRouter(statusSyncWebhookRegistry);
    const statusSyncWebhookDispatcher = new TrackSyraWebhookDispatcher(statusSyncWebhookRouter, statusSyncWebhookValidator, statusSyncWebhookReceiver, statusSyncLogger, statusSyncMetrics);
    const statusSyncPollingStrategyResolver = new TrackSyraPollingStrategyResolver();
    const statusSyncPollingExecutor = new TrackSyraPollingExecutor(statusSyncMapper, statusSyncScheduler, statusSyncMetrics, statusSyncLogger, statusSyncPollingStrategyResolver);
    const statusSyncPollingDispatcher = new TrackSyraPollingDispatcher(statusSyncPollingRegistry, statusSyncPollingExecutor, statusSyncLogger, statusSyncMetrics);
    const statusSyncWebhookProcessor = new TrackSyraWebhookProcessor(statusSyncWebhookDispatcher, statusSyncNormalizer, statusSyncTransitionValidator, statusSyncReconciliationEngine, statusSyncProjectionUpdater, statusSyncTimelineUpdater, statusSyncEventPublisher, statusSyncMetrics, statusSyncLogger, statusSyncConflictResolver);
    const statusSyncPollingProcessor = new TrackSyraPollingProcessor(statusSyncPollingDispatcher);
    const statusSyncRuntimeDependenciesBase = {
        logger: statusSyncLogger,
        metrics: statusSyncMetrics,
        eventPublisher: statusSyncEventPublisher,
        webhookRegistry: statusSyncWebhookRegistry,
        pollingRegistry: statusSyncPollingRegistry,
        scheduler: statusSyncScheduler,
        mapper: statusSyncMapper,
        normalizer: statusSyncNormalizer,
        validator: statusSyncTransitionValidator,
        conflictResolver: statusSyncConflictResolver,
        reconciliationEngine: statusSyncReconciliationEngine,
        projectionUpdater: statusSyncProjectionUpdater,
        timelineUpdater: statusSyncTimelineUpdater,
        deadLetterRouter: statusSyncDeadLetterRouter,
        retryQueue: statusSyncRetryQueue,
        failureRecovery: statusSyncFailureRecovery,
        auditLogger: statusSyncAuditLogger,
        healthMonitor: statusSyncHealthMonitor,
        webhookReceiver: statusSyncWebhookReceiver,
        webhookValidator: statusSyncWebhookValidator,
        webhookDispatcher: statusSyncWebhookDispatcher,
        pollingExecutor: statusSyncPollingExecutor,
        pollingDispatcher: statusSyncPollingDispatcher,
        webhookProcessor: statusSyncWebhookProcessor,
        pollingProcessor: statusSyncPollingProcessor,
    };
    const stateSyncRepositories = {
        values: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-values"),
        snapshots: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-snapshots"),
        history: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-history"),
        versions: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-versions"),
        published: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-published"),
        distribution: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-distribution"),
        release: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-release"),
        dashboard: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-dashboard"),
        analytics: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-analytics"),
        checkpoints: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "state-sync-checkpoints"),
    };
    const stateSyncRegistry = new StateRegistry(stateSyncRepositories.values);
    const stateSyncSnapshotManager = new StateSnapshotManager(stateSyncRepositories.snapshots);
    const stateSyncHistoryManager = new StateHistoryManager(stateSyncRepositories.history);
    const stateSyncVersionManager = new StateVersionManager(stateSyncRepositories.versions);
    const stateSyncPublisher = new ProjectionPublisher(stateSyncRepositories.distribution, stateSyncRepositories.release, stateSyncRepositories.dashboard, stateSyncRepositories.analytics, stateSyncRepositories.checkpoints);
    const stateSyncTimelineBuilder = new TimelineBuilder();
    const stateSyncTimelinePublisher = new TimelinePublisher(stateSyncRepositories.published);
    state.container.register("status.sync.logger", statusSyncLogger);
    state.container.register("status.sync.metrics", statusSyncMetrics);
    state.container.register("status.sync.eventPublisher", statusSyncEventPublisher);
    state.container.register("status.sync.webhookRegistry", statusSyncWebhookRegistry);
    state.container.register("status.sync.pollingRegistry", statusSyncPollingRegistry);
    state.container.register("status.sync.scheduler", statusSyncScheduler);
    state.container.register("status.sync.mapper", statusSyncMapper);
    state.container.register("status.sync.normalizer", statusSyncNormalizer);
    state.container.register("status.sync.transitionValidator", statusSyncTransitionValidator);
    state.container.register("status.sync.conflictResolver", statusSyncConflictResolver);
    state.container.register("status.sync.reconciliationEngine", statusSyncReconciliationEngine);
    state.container.register("status.sync.projectionUpdater", statusSyncProjectionUpdater);
    state.container.register("status.sync.timelineUpdater", statusSyncTimelineUpdater);
    state.container.register("status.sync.deadLetterRouter", statusSyncDeadLetterRouter);
    state.container.register("status.sync.retryQueue", statusSyncRetryQueue);
    state.container.register("status.sync.failureRecovery", statusSyncFailureRecovery);
    state.container.register("status.sync.auditLogger", statusSyncAuditLogger);
    state.container.register("status.sync.healthMonitor", statusSyncHealthMonitor);
    state.container.register("status.sync.webhookReceiver", statusSyncWebhookReceiver);
    state.container.register("status.sync.webhookValidator", statusSyncWebhookValidator);
    state.container.register("status.sync.webhookDispatcher", statusSyncWebhookDispatcher);
    state.container.register("status.sync.pollingExecutor", statusSyncPollingExecutor);
    state.container.register("status.sync.pollingDispatcher", statusSyncPollingDispatcher);
    state.container.register("status.sync.webhookProcessor", statusSyncWebhookProcessor);
    state.container.register("status.sync.pollingProcessor", statusSyncPollingProcessor);
    if (!statusSyncWebhookRegistry.resolve("*")) {
        statusSyncWebhookRegistry.register("*", async (event) => await statusSyncWebhookProcessor.process(event));
    }
    if (!statusSyncPollingRegistry.resolve("*")) {
        statusSyncPollingRegistry.register("*", (input) => statusSyncPollingExecutor.execute(input));
    }
    state.container.register("state.sync.registry", stateSyncRegistry);
    state.container.register("state.sync.snapshotManager", stateSyncSnapshotManager);
    state.container.register("state.sync.historyManager", stateSyncHistoryManager);
    state.container.register("state.sync.versionManager", stateSyncVersionManager);
    state.container.register("state.sync.projectionPublisher", stateSyncPublisher);
    state.container.register("state.sync.timelineBuilder", stateSyncTimelineBuilder);
    state.container.register("state.sync.timelinePublisher", stateSyncTimelinePublisher);
    state.container.register("state.sync.runtimeFactory", (orchestrator) => new StateSyncRuntimeEngine({
        ...statusSyncRuntimeDependenciesBase,
        bridge: new DistributionStatusSyncEngineBridge(orchestrator),
    }));
    state.container.register("status.sync.runtimeFactory", (orchestrator) => new TrackSyraStatusSyncRuntimeEngine({
        ...statusSyncRuntimeDependenciesBase,
        bridge: new DistributionStatusSyncEngineBridge(orchestrator),
    }));
    const royaltyRepositories = {
        records: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-records"),
        stages: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-stages"),
        counters: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-counters"),
        observations: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-observations"),
        rates: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-rates"),
        holds: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-holds"),
        adjustments: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-adjustments"),
        snapshots: runtimeRepositoryFactory(runtimeStorageRepository, "distribution", "royalty-snapshots"),
    };
    const royaltyRegistry = new RoyaltyRegistry(royaltyRepositories.records);
    const royaltyLifecycleManager = new RoyaltyLifecycleManager(royaltyRepositories.stages);
    const royaltyLogger = new RoyaltyLogger();
    const royaltyMetrics = new RoyaltyMetrics(royaltyRepositories.counters, royaltyRepositories.observations);
    const royaltyHealthChecker = new RoyaltyHealthChecker();
    const royaltyReportParser = new RoyaltyReportParser();
    const royaltyCurrencyNormalizer = new RoyaltyCurrencyNormalizer();
    const royaltyTerritoryNormalizer = new RoyaltyTerritoryNormalizer();
    const royaltyProductNormalizer = new RoyaltyProductNormalizer();
    const royaltyReportNormalizer = new RoyaltyReportNormalizer(royaltyCurrencyNormalizer, royaltyTerritoryNormalizer, royaltyProductNormalizer);
    const royaltyVersionManager = new RoyaltyVersionManager();
    const royaltyLedgerBuilder = new RoyaltyLedgerBuilder(royaltyVersionManager);
    const royaltyTaxCalculator = new RoyaltyTaxCalculator();
    const royaltyExchangeRateProvider = new RoyaltyExchangeRateProvider(royaltyRepositories.rates);
    const royaltyCurrencyConversionEngine = new RoyaltyCurrencyConversionEngine(royaltyExchangeRateProvider);
    const royaltyRevenueCalculator = new RoyaltyRevenueCalculator(royaltyTaxCalculator, royaltyCurrencyConversionEngine);
    const royaltyRevenueAllocator = new RoyaltyRevenueAllocator();
    const royaltySettlementManager = new RoyaltySettlementManager();
    const royaltyStatementGenerator = new RoyaltyStatementGenerator();
    const royaltyHoldManager = new RoyaltyHoldManager(royaltyRepositories.holds);
    const royaltyAdjustmentManager = new RoyaltyAdjustmentManager(royaltyRepositories.adjustments);
    const royaltyDuplicateDetection = new RoyaltyDuplicateDetection();
    const royaltyConflictResolver = new RoyaltyConflictResolver();
    const royaltyReconciliationEngine = new RoyaltyReconciliationEngine(royaltyDuplicateDetection, royaltyConflictResolver);
    const royaltyAuditTrail = new RoyaltyAuditTrail();
    const royaltyFinancialHistory = new RoyaltyFinancialHistory();
    const royaltyRevenueDashboard = new RoyaltyRevenueDashboard(royaltyRepositories.snapshots);
    const royaltyAnalyticsPublisher = new RoyaltyAnalyticsPublisher();
    const royaltyLabelStatements = new RoyaltyLabelStatements();
    const royaltyDistributorReports = new RoyaltyDistributorReports();
    const royaltyReportImportManager = new RoyaltyReportImportManager(royaltyRegistry, royaltyLifecycleManager, royaltyReportParser, royaltyReportNormalizer, royaltyLedgerBuilder, royaltyRevenueCalculator, royaltySettlementManager, royaltyStatementGenerator, royaltyReconciliationEngine, royaltyAuditTrail, royaltyFinancialHistory, royaltyLogger, royaltyMetrics, royaltyAnalyticsPublisher);
    const royaltyBatchImportEngine = new RoyaltyBatchImportEngine(royaltyReportImportManager);
    const royaltyIncrementalImport = new RoyaltyIncrementalImport(royaltyReportImportManager);
    const royaltyScheduledImport = new RoyaltyScheduledImport(royaltyReportImportManager);
    const royaltyManualImport = new RoyaltyManualImport(royaltyReportImportManager);
    const royaltyImportRecovery = new RoyaltyImportRecovery(royaltyRegistry, royaltyReportImportManager);
    const royaltyRuntimeDependencies = {
        repositories: royaltyRepositories,
        registry: royaltyRegistry,
        lifecycle: royaltyLifecycleManager,
        resolver: new RoyaltyResolver(royaltyRegistry),
        logger: royaltyLogger,
        metrics: royaltyMetrics,
        parser: royaltyReportParser,
        normalizer: royaltyReportNormalizer,
        currencyNormalizer: royaltyCurrencyNormalizer,
        territoryNormalizer: royaltyTerritoryNormalizer,
        productNormalizer: royaltyProductNormalizer,
        ledgerBuilder: royaltyLedgerBuilder,
        revenueCalculator: royaltyRevenueCalculator,
        settlementManager: royaltySettlementManager,
        statementGenerator: royaltyStatementGenerator,
        reconciliationEngine: royaltyReconciliationEngine,
        auditTrail: royaltyAuditTrail,
        financialHistory: royaltyFinancialHistory,
        revenueDashboard: royaltyRevenueDashboard,
        analyticsPublisher: royaltyAnalyticsPublisher,
    };
    state.container.register("royalty.registry", royaltyRegistry);
    state.container.register("royalty.lifecycleManager", royaltyLifecycleManager);
    state.container.register("royalty.logger", royaltyLogger);
    state.container.register("royalty.metrics", royaltyMetrics);
    state.container.register("royalty.healthChecker", royaltyHealthChecker);
    state.container.register("royalty.reportParser", royaltyReportParser);
    state.container.register("royalty.reportNormalizer", royaltyReportNormalizer);
    state.container.register("royalty.currencyNormalizer", royaltyCurrencyNormalizer);
    state.container.register("royalty.territoryNormalizer", royaltyTerritoryNormalizer);
    state.container.register("royalty.productNormalizer", royaltyProductNormalizer);
    state.container.register("royalty.ledgerBuilder", royaltyLedgerBuilder);
    state.container.register("royalty.revenueCalculator", royaltyRevenueCalculator);
    state.container.register("royalty.revenueAllocator", royaltyRevenueAllocator);
    state.container.register("royalty.settlementManager", royaltySettlementManager);
    state.container.register("royalty.statementGenerator", royaltyStatementGenerator);
    state.container.register("royalty.holdManager", royaltyHoldManager);
    state.container.register("royalty.adjustmentManager", royaltyAdjustmentManager);
    state.container.register("royalty.reconciliationEngine", royaltyReconciliationEngine);
    state.container.register("royalty.auditTrail", royaltyAuditTrail);
    state.container.register("royalty.financialHistory", royaltyFinancialHistory);
    state.container.register("royalty.versionManager", royaltyVersionManager);
    state.container.register("royalty.artistStatements", new RoyaltyArtistStatements());
    state.container.register("royalty.labelStatements", royaltyLabelStatements);
    state.container.register("royalty.distributorReports", royaltyDistributorReports);
    state.container.register("royalty.revenueDashboard", royaltyRevenueDashboard);
    state.container.register("royalty.analyticsPublisher", royaltyAnalyticsPublisher);
    state.container.register("royalty.batchImportEngine", royaltyBatchImportEngine);
    state.container.register("royalty.incrementalImport", royaltyIncrementalImport);
    state.container.register("royalty.scheduledImport", royaltyScheduledImport);
    state.container.register("royalty.manualImport", royaltyManualImport);
    state.container.register("royalty.importRecovery", royaltyImportRecovery);
    state.container.register("royalty.runtimeFactory", () => new RoyaltyRuntimeEngine(royaltyRuntimeDependencies));
    state.container.register("royalty.coordinator.factory", (runtime) => new RoyaltyCoordinator(runtime));
    state.container.register("observability.runtime", observabilityRuntime);
    state.container.register("observability.runtimeFactory", () => new ObservabilityRuntime(observabilityRuntimeDependencies));
    state.container.register("observability.logger", observabilityRuntime.logger);
    state.container.register("observability.logSink", observabilityRuntime.logSink);
    state.container.register("observability.logRouter", observabilityRuntime.logRouter);
    state.container.register("observability.logAggregator", observabilityRuntime.logAggregator);
    state.container.register("observability.logContextManager", observabilityRuntime.logContextManager);
    state.container.register("observability.correlationIdManager", observabilityRuntime.correlationIdManager);
    state.container.register("observability.requestIdGenerator", observabilityRuntime.requestIdGenerator);
    state.container.register("observability.auditLogManager", observabilityRuntime.auditLogManager);
    state.container.register("observability.securityLogManager", observabilityRuntime.securityLogManager);
    state.container.register("observability.errorLogManager", observabilityRuntime.errorLogManager);
    state.container.register("observability.metricsRuntime", observabilityRuntime.metricsRuntime);
    state.container.register("observability.metricsRegistry", observabilityRuntime.metricsRegistry);
    state.container.register("observability.runtimeCounters", observabilityRuntime.runtimeCounters);
    state.container.register("observability.gauges", observabilityRuntime.gauges);
    state.container.register("observability.histograms", observabilityRuntime.histograms);
    state.container.register("observability.timers", observabilityRuntime.timers);
    state.container.register("observability.queueMetrics", observabilityRuntime.queueMetrics);
    state.container.register("observability.workerMetrics", observabilityRuntime.workerMetrics);
    state.container.register("observability.dspRuntimeMetrics", observabilityRuntime.dspRuntimeMetrics);
    state.container.register("observability.royaltyMetrics", observabilityRuntime.royaltyMetrics);
    state.container.register("observability.stateSyncMetrics", observabilityRuntime.stateSyncMetrics);
    state.container.register("observability.workflowMetrics", observabilityRuntime.workflowMetrics);
    state.container.register("observability.traceRuntime", observabilityRuntime.traceRuntime);
    state.container.register("observability.spanManager", observabilityRuntime.spanManager);
    state.container.register("observability.parentChildSpanResolver", observabilityRuntime.parentChildSpanResolver);
    state.container.register("observability.pipelineTraceBuilder", observabilityRuntime.pipelineTraceBuilder);
    state.container.register("observability.runtimeTracePublisher", observabilityRuntime.runtimeTracePublisher);
    state.container.register("observability.healthRuntime", observabilityRuntime.healthRuntime);
    state.container.register("observability.componentHealthRegistry", observabilityRuntime.componentHealthRegistry);
    state.container.register("observability.readinessEngine", observabilityRuntime.readinessEngine);
    state.container.register("observability.livenessEngine", observabilityRuntime.livenessEngine);
    state.container.register("observability.startupValidator", observabilityRuntime.startupValidator);
    state.container.register("observability.shutdownValidator", observabilityRuntime.shutdownValidator);
    state.container.register("observability.dependencyHealthAnalyzer", observabilityRuntime.dependencyHealthAnalyzer);
    state.container.register("observability.alertEngine", observabilityRuntime.alertEngine);
    state.container.register("observability.alertRules", observabilityRuntime.alertRules);
    state.container.register("observability.alertDispatcher", observabilityRuntime.alertDispatcher);
    state.container.register("observability.incidentManager", observabilityRuntime.incidentManager);
    state.container.register("observability.incidentTimeline", observabilityRuntime.incidentTimeline);
    state.container.register("observability.escalationPolicies", observabilityRuntime.escalationPolicies);
    state.container.register("observability.runtimeProfiler", observabilityRuntime.runtimeProfiler);
    state.container.register("observability.pipelinePerformanceAnalyzer", observabilityRuntime.pipelinePerformanceAnalyzer);
    state.container.register("observability.queuePerformanceMonitor", observabilityRuntime.queuePerformanceMonitor);
    state.container.register("observability.workerPerformanceMonitor", observabilityRuntime.workerPerformanceMonitor);
    state.container.register("observability.memoryAnalyzer", observabilityRuntime.memoryAnalyzer);
    state.container.register("observability.cpuAnalyzer", observabilityRuntime.cpuAnalyzer);
    state.container.register("observability.throughputAnalyzer", observabilityRuntime.throughputAnalyzer);
    state.container.register("observability.bottleneckDetector", observabilityRuntime.bottleneckDetector);
    state.container.register("observability.diagnosticRuntime", observabilityRuntime.diagnosticRuntime);
    state.container.register("observability.dependencyDiagnostics", observabilityRuntime.dependencyDiagnostics);
    state.container.register("observability.runtimeDiagnostics", observabilityRuntime.runtimeDiagnostics);
    state.container.register("observability.failureAnalyzer", observabilityRuntime.failureAnalyzer);
    state.container.register("observability.recoveryAnalyzer", observabilityRuntime.recoveryAnalyzer);
    state.container.register("observability.deadlockDetection", observabilityRuntime.deadlockDetection);
    state.container.register("observability.configurationValidator", observabilityRuntime.configurationValidator);
    state.container.register("observability.runtimeDashboard", observabilityRuntime.runtimeDashboard);
    state.container.register("observability.workerDashboard", observabilityRuntime.workerDashboard);
    state.container.register("observability.queueDashboard", observabilityRuntime.queueDashboard);
    state.container.register("observability.providerDashboard", observabilityRuntime.providerDashboard);
    state.container.register("observability.distributionDashboard", observabilityRuntime.distributionDashboard);
    state.container.register("observability.royaltyDashboard", observabilityRuntime.royaltyDashboard);
    state.container.register("observability.stateSyncDashboard", observabilityRuntime.stateSyncDashboard);
    state.container.register("observability.systemDashboard", observabilityRuntime.systemDashboard);
    state.container.register("observability.runtimeStatistics", observabilityRuntime.runtimeStatistics);
    state.container.register("observability.runtimeMonitoringReporter", observabilityRuntime.runtimeMonitoringReporter);
    state.container.register("observability.healthReporter", observabilityRuntime.healthReporter);
    state.container.register("observability.observabilityEventPublisher", observabilityRuntime.observabilityEventPublisher);
    observabilityRuntime.componentHealthRegistry.register("partner-onboarding", new HealthStatus({
        componentId: "partner-onboarding",
        category: "Application",
        healthy: true,
        message: "Partner onboarding runtime ready",
        metadata: {
            partnerCount: OFFICIAL_DSP_PARTNERS.length,
            approvedPartners: partnerOnboardingRuntime.list().filter((partner) => partner.approved).length,
            activePartners: partnerOnboardingRuntime.list().filter((partner) => partner.approved && partner.credentialsInstalled && partner.certificationPassed).length,
        },
    }));
    observabilityRuntime.componentHealthRegistry.register("partner-credentials", credentialService.healthChecker.check("partner-credentials"));
    const validationConfiguration = new ValidationConfiguration({
        validationId: `${context.configuration.compositionId}:validation`,
        metadata: { compositionId: context.configuration.compositionId },
    });
    const validationLogger = new RuntimeValidationLogger();
    const validationMetrics = new RuntimeValidationMetrics();
    const validationSerializer = new ValidationSerializer();
    const validationRegistry = new ValidationRegistryImpl();
    const validationPipeline = new ValidationPipelineImpl(validationRegistry);
    const validationScheduler = new ValidationSchedulerImpl();
    const validationEventPublisher = new ValidationValidators.ValidationEventPublisherFacade();
    const validationCoordinator = new ValidationCoordinatorImpl(validationPipeline, validationScheduler, validationLogger, validationMetrics, validationEventPublisher);
    const validationValidators = ValidationValidators.createValidationValidators([
        new ValidationValidators.PlatformValidator(),
        new ValidationValidators.RuntimeValidator(),
        new ValidationValidators.WorkflowValidator(),
        new ValidationValidators.OrchestratorValidator(),
        new ValidationValidators.QueueValidator(),
        new ValidationValidators.WorkerValidator(),
        new ValidationValidators.ProviderValidator(),
        new ValidationValidators.ConnectorValidator(),
        new ValidationValidators.StatusSyncValidator(),
        new ValidationValidators.RoyaltyValidator(),
        new ValidationValidators.ObservabilityValidator(),
        new ValidationValidators.BootstrapValidator(),
        new ValidationValidators.CompositionValidator(),
        new ValidationValidators.DependencyValidator(),
        new ValidationValidators.ConfigurationValidator(),
        new ValidationValidators.SecurityValidator(),
        new ValidationValidators.AuthenticationValidator(),
        new ValidationValidators.StorageValidator(),
        new ValidationValidators.StorageConsistencyValidator(),
        new ValidationValidators.RepositoryValidator(),
        new ValidationValidators.RepositoryConsistencyValidator(),
        new ValidationValidators.UnitOfWorkValidator(),
        new ValidationValidators.AggregateIsolationValidator(),
        new ValidationValidators.CredentialPropagationValidator(),
        new ValidationValidators.AuthenticationSnapshotValidator(),
        new ValidationValidators.CredentialVersionPinningValidator(),
        new ValidationValidators.RotationValidator(),
        new ValidationValidators.ResolverValidator(),
        new ValidationValidators.SecretExposureValidator(),
        new ValidationValidators.RuntimeAuthenticationValidator(),
        new ValidationValidators.HealthValidator(),
        new ValidationValidators.ReadinessValidator(),
        new ValidationValidators.StartupValidator(),
        new ValidationValidators.ShutdownValidator(),
        new ValidationValidators.DisasterRecoveryValidator(),
        new ValidationValidators.BackupValidator(),
        new ValidationValidators.RestoreValidator(),
        new ValidationValidators.FailoverValidator(),
        new ValidationValidators.ScalabilityValidator(),
        new ValidationValidators.PerformanceValidator(),
        new ValidationValidators.LoadValidator(),
        new ValidationValidators.ConcurrencyValidator(),
        new ValidationValidators.DataIntegrityValidator(),
        new ValidationValidators.StateMachineValidator(),
        new ValidationValidators.EventReplayValidator(),
        new ValidationValidators.ProjectionValidator(),
        new ValidationValidators.SnapshotValidator(),
        new ValidationValidators.AuditValidator(),
        new ValidationValidators.MetricsValidator(),
        new ValidationValidators.LoggingValidator(),
        new ValidationValidators.TraceValidator(),
        new ValidationValidators.ArchitectureAuditValidator(),
    ]);
    const validationRuntimeDependencies = {
        configuration: validationConfiguration,
        logger: validationLogger,
        metrics: validationMetrics,
        serializer: validationSerializer,
        configurationProvider: { get: () => validationConfiguration },
        eventPublisher: validationEventPublisher,
        registry: validationRegistry,
        pipeline: validationPipeline,
        scheduler: validationScheduler,
        coordinator: validationCoordinator,
        validators: validationValidators,
    };
    const validationRuntime = new ValidationRuntimeEngine(validationRuntimeDependencies);
    state.container.register("validation.runtime", validationRuntime);
    state.container.register("validation.runtimeFactory", () => new ValidationRuntimeEngine(validationRuntimeDependencies));
    state.container.register("validation.registry", validationRuntime.registry);
    state.container.register("validation.pipeline", validationRuntime.pipeline);
    state.container.register("validation.scheduler", validationRuntime.scheduler);
    state.container.register("validation.coordinator", validationRuntime.coordinator);
    state.container.register("validation.logger", validationRuntime.logger);
    state.container.register("validation.metrics", validationRuntime.metrics);
    state.container.register("validation.serializer", validationRuntime.serializer);
    state.container.register("validation.configurationProvider", validationRuntime.configurationProvider);
    state.container.register("validation.eventPublisher", validationRuntime.eventPublisher);
    state.container.register("validation.validators", validationRuntime.validators);
    state.container.register("validation.platformValidator", validationRuntime.platformValidator);
    state.container.register("validation.runtimeValidator", validationRuntime.runtimeValidator);
    state.container.register("validation.workflowValidator", validationRuntime.workflowValidator);
    state.container.register("validation.orchestratorValidator", validationRuntime.orchestratorValidator);
    state.container.register("validation.queueValidator", validationRuntime.queueValidator);
    state.container.register("validation.workerValidator", validationRuntime.workerValidator);
    state.container.register("validation.providerValidator", validationRuntime.providerValidator);
    state.container.register("validation.connectorValidator", validationRuntime.connectorValidator);
    state.container.register("validation.statusSyncValidator", validationRuntime.statusSyncValidator);
    state.container.register("validation.royaltyValidator", validationRuntime.royaltyValidator);
    state.container.register("validation.observabilityValidator", validationRuntime.observabilityValidator);
    state.container.register("validation.bootstrapValidator", validationRuntime.bootstrapValidator);
    state.container.register("validation.compositionValidator", validationRuntime.compositionValidator);
    state.container.register("validation.dependencyValidator", validationRuntime.dependencyValidator);
    state.container.register("validation.configurationValidator", validationRuntime.configurationValidator);
    state.container.register("validation.securityValidator", validationRuntime.securityValidator);
    state.container.register("validation.authenticationValidator", validationRuntime.authenticationValidator);
    state.container.register("validation.storageValidator", validationRuntime.storageValidator);
    state.container.register("validation.storageConsistencyValidator", validationRuntime.storageConsistencyValidator);
    state.container.register("validation.repositoryValidator", validationRuntime.repositoryValidator);
    state.container.register("validation.repositoryConsistencyValidator", validationRuntime.repositoryConsistencyValidator);
    state.container.register("validation.unitOfWorkValidator", validationRuntime.unitOfWorkValidator);
    state.container.register("validation.aggregateIsolationValidator", validationRuntime.aggregateIsolationValidator);
    state.container.register("validation.credentialPropagationValidator", validationRuntime.credentialPropagationValidator);
    state.container.register("validation.authenticationSnapshotValidator", validationRuntime.authenticationSnapshotValidator);
    state.container.register("validation.credentialVersionPinningValidator", validationRuntime.credentialVersionPinningValidator);
    state.container.register("validation.rotationValidator", validationRuntime.rotationValidator);
    state.container.register("validation.resolverValidator", validationRuntime.resolverValidator);
    state.container.register("validation.secretExposureValidator", validationRuntime.secretExposureValidator);
    state.container.register("validation.runtimeAuthenticationValidator", validationRuntime.runtimeAuthenticationValidator);
    state.container.register("validation.healthValidator", validationRuntime.healthValidator);
    state.container.register("validation.readinessValidator", validationRuntime.readinessValidator);
    state.container.register("validation.startupValidator", validationRuntime.startupValidator);
    state.container.register("validation.shutdownValidator", validationRuntime.shutdownValidator);
    state.container.register("validation.disasterRecoveryValidator", validationRuntime.disasterRecoveryValidator);
    state.container.register("validation.backupValidator", validationRuntime.backupValidator);
    state.container.register("validation.restoreValidator", validationRuntime.restoreValidator);
    state.container.register("validation.failoverValidator", validationRuntime.failoverValidator);
    state.container.register("validation.scalabilityValidator", validationRuntime.scalabilityValidator);
    state.container.register("validation.performanceValidator", validationRuntime.performanceValidator);
    state.container.register("validation.loadValidator", validationRuntime.loadValidator);
    state.container.register("validation.concurrencyValidator", validationRuntime.concurrencyValidator);
    state.container.register("validation.dataIntegrityValidator", validationRuntime.dataIntegrityValidator);
    state.container.register("validation.stateMachineValidator", validationRuntime.stateMachineValidator);
    state.container.register("validation.eventReplayValidator", validationRuntime.eventReplayValidator);
    state.container.register("validation.projectionValidator", validationRuntime.projectionValidator);
    state.container.register("validation.snapshotValidator", validationRuntime.snapshotValidator);
    state.container.register("validation.auditValidator", validationRuntime.auditValidator);
    state.container.register("validation.metricsValidator", validationRuntime.metricsValidator);
    state.container.register("validation.loggingValidator", validationRuntime.loggingValidator);
    state.container.register("validation.traceValidator", validationRuntime.traceValidator);
    validationRuntime.registry.register(partnerOnboardingRuntime.createValidator());
    const publishingRuntime = createPublishingStandardsRuntime({
        logger: createLogger({ component: "publishing-runtime" }),
    });
    state.container.register("publishing.registry", publishingRuntime.registry);
    state.container.register("publishing.service", publishingRuntime.service);
    state.container.register("publishing.validationWorker", publishingRuntime.validationWorker);
    state.container.register("publishing.cwrExportWorker", publishingRuntime.cwrExportWorker);
    state.container.register("publishing.rightsVerificationWorker", publishingRuntime.rightsVerificationWorker);
    state.container.register("publishing.retryWorker", publishingRuntime.retryWorker);
    partnerOnboardingRuntime.info("Partner onboarding runtime registered", { partners: OFFICIAL_DSP_PARTNERS.length });
    state.container.register("queue.dispatcher.factory", (runtime) => new DistributionQueueDispatcher(runtime));
    state.container.register("execution.stageRegistry.factory", (runtime) => {
        const registry = new ExecutionStageRegistry();
        registerDistributionExecutionStages(registry, new DistributionQueueDispatcher(runtime));
        return registry;
    });
    if (!state.moduleRegistry.list().length) {
        state.moduleRegistry.registerAll(context.graph.modules);
    }
    if (!state.serviceRegistry.list().length) {
        state.serviceRegistry.registerAll(state.services.length ? state.services : createDefaultServices(context.graph.modules));
    }
    return state.moduleRegistry.list().length ? state.moduleRegistry.list() : context.graph.modules;
}
export class DistributionCompositionRoot {
    state;
    constructor(state) {
        this.state = state;
    }
    bootstrap(context) {
        const loadedModules = seedRegistries(this.state, context).map((module) => module.moduleName);
        const bootstrapResult = new BootstrapResult({
            bootstrapId: context.bootstrapId,
            success: true,
            failure: false,
            startedAt: context.startedAt,
            loadedModules,
            warnings: [],
            errors: [],
            metadata: {
                compositionId: context.configuration.compositionId,
            },
        });
        return bootstrapResult;
    }
}
export async function createDistributionBootstrapDependencies(options = {}) {
    loadRuntimeEnv();
    const logger = createLogger({ component: "worker-bootstrap" });
    const env = readQueueEnvironment();
    const runtime = new QueueWorkerRuntimeClass(logger, new WorkerSupervisor(), readQueueEnvironment);
    const queueSchedulers = createQueueSchedulers();
    const runtimeEnv = readEnv();
    const state = {
        modules: [],
        services: [],
        container: new DistributionDependencyContainer(),
        moduleRegistry: new DistributionModuleRegistry(),
        serviceRegistry: new DistributionServiceRegistry(),
    };
    const sequelize = createSequelize(runtimeEnv.DATABASE_URL ?? "");
    const sequelizeSqlExecutor = new SequelizeSqlExecutor(sequelize);
    const adminSupabaseClient = createAdminSupabaseClient();
    const distributionAudioUrlResolver = createDistributionAudioUrlResolver(adminSupabaseClient);
    const distributionStore = new SqlDistributionStore(sequelizeSqlExecutor, distributionAudioUrlResolver);
    const distributionIdGenerator = new DistributionIdGenerator(sequelizeSqlExecutor);
    const enterpriseDistributionService = new EnterpriseDistributionService(sequelizeSqlExecutor, distributionStore, distributionIdGenerator);
    const backupRecoveryService = new BackupDisasterRecoveryService({
        sql: sequelizeSqlExecutor,
        distributionService: enterpriseDistributionService,
    });
    const enterpriseOperationsService = new EnterpriseOperationsService(sequelizeSqlExecutor, distributionStore, enterpriseDistributionService);
    const enterpriseRightsRuntime = createEnterpriseRightsRuntime({
        sql: sequelizeSqlExecutor,
        distributionStore,
        enterpriseDistributionService,
        enterpriseOperationsService,
        logger,
    });
    const metadataTransformer = new MetadataTransformer();
    const metadataValidator = new MetadataValidator();
    const metadataHasher = new MetadataHasher();
    const metadataComparator = new MetadataComparator(metadataHasher);
    const ddexFoundationService = new DdexFoundationService(new DdexErnMapper(), new DdexMeadMapper(), new DdexRinMapper(), new DdexValidator(), new DdexXmlSerializer(), new DdexCompressionService(false), null);
    const metadataIntelligenceEngine = new MetadataIntelligenceEngine({
        sql: sequelizeSqlExecutor,
        distributionStore,
        enterpriseDistributionService,
        enterpriseOperationsService,
        enterpriseRightsService: enterpriseRightsRuntime.service,
        metadataTransformer,
        metadataValidator,
        metadataComparator,
        metadataHasher,
        ddexFoundationService,
        audioFingerprintingEngine: null,
        releaseDeliveryEngine: null,
        logger,
    });
    const releaseAutomationEngine = new ReleaseAutomationEngine({
        sql: sequelizeSqlExecutor,
        distributionStore,
        releaseDeliveryEngine: null,
        enterpriseOperationsService,
        enterpriseDistributionService,
        metadataIntelligenceEngine,
        logger,
    });
    state.container.register("distribution.releaseAutomationEngine", releaseAutomationEngine);
    state.container.register("backup.recoveryService", backupRecoveryService);
    const deliveryWorkspaceRoot = join(distributionPersistenceBasePath(), "delivery-workspaces");
    const deliveryOutputRoot = join(distributionPersistenceBasePath(), "delivery-output");
    const packageLayout = new PackageLayout();
    const packageAssets = new PackageAssets(packageLayout, (release) => new PackageMetadata(release));
    const packageBuilder = new PackageBuilder(packageAssets, packageLayout);
    const packageValidator = new PackageValidator(packageLayout);
    const packageSerializer = new PackageSerializer();
    const packageFingerprint = new PackageFingerprint();
    const packageStreamWriter = new PackageStreamWriter(packageLayout, packageSerializer, packageFingerprint);
    const releaseDeliveryEngine = new ReleaseDeliveryEngine({
        metadataTransformer,
        metadataValidator,
        packageBuilder,
        packageDirector: new PackageDirector(packageValidator, packageStreamWriter, packageSerializer, logger, new PackageMetrics()),
        packageIntegrity: new PackageIntegrity(),
        packageComparator: new PackageComparator(),
        packageAudit: new PackageAudit(),
        checksumGenerator: new ChecksumGenerator(),
        packageLayout,
        packageSerializer,
        packageVersion: new PackageVersionInfo(),
        packageSigning: null,
        logger,
        ddexFoundation: ddexFoundationService,
        connectorFramework: null,
        workspaceRoot: deliveryWorkspaceRoot,
        outputRoot: deliveryOutputRoot,
        cleanupTemporaryWorkspace: true,
        resumeInterrupted: true,
    });
    const providerResolver = { resolve: () => null };
    const connectorFactory = new OfficialDspConnectorFactory({
        providerResolver: providerResolver,
        logger,
        metrics: null,
    });
    const connectorFramework = new DSPConnectorFramework({
        connectorFactory,
        releaseDeliveryEngine,
        logger,
        retryPolicy: new ExponentialProviderRetryStrategy(),
        capabilityMatrix: createConnectorCapabilityMatrix(),
        defaultConnectorVersion: "1.0.0",
    });
    const youtubeConnector = connectorFramework.createYouTubeMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const youTubeEnterpriseService = new YouTubeEnterpriseService({
        connector: youtubeConnector,
        logger,
    });
    const amazonConnector = connectorFramework.createAmazonMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const amazonMusicEnterpriseService = new AmazonMusicEnterpriseService({
        connector: amazonConnector,
        logger,
    });
    const deezerConnector = connectorFramework.createDeezerMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const deezerEnterpriseService = new DeezerEnterpriseService({
        connector: deezerConnector,
        logger,
    });
    const jioSaavnConnector = connectorFramework.createJioSaavnMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const jioSaavnEnterpriseService = new JioSaavnEnterpriseService({
        connector: jioSaavnConnector,
        logger,
    });
    const anghamiConnector = connectorFramework.createAnghamiMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const anghamiEnterpriseService = new AnghamiEnterpriseService({
        connector: anghamiConnector,
        logger,
    });
    const boomplayConnector = connectorFramework.createBoomplayMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const boomplayEnterpriseService = new BoomplayEnterpriseService({
        connector: boomplayConnector,
        logger,
    });
    const tiktokConnector = connectorFramework.createTikTokMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const tiktokEnterpriseService = new TikTokEnterpriseService({
        connector: tiktokConnector,
        logger,
    });
    const metaRightsConnector = connectorFramework.createMetaRightsManagerConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const metaRightsEnterpriseService = new MetaRightsEnterpriseService({
        connector: metaRightsConnector,
        logger,
    });
    const tidalConnector = connectorFramework.createTidalMusicConnector({
        configuration: {
            apiVersion: "1.0.0",
            ingestionBaseUrl: null,
            oauthAuthorizeUrl: null,
            oauthTokenUrl: null,
            deliveryEndpointUrl: null,
            statusEndpointUrl: null,
            withdrawalEndpointUrl: null,
            restoreEndpointUrl: null,
            healthEndpointUrl: null,
            requestTimeoutMs: null,
            webhookUrl: null,
            webhookSecret: null,
            clientId: null,
            clientSecret: null,
            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
            sandboxMode: true,
        },
    });
    const tidalEnterpriseService = new TidalEnterpriseService({
        connector: tidalConnector,
        logger,
    });
    const royaltyStore = new RoyaltyStore(sequelizeSqlExecutor);
    const royaltyEngine = new RoyaltyEngine({ royaltyStore });
    const royaltyAccountingService = new RoyaltyAccountingService({
        db: sequelizeSqlExecutor,
        royaltyStore,
        walletService: new PayoutWalletService(sequelizeSqlExecutor),
        statementGenerator: new RoyaltyDocumentGenerator(),
    });
    const fraudStore = new FraudStore(sequelizeSqlExecutor);
    const fraudDetectionEngine = new FraudDetectionEngine({
        store: fraudStore,
        featureExtractor: new FraudFeatureExtractor(fraudStore),
        ruleEngine: new FraudRuleEngine(),
    });
    const analyticsDependencies = {
        streamAnalyticsService: new StreamAnalyticsService(sequelizeSqlExecutor),
        revenueAnalyticsService: new RevenueAnalyticsService(sequelizeSqlExecutor),
        fraudAnalyticsService: new FraudAnalyticsService(sequelizeSqlExecutor),
        distributionAnalyticsService: new DistributionAnalyticsService(sequelizeSqlExecutor),
    };
    const realtimeEventStore = new RealtimeEventStore(sequelizeSqlExecutor);
    const eventBus = new EventBus(realtimeEventStore);
    const realtimeDependencies = {
        eventBus,
        liveDashboardService: new LiveDashboardService({ db: sequelizeSqlExecutor, eventBus }),
    };
    const mediaEnv = runtimeEnv;
    const mediaStorageProviderValue = mediaEnv.MEDIA_STORAGE_PROVIDER;
    const mediaStorageProvider = (mediaStorageProviderValue === "r2" || mediaStorageProviderValue === "s3")
        ? mediaStorageProviderValue
        : "supabase";
    const mediaStorageAdapter = mediaStorageProvider === "supabase"
        ? new SupabaseMediaStorageAdapter(adminSupabaseClient)
        : new S3CompatibleMediaStorageAdapter(mediaStorageProvider);
    const ffmpegRunner = new FfmpegRunner();
    const mediaOutputBucket = runtimeEnv.MEDIA_OUTPUT_BUCKET ?? "media-private";
    const mediaValidationService = new MediaValidationService(ffmpegRunner);
    const audioTranscodingService = new AudioTranscodingService(mediaStorageAdapter, ffmpegRunner, mediaOutputBucket);
    const waveformGenerator = new WaveformGenerator(mediaStorageAdapter, ffmpegRunner, mediaOutputBucket);
    const previewClipGenerator = new PreviewClipGenerator(mediaStorageAdapter, ffmpegRunner, mediaOutputBucket);
    const artworkOptimizationService = new ArtworkOptimizationService(mediaStorageAdapter, ffmpegRunner, mediaOutputBucket);
    const audioFingerprintService = new AudioFingerprintService(adminSupabaseClient, ffmpegRunner);
    const audioFingerprintingEngine = new AudioFingerprintingEngine({
        sql: sequelizeSqlExecutor,
        distributionStore,
        enterpriseDistributionService,
        enterpriseOperationsService,
        enterpriseRightsService: enterpriseRightsRuntime.service,
        metadataTransformer,
        ddexFoundationService,
        audioFingerprintService,
        ffmpeg: ffmpegRunner,
        releaseDeliveryEngine: null,
        logger,
    });
    const mediaProcessingEngine = new MediaProcessingEngine({
        db: adminSupabaseClient,
        storage: mediaStorageAdapter,
        ffmpeg: ffmpegRunner,
        validation: mediaValidationService,
        transcoder: audioTranscodingService,
        waveform: waveformGenerator,
        preview: previewClipGenerator,
        artwork: artworkOptimizationService,
        fingerprint: audioFingerprintService,
    });
    const promoAssetStorage = mediaStorageAdapter;
    const promoAssetFfmpeg = new PromoAssetFfmpegService();
    const promoAssetPlatformValidation = new PromoAssetPlatformValidationEngine(adminSupabaseClient, promoAssetStorage, promoAssetFfmpeg);
    const promoAssetProcessor = new PromoAssetVideoProcessor(adminSupabaseClient, promoAssetStorage, promoAssetFfmpeg, promoAssetPlatformValidation);
    const payoutEngine = new PayoutEngine({
        walletService: createWalletService(),
        payoutRequestService: new PayoutRequestService({ sequelize }),
        payoutService: new PayoutService({ sequelize }),
    });
    const recovery = new AdminRecoveryService(adminSupabaseClient);
    const passwordResetService = new PasswordResetService(adminSupabaseClient);
    const resendWebhookService = new ResendWebhookService(adminSupabaseClient);
    const tooLostCredentialStore = new TooLostCredentialStore(adminSupabaseClient);
    const tooLostConfig = {
        clientId: runtimeEnv.TOO_LOST_CLIENT_ID ?? "",
        clientSecret: runtimeEnv.TOO_LOST_CLIENT_SECRET ?? "",
        webhookSecret: runtimeEnv.TOO_LOST_WEBHOOK_SECRET ?? "",
        webhooksEnabled: ["1", "true", "yes", "on"].includes(String(runtimeEnv.TOO_LOST_WEBHOOKS_ENABLED ?? "").toLowerCase()),
        apiUrl: runtimeEnv.TOO_LOST_API_URL ?? runtimeEnv.TOO_LOST_API_BASE_URL ?? "https://api.toolost.com/v1",
        oauthAuthorizeUrl: runtimeEnv.TOO_LOST_AUTHORIZE_URL ?? runtimeEnv.TOO_LOST_OAUTH_AUTHORIZE_URL ?? "https://toolost.com/oauth/authorize",
        oauthTokenUrl: runtimeEnv.TOO_LOST_TOKEN_URL ?? runtimeEnv.TOO_LOST_OAUTH_TOKEN_URL ?? "https://toolost.com/oauth/token",
        redirectUri: runtimeEnv.TOO_LOST_REDIRECT_URI ?? runtimeEnv.TOO_LOST_OAUTH_REDIRECT_URI ?? "https://app.tracksyra.com/auth/toolost/callback",
        tokenEncryptionKey: runtimeEnv.TOO_LOST_TOKEN_ENCRYPTION_KEY ?? "",
        accountProfileUrl: runtimeEnv.TOO_LOST_ACCOUNT_PROFILE_URL ?? null,
        dspTargets: (runtimeEnv.TOO_LOST_DSP_TARGETS ?? "spotify,apple_music,youtube_music,amazon_music,tiktok,meta").split(",").map((part) => part.trim()).filter(Boolean),
        sandboxMode: ["1", "true", "yes", "on"].includes(String(runtimeEnv.TOO_LOST_SANDBOX_MODE ?? "").toLowerCase()),
        liveApproved: ["1", "true", "yes", "on"].includes(String(runtimeEnv.TOO_LOST_INTEGRATION_APPROVED ?? "").toLowerCase()),
    };
    const tooLostApiClient = new TooLostApiClient(tooLostConfig, tooLostCredentialStore, fetch);
    const adapterRegistry = new PlatformAdapterRegistry(["too_lost"], "too_lost");
    adapterRegistry.register(new TooLostAdapter({
        config: tooLostConfig,
        httpClient: fetch,
        credentialStore: tooLostCredentialStore,
        api: tooLostApiClient,
    }));
    const distributionIntelligenceStore = new DistributionIntelligenceStore(sequelizeSqlExecutor);
    const distributionAnalyticsService = new DistributionAnalyticsService(sequelizeSqlExecutor);
    const distributionWorker = new DistributionWorker(distributionStore, {
        adapterRegistry,
        retryEngine: new RetryEngine(),
        intelligenceStore: distributionIntelligenceStore,
        analyticsService: distributionAnalyticsService,
    });
    const tooLostIntegrationService = new TooLostIntegrationService(distributionStore, sequelizeSqlExecutor, {
        config: tooLostConfig,
        httpClient: fetch,
        credentialStore: tooLostCredentialStore,
        api: tooLostApiClient,
        intelligence: distributionIntelligenceStore,
        ffmpeg: ffmpegRunner,
        resolveAudioUrl: distributionAudioUrlResolver,
    });
    const tooLostWebhookController = new TooLostWebhookController({
        db: sequelizeSqlExecutor,
        distributionStore,
        syncService: tooLostIntegrationService,
        intelligenceStore: distributionIntelligenceStore,
        analyticsService: distributionAnalyticsService,
    });
    const amazonWorkerDependencies = {
        enterpriseService: amazonMusicEnterpriseService,
        enterpriseOperationsService,
    };
    const amazonDeliveryWorker = new AmazonMusicDeliveryWorker(amazonWorkerDependencies);
    const amazonPollingWorker = new AmazonMusicPollingWorker(amazonWorkerDependencies);
    const amazonRetryWorker = new AmazonMusicRetryWorker(amazonWorkerDependencies);
    const amazonWebhookWorker = new AmazonMusicWebhookWorker(amazonWorkerDependencies);
    const amazonHealthWorker = new AmazonMusicHealthWorker(amazonWorkerDependencies);
    const deezerWorkerDependencies = {
        enterpriseService: deezerEnterpriseService,
        enterpriseOperationsService,
    };
    const deezerDeliveryWorker = new DeezerDeliveryWorker(deezerWorkerDependencies);
    const deezerPollingWorker = new DeezerPollingWorker(deezerWorkerDependencies);
    const deezerRetryWorker = new DeezerRetryWorker(deezerWorkerDependencies);
    const deezerWebhookWorker = new DeezerWebhookWorker(deezerWorkerDependencies);
    const deezerHealthWorker = new DeezerHealthWorker(deezerWorkerDependencies);
    const jioSaavnWorkerDependencies = {
        enterpriseService: jioSaavnEnterpriseService,
        enterpriseOperationsService,
    };
    const jioSaavnDeliveryWorker = new JioSaavnDeliveryWorker(jioSaavnWorkerDependencies);
    const jioSaavnPollingWorker = new JioSaavnPollingWorker(jioSaavnWorkerDependencies);
    const jioSaavnRetryWorker = new JioSaavnRetryWorker(jioSaavnWorkerDependencies);
    const jioSaavnWebhookWorker = new JioSaavnWebhookWorker(jioSaavnWorkerDependencies);
    const jioSaavnHealthWorker = new JioSaavnHealthWorker(jioSaavnWorkerDependencies);
    const anghamiWorkerDependencies = {
        enterpriseService: anghamiEnterpriseService,
        enterpriseOperationsService,
    };
    const anghamiDeliveryWorker = new AnghamiDeliveryWorker(anghamiWorkerDependencies);
    const anghamiPollingWorker = new AnghamiPollingWorker(anghamiWorkerDependencies);
    const anghamiRetryWorker = new AnghamiRetryWorker(anghamiWorkerDependencies);
    const anghamiWebhookWorker = new AnghamiWebhookWorker(anghamiWorkerDependencies);
    const anghamiHealthWorker = new AnghamiHealthWorker(anghamiWorkerDependencies);
    const boomplayWorkerDependencies = {
        enterpriseService: boomplayEnterpriseService,
        enterpriseOperationsService,
    };
    const boomplayDeliveryWorker = new BoomplayDeliveryWorker(boomplayWorkerDependencies);
    const boomplayPollingWorker = new BoomplayPollingWorker(boomplayWorkerDependencies);
    const boomplayRetryWorker = new BoomplayRetryWorker(boomplayWorkerDependencies);
    const boomplayWebhookWorker = new BoomplayWebhookWorker(boomplayWorkerDependencies);
    const boomplayHealthWorker = new BoomplayHealthWorker(boomplayWorkerDependencies);
    const tiktokWorkerDependencies = {
        enterpriseService: tiktokEnterpriseService,
        enterpriseOperationsService,
    };
    const tiktokDeliveryWorker = new TikTokDeliveryWorker(tiktokWorkerDependencies);
    const tiktokPollingWorker = new TikTokPollingWorker(tiktokWorkerDependencies);
    const tiktokRetryWorker = new TikTokRetryWorker(tiktokWorkerDependencies);
    const tiktokWebhookWorker = new TikTokWebhookWorker(tiktokWorkerDependencies);
    const tiktokHealthWorker = new TikTokHealthWorker(tiktokWorkerDependencies);
    const metaRightsWorkerDependencies = {
        enterpriseService: metaRightsEnterpriseService,
        enterpriseOperationsService,
    };
    const metaDeliveryWorker = new MetaDeliveryWorker(metaRightsWorkerDependencies);
    const metaPollingWorker = new MetaPollingWorker(metaRightsWorkerDependencies);
    const metaRetryWorker = new MetaRetryWorker(metaRightsWorkerDependencies);
    const metaWebhookWorker = new MetaWebhookWorker(metaRightsWorkerDependencies);
    const metaHealthWorker = new MetaHealthWorker(metaRightsWorkerDependencies);
    const tidalWorkerDependencies = {
        enterpriseService: tidalEnterpriseService,
        enterpriseOperationsService,
    };
    const tidalDeliveryWorker = new TidalDeliveryWorker(tidalWorkerDependencies);
    const tidalPollingWorker = new TidalPollingWorker(tidalWorkerDependencies);
    const tidalRetryWorker = new TidalRetryWorker(tidalWorkerDependencies);
    const tidalWebhookWorker = new TidalWebhookWorker(tidalWorkerDependencies);
    const tidalHealthWorker = new TidalHealthWorker(tidalWorkerDependencies);
    const youTubeWorkerDependencies = {
        enterpriseService: youTubeEnterpriseService,
        enterpriseOperationsService,
    };
    const youTubeDeliveryWorker = new YouTubeDeliveryWorker(youTubeWorkerDependencies);
    const youTubePollingWorker = new YouTubePollingWorker(youTubeWorkerDependencies);
    const youTubeRetryWorker = new YouTubeRetryWorker(youTubeWorkerDependencies);
    const youTubeWebhookWorker = new YouTubeWebhookWorker(youTubeWorkerDependencies);
    const youTubeHealthWorker = new YouTubeHealthWorker(youTubeWorkerDependencies);
    const youTubeContentIdWorker = new YouTubeContentIdWorker(youTubeWorkerDependencies);
    const emailWorkerRegistration = await registerEmailWorker({
        concurrency: env.workerConcurrency,
        dispatchIntervalMs: options.emailWorkerIntervalMs ?? 5000,
    });
    const backupWorkerDependencies = {
        backupService: backupRecoveryService,
    };
    const backupWorker = registerBackupWorker(backupWorkerDependencies, { concurrency: env.workerConcurrency });
    const incrementalBackupWorker = registerIncrementalBackupWorker(backupWorkerDependencies, { concurrency: env.workerConcurrency });
    const backupVerificationWorker = registerBackupVerificationWorker(backupWorkerDependencies, { concurrency: env.workerConcurrency });
    const restoreWorker = registerRestoreWorker(backupWorkerDependencies, { concurrency: env.workerConcurrency });
    const recoveryAuditWorker = registerRecoveryAuditWorker(backupWorkerDependencies, { concurrency: env.workerConcurrency });
    const workerRegistrations = [
        { name: "email", worker: emailWorkerRegistration.worker, shutdown: emailWorkerRegistration.stopDispatcher },
        { name: "backup", worker: backupWorker },
        { name: "incremental-backup", worker: incrementalBackupWorker },
        { name: "backup-verification", worker: backupVerificationWorker },
        { name: "restore", worker: restoreWorker },
        { name: "recovery-audit", worker: recoveryAuditWorker },
        { name: "distribution", worker: registerDistributionQueueWorker(distributionWorker, { concurrency: env.workerConcurrency }) },
        { name: "royalty", worker: registerRoyaltyWorker(royaltyEngine, { concurrency: env.workerConcurrency }) },
        { name: "royalty-calculation", worker: registerRoyaltyCalculationWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "statement", worker: registerStatementWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "currency", worker: registerRoyaltyCurrencyWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "tax", worker: registerRoyaltyTaxWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "reserve", worker: registerRoyaltyReserveWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "adjustment", worker: registerRoyaltyAdjustmentWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "payment", worker: registerRoyaltyPaymentWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "forecast", worker: registerRoyaltyForecastWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "royalty-audit", worker: registerRoyaltyAuditWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "royalty-retry", worker: registerRoyaltyRetryWorker(royaltyAccountingService, { concurrency: env.workerConcurrency }) },
        { name: "fraud", worker: registerFraudWorker(fraudDetectionEngine, { concurrency: env.workerConcurrency }) },
        { name: "review", worker: registerReviewQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "fraud-review", worker: registerFraudReviewQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "validation", worker: registerValidationQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "delivery", worker: registerDeliveryQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "retry", worker: registerRetryQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "withdrawal", worker: registerWithdrawalQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "takedown", worker: registerTakedownQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "audit", worker: registerAuditQueueWorker(enterpriseOperationsService, { concurrency: env.workerConcurrency }) },
        { name: "release-scheduler", worker: registerReleaseSchedulerWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "delivery-orchestrator", worker: registerDeliveryOrchestratorWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "delivery-retry", worker: registerDeliveryRetryWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "rollback", worker: registerDeliveryRollbackWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "approval", worker: registerReleaseApprovalWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "automation", worker: registerReleaseAutomationWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "delivery-audit", worker: registerDeliveryAuditWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "delivery-webhook", worker: registerWebhookProcessingWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "delivery-health", worker: registerDeliveryHealthWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "sla", worker: registerSLAWorker({ engine: releaseAutomationEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-validation", worker: registerMetadataValidationWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-normalization", worker: registerMetadataNormalizationWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-repair", worker: registerMetadataRepairWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-recommendation", worker: registerMetadataRecommendationWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-audit", worker: registerMetadataAuditWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "metadata-retry", worker: registerMetadataRetryWorker({ engine: metadataIntelligenceEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "rights-validation", worker: registerRightsValidationQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "rights-territory-sync", worker: registerRightsTerritorySyncQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "rights-conflict", worker: registerRightsConflictQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "rights-withdrawal", worker: registerRightsWithdrawalQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "rights-license-expiration", worker: registerRightsLicenseExpirationQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "rights-audit", worker: registerRightsAuditQueueWorker(enterpriseRightsRuntime.service, logger, { concurrency: env.workerConcurrency }) },
        { name: "analytics", worker: registerAnalyticsWorker(analyticsDependencies, { concurrency: env.workerConcurrency }) },
        { name: "realtime", worker: registerRealtimeWorker(realtimeDependencies, { concurrency: env.workerConcurrency }) },
        { name: "payout", worker: registerPayoutJobProcessor(payoutEngine) },
        { name: "media-processing", worker: registerMediaProcessingWorker(mediaProcessingEngine, { concurrency: env.workerConcurrency }) },
        { name: "artwork-processing", worker: registerArtworkProcessingWorker(mediaProcessingEngine, { concurrency: env.workerConcurrency }) },
        { name: "waveform-generation", worker: registerWaveformGenerationWorker(mediaProcessingEngine, { concurrency: env.workerConcurrency }) },
        { name: "fingerprint-analysis", worker: registerFingerprintAnalysisWorker(mediaProcessingEngine, { concurrency: env.workerConcurrency }) },
        { name: "fingerprint", worker: registerFingerprintWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "duplicate", worker: registerDuplicateDetectionWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "similarity", worker: registerSimilarityWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "audio-fraud", worker: registerFraudAudioWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "fingerprint-retry", worker: registerFingerprintRetryWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "fingerprint-audit", worker: registerFingerprintAuditWorker({ engine: audioFingerprintingEngine, operations: enterpriseOperationsService }, { concurrency: env.workerConcurrency }) },
        { name: "amazon-delivery", worker: registerAmazonMusicDeliveryWorker(amazonDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "amazon-polling", worker: registerAmazonMusicPollingWorker(amazonPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "amazon-retry", worker: registerAmazonMusicRetryWorker(amazonRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "amazon-webhook", worker: registerAmazonMusicWebhookWorker(amazonWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "amazon-health", worker: registerAmazonMusicHealthWorker(amazonHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "deezer-delivery", worker: registerDeezerDeliveryWorker(deezerDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "deezer-polling", worker: registerDeezerPollingWorker(deezerPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "deezer-retry", worker: registerDeezerRetryWorker(deezerRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "deezer-webhook", worker: registerDeezerWebhookWorker(deezerWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "deezer-health", worker: registerDeezerHealthWorker(deezerHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "jiosaavn-delivery", worker: registerJioSaavnDeliveryWorker(jioSaavnDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "jiosaavn-polling", worker: registerJioSaavnPollingWorker(jioSaavnPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "jiosaavn-retry", worker: registerJioSaavnRetryWorker(jioSaavnRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "jiosaavn-webhook", worker: registerJioSaavnWebhookWorker(jioSaavnWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "jiosaavn-health", worker: registerJioSaavnHealthWorker(jioSaavnHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "anghami-delivery", worker: registerAnghamiDeliveryWorker(anghamiDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "anghami-polling", worker: registerAnghamiPollingWorker(anghamiPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "anghami-retry", worker: registerAnghamiRetryWorker(anghamiRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "anghami-webhook", worker: registerAnghamiWebhookWorker(anghamiWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "anghami-health", worker: registerAnghamiHealthWorker(anghamiHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "boomplay-delivery", worker: registerBoomplayDeliveryWorker(boomplayDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "boomplay-polling", worker: registerBoomplayPollingWorker(boomplayPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "boomplay-retry", worker: registerBoomplayRetryWorker(boomplayRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "boomplay-webhook", worker: registerBoomplayWebhookWorker(boomplayWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "boomplay-health", worker: registerBoomplayHealthWorker(boomplayHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "tiktok-delivery", worker: registerTikTokDeliveryWorker(tiktokDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "tiktok-polling", worker: registerTikTokPollingWorker(tiktokPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "tiktok-retry", worker: registerTikTokRetryWorker(tiktokRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "tiktok-webhook", worker: registerTikTokWebhookWorker(tiktokWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "tiktok-health", worker: registerTikTokHealthWorker(tiktokHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "meta-delivery", worker: registerMetaDeliveryWorker(metaDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "meta-polling", worker: registerMetaPollingWorker(metaPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "meta-retry", worker: registerMetaRetryWorker(metaRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "meta-webhook", worker: registerMetaWebhookWorker(metaWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "meta-health", worker: registerMetaHealthWorker(metaHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "tidal-delivery", worker: registerTidalDeliveryWorker(tidalDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "tidal-polling", worker: registerTidalPollingWorker(tidalPollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "tidal-retry", worker: registerTidalRetryWorker(tidalRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "tidal-webhook", worker: registerTidalWebhookWorker(tidalWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "tidal-health", worker: registerTidalHealthWorker(tidalHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-delivery", worker: registerYouTubeDeliveryWorker(youTubeDeliveryWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-polling", worker: registerYouTubePollingWorker(youTubePollingWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-retry", worker: registerYouTubeRetryWorker(youTubeRetryWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-webhook", worker: registerYouTubeWebhookWorker(youTubeWebhookWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-health", worker: registerYouTubeHealthWorker(youTubeHealthWorker, { concurrency: env.workerConcurrency }) },
        { name: "youtube-content-id", worker: registerYouTubeContentIdWorker(youTubeContentIdWorker, { concurrency: env.workerConcurrency }) },
        { name: "promo-asset-processing", worker: await registerPromoAssetWorker(new PromoAssetWorker(promoAssetProcessor, adminSupabaseClient, { pollIntervalMs: 5000 })) },
    ];
    return {
        runtime,
        queueSchedulers,
        workerRegistrations,
        emailWorkerRegistration,
        operationsServerDependencies: {
            runtime,
            recovery,
            passwordResetService,
            resendWebhookService,
            tooLostCredentialStore,
            tooLostIntegrationService,
            tooLostWebhookController,
            enterpriseDistributionService,
            royaltyAccountingService,
            adminSupabaseClient,
            logger,
        },
        logger,
    };
}
function createAdminSupabaseClient() {
    const env = readEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: createTimeoutFetch(1500) },
    });
}
function createTimeoutFetch(timeoutMs) {
    return async (input, init) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(new Error(`Supabase request timed out after ${timeoutMs}ms`)), timeoutMs);
        try {
            const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
            return await fetch(input, { ...init, signal });
        }
        finally {
            clearTimeout(timeout);
        }
    };
}
function readEnv() {
    loadRuntimeEnv();
    return process.env;
}
import { join } from "node:path";
