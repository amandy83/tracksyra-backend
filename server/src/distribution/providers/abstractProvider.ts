import type { DistributionStatus } from "../core/distributionStatus";
import type { DistributionContext } from "../core/distributionContext";
import { createProviderResult as buildProviderResult } from "./providerResult";
import type { ProviderAuthentication } from "./providerAuthentication";
import type { ProviderCapabilities } from "./providerCapabilities";
import type { ProviderConfiguration } from "./providerConfiguration";
import type { ProviderCredentials } from "./providerCredentials";
import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderHealth } from "./providerHealth";
import type { ProviderHooks } from "./providerHooks";
import type { ProviderLifecycle } from "./providerLifecycle";
import type { ProviderLogger } from "./providerLogger";
import type { ProviderManifest } from "./providerManifest";
import type { ProviderMetrics } from "./providerMetrics";
import type { ProviderOperationInput, ProviderWebhookInput, DistributionProvider } from "./distributionProvider";
import type { ProviderResult } from "./providerResult";
import type { ProviderRetryStrategy } from "./providerRetryStrategy";
import { ProviderStatus, ProviderLifecycleStage } from "./providerStatus";
import { ProviderError } from "./providerError";
import { ProviderStatusMapper } from "./providerStatusMapper";

export type AbstractProviderDependencies = Readonly<{
  logger: ProviderLogger;
  metrics: ProviderMetrics;
  hooks: ProviderHooks;
  retryStrategy: ProviderRetryStrategy;
  statusMapper: ProviderStatusMapper;
}>;

export type AbstractProviderOptions = Readonly<{
  name: string;
  version: string;
  configuration: ProviderConfiguration;
  capabilities: ProviderCapabilities;
  credentials?: ProviderCredentials | null;
  featureFlags?: ProviderFeatureFlags;
  manifest?: ProviderManifest | null;
  logger: ProviderLogger;
  metrics: ProviderMetrics;
  hooks: ProviderHooks;
  retryStrategy: ProviderRetryStrategy;
  statusMapper: ProviderStatusMapper;
  lifecycle?: ProviderLifecycle | null;
}>;

export abstract class AbstractProvider implements DistributionProvider {
  readonly name: string;
  readonly version: string;
  readonly configuration: ProviderConfiguration;
  readonly capabilities: ProviderCapabilities;
  readonly featureFlags: ProviderFeatureFlags;
  readonly manifest: ProviderManifest | null;
  readonly logger: ProviderLogger;
  readonly metrics: ProviderMetrics;
  readonly hooks: ProviderHooks;
  readonly retryStrategy: ProviderRetryStrategy;
  readonly statusMapper: ProviderStatusMapper;

  protected _status: ProviderStatus;
  protected _credentials: ProviderCredentials | null;
  protected _lifecycle: ProviderLifecycle;

  constructor(options: AbstractProviderOptions) {
    this.name = options.name;
    this.version = options.version;
    this.configuration = options.configuration;
    this.capabilities = options.capabilities;
    this.featureFlags = options.featureFlags ?? options.configuration.featureFlags;
    this.manifest = options.manifest ?? null;
    this.logger = options.logger;
    this.metrics = options.metrics;
    this.hooks = options.hooks;
    this.retryStrategy = options.retryStrategy;
    this.statusMapper = options.statusMapper;
    this._credentials = options.credentials ?? null;
    this._status = options.configuration.enabled ? ProviderStatus.INITIALIZING : ProviderStatus.DISABLED;
    this._lifecycle = options.lifecycle ?? createLifecycle(this.name, this.version, ProviderLifecycleStage.CREATED);
  }

  get status(): ProviderStatus {
    return this._status;
  }

  get lifecycle(): ProviderLifecycle {
    return this._lifecycle;
  }

  get credentials(): ProviderCredentials | null {
    return this._credentials;
  }

  async authenticate(input: ProviderOperationInput): Promise<ProviderAuthentication> {
    await this.runHook("beforeAuthenticate", input);
    try {
      const auth = await this.performAuthenticate(input);
      this._status = ProviderStatus.READY;
      this.transition(ProviderLifecycleStage.AUTHENTICATED);
      await this.runHook("afterAuthenticate", { ...input, metadata: { ...input.metadata, authenticated: auth.authenticated } });
      return auth;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async refreshCredentials(input: ProviderOperationInput): Promise<ProviderCredentials> {
    await this.runHook("beforeRefreshCredentials", input);
    try {
      const credentials = await this.performRefreshCredentials(input);
      this._credentials = credentials;
      this._status = ProviderStatus.READY;
      this.transition(ProviderLifecycleStage.AUTHENTICATED);
      await this.runHook("afterRefreshCredentials", { ...input, metadata: { ...input.metadata, credentialId: credentials.credentialId } });
      return credentials;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async validateRelease(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeValidateRelease", input);
    try {
      const result = await this.performValidateRelease(input);
      await this.runHook("afterValidateRelease", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async validateAssets(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeValidateAssets", input);
    try {
      const result = await this.performValidateAssets(input);
      await this.runHook("afterValidateAssets", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async preparePackage(input: ProviderOperationInput): Promise<ProviderManifest> {
    await this.runHook("beforePreparePackage", input);
    try {
      const manifest = await this.performPreparePackage(input);
      await this.runHook("afterPreparePackage", { ...input, manifest });
      return manifest;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async submitRelease(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeSubmitRelease", input);
    try {
      const result = await this.performSubmitRelease(input);
      await this.runHook("afterSubmitRelease", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async updateRelease(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeUpdateRelease", input);
    try {
      const result = await this.performUpdateRelease(input);
      await this.runHook("afterUpdateRelease", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async takedownRelease(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeTakedownRelease", input);
    try {
      const result = await this.performTakedownRelease(input);
      await this.runHook("afterTakedownRelease", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async checkStatus(input: ProviderOperationInput): Promise<ProviderHealth> {
    await this.runHook("beforeCheckStatus", input);
    try {
      const health = await this.performHealthCheck(input);
      await this.runHook("afterCheckStatus", { ...input, health });
      return health;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async syncRelease(input: ProviderOperationInput): Promise<ProviderResult> {
    await this.runHook("beforeSyncRelease", input);
    try {
      const result = await this.performSyncRelease(input);
      await this.runHook("afterSyncRelease", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async receiveWebhook(input: ProviderWebhookInput): Promise<ProviderResult> {
    await this.runHook("beforeReceiveWebhook", input);
    try {
      const result = await this.performReceiveWebhook(input);
      await this.runHook("afterReceiveWebhook", { ...input, result });
      return result;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async healthCheck(input: ProviderOperationInput): Promise<ProviderHealth> {
    await this.runHook("beforeHealthCheck", input);
    try {
      const health = await this.performHealthCheck(input);
      await this.runHook("afterHealthCheck", { ...input, health });
      return health;
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  async disconnect(input: ProviderOperationInput): Promise<void> {
    await this.runHook("beforeDisconnect", input);
    try {
      await this.performDisconnect(input);
      this._status = ProviderStatus.DISABLED;
      this.transition(ProviderLifecycleStage.DISCONNECTED);
      await this.runHook("afterDisconnect", input);
    } catch (error) {
      await this.handleError(input, error);
      throw error;
    }
  }

  protected abstract performAuthenticate(input: ProviderOperationInput): Promise<ProviderAuthentication>;
  protected abstract performRefreshCredentials(input: ProviderOperationInput): Promise<ProviderCredentials>;
  protected abstract performValidateRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performValidateAssets(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performPreparePackage(input: ProviderOperationInput): Promise<ProviderManifest>;
  protected abstract performSubmitRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performUpdateRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performTakedownRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performHealthCheck(input: ProviderOperationInput): Promise<ProviderHealth>;
  protected abstract performSyncRelease(input: ProviderOperationInput): Promise<ProviderResult>;
  protected abstract performReceiveWebhook(input: ProviderWebhookInput): Promise<ProviderResult>;
  protected abstract performDisconnect(input: ProviderOperationInput): Promise<void>;

  protected createProviderResult(input: Omit<ProviderResult, "provider" | "version"> & { provider?: string; version?: string }): ProviderResult {
    return buildProviderResult({
      provider: input.provider ?? this.name,
      version: input.version ?? this.version,
      operation: input.operation,
      status: input.status,
      distributionStatus: input.distributionStatus,
      manifest: input.manifest ?? null,
      referenceId: input.referenceId ?? null,
      checksum: input.checksum ?? null,
      completedAt: input.completedAt,
      retryAt: input.retryAt ?? null,
      payload: input.payload,
      health: input.health ?? null,
      metadata: input.metadata ?? {},
      errors: input.errors ?? [],
    });
  }

  protected createHealth(status: ProviderStatus, message: string | null = null, checks: ProviderHealth["checks"] = []): ProviderHealth {
    return {
      provider: this.name,
      version: this.version,
      status,
      healthy: status === ProviderStatus.READY,
      checkedAt: new Date(),
      latencyMs: null,
      configurationValid: true,
      credentialsValid: Boolean(this._credentials),
      message,
      checks,
      metadata: {},
    };
  }

  protected toProviderError(error: unknown, fallback?: Partial<ProviderError>): ProviderError {
    return ProviderError.fromUnknown(error, this.name, this.version, fallback);
  }

  protected get distributionStatus(): DistributionStatus {
    return this.statusMapper.toDistributionStatus(this._status);
  }

  private async runHook(
    name: keyof ProviderHooks,
    input: ProviderOperationInput | (ProviderWebhookInput & { result?: ProviderResult | null; health?: ProviderHealth | null }),
  ): Promise<void> {
    const hook = this.hooks[name];
    if (!hook) return;
    await hook({
      context: input.context,
      manifest: input.manifest ?? null,
      result: "result" in input ? input.result ?? null : null,
      error: null,
      payload: input.payload,
      metadata: input.metadata ?? {},
    });
  }

  private async handleError(input: ProviderOperationInput | ProviderWebhookInput, error: unknown): Promise<void> {
    const normalized = this.toProviderError(error, { code: "UNEXPECTED_ERROR", retryable: true });
    this._status = ProviderStatus.ERROR;
    this.transition(ProviderLifecycleStage.ERROR, normalized.message);
    this.logger.error("[provider] operation failed", {
      provider: this.name,
      version: this.version,
      code: normalized.code,
      message: normalized.message,
    });
    await this.hooks.onError?.({
      context: input.context,
      manifest: input.manifest ?? null,
      error: normalized,
      payload: input.payload,
      metadata: input.metadata ?? {},
    });
  }

  private transition(stage: ProviderLifecycleStage, reason?: string | null): void {
    const now = new Date();
    this._lifecycle = {
      ...this._lifecycle,
      stage,
      lastTransitionAt: now,
      history: [...this._lifecycle.history, { stage, transitionedAt: now, reason: reason ?? null }],
    };
  }
}

function createLifecycle(provider: string, version: string, stage: ProviderLifecycleStage): ProviderLifecycle {
  const now = new Date();
  return {
    provider,
    version,
    stage,
    createdAt: now,
    lastTransitionAt: now,
    history: [{ stage, transitionedAt: now, reason: null }],
    metadata: {},
  };
}
