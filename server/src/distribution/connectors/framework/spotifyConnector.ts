import type { ConnectorAsset } from "../assets/connectorAsset";
import { ConnectorAsset as ConnectorAssetModel } from "../assets/connectorAsset";
import { ConnectorConfiguration, ConnectorCredentials } from "../configuration/connectorConfiguration";
import { ConnectorContext } from "../context/connectorContext";
import { ConnectorError } from "../errors/connectorError";
import { ConnectorHealth } from "../health/connectorHealth";
import { ConnectorMetadata } from "../metadata/connectorMetadata";
import { ConnectorRetry } from "../retry/connectorRetry";
import { ConnectorStatus } from "../status/connectorStatus";
import { ConnectorTakedown } from "../takedown/connectorTakedown";
import { ConnectorWebhook } from "../webhooks/connectorWebhook";
import type { ConnectorFactory, DSPConnector as LegacyDSPConnector } from "../contracts/connectorContracts";
import type { Logger } from "../../observability/contracts/observabilityContracts";
import type { Release } from "../../domain";
import type { ReleaseDeliveryBuildOptions, ReleaseDeliveryEngine } from "../../core/releaseDeliveryEngine";
import type {
  DSPAuthentication,
  DSPCapabilities,
  DSPConnector,
  DSPConnectorCapabilityMatrix,
  DSPDeliveryJob,
  DSPDeliveryPackage,
  DSPDeliveryResult,
  DSPHealthCheck,
  DSPHealthSnapshot,
  DSPMetadataTransformer,
  DSPNormalizedAudio,
  DSPNormalizedArtwork,
  DSPNormalizedMetadata,
  DSPPackageBuilder,
  DSPRetryPolicy,
  DSPStatusSnapshot,
  DSPStatusProvider,
  DSPWebhookHandler,
} from "./connectorFrameworkTypes";

export type DSPConnectorDependencies = SpotifyConnectorDependencies;

export type SpotifyConnectorConfiguration = Readonly<{
  apiVersion: string;
  ingestionBaseUrl: string | null;
  oauthAuthorizeUrl: string | null;
  oauthTokenUrl: string | null;
  deliveryEndpointUrl?: string | null;
  statusEndpointUrl?: string | null;
  withdrawalEndpointUrl?: string | null;
  restoreEndpointUrl?: string | null;
  healthEndpointUrl?: string | null;
  requestTimeoutMs?: number | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  clientId: string | null;
  clientSecret: string | null;
  scopes: readonly string[];
  sandboxMode: boolean;
}>;

export type SpotifyConnectorDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: ReleaseDeliveryEngineLike;
  capabilityMatrix: DSPConnectorCapabilityMatrix;
  logger: Logger | null;
  retryPolicy: DSPRetryPolicy;
  configuration: SpotifyConnectorConfiguration;
  fetchImpl?: typeof fetch;
}>;

export interface ReleaseDeliveryEngineLike {
  validateRelease(release: Release): unknown;
  buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
}

function nowIso(): string {
  return new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function trackAudioAsset(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorAsset {
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

function trackArtworkAsset(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorAsset {
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

function normalizePackageArtifacts(packageModel: DSPDeliveryPackage): readonly { path: string; kind: string; checksum: string | null; sizeBytes: number | null; contentType: string | null; metadata: Readonly<Record<string, unknown>> }[] {
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

function buildContext(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorContext {
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

function normalizedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedList(values: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}

function buildEndpoint(primary: string | null | undefined, fallback: string | null | undefined): string | null {
  return normalizedText(primary) ?? normalizedText(fallback);
}

function formatRequestTimeout(timeoutMs: number | null | undefined): number {
  return Number.isFinite(timeoutMs ?? NaN) && (timeoutMs ?? 0) > 0 ? Math.floor(timeoutMs as number) : 15_000;
}

function buildContributorSummary(release: DSPDeliveryJob["release"] | null) {
  const contributors = new Map<string, readonly string[]>();
  const add = (name: string | null | undefined, role: string) => {
    const contributorName = normalizedText(name);
    if (!contributorName) return;
    const current = contributors.get(contributorName) ?? [];
    if (!current.includes(role)) {
      contributors.set(contributorName, Object.freeze([...current, role]));
    }
  };

  if (!release) {
    return Object.freeze([] as readonly { name: string; roles: readonly string[] }[]);
  }
  add(release.primaryArtist, "primary_artist");
  for (const contributor of release.contributors ?? []) {
    for (const role of contributor.roles ?? []) add(contributor.name, role);
  }
  for (const track of release.tracks ?? []) {
    for (const contributor of track.contributors ?? []) {
      for (const role of contributor.roles ?? []) add(contributor.name, role);
    }
  }

  return Object.freeze([...contributors.entries()].map(([name, roles]) => Object.freeze({ name, roles })));
}

function spotifyGenre(value: string | null | undefined, capabilities: DSPCapabilities): string | null {
  const normalized = normalizedText(value)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return capabilities.genreMappings[normalized] ?? normalizedText(value);
}

function spotifyLanguage(value: string | null | undefined, capabilities: DSPCapabilities): string | null {
  const normalized = normalizedText(value)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return capabilities.languageMappings[normalized] ?? normalizedText(value);
}

function deliveryAssetFromTrack(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorAsset {
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

function artworkAssetFromRelease(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorAsset {
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

export class DSPConnectorShell implements DSPConnector, DSPMetadataTransformer, DSPPackageBuilder, DSPAuthentication, DSPWebhookHandler, DSPStatusProvider, DSPHealthCheck {
  readonly connectorId: string;
  readonly version: string;
  readonly configuration: ConnectorConfiguration;
  readonly capabilities: DSPCapabilities;

  constructor(protected readonly dependencies: DSPConnectorDependencies, connectorId: string) {
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

  validateRelease(job: DSPDeliveryJob): unknown {
    const release = this.assertRelease(job);
    return this.dependencies.releaseDeliveryEngine.validateRelease(release);
  }

  async authenticate(context: ConnectorContext): Promise<ConnectorCredentials> {
    const connector = this.resolveConnector(context);
    const response = await Promise.resolve(connector.authenticate(context));
    return response.payload;
  }

  async normalizeMetadata(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
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

  async normalizeArtwork(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    const packageModel = await this.buildPackage(job);
    return trackArtworkAsset(job, packageModel);
  }

  async normalizeAudio(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    const packageModel = await this.buildPackage(job);
    return trackAudioAsset(job, packageModel);
  }

  async buildPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> {
    if (job.packageModel) return job.packageModel;
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
    return packageModel as DSPDeliveryPackage;
  }

  async deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    const packageModel = await this.buildPackage(job);
    const context = buildContext(job, packageModel);
    const connector = this.resolveConnector(context);
    const capabilities = new (await import("../capabilities/connectorCapabilities")).ConnectorCapabilities({
      connectorId: this.connectorId,
      categories: this.capabilities.metadata.categories as readonly never[] ?? Object.freeze(["Music", "Territories", "Languages", "Monetization", "Royalty Reporting"]),
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

  async pollStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    const context = buildContext(job, await this.buildPackage(job));
    const connector = this.resolveConnector(context);
    const response = await Promise.resolve(connector.trackLiveStatus(context));
    return response.payload;
  }

  async fetchErrors(job: DSPDeliveryJob): Promise<readonly string[]> {
    const packageModel = await this.buildPackage(job);
    const validation = packageModel.validation as { errors?: readonly { message?: string }[] } | null;
    const errors = validation?.errors?.map((entry) => entry.message ?? "validation_error") ?? [];
    return Object.freeze(errors);
  }

  async withdraw(job: DSPDeliveryJob): Promise<ConnectorTakedown> {
    const context = buildContext(job, await this.buildPackage(job));
    const connector = this.resolveConnector(context);
    const response = await Promise.resolve(connector.takedownRelease(context));
    return response.payload;
  }

  async restore(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
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

  async healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    const context = buildContext(job, await this.buildPackage(job));
    const connector = this.resolveConnector(context);
    const response = await Promise.resolve(connector.checkHealth(context));
    return response.payload;
  }

  validateWebhook(event: ConnectorWebhook): Promise<boolean> | boolean {
    return Boolean(event.signatureValid);
  }

  parseWebhook(event: ConnectorWebhook): Promise<ConnectorWebhook> | ConnectorWebhook {
    return event;
  }

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.retryPolicy.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.retryPolicy.nextRetryAt(error, attempt, job);
  }

  private resolveConnector(context: ConnectorContext): LegacyDSPConnector {
    return this.dependencies.connectorFactory.create(context);
  }

  protected assertRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new Error(`Release is required for connector ${this.connectorId}`);
    }
    return job.release;
  }

  private assertPackage(job: DSPDeliveryJob): DSPDeliveryPackage {
    if (job.packageModel) {
      return job.packageModel;
    }
    throw new Error(`Package model is required for connector ${this.connectorId}`);
  }
}

export class SpotifyConnector extends DSPConnectorShell {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(dependencies: DSPConnectorDependencies) {
    super(dependencies, "Spotify");
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.timeoutMs = formatRequestTimeout(dependencies.configuration.requestTimeoutMs as number | null | undefined);
  }

  validateRelease(job: DSPDeliveryJob): unknown {
    return this.dependencies.releaseDeliveryEngine.validateRelease(this.assertRelease(job));
  }

  async authenticate(context: ConnectorContext): Promise<ConnectorCredentials> {
    const clientId = normalizedText(this.configuration.settings.clientId as string | null | undefined);
    const clientSecret = normalizedText(this.configuration.settings.clientSecret as string | null | undefined);
    const tokenUrl = buildEndpoint(this.configuration.settings.oauthTokenUrl as string | null | undefined, this.configuration.settings.ingestionBaseUrl as string | null | undefined);
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
      scope: normalizedList(this.configuration.settings.scopes as readonly string[] | null | undefined).join(" "),
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
        scope: normalizedList(this.configuration.settings.scopes as readonly string[] | null | undefined),
        tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
      }),
    });
  }

  async normalizeMetadata(job: DSPDeliveryJob): Promise<DSPNormalizedMetadata> {
    const packageModel = await this.buildPackage(job);
    return this.createMetadata(job, packageModel);
  }

  async normalizeArtwork(job: DSPDeliveryJob): Promise<DSPNormalizedArtwork> {
    const packageModel = await this.buildPackage(job);
    return artworkAssetFromRelease(job, packageModel);
  }

  async normalizeAudio(job: DSPDeliveryJob): Promise<DSPNormalizedAudio> {
    const packageModel = await this.buildPackage(job);
    return deliveryAssetFromTrack(job, packageModel);
  }

  async buildPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> {
    if (job.packageModel) return job.packageModel;
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
    return packageModel as DSPDeliveryPackage;
  }

  async deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    const packageModel = await this.buildPackage(job);
    const release = this.assertRelease(job);
    const context = buildContext(job, packageModel);
    const metadata = this.createMetadata(job, packageModel);
    const endpoint = buildEndpoint(job.target.endpointUrl, (this.configuration.settings.deliveryEndpointUrl as string | null | undefined) ?? (this.configuration.settings.ingestionBaseUrl as string | null | undefined));

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

  async pollStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    const packageModel = await this.buildPackage(job);
    const context = buildContext(job, packageModel);
    const endpoint = buildEndpoint(this.configuration.settings.statusEndpointUrl as string | null | undefined, this.configuration.settings.ingestionBaseUrl as string | null | undefined);
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
    const status: ConnectorStatus["status"] = /live|published|delivered/i.test(providerStatus) ? "Live" : /failed|rejected/i.test(providerStatus) ? "Failed" : "Processing";
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

  async fetchErrors(job: DSPDeliveryJob): Promise<readonly string[]> {
    const packageModel = await this.buildPackage(job);
    const validation = packageModel.validation as { errors?: readonly { message?: string }[] } | null | undefined;
    const validationErrors = Array.isArray(validation?.errors)
      ? validation.errors.map((entry: { message?: string } | null | undefined) => entry?.message ?? "validation_error").filter(Boolean)
      : [];
    if (validationErrors.length) return Object.freeze(validationErrors);
    if (!buildEndpoint(job.target.endpointUrl, (this.configuration.settings.deliveryEndpointUrl as string | null | undefined) ?? (this.configuration.settings.ingestionBaseUrl as string | null | undefined))) {
      return Object.freeze(["Spotify delivery endpoint is not configured."]);
    }
    return Object.freeze([]);
  }

  async withdraw(job: DSPDeliveryJob): Promise<ConnectorTakedown> {
    const packageModel = await this.buildPackage(job);
    const context = buildContext(job, packageModel);
    const endpoint = buildEndpoint(this.configuration.settings.withdrawalEndpointUrl as string | null | undefined, this.configuration.settings.ingestionBaseUrl as string | null | undefined);
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

  async restore(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    const packageModel = await this.buildPackage(job);
    const context = buildContext(job, packageModel);
    const endpoint = buildEndpoint(this.configuration.settings.restoreEndpointUrl as string | null | undefined, this.configuration.settings.ingestionBaseUrl as string | null | undefined);
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

  async healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    const packageModel = await this.buildPackage(job);
    const context = buildContext(job, packageModel);
    const endpoint = buildEndpoint(this.configuration.settings.healthEndpointUrl as string | null | undefined, this.configuration.settings.ingestionBaseUrl as string | null | undefined);
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

  validateWebhook(event: ConnectorWebhook): Promise<boolean> | boolean {
    return Boolean(event.signatureValid);
  }

  parseWebhook(event: ConnectorWebhook): Promise<ConnectorWebhook> | ConnectorWebhook {
    return event;
  }

  shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean {
    return this.dependencies.retryPolicy.shouldRetry(error, attempt, job);
  }

  nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null {
    return this.dependencies.retryPolicy.nextRetryAt(error, attempt, job);
  }

  protected assertRelease(job: DSPDeliveryJob): NonNullable<DSPDeliveryJob["release"]> {
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

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private createMetadata(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage): ConnectorMetadata {
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
        genre: spotifyGenre(release.metadata?.genre as string | null | undefined, capabilities),
        language: spotifyLanguage(release.metadata?.language as string | null | undefined, capabilities),
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
      language: spotifyLanguage(release.metadata?.language as string | null | undefined, capabilities),
      territories: Object.freeze(normalizedList(job.target.territories).map((territory) => territory.toUpperCase())),
      createdAt: nowIso(),
    });
  }

  private async readResponseBody(response: Response): Promise<Record<string, unknown>> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json() as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    const text = await response.text().catch(() => "");
    return text ? { message: text } : {};
  }

  private normalizeParentalAdvisory(value: unknown): string {
    const text = normalizedText(value);
    if (!text) return "none";
    if (["explicit", "clean", "none"].includes(text.toLowerCase())) return text.toLowerCase();
    return "none";
  }

  private extractStatus(body: Record<string, unknown>): string | null {
    return normalizedText(body.providerStatus ?? body.status ?? body.state ?? body.deliveryStatus ?? null);
  }

  private extractReceipt(body: Record<string, unknown>): string | null {
    return normalizedText(body.receipt ?? body.deliveryId ?? body.submissionId ?? body.takedownId ?? body.id ?? null);
  }

  private isFailureStatus(body: Record<string, unknown>): boolean {
    const status = this.extractStatus(body)?.toLowerCase() ?? "";
    return ["failed", "error", "rejected", "blocked"].includes(status);
  }

  private isRetryable(body: Record<string, unknown>): boolean {
    const retryable = body.retryable;
    return typeof retryable === "boolean" ? retryable : true;
  }

  private extractErrors(body: Record<string, unknown>): string[] {
    if (Array.isArray(body.errors)) {
      return body.errors.map((entry) => (typeof entry === "string" ? entry : normalizedText((entry as Record<string, unknown>).message) ?? "spotify_delivery_error"));
    }
    const message = normalizedText(body.message ?? body.error ?? null);
    return message ? [message] : ["Spotify delivery failed."];
  }

  private toError(code: string, message: string, metadata: Record<string, unknown>, retryable: boolean, releaseId: string, executionId: string): ConnectorError {
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

  private failedResult(job: DSPDeliveryJob, packageModel: DSPDeliveryPackage, errors: readonly string[], code: string, metadata: Record<string, unknown>): DSPDeliveryResult {
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
