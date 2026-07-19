import { ProviderReference, ProviderStatus } from "../domain/index.js";
import { ProviderStatus as ProviderHealthStatus } from "../providers/index.js";
import { DistributionStatus } from "../core/distributionStatus.js";
function buildProviderReference(providerName, version) {
    return new ProviderReference(`${providerName}:${version}`);
}
function createProviderContext(provider, releaseId, metadata = {}) {
    return {
        provider: provider.name,
        version: provider.version,
        configuration: provider.configuration,
        credentials: provider.credentials,
        authentication: null,
        capabilities: provider.capabilities,
        featureFlags: provider.featureFlags,
        lifecycle: provider.lifecycle,
        logger: provider.logger,
        metrics: provider.metrics,
        hooks: provider.hooks,
        distributionContext: null,
        manifest: provider.manifest,
        requestId: null,
        correlationId: releaseId,
        traceId: releaseId,
        metadata,
        createdAt: new Date(),
    };
}
function mapDistributionStatus(status) {
    switch (status) {
        case DistributionStatus.SUBMITTED:
        case DistributionStatus.IN_REVIEW:
        case DistributionStatus.APPROVED:
        case DistributionStatus.DELIVERED:
            return new ProviderStatus("PROCESSING");
        case DistributionStatus.PUBLISHED:
            return new ProviderStatus("LIVE");
        case DistributionStatus.REJECTED:
            return new ProviderStatus("REJECTED");
        case DistributionStatus.FAILED:
        case DistributionStatus.DEAD_LETTER:
            return new ProviderStatus("FAILED");
        case DistributionStatus.PENDING:
        case DistributionStatus.PROCESSING:
        default:
            return new ProviderStatus("PENDING");
    }
}
function mapProviderHealthStatus(status) {
    switch (status) {
        case ProviderHealthStatus.READY:
            return new ProviderStatus("PROCESSING");
        case ProviderHealthStatus.DEGRADED:
            return new ProviderStatus("PROCESSING");
        case ProviderHealthStatus.AUTH_REQUIRED:
        case ProviderHealthStatus.CONFIGURATION_REQUIRED:
        case ProviderHealthStatus.INITIALIZING:
            return new ProviderStatus("PENDING");
        case ProviderHealthStatus.DISABLED:
        case ProviderHealthStatus.UNAVAILABLE:
        case ProviderHealthStatus.ERROR:
        default:
            return new ProviderStatus("FAILED");
    }
}
export class DistributionProviderFrameworkBridge {
    registry;
    resolver;
    constructor(registry, resolver, providerName) {
        this.registry = registry;
        this.resolver = resolver;
        this.providerName = providerName ?? null;
    }
    providerName;
    async resolveProvider(release, packageModel) {
        const entry = this.resolver.resolve({
            name: this.providerName ?? null,
            requireEnabled: true,
            requireHealthy: false,
            allowFallback: true,
            capabilities: {
                operations: ["submitRelease"],
            },
        });
        return buildProviderReference(entry.name, entry.version);
    }
    async authenticate(providerReference, release) {
        const provider = await this.resolveProviderInstance(providerReference);
        const result = await provider.authenticate({
            context: createProviderContext(provider, release.id.value, { releaseId: release.id.value }),
            payload: { release },
            metadata: { releaseId: release.id.value },
        });
        return {
            receipt: result.accessToken ?? result.providerAccountId ?? `${provider.name}:${provider.version}`,
            status: new ProviderStatus(result.authenticated ? "AUTHENTICATING" : "FAILED"),
        };
    }
    async submitPackage(providerReference, packageModel) {
        const provider = await this.resolveProviderInstance(providerReference);
        const result = await provider.submitRelease({
            context: createProviderContext(provider, packageModel.fingerprint.value, { packageFingerprint: packageModel.fingerprint.value }),
            manifest: null,
            payload: { package: packageModel },
            metadata: { packageFingerprint: packageModel.fingerprint.value },
        });
        return {
            receipt: result.referenceId ?? `${provider.name}:${provider.version}:${packageModel.fingerprint.value}`,
            status: mapDistributionStatus(result.distributionStatus),
        };
    }
    async fetchStatus(providerReference, release) {
        const provider = await this.resolveProviderInstance(providerReference);
        const result = await provider.checkStatus({
            context: createProviderContext(provider, release.id.value, { releaseId: release.id.value }),
            payload: { release },
            metadata: { releaseId: release.id.value },
        });
        return mapProviderHealthStatus(result.status);
    }
    async resolveProviderInstance(providerReference) {
        const [providerName, version] = providerReference.value.split(":");
        return await this.registry.create(providerName, version || undefined);
    }
}
