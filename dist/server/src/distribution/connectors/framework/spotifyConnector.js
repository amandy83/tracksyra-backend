import { ConnectorAsset as ConnectorAssetModel } from "../assets/connectorAsset.js";
import { ConnectorConfiguration, ConnectorCredentials } from "../configuration/connectorConfiguration.js";
import { ConnectorContext } from "../context/connectorContext.js";
import { ConnectorError } from "../errors/connectorError.js";
import { ConnectorHealth } from "../health/connectorHealth.js";
import { ConnectorMetadata } from "../metadata/connectorMetadata.js";
import { ConnectorStatus } from "../status/connectorStatus.js";
import { ConnectorTakedown } from "../takedown/connectorTakedown.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function safeText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function trackAudioAsset(job, packageModel) {
    const release = job.release;
    const track = release?.tracks[0] ?? null;
    const url = track?.audioReference ?? null;
    return new ConnectorAssetModel({
        assetId: `${job.target.connectorId}:${job.releaseId}:audio`,
        releaseId: job.releaseId,
        kind: "audio",
        uri: url ?? `${job.releaseId}.flac`,
        checksum: track?.audioChecksum ?? null,
        sizeBytes: null,
        mediaType: "audio/flac",
        metadata: freeze({
            packageId: packageModel.packageId,
            connectorId: job.target.connectorId,
            connectorVersion: job.target.connectorVersion,
        }),
    });
}
function trackArtworkAsset(job, packageModel) {
    const release = job.release;
    const artworkUrl = safeText(release?.metadata?.coverArtUrl ?? release?.metadata?.artworkUrl ?? release?.tracks[0]?.artworkReference ?? null);
    return new ConnectorAssetModel({
        assetId: `${job.target.connectorId}:${job.releaseId}:artwork`,
        releaseId: job.releaseId,
        kind: "artwork",
        uri: artworkUrl ?? `${job.releaseId}.jpg`,
        checksum: null,
        sizeBytes: null,
        mediaType: "image/jpeg",
        metadata: freeze({
            packageId: packageModel.packageId,
            connectorId: job.target.connectorId,
            connectorVersion: job.target.connectorVersion,
        }),
    });
}
function normalizePackageArtifacts(packageModel) {
    const artifacts = Array.isArray(packageModel.artifacts) ? packageModel.artifacts : [];
    return Object.freeze(artifacts.map((artifact) => ({
        path: artifact.path,
        kind: artifact.kind,
        checksum: artifact.checksum,
        sizeBytes: artifact.sizeBytes,
        contentType: artifact.contentType,
        metadata: freeze({ ...artifact.metadata }),
    })));
}
function buildContext(job, packageModel) {
    return new ConnectorContext({
        connectorId: job.target.connectorId,
        connectorVersion: job.target.connectorVersion ?? "1.0.0",
        releaseId: job.releaseId,
        executionId: `${job.jobId}:${job.target.connectorId}`,
        providerReference: job.target.endpointUrl ?? `${job.target.connectorId}:${packageModel.packageId}`,
        configuration: new ConnectorConfiguration({
            connectorId: job.target.connectorId,
            version: job.target.connectorVersion ?? "1.0.0",
            authenticationType: "OAuth2",
            settings: freeze({
                connectorId: job.target.connectorId,
                endpointUrl: job.target.endpointUrl,
                territories: job.target.territories,
                requestedBy: job.requestedBy,
                ...job.target.metadata,
                ...job.metadata,
            }),
        }),
        metadata: freeze({
            jobId: job.jobId,
            packageId: packageModel.packageId,
            releaseId: job.releaseId,
            connectorId: job.target.connectorId,
            connectorVersion: job.target.connectorVersion,
            ...job.metadata,
            ...job.target.metadata,
        }),
        attributes: freeze({
            targetTerritoryCount: job.target.territories.length,
            scheduledFor: job.scheduledFor ? String(job.scheduledFor) : null,
        }),
    });
}
function normalizedText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function normalizedList(values) {
    return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}
function buildEndpoint(primary, fallback) {
    return normalizedText(primary) ?? normalizedText(fallback);
}
function formatRequestTimeout(timeoutMs) {
    return Number.isFinite(timeoutMs ?? NaN) && (timeoutMs ?? 0) > 0 ? Math.floor(timeoutMs) : 15_000;
}
function buildContributorSummary(release) {
    const contributors = new Map();
    const add = (name, role) => {
        const contributorName = normalizedText(name);
        if (!contributorName)
            return;
        const current = contributors.get(contributorName) ?? [];
        if (!current.includes(role)) {
            contributors.set(contributorName, Object.freeze([...current, role]));
        }
    };
    if (!release) {
        return Object.freeze([]);
    }
    add(release.primaryArtist, "primary_artist");
    for (const contributor of release.contributors ?? []) {
        for (const role of contributor.roles ?? [])
            add(contributor.name, role);
    }
    for (const track of release.tracks ?? []) {
        for (const contributor of track.contributors ?? []) {
            for (const role of contributor.roles ?? [])
                add(contributor.name, role);
        }
    }
    return Object.freeze([...contributors.entries()].map(([name, roles]) => Object.freeze({ name, roles })));
}
function spotifyGenre(value, capabilities) {
    const normalized = normalizedText(value)?.toLowerCase() ?? null;
    if (!normalized)
        return null;
    return capabilities.genreMappings[normalized] ?? normalizedText(value);
}
function spotifyLanguage(value, capabilities) {
    const normalized = normalizedText(value)?.toLowerCase() ?? null;
    if (!normalized)
        return null;
    return capabilities.languageMappings[normalized] ?? normalizedText(value);
}
function deliveryAssetFromTrack(job, packageModel) {
    const release = job.release;
    const track = release?.tracks[0] ?? null;
    return new ConnectorAssetModel({
        assetId: `${job.target.connectorId}:${job.releaseId}:audio`,
        releaseId: job.releaseId,
        kind: "audio",
        uri: normalizedText(track?.audioReference) ?? `${job.releaseId}.flac`,
        checksum: normalizedText(track?.audioChecksum) ?? null,
        sizeBytes: null,
        mediaType: track?.audioReference?.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/flac",
        metadata: freeze({
            packageId: packageModel.packageId,
            connectorId: job.target.connectorId,
            connectorVersion: job.target.connectorVersion,
        }),
    });
}
function artworkAssetFromRelease(job, packageModel) {
    const release = job.release;
    const artworkUrl = normalizedText(release?.metadata?.coverArtUrl ?? release?.metadata?.artworkUrl ?? release?.tracks[0]?.artworkReference ?? null);
    return new ConnectorAssetModel({
        assetId: `${job.target.connectorId}:${job.releaseId}:artwork`,
        releaseId: job.releaseId,
        kind: "artwork",
        uri: artworkUrl ?? `${job.releaseId}.jpg`,
        checksum: normalizedText(release?.metadata?.coverArtChecksum ?? release?.metadata?.artworkChecksum ?? null),
        sizeBytes: null,
        mediaType: artworkUrl?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        metadata: freeze({
            packageId: packageModel.packageId,
            connectorId: job.target.connectorId,
            connectorVersion: job.target.connectorVersion,
        }),
    });
}
export class DSPConnectorShell {
    dependencies;
    connectorId;
    version;
    configuration;
    capabilities;
    constructor(dependencies, connectorId) {
        this.dependencies = dependencies;
        this.connectorId = connectorId;
        this.version = dependencies.configuration.apiVersion;
        this.configuration = new ConnectorConfiguration({
            connectorId,
            version: dependencies.configuration.apiVersion,
            authenticationType: "OAuth2",
            settings: freeze({
                apiVersion: dependencies.configuration.apiVersion,
                ingestionBaseUrl: dependencies.configuration.ingestionBaseUrl,
                oauthAuthorizeUrl: dependencies.configuration.oauthAuthorizeUrl,
                oauthTokenUrl: dependencies.configuration.oauthTokenUrl,
                deliveryEndpointUrl: dependencies.configuration.deliveryEndpointUrl ?? null,
                statusEndpointUrl: dependencies.configuration.statusEndpointUrl ?? null,
                withdrawalEndpointUrl: dependencies.configuration.withdrawalEndpointUrl ?? null,
                restoreEndpointUrl: dependencies.configuration.restoreEndpointUrl ?? null,
                healthEndpointUrl: dependencies.configuration.healthEndpointUrl ?? null,
                requestTimeoutMs: dependencies.configuration.requestTimeoutMs ?? null,
                webhookUrl: dependencies.configuration.webhookUrl,
                webhookSecret: dependencies.configuration.webhookSecret,
                clientId: dependencies.configuration.clientId,
                clientSecret: dependencies.configuration.clientSecret,
                scopes: dependencies.configuration.scopes,
                sandboxMode: dependencies.configuration.sandboxMode,
            }),
        });
        this.capabilities = dependencies.capabilityMatrix[connectorId] ?? dependencies.capabilityMatrix.Spotify;
    }
    validateRelease(job) {
        const release = this.assertRelease(job);
        return this.dependencies.releaseDeliveryEngine.validateRelease(release);
    }
    async authenticate(context) {
        const connector = this.resolveConnector(context);
        const response = await Promise.resolve(connector.authenticate(context));
        return response.payload;
    }
    async normalizeMetadata(job) {
        const packageModel = await this.buildPackage(job);
        const release = job.release;
        return new ConnectorMetadata({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            payload: freeze({
                packageId: packageModel.packageId,
                connectorId: this.connectorId,
                connectorVersion: this.version,
                releaseTitle: release?.title ?? null,
                primaryArtist: release?.primaryArtist ?? null,
                label: release?.label ?? null,
                territories: job.target.territories,
                endpointUrl: job.target.endpointUrl,
            }),
            language: safeText(release?.metadata?.language ?? null),
            territories: job.target.territories,
            createdAt: nowIso(),
        });
    }
    async normalizeArtwork(job) {
        const packageModel = await this.buildPackage(job);
        return trackArtworkAsset(job, packageModel);
    }
    async normalizeAudio(job) {
        const packageModel = await this.buildPackage(job);
        return trackAudioAsset(job, packageModel);
    }
    async buildPackage(job) {
        if (job.packageModel)
            return job.packageModel;
        const release = this.assertRelease(job);
        const packageModel = await this.dependencies.releaseDeliveryEngine.buildDeliveryPackage(release, {
            requestedBy: job.requestedBy,
            scheduledFor: job.scheduledFor,
            metadata: freeze({
                ...job.metadata,
                connectorId: this.connectorId,
                connectorVersion: this.version,
                connectorEndpoint: job.target.endpointUrl,
            }),
        });
        return packageModel;
    }
    async deliver(job) {
        const packageModel = await this.buildPackage(job);
        const context = buildContext(job, packageModel);
        const connector = this.resolveConnector(context);
        const capabilities = new (await import("../capabilities/connectorCapabilities")).ConnectorCapabilities({
            connectorId: this.connectorId,
            categories: this.capabilities.metadata.categories ?? Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting"]),
            uploadModes: Object.freeze(["Single Upload", "Resumable Upload", "Multipart Upload"]),
            territories: job.target.territories,
            languages: Object.freeze([safeText(job.release?.metadata?.language ?? null) ?? "en"]),
            features: Object.freeze(["metadata-validation", "asset-validation", "status-sync", "retry", "checkpoint"]),
            metadata: freeze({ connectorId: this.connectorId, packageId: packageModel.packageId }),
        });
        const assets = Object.freeze([trackArtworkAsset(job, packageModel), trackAudioAsset(job, packageModel)]);
        const submission = new (await import("../catalog/connectorCatalog")).ConnectorSubmission({
            submissionId: `${packageModel.packageId}:${this.connectorId}:submission`,
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            submittedAt: packageModel.generatedAt,
            accepted: false,
            metadata: freeze({ packageId: packageModel.packageId, connectorId: this.connectorId }),
        });
        const metadata = await this.normalizeMetadata(job);
        const authenticated = await Promise.resolve(connector.authenticate(context));
        await Promise.resolve(connector.validateCapabilities(context, capabilities));
        const assetResponse = await Promise.resolve(connector.uploadAssets(context, assets));
        const metadataResponse = await Promise.resolve(connector.submitMetadata(context, metadata));
        const submissionResponse = await Promise.resolve(connector.createRelease(context, submission));
        const statusResponse = await Promise.resolve(connector.trackProcessing(context));
        const success = Boolean(authenticated.success && assetResponse.success && metadataResponse.success && submissionResponse.success);
        return Object.freeze({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            target: job.target,
            success,
            connectorStatus: typeof statusResponse.payload?.status === "string" ? statusResponse.payload.status : null,
            receipt: submissionResponse.payload?.submissionId ?? null,
            errors: Object.freeze(success ? [] : ["Connector delivery failed"]),
            warnings: Object.freeze([]),
            metadata: freeze({
                packageId: packageModel.packageId,
                authentication: authenticated.metadata,
                assets: assetResponse.metadata,
                metadataSubmission: metadataResponse.metadata,
                submission: submissionResponse.metadata,
                status: statusResponse.metadata,
            }),
        });
    }
    async pollStatus(job) {
        const context = buildContext(job, await this.buildPackage(job));
        const connector = this.resolveConnector(context);
        const response = await Promise.resolve(connector.trackLiveStatus(context));
        return response.payload;
    }
    async fetchErrors(job) {
        const packageModel = await this.buildPackage(job);
        const validation = packageModel.validation;
        const errors = validation?.errors?.map((entry) => entry.message ?? "validation_error") ?? [];
        return Object.freeze(errors);
    }
    async withdraw(job) {
        const context = buildContext(job, await this.buildPackage(job));
        const connector = this.resolveConnector(context);
        const response = await Promise.resolve(connector.takedownRelease(context));
        return response.payload;
    }
    async restore(job) {
        const delivery = await this.deliver(job);
        return new ConnectorStatus({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            status: "Live",
            providerStatus: delivery.connectorStatus ?? "Restored",
            observedAt: nowIso(),
            metadata: freeze({
                packageId: delivery.metadata.packageId ?? null,
                response: delivery.metadata,
            }),
        });
    }
    async healthCheck(job) {
        const context = buildContext(job, await this.buildPackage(job));
        const connector = this.resolveConnector(context);
        const response = await Promise.resolve(connector.checkHealth(context));
        return response.payload;
    }
    validateWebhook(event) {
        return Boolean(event.signatureValid);
    }
    parseWebhook(event) {
        return event;
    }
    shouldRetry(error, attempt, job) {
        return this.dependencies.retryPolicy.shouldRetry(error, attempt, job);
    }
    nextRetryAt(error, attempt, job) {
        return this.dependencies.retryPolicy.nextRetryAt(error, attempt, job);
    }
    resolveConnector(context) {
        return this.dependencies.connectorFactory.create(context);
    }
    assertRelease(job) {
        if (!job.release) {
            throw new Error(`Release is required for connector ${this.connectorId}`);
        }
        return job.release;
    }
    assertPackage(job) {
        if (job.packageModel) {
            return job.packageModel;
        }
        throw new Error(`Package model is required for connector ${this.connectorId}`);
    }
}
export class SpotifyConnector extends DSPConnectorShell {
    fetchImpl;
    timeoutMs;
    constructor(dependencies) {
        super(dependencies, "Spotify");
        this.fetchImpl = dependencies.fetchImpl ?? fetch;
        this.timeoutMs = formatRequestTimeout(dependencies.configuration.requestTimeoutMs);
    }
    validateRelease(job) {
        return this.dependencies.releaseDeliveryEngine.validateRelease(this.assertRelease(job));
    }
    async authenticate(context) {
        const clientId = normalizedText(this.configuration.settings.clientId);
        const clientSecret = normalizedText(this.configuration.settings.clientSecret);
        const tokenUrl = buildEndpoint(this.configuration.settings.oauthTokenUrl, this.configuration.settings.ingestionBaseUrl);
        if (!clientId || !clientSecret || !tokenUrl) {
            throw new ConnectorError({
                connectorId: this.connectorId,
                code: "SPOTIFY_AUTH_CONFIGURATION_REQUIRED",
                message: "Spotify OAuth configuration is required before delivery can authenticate.",
                retryable: false,
                metadata: freeze({
                    connectorId: this.connectorId,
                    releaseId: context.releaseId,
                    executionId: context.executionId,
                }),
            });
        }
        const body = new URLSearchParams({
            grant_type: "client_credentials",
            scope: normalizedList(this.configuration.settings.scopes).join(" "),
        });
        const response = await this.request(tokenUrl, {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        });
        const payload = await this.readResponseBody(response);
        if (!response.ok) {
            throw this.toError("SPOTIFY_AUTH_FAILED", "Spotify OAuth token request failed.", payload, true, context.releaseId, context.executionId);
        }
        const token = typeof payload.access_token === "string" ? payload.access_token : null;
        if (!token) {
            throw this.toError("SPOTIFY_AUTH_TOKEN_MISSING", "Spotify OAuth token response did not include an access token.", payload, false, context.releaseId, context.executionId);
        }
        return new ConnectorCredentials({
            connectorId: this.connectorId,
            authenticationType: "Client Credentials",
            token,
            clientId,
            clientSecret: null,
            refreshToken: null,
            expiresAt: typeof payload.expires_in === "number" ? new Date(Date.now() + Math.max(1, payload.expires_in) * 1000).toISOString() : null,
            metadata: freeze({
                connectorId: this.connectorId,
                releaseId: context.releaseId,
                executionId: context.executionId,
                scope: normalizedList(this.configuration.settings.scopes),
                tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
            }),
        });
    }
    async normalizeMetadata(job) {
        const packageModel = await this.buildPackage(job);
        return this.createMetadata(job, packageModel);
    }
    async normalizeArtwork(job) {
        const packageModel = await this.buildPackage(job);
        return artworkAssetFromRelease(job, packageModel);
    }
    async normalizeAudio(job) {
        const packageModel = await this.buildPackage(job);
        return deliveryAssetFromTrack(job, packageModel);
    }
    async buildPackage(job) {
        if (job.packageModel)
            return job.packageModel;
        const release = this.assertRelease(job);
        const packageModel = await this.dependencies.releaseDeliveryEngine.buildDeliveryPackage(release, {
            requestedBy: job.requestedBy,
            scheduledFor: job.scheduledFor,
            metadata: freeze({
                ...job.metadata,
                connectorId: this.connectorId,
                connectorVersion: this.version,
                connectorEndpoint: job.target.endpointUrl,
                partnerName: job.target.partnerName,
            }),
        });
        return packageModel;
    }
    async deliver(job) {
        const packageModel = await this.buildPackage(job);
        const release = this.assertRelease(job);
        const context = buildContext(job, packageModel);
        const metadata = this.createMetadata(job, packageModel);
        const endpoint = buildEndpoint(job.target.endpointUrl, this.configuration.settings.deliveryEndpointUrl ?? this.configuration.settings.ingestionBaseUrl);
        if (!endpoint) {
            return this.failedResult(job, packageModel, ["Spotify delivery endpoint is not configured."], "SPOTIFY_DELIVERY_ENDPOINT_REQUIRED", {
                packageId: packageModel.packageId,
                releaseTitle: release.title,
            });
        }
        const credentials = await this.authenticate(context);
        const response = await this.request(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${credentials.token ?? ""}`,
                "Content-Type": "application/json",
                "X-TrackSyra-Connector": this.connectorId,
                "X-TrackSyra-Package-Id": packageModel.packageId,
            },
            body: JSON.stringify({
                packageId: packageModel.packageId,
                releaseId: job.releaseId,
                connectorId: this.connectorId,
                connectorVersion: this.version,
                release: metadata.payload,
                audio: (await this.normalizeAudio(job)).metadata,
                artwork: (await this.normalizeArtwork(job)).metadata,
                package: {
                    checksum: packageModel.checksum,
                    generatedAt: packageModel.generatedAt,
                    manifestChecksum: null,
                },
                artifacts: normalizePackageArtifacts(packageModel),
                target: job.target,
            }),
        });
        const body = await this.readResponseBody(response);
        if (!response.ok) {
            return this.failedResult(job, packageModel, this.extractErrors(body), "SPOTIFY_DELIVERY_FAILED", {
                statusCode: response.status,
                response: body,
            });
        }
        return Object.freeze({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            target: job.target,
            success: true,
            connectorStatus: this.extractStatus(body) ?? "SUBMITTED",
            receipt: this.extractReceipt(body) ?? response.headers.get("x-request-id") ?? null,
            errors: Object.freeze([]),
            warnings: Object.freeze([]),
            metadata: freeze({
                packageId: packageModel.packageId,
                endpoint,
                requestId: response.headers.get("x-request-id"),
                response: body,
            }),
        });
    }
    async pollStatus(job) {
        const packageModel = await this.buildPackage(job);
        const context = buildContext(job, packageModel);
        const endpoint = buildEndpoint(this.configuration.settings.statusEndpointUrl, this.configuration.settings.ingestionBaseUrl);
        if (!endpoint) {
            return new ConnectorStatus({
                connectorId: this.connectorId,
                releaseId: job.releaseId,
                status: "Pending",
                providerStatus: "SPOTIFY_STATUS_ENDPOINT_NOT_CONFIGURED",
                observedAt: nowIso(),
                metadata: freeze({
                    packageId: packageModel.packageId,
                    releaseId: job.releaseId,
                    reason: "Spotify status endpoint is not configured.",
                }),
            });
        }
        const credentials = await this.authenticate(context);
        const response = await this.request(`${endpoint}?releaseId=${encodeURIComponent(job.releaseId)}&packageId=${encodeURIComponent(packageModel.packageId)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${credentials.token ?? ""}`,
                "X-TrackSyra-Connector": this.connectorId,
            },
        });
        const body = await this.readResponseBody(response);
        const providerStatus = this.extractStatus(body) ?? (response.ok ? "PROCESSING" : "FAILED");
        const status = /live|published|delivered/i.test(providerStatus) ? "Live" : /failed|rejected/i.test(providerStatus) ? "Failed" : "Processing";
        return new ConnectorStatus({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            status,
            providerStatus,
            observedAt: nowIso(),
            metadata: freeze({
                packageId: packageModel.packageId,
                endpoint,
                response: body,
            }),
        });
    }
    async fetchErrors(job) {
        const packageModel = await this.buildPackage(job);
        const validation = packageModel.validation;
        const validationErrors = Array.isArray(validation?.errors)
            ? validation.errors.map((entry) => entry?.message ?? "validation_error").filter(Boolean)
            : [];
        if (validationErrors.length)
            return Object.freeze(validationErrors);
        if (!buildEndpoint(job.target.endpointUrl, this.configuration.settings.deliveryEndpointUrl ?? this.configuration.settings.ingestionBaseUrl)) {
            return Object.freeze(["Spotify delivery endpoint is not configured."]);
        }
        return Object.freeze([]);
    }
    async withdraw(job) {
        const packageModel = await this.buildPackage(job);
        const context = buildContext(job, packageModel);
        const endpoint = buildEndpoint(this.configuration.settings.withdrawalEndpointUrl, this.configuration.settings.ingestionBaseUrl);
        if (!endpoint) {
            throw this.toError("SPOTIFY_WITHDRAWAL_ENDPOINT_REQUIRED", "Spotify withdrawal endpoint is not configured.", { releaseId: job.releaseId }, false, job.releaseId, context.executionId);
        }
        const credentials = await this.authenticate(context);
        const response = await this.request(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${credentials.token ?? ""}`,
                "Content-Type": "application/json",
                "X-TrackSyra-Connector": this.connectorId,
            },
            body: JSON.stringify({
                packageId: packageModel.packageId,
                releaseId: job.releaseId,
                target: job.target,
            }),
        });
        const body = await this.readResponseBody(response);
        if (!response.ok) {
            throw this.toError("SPOTIFY_WITHDRAWAL_FAILED", "Spotify withdrawal request failed.", body, this.isRetryable(body), job.releaseId, context.executionId);
        }
        return new ConnectorTakedown({
            takedownId: this.extractReceipt(body) ?? `${this.connectorId}:${job.releaseId}:takedown`,
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            requestedAt: nowIso(),
            completedAt: nowIso(),
            metadata: freeze({
                packageId: packageModel.packageId,
                endpoint,
                response: body,
            }),
        });
    }
    async restore(job) {
        const packageModel = await this.buildPackage(job);
        const context = buildContext(job, packageModel);
        const endpoint = buildEndpoint(this.configuration.settings.restoreEndpointUrl, this.configuration.settings.ingestionBaseUrl);
        if (!endpoint) {
            throw this.toError("SPOTIFY_RESTORE_ENDPOINT_REQUIRED", "Spotify restore endpoint is not configured.", { releaseId: job.releaseId }, false, job.releaseId, context.executionId);
        }
        const credentials = await this.authenticate(context);
        const response = await this.request(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${credentials.token ?? ""}`,
                "Content-Type": "application/json",
                "X-TrackSyra-Connector": this.connectorId,
            },
            body: JSON.stringify({
                packageId: packageModel.packageId,
                releaseId: job.releaseId,
                target: job.target,
            }),
        });
        const body = await this.readResponseBody(response);
        if (!response.ok) {
            throw this.toError("SPOTIFY_RESTORE_FAILED", "Spotify restore request failed.", body, this.isRetryable(body), job.releaseId, context.executionId);
        }
        return new ConnectorStatus({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            status: "Live",
            providerStatus: this.extractStatus(body) ?? "RESTORED",
            observedAt: nowIso(),
            metadata: freeze({
                packageId: packageModel.packageId,
                endpoint,
                response: body,
            }),
        });
    }
    async healthCheck(job) {
        const packageModel = await this.buildPackage(job);
        const context = buildContext(job, packageModel);
        const endpoint = buildEndpoint(this.configuration.settings.healthEndpointUrl, this.configuration.settings.ingestionBaseUrl);
        if (!endpoint) {
            return new ConnectorHealth({
                connectorId: this.connectorId,
                healthy: false,
                latencyMs: null,
                checkedAt: nowIso(),
                details: freeze({
                    packageId: packageModel.packageId,
                    releaseId: job.releaseId,
                    reason: "Spotify health endpoint is not configured.",
                }),
            });
        }
        const credentials = await this.authenticate(context);
        const startedAt = Date.now();
        const response = await this.request(endpoint, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${credentials.token ?? ""}`,
                "X-TrackSyra-Connector": this.connectorId,
            },
        });
        const body = await this.readResponseBody(response);
        return new ConnectorHealth({
            connectorId: this.connectorId,
            healthy: response.ok && !this.isFailureStatus(body),
            latencyMs: Date.now() - startedAt,
            checkedAt: nowIso(),
            details: freeze({
                packageId: packageModel.packageId,
                endpoint,
                response: body,
            }),
        });
    }
    validateWebhook(event) {
        return Boolean(event.signatureValid);
    }
    parseWebhook(event) {
        return event;
    }
    shouldRetry(error, attempt, job) {
        return this.dependencies.retryPolicy.shouldRetry(error, attempt, job);
    }
    nextRetryAt(error, attempt, job) {
        return this.dependencies.retryPolicy.nextRetryAt(error, attempt, job);
    }
    assertRelease(job) {
        if (!job.release) {
            throw new ConnectorError({
                connectorId: this.connectorId,
                code: "SPOTIFY_RELEASE_REQUIRED",
                message: "Spotify delivery requires a release payload.",
                retryable: false,
                metadata: freeze({
                    connectorId: this.connectorId,
                    releaseId: job.releaseId,
                }),
            });
        }
        return job.release;
    }
    async request(url, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.fetchImpl(url, { ...init, signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    createMetadata(job, packageModel) {
        const release = this.assertRelease(job);
        const capabilities = this.capabilities;
        return new ConnectorMetadata({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            payload: freeze({
                packageId: packageModel.packageId,
                releaseTitle: release.title ?? null,
                primaryArtist: release.primaryArtist ?? null,
                label: release.label ?? null,
                genre: spotifyGenre(release.metadata?.genre, capabilities),
                language: spotifyLanguage(release.metadata?.language, capabilities),
                territories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
                contributors: buildContributorSummary(release),
                rightsOwned: Boolean(release.metadata?.rightsOwned ?? false),
                parentalAdvisory: this.normalizeParentalAdvisory(release.metadata?.parentalAdvisory ?? release.tracks[0]?.metadata?.parentalAdvisory ?? null),
                spotifyArtistId: normalizedText(release.metadata?.spotifyArtistId ?? null),
                appleArtistId: normalizedText(release.metadata?.appleArtistId ?? null),
                deliveryProtocol: this.capabilities.deliveryProtocol,
                canvasSupport: this.capabilities.canvasSupport,
                spatialAudioSupport: this.capabilities.spatialAudioSupport,
                dolbySupport: this.capabilities.dolbySupport,
            }),
            language: spotifyLanguage(release.metadata?.language, capabilities),
            territories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
            createdAt: nowIso(),
        });
    }
    async readResponseBody(response) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            try {
                return await response.json();
            }
            catch {
                return {};
            }
        }
        const text = await response.text().catch(() => "");
        return text ? { message: text } : {};
    }
    normalizeParentalAdvisory(value) {
        const text = normalizedText(value);
        if (!text)
            return "none";
        if (["explicit", "clean", "none"].includes(text.toLowerCase()))
            return text.toLowerCase();
        return "none";
    }
    extractStatus(body) {
        return normalizedText(body.providerStatus ?? body.status ?? body.state ?? body.deliveryStatus ?? null);
    }
    extractReceipt(body) {
        return normalizedText(body.receipt ?? body.deliveryId ?? body.submissionId ?? body.takedownId ?? body.id ?? null);
    }
    isFailureStatus(body) {
        const status = this.extractStatus(body)?.toLowerCase() ?? "";
        return ["failed", "error", "rejected", "blocked"].includes(status);
    }
    isRetryable(body) {
        const retryable = body.retryable;
        return typeof retryable === "boolean" ? retryable : true;
    }
    extractErrors(body) {
        if (Array.isArray(body.errors)) {
            return body.errors.map((entry) => (typeof entry === "string" ? entry : normalizedText(entry.message) ?? "spotify_delivery_error"));
        }
        const message = normalizedText(body.message ?? body.error ?? null);
        return message ? [message] : ["Spotify delivery failed."];
    }
    toError(code, message, metadata, retryable, releaseId, executionId) {
        return new ConnectorError({
            connectorId: this.connectorId,
            code,
            message,
            retryable,
            metadata: freeze({
                connectorId: this.connectorId,
                releaseId,
                executionId,
                ...metadata,
            }),
        });
    }
    failedResult(job, packageModel, errors, code, metadata) {
        return Object.freeze({
            connectorId: this.connectorId,
            releaseId: job.releaseId,
            target: job.target,
            success: false,
            connectorStatus: code,
            receipt: null,
            errors: Object.freeze([...errors]),
            warnings: Object.freeze([]),
            metadata: freeze({
                packageId: packageModel.packageId,
                code,
                ...metadata,
            }),
        });
    }
}
