import { DSPConnectorShell, SpotifyConnector } from "./spotifyConnector.js";
import { AppleMusicConnector } from "./appleMusicConnector.js";
import { AnghamiConnector } from "./anghamiConnector.js";
import { AmazonMusicConnector } from "./amazonMusicConnector.js";
import { DeezerConnector } from "./deezerConnector.js";
import { JioSaavnConnector } from "./jioSaavnConnector.js";
import { BoomplayConnector } from "./boomplayConnector.js";
import { TikTokConnector } from "./tiktokConnector.js";
import { MetaRightsManagerConnector } from "./metaRightsManagerConnector.js";
import { TidalConnector } from "./tidalConnector.js";
import { YouTubeMusicConnector } from "./youtubeMusicConnector.js";
import { createConnectorCapabilityMatrix, SPOTIFY_CONNECTOR_CAPABILITIES } from "./connectorCapabilityMatrix.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
export class DSPConnectorFramework {
    dependencies;
    capabilityMatrix;
    connectors = new Map();
    defaultConnectorVersion;
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.capabilityMatrix = dependencies.capabilityMatrix ?? createConnectorCapabilityMatrix();
        this.defaultConnectorVersion = dependencies.defaultConnectorVersion ?? "1.0.0";
    }
    validateRelease(job) {
        const release = this.requireRelease(job);
        return this.dependencies.releaseDeliveryEngine.validateRelease(release);
    }
    normalizeMetadata(job) {
        return this.connectorFor(job).normalizeMetadata(job);
    }
    normalizeArtwork(job) {
        return this.connectorFor(job).normalizeArtwork(job);
    }
    normalizeAudio(job) {
        return this.connectorFor(job).normalizeAudio(job);
    }
    async buildPackage(job) {
        const connector = this.connectorFor(job);
        const packageModel = await connector.buildPackage(job);
        return Object.freeze({
            ...packageModel,
            metadata: freeze({
                ...packageModel.metadata,
                connectorCapabilities: this.getCapabilities(job.target.connectorId),
            }),
        });
    }
    async deliver(job) {
        return this.connectorFor(job).deliver(job);
    }
    async pollStatus(job) {
        return this.connectorFor(job).pollStatus(job);
    }
    async fetchErrors(job) {
        return this.connectorFor(job).fetchErrors(job);
    }
    async retry(job, attempt = 0, error = null) {
        const connector = this.connectorFor(job);
        if (!connector.shouldRetry(error, attempt, job)) {
            return Object.freeze({
                connectorId: job.target.connectorId,
                releaseId: job.releaseId,
                retryCount: attempt,
                lastAttemptAt: nowIso(),
                nextAttemptAt: null,
                metadata: freeze({
                    connectorId: job.target.connectorId,
                    releaseId: job.releaseId,
                    retryable: false,
                }),
            });
        }
        return Object.freeze({
            connectorId: job.target.connectorId,
            releaseId: job.releaseId,
            retryCount: attempt + 1,
            lastAttemptAt: nowIso(),
            nextAttemptAt: connector.nextRetryAt(error, attempt, job),
            metadata: freeze({
                connectorId: job.target.connectorId,
                releaseId: job.releaseId,
                retryable: true,
            }),
        });
    }
    async withdraw(job) {
        return this.connectorFor(job).withdraw(job);
    }
    async restore(job) {
        return this.connectorFor(job).restore(job);
    }
    async healthCheck(job) {
        return this.connectorFor(job).healthCheck(job);
    }
    getCapabilities(connectorId) {
        return this.capabilityMatrix[connectorId] ?? SPOTIFY_CONNECTOR_CAPABILITIES;
    }
    generateSpotifyDeliveryReport(job, result) {
        return Object.freeze({
            connectorId: job.target.connectorId,
            releaseId: job.releaseId,
            generatedAt: nowIso(),
            packageId: job.packageModel?.packageId ?? null,
            connectorStatus: result.connectorStatus,
            success: result.success,
            errors: result.errors,
            warnings: result.warnings,
            metadata: freeze({
                target: job.target.partnerName,
                connectorVersion: job.target.connectorVersion,
            }),
        });
    }
    generateConnectorHealthReport(connectorId, health) {
        return Object.freeze({
            connectorId,
            generatedAt: nowIso(),
            healthy: health.healthy,
            latencyMs: health.latencyMs,
            details: freeze({
                ...health.details,
                checkedAt: health.checkedAt,
            }),
        });
    }
    generateConnectorCapabilityReport(connectorId) {
        return Object.freeze({
            connectorId,
            generatedAt: nowIso(),
            capabilities: this.getCapabilities(connectorId),
        });
    }
    generateDeliveryErrorReport(job, errors) {
        return Object.freeze({
            connectorId: job.target.connectorId,
            releaseId: job.releaseId,
            generatedAt: nowIso(),
            errors: Object.freeze([...errors]),
            metadata: freeze({
                packageId: job.packageModel?.packageId ?? null,
                target: job.target.partnerName,
            }),
        });
    }
    register(job) {
        const shell = this.connectorFor(job);
        this.connectors.set(job.target.connectorId, shell);
        return shell;
    }
    createSpotifyConnector(dependencies = {}) {
        return new SpotifyConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createAppleMusicConnector(dependencies = {}) {
        return new AppleMusicConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createAnghamiConnector(dependencies = {}) {
        return new AnghamiConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createAnghamiMusicConnector(dependencies = {}) {
        return this.createAnghamiConnector(dependencies);
    }
    createBoomplayConnector(dependencies = {}) {
        return new BoomplayConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createBoomplayMusicConnector(dependencies = {}) {
        return this.createBoomplayConnector(dependencies);
    }
    createTikTokConnector(dependencies = {}) {
        return new TikTokConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createTikTokMusicConnector(dependencies = {}) {
        return this.createTikTokConnector(dependencies);
    }
    createMetaRightsManagerConnector(dependencies = {}) {
        return new MetaRightsManagerConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createMetaRightsManagerMusicConnector(dependencies = {}) {
        return this.createMetaRightsManagerConnector(dependencies);
    }
    createAmazonMusicConnector(dependencies = {}) {
        return new AmazonMusicConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createDeezerConnector(dependencies = {}) {
        return new DeezerConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createDeezerMusicConnector(dependencies = {}) {
        return this.createDeezerConnector(dependencies);
    }
    createJioSaavnConnector(dependencies = {}) {
        return new JioSaavnConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createJioSaavnMusicConnector(dependencies = {}) {
        return this.createJioSaavnConnector(dependencies);
    }
    createTidalConnector(dependencies = {}) {
        return new TidalConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createTidalMusicConnector(dependencies = {}) {
        return this.createTidalConnector(dependencies);
    }
    createYouTubeMusicConnector(dependencies = {}) {
        return new YouTubeMusicConnector({
            connectorFactory: dependencies.connectorFactory ?? this.dependencies.connectorFactory,
            releaseDeliveryEngine: dependencies.releaseDeliveryEngine ?? this.dependencies.releaseDeliveryEngine,
            capabilityMatrix: dependencies.capabilityMatrix ?? this.capabilityMatrix,
            logger: dependencies.logger ?? this.dependencies.logger,
            retryPolicy: dependencies.retryPolicy ?? this.dependencies.retryPolicy,
            fetchImpl: dependencies.fetchImpl ?? this.dependencies.fetchImpl,
            configuration: dependencies.configuration ?? {
                apiVersion: "1.0.0",
                ingestionBaseUrl: null,
                oauthAuthorizeUrl: null,
                oauthTokenUrl: null,
                webhookUrl: null,
                webhookSecret: null,
                clientId: null,
                clientSecret: null,
                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                sandboxMode: true,
            },
        });
    }
    createConnector(job) {
        return this.connectorFor(job);
    }
    connectorFor(job) {
        const key = job.target.connectorId;
        const existing = this.connectors.get(key);
        if (existing)
            return existing;
        const shell = key === "Spotify"
            ? new SpotifyConnector({
                connectorFactory: this.dependencies.connectorFactory,
                releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                capabilityMatrix: this.capabilityMatrix,
                logger: this.dependencies.logger,
                retryPolicy: this.dependencies.retryPolicy,
                fetchImpl: this.dependencies.fetchImpl,
                configuration: {
                    apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                    ingestionBaseUrl: job.target.endpointUrl,
                    oauthAuthorizeUrl: null,
                    oauthTokenUrl: null,
                    webhookUrl: null,
                    webhookSecret: null,
                    clientId: null,
                    clientSecret: null,
                    scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                    sandboxMode: true,
                },
            })
            : key === "AppleMusic"
                ? new AppleMusicConnector({
                    connectorFactory: this.dependencies.connectorFactory,
                    releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                    capabilityMatrix: this.capabilityMatrix,
                    logger: this.dependencies.logger,
                    retryPolicy: this.dependencies.retryPolicy,
                    fetchImpl: this.dependencies.fetchImpl,
                    configuration: {
                        apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                        ingestionBaseUrl: job.target.endpointUrl,
                        oauthAuthorizeUrl: null,
                        oauthTokenUrl: null,
                        webhookUrl: null,
                        webhookSecret: null,
                        clientId: null,
                        clientSecret: null,
                        scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                        sandboxMode: true,
                    },
                })
                : key === "AmazonMusic"
                    ? new AmazonMusicConnector({
                        connectorFactory: this.dependencies.connectorFactory,
                        releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                        capabilityMatrix: this.capabilityMatrix,
                        logger: this.dependencies.logger,
                        retryPolicy: this.dependencies.retryPolicy,
                        fetchImpl: this.dependencies.fetchImpl,
                        configuration: {
                            apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                            ingestionBaseUrl: job.target.endpointUrl,
                            oauthAuthorizeUrl: null,
                            oauthTokenUrl: null,
                            webhookUrl: null,
                            webhookSecret: null,
                            clientId: null,
                            clientSecret: null,
                            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                            sandboxMode: true,
                        },
                    })
                    : key === "Deezer"
                        ? new DeezerConnector({
                            connectorFactory: this.dependencies.connectorFactory,
                            releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                            capabilityMatrix: this.capabilityMatrix,
                            logger: this.dependencies.logger,
                            retryPolicy: this.dependencies.retryPolicy,
                            fetchImpl: this.dependencies.fetchImpl,
                            configuration: {
                                apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                ingestionBaseUrl: job.target.endpointUrl,
                                oauthAuthorizeUrl: null,
                                oauthTokenUrl: null,
                                webhookUrl: null,
                                webhookSecret: null,
                                clientId: null,
                                clientSecret: null,
                                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                sandboxMode: true,
                            },
                        })
                        : key === "JioSaavn"
                            ? new JioSaavnConnector({
                                connectorFactory: this.dependencies.connectorFactory,
                                releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                capabilityMatrix: this.capabilityMatrix,
                                logger: this.dependencies.logger,
                                retryPolicy: this.dependencies.retryPolicy,
                                fetchImpl: this.dependencies.fetchImpl,
                                configuration: {
                                    apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                    ingestionBaseUrl: job.target.endpointUrl,
                                    oauthAuthorizeUrl: null,
                                    oauthTokenUrl: null,
                                    webhookUrl: null,
                                    webhookSecret: null,
                                    clientId: null,
                                    clientSecret: null,
                                    scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                    sandboxMode: true,
                                },
                            })
                            : key === "Anghami"
                                ? new AnghamiConnector({
                                    connectorFactory: this.dependencies.connectorFactory,
                                    releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                    capabilityMatrix: this.capabilityMatrix,
                                    logger: this.dependencies.logger,
                                    retryPolicy: this.dependencies.retryPolicy,
                                    fetchImpl: this.dependencies.fetchImpl,
                                    configuration: {
                                        apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                        ingestionBaseUrl: job.target.endpointUrl,
                                        oauthAuthorizeUrl: null,
                                        oauthTokenUrl: null,
                                        webhookUrl: null,
                                        webhookSecret: null,
                                        clientId: null,
                                        clientSecret: null,
                                        scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                        sandboxMode: true,
                                    },
                                })
                                : key === "Boomplay"
                                    ? new BoomplayConnector({
                                        connectorFactory: this.dependencies.connectorFactory,
                                        releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                        capabilityMatrix: this.capabilityMatrix,
                                        logger: this.dependencies.logger,
                                        retryPolicy: this.dependencies.retryPolicy,
                                        fetchImpl: this.dependencies.fetchImpl,
                                        configuration: {
                                            apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                            ingestionBaseUrl: job.target.endpointUrl,
                                            oauthAuthorizeUrl: null,
                                            oauthTokenUrl: null,
                                            webhookUrl: null,
                                            webhookSecret: null,
                                            clientId: null,
                                            clientSecret: null,
                                            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                            sandboxMode: true,
                                        },
                                    })
                                    : key === "TikTok"
                                        ? new TikTokConnector({
                                            connectorFactory: this.dependencies.connectorFactory,
                                            releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                            capabilityMatrix: this.capabilityMatrix,
                                            logger: this.dependencies.logger,
                                            retryPolicy: this.dependencies.retryPolicy,
                                            fetchImpl: this.dependencies.fetchImpl,
                                            configuration: {
                                                apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                                ingestionBaseUrl: job.target.endpointUrl,
                                                oauthAuthorizeUrl: null,
                                                oauthTokenUrl: null,
                                                webhookUrl: null,
                                                webhookSecret: null,
                                                clientId: null,
                                                clientSecret: null,
                                                scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                                sandboxMode: true,
                                            },
                                        })
                                        : key === "Meta"
                                            ? new MetaRightsManagerConnector({
                                                connectorFactory: this.dependencies.connectorFactory,
                                                releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                                capabilityMatrix: this.capabilityMatrix,
                                                logger: this.dependencies.logger,
                                                retryPolicy: this.dependencies.retryPolicy,
                                                fetchImpl: this.dependencies.fetchImpl,
                                                configuration: {
                                                    apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                                    ingestionBaseUrl: job.target.endpointUrl,
                                                    oauthAuthorizeUrl: null,
                                                    oauthTokenUrl: null,
                                                    webhookUrl: null,
                                                    webhookSecret: null,
                                                    clientId: null,
                                                    clientSecret: null,
                                                    scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                                    sandboxMode: true,
                                                },
                                            })
                                            : key === "Tidal"
                                                ? new TidalConnector({
                                                    connectorFactory: this.dependencies.connectorFactory,
                                                    releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                                    capabilityMatrix: this.capabilityMatrix,
                                                    logger: this.dependencies.logger,
                                                    retryPolicy: this.dependencies.retryPolicy,
                                                    fetchImpl: this.dependencies.fetchImpl,
                                                    configuration: {
                                                        apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                                        ingestionBaseUrl: job.target.endpointUrl,
                                                        oauthAuthorizeUrl: null,
                                                        oauthTokenUrl: null,
                                                        webhookUrl: null,
                                                        webhookSecret: null,
                                                        clientId: null,
                                                        clientSecret: null,
                                                        scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                                        sandboxMode: true,
                                                    },
                                                })
                                                : key === "YouTubeMusic"
                                                    ? new YouTubeMusicConnector({
                                                        connectorFactory: this.dependencies.connectorFactory,
                                                        releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                                        capabilityMatrix: this.capabilityMatrix,
                                                        logger: this.dependencies.logger,
                                                        retryPolicy: this.dependencies.retryPolicy,
                                                        fetchImpl: this.dependencies.fetchImpl,
                                                        configuration: {
                                                            apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                                            ingestionBaseUrl: job.target.endpointUrl,
                                                            oauthAuthorizeUrl: null,
                                                            oauthTokenUrl: null,
                                                            webhookUrl: null,
                                                            webhookSecret: null,
                                                            clientId: null,
                                                            clientSecret: null,
                                                            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                                            sandboxMode: true,
                                                        },
                                                    })
                                                    : new DSPConnectorShell({
                                                        connectorFactory: this.dependencies.connectorFactory,
                                                        releaseDeliveryEngine: this.dependencies.releaseDeliveryEngine,
                                                        capabilityMatrix: this.capabilityMatrix,
                                                        logger: this.dependencies.logger,
                                                        retryPolicy: this.dependencies.retryPolicy,
                                                        configuration: {
                                                            apiVersion: job.target.connectorVersion ?? this.defaultConnectorVersion,
                                                            ingestionBaseUrl: job.target.endpointUrl,
                                                            oauthAuthorizeUrl: null,
                                                            oauthTokenUrl: null,
                                                            webhookUrl: null,
                                                            webhookSecret: null,
                                                            clientId: null,
                                                            clientSecret: null,
                                                            scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health"]),
                                                            sandboxMode: true,
                                                        },
                                                    }, key);
        this.connectors.set(key, shell);
        return shell;
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error(`Release is required for connector ${job.target.connectorId}`);
        }
        return job.release;
    }
}
