import { createProviderResult as buildProviderResult } from "./providerResult.js";
import { ProviderStatus, ProviderLifecycleStage } from "./providerStatus.js";
import { ProviderError } from "./providerError.js";
export class AbstractProvider {
    name;
    version;
    configuration;
    capabilities;
    featureFlags;
    manifest;
    logger;
    metrics;
    hooks;
    retryStrategy;
    statusMapper;
    _status;
    _credentials;
    _lifecycle;
    constructor(options) {
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
    get status() {
        return this._status;
    }
    get lifecycle() {
        return this._lifecycle;
    }
    get credentials() {
        return this._credentials;
    }
    async authenticate(input) {
        await this.runHook("beforeAuthenticate", input);
        try {
            const auth = await this.performAuthenticate(input);
            this._status = ProviderStatus.READY;
            this.transition(ProviderLifecycleStage.AUTHENTICATED);
            await this.runHook("afterAuthenticate", { ...input, metadata: { ...input.metadata, authenticated: auth.authenticated } });
            return auth;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async refreshCredentials(input) {
        await this.runHook("beforeRefreshCredentials", input);
        try {
            const credentials = await this.performRefreshCredentials(input);
            this._credentials = credentials;
            this._status = ProviderStatus.READY;
            this.transition(ProviderLifecycleStage.AUTHENTICATED);
            await this.runHook("afterRefreshCredentials", { ...input, metadata: { ...input.metadata, credentialId: credentials.credentialId } });
            return credentials;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async validateRelease(input) {
        await this.runHook("beforeValidateRelease", input);
        try {
            const result = await this.performValidateRelease(input);
            await this.runHook("afterValidateRelease", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async validateAssets(input) {
        await this.runHook("beforeValidateAssets", input);
        try {
            const result = await this.performValidateAssets(input);
            await this.runHook("afterValidateAssets", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async preparePackage(input) {
        await this.runHook("beforePreparePackage", input);
        try {
            const manifest = await this.performPreparePackage(input);
            await this.runHook("afterPreparePackage", { ...input, manifest });
            return manifest;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async submitRelease(input) {
        await this.runHook("beforeSubmitRelease", input);
        try {
            const result = await this.performSubmitRelease(input);
            await this.runHook("afterSubmitRelease", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async updateRelease(input) {
        await this.runHook("beforeUpdateRelease", input);
        try {
            const result = await this.performUpdateRelease(input);
            await this.runHook("afterUpdateRelease", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async takedownRelease(input) {
        await this.runHook("beforeTakedownRelease", input);
        try {
            const result = await this.performTakedownRelease(input);
            await this.runHook("afterTakedownRelease", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async checkStatus(input) {
        await this.runHook("beforeCheckStatus", input);
        try {
            const health = await this.performHealthCheck(input);
            await this.runHook("afterCheckStatus", { ...input, health });
            return health;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async syncRelease(input) {
        await this.runHook("beforeSyncRelease", input);
        try {
            const result = await this.performSyncRelease(input);
            await this.runHook("afterSyncRelease", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async receiveWebhook(input) {
        await this.runHook("beforeReceiveWebhook", input);
        try {
            const result = await this.performReceiveWebhook(input);
            await this.runHook("afterReceiveWebhook", { ...input, result });
            return result;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async healthCheck(input) {
        await this.runHook("beforeHealthCheck", input);
        try {
            const health = await this.performHealthCheck(input);
            await this.runHook("afterHealthCheck", { ...input, health });
            return health;
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    async disconnect(input) {
        await this.runHook("beforeDisconnect", input);
        try {
            await this.performDisconnect(input);
            this._status = ProviderStatus.DISABLED;
            this.transition(ProviderLifecycleStage.DISCONNECTED);
            await this.runHook("afterDisconnect", input);
        }
        catch (error) {
            await this.handleError(input, error);
            throw error;
        }
    }
    createProviderResult(input) {
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
    createHealth(status, message = null, checks = []) {
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
    toProviderError(error, fallback) {
        return ProviderError.fromUnknown(error, this.name, this.version, fallback);
    }
    get distributionStatus() {
        return this.statusMapper.toDistributionStatus(this._status);
    }
    async runHook(name, input) {
        const hook = this.hooks[name];
        if (!hook)
            return;
        await hook({
            context: input.context,
            manifest: input.manifest ?? null,
            result: "result" in input ? input.result ?? null : null,
            error: null,
            payload: input.payload,
            metadata: input.metadata ?? {},
        });
    }
    async handleError(input, error) {
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
    transition(stage, reason) {
        const now = new Date();
        this._lifecycle = {
            ...this._lifecycle,
            stage,
            lastTransitionAt: now,
            history: [...this._lifecycle.history, { stage, transitionedAt: now, reason: reason ?? null }],
        };
    }
}
function createLifecycle(provider, version, stage) {
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
