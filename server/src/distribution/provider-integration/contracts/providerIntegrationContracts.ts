import type { ProviderConfiguration, ProviderCredentials, ProviderHealthSnapshot, ProviderSelectionResult, ProviderSession, ProviderUploadContext, ProviderUploadResult, ProviderStatusSnapshot, ProviderWebhookEnvelope, ProviderPollingResult, ProviderRoyaltyBatch, ProviderReportBatch, ProviderRetryContext } from "../types/providerIntegrationTypes";

export interface ProviderIntegration {
  readonly integrationId: string;
  readonly providerName: string;
  readonly adapterName: string;
  readonly configuration: ProviderConfiguration;
  readonly session: ProviderSession | null;
  readonly adapter: ProviderAdapter;
  authenticate(): Promise<ProviderSession> | ProviderSession;
  refreshCredentials(): Promise<ProviderCredentials> | ProviderCredentials;
  select(): Promise<ProviderSelectionResult> | ProviderSelectionResult;
  health(): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly version: string;
  readonly configuration: ProviderConfiguration;
  readonly credentials: ProviderCredentials | null;
  authenticate(): Promise<ProviderSession> | ProviderSession;
  refreshCredentials(): Promise<ProviderCredentials> | ProviderCredentials;
  resolveCapabilities(): Promise<unknown> | unknown;
  upload(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
  submitMetadata(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
  createRelease(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
  trackStatus(context: ProviderStatusSnapshot | ProviderUploadContext): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
  receiveWebhook(event: ProviderWebhookEnvelope): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
  poll(context: ProviderPollingResult): Promise<ProviderPollingResult> | ProviderPollingResult;
  importRoyalties(batch: ProviderRoyaltyBatch): Promise<ProviderRoyaltyBatch> | ProviderRoyaltyBatch;
  generateReports(batch: ProviderReportBatch): Promise<ProviderReportBatch> | ProviderReportBatch;
  takedown(): Promise<ProviderUploadResult> | ProviderUploadResult;
  health(): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
  rateLimit(): Promise<unknown> | unknown;
  retry(context: ProviderRetryContext): Promise<ProviderRetryContext> | ProviderRetryContext;
}

export interface ProviderRegistry {
  register(integration: ProviderIntegration): void;
  resolve(providerName: string): ProviderIntegration | null;
  list(): readonly ProviderIntegration[];
}

export interface ProviderFactory {
  create(configuration: ProviderConfiguration): ProviderIntegration;
}

export interface ProviderResolver {
  resolve(providerName: string): ProviderIntegration | null;
  resolveAdapter(adapterName: string): ProviderAdapter | null;
}

export interface ProviderRouter {
  route(providerName: string, adapterName?: string | null): ProviderIntegration | null;
}

export interface AuthenticationManager {
  authenticate(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession;
  refresh(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials;
}

export interface SessionManager {
  start(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession;
  renew(session: ProviderSession): Promise<ProviderSession> | ProviderSession;
  end(session: ProviderSession): Promise<boolean> | boolean;
}

export interface CredentialManager {
  issue(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials;
  rotate(credentials: ProviderCredentials): Promise<ProviderCredentials> | ProviderCredentials;
  revoke(credentials: ProviderCredentials): Promise<boolean> | boolean;
}

export interface CapabilityResolver {
  resolve(integration: ProviderIntegration): unknown;
}

export interface ProviderSelector {
  select(providerName: string): Promise<ProviderSelectionResult> | ProviderSelectionResult;
}

export interface HealthManager {
  check(integration: ProviderIntegration): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
  snapshot(providerName: string): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
}

export interface UploadManager {
  upload(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}

export interface AssetManager {
  uploadAssets(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}

export interface MetadataManager {
  submitMetadata(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}

export interface CatalogManager {
  createRelease(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}

export interface StatusManager {
  trackStatus(snapshot: ProviderStatusSnapshot | ProviderUploadContext): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
  reconcile(snapshot: ProviderStatusSnapshot): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
}

export interface WebhookManager {
  receiveWebhook(event: ProviderWebhookEnvelope): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
}

export interface PollingManager {
  poll(providerName: string): Promise<ProviderPollingResult> | ProviderPollingResult;
}

export interface RoyaltyManager {
  importRoyalties(batch: ProviderRoyaltyBatch): Promise<ProviderRoyaltyBatch> | ProviderRoyaltyBatch;
}

export interface ReportManager {
  generateReports(batch: ProviderReportBatch): Promise<ProviderReportBatch> | ProviderReportBatch;
}

export interface TakedownManager {
  takedown(providerName: string): Promise<ProviderUploadResult> | ProviderUploadResult;
}

export interface RateLimitManager {
  evaluate(providerName: string): Promise<unknown> | unknown;
}

export interface RetryManager {
  retry(context: ProviderRetryContext): Promise<ProviderRetryContext> | ProviderRetryContext;
}

export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface ProviderLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface ConfigurationProvider {
  load(providerName: string): Promise<ProviderConfiguration | null> | ProviderConfiguration | null;
  save(configuration: ProviderConfiguration): Promise<void> | void;
  list(): Promise<readonly ProviderConfiguration[]> | readonly ProviderConfiguration[];
}
