import { ConnectorContext } from "../context/connectorContext";
import type { ConnectorFactory } from "../contracts/connectorContracts";
import type { Logger } from "../../observability/contracts/observabilityContracts";
import type { Release } from "../../domain";
import type { DeliveryValidationReport } from "../../core/deliveryPackage";
import type { ReleaseDeliveryBuildOptions } from "../../core/releaseDeliveryEngine";
import type { DSPConnectorCapabilityMatrix, DSPConnectorCapabilityReport, DSPConnectorHealthReport, DSPDeliveryErrorReport, DSPDeliveryJob, DSPDeliveryPackage, DSPDeliveryReport, DSPDeliveryResult, DSPHealthSnapshot, DSPRetryDecision } from "./connectorFrameworkTypes";
import type { DSPStatusSnapshot } from "./connectorFrameworkTypes";
import { DSPConnectorShell, SpotifyConnector, type DSPConnectorDependencies } from "./spotifyConnector";
import { AppleMusicConnector } from "./appleMusicConnector";
import { AnghamiConnector } from "./anghamiConnector";
import { AmazonMusicConnector } from "./amazonMusicConnector";
import { DeezerConnector } from "./deezerConnector";
import { JioSaavnConnector } from "./jioSaavnConnector";
import { BoomplayConnector } from "./boomplayConnector";
import { TikTokConnector } from "./tiktokConnector";
import { MetaRightsManagerConnector } from "./metaRightsManagerConnector";
import { TidalConnector } from "./tidalConnector";
import { YouTubeMusicConnector } from "./youtubeMusicConnector";
import { createConnectorCapabilityMatrix, SPOTIFY_CONNECTOR_CAPABILITIES } from "./connectorCapabilityMatrix";

export type DSPConnectorFrameworkDependencies = Readonly<{
  connectorFactory: ConnectorFactory;
  releaseDeliveryEngine: {
    validateRelease(release: Release): DeliveryValidationReport;
    buildDeliveryPackage(release: Release, options?: ReleaseDeliveryBuildOptions): Promise<DSPDeliveryPackage> | DSPDeliveryPackage;
  };
  logger: Logger | null;
  retryPolicy: {
    shouldRetry(error: unknown, attempt: number, job: DSPDeliveryJob): boolean;
    nextRetryAt(error: unknown, attempt: number, job: DSPDeliveryJob): string | null;
  };
  capabilityMatrix?: DSPConnectorCapabilityMatrix;
  defaultConnectorVersion?: string;
  fetchImpl?: typeof fetch;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freeze<T extends Record<string, unknown>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export class DSPConnectorFramework {
  private readonly capabilityMatrix: DSPConnectorCapabilityMatrix;
  private readonly connectors = new Map<string, DSPConnectorShell>();
  private readonly defaultConnectorVersion: string;

  constructor(private readonly dependencies: DSPConnectorFrameworkDependencies) {
    this.capabilityMatrix = dependencies.capabilityMatrix ?? createConnectorCapabilityMatrix();
    this.defaultConnectorVersion = dependencies.defaultConnectorVersion ?? "1.0.0";
  }

  validateRelease(job: DSPDeliveryJob): DeliveryValidationReport {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.validateRelease(release);
  }

  normalizeMetadata(job: DSPDeliveryJob) {
    return this.connectorFor(job).normalizeMetadata(job);
  }

  normalizeArtwork(job: DSPDeliveryJob) {
    return this.connectorFor(job).normalizeArtwork(job);
  }

  normalizeAudio(job: DSPDeliveryJob) {
    return this.connectorFor(job).normalizeAudio(job);
  }

  async buildPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> {
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

  async deliver(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    return this.connectorFor(job).deliver(job);
  }

  async pollStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.connectorFor(job).pollStatus(job);
  }

  async fetchErrors(job: DSPDeliveryJob): Promise<readonly string[]> {
    return this.connectorFor(job).fetchErrors(job);
  }

  async retry(job: DSPDeliveryJob, attempt = 0, error: unknown = null): Promise<DSPRetryDecision> {
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

  async withdraw(job: DSPDeliveryJob) {
    return this.connectorFor(job).withdraw(job);
  }

  async restore(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    return this.connectorFor(job).restore(job);
  }

  async healthCheck(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    return this.connectorFor(job).healthCheck(job);
  }

  getCapabilities(connectorId: string) {
    return this.capabilityMatrix[connectorId] ?? SPOTIFY_CONNECTOR_CAPABILITIES;
  }

  generateSpotifyDeliveryReport(job: DSPDeliveryJob, result: DSPDeliveryResult): DSPDeliveryReport {
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

  generateConnectorHealthReport(connectorId: string, health: DSPHealthSnapshot): DSPConnectorHealthReport {
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

  generateConnectorCapabilityReport(connectorId: string): DSPConnectorCapabilityReport {
    return Object.freeze({
      connectorId,
      generatedAt: nowIso(),
      capabilities: this.getCapabilities(connectorId),
    });
  }

  generateDeliveryErrorReport(job: DSPDeliveryJob, errors: readonly string[]): DSPDeliveryErrorReport {
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

  register(job: DSPDeliveryJob): DSPConnectorShell {
    const shell = this.connectorFor(job);
    this.connectors.set(job.target.connectorId, shell);
    return shell;
  }

  createSpotifyConnector(dependencies: Partial<DSPConnectorDependencies> = {}): SpotifyConnector {
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

  createAppleMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): AppleMusicConnector {
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

  createAnghamiConnector(dependencies: Partial<DSPConnectorDependencies> = {}): AnghamiConnector {
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

  createAnghamiMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): AnghamiConnector {
    return this.createAnghamiConnector(dependencies);
  }

  createBoomplayConnector(dependencies: Partial<DSPConnectorDependencies> = {}): BoomplayConnector {
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

  createBoomplayMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): BoomplayConnector {
    return this.createBoomplayConnector(dependencies);
  }

  createTikTokConnector(dependencies: Partial<DSPConnectorDependencies> = {}): TikTokConnector {
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

  createTikTokMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): TikTokConnector {
    return this.createTikTokConnector(dependencies);
  }

  createMetaRightsManagerConnector(dependencies: Partial<DSPConnectorDependencies> = {}): MetaRightsManagerConnector {
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

  createMetaRightsManagerMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): MetaRightsManagerConnector {
    return this.createMetaRightsManagerConnector(dependencies);
  }

  createAmazonMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): AmazonMusicConnector {
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

  createDeezerConnector(dependencies: Partial<DSPConnectorDependencies> = {}): DeezerConnector {
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

  createDeezerMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): DeezerConnector {
    return this.createDeezerConnector(dependencies);
  }

  createJioSaavnConnector(dependencies: Partial<DSPConnectorDependencies> = {}): JioSaavnConnector {
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

  createJioSaavnMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): JioSaavnConnector {
    return this.createJioSaavnConnector(dependencies);
  }

  createTidalConnector(dependencies: Partial<DSPConnectorDependencies> = {}): TidalConnector {
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

  createTidalMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): TidalConnector {
    return this.createTidalConnector(dependencies);
  }

  createYouTubeMusicConnector(dependencies: Partial<DSPConnectorDependencies> = {}): YouTubeMusicConnector {
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

  createConnector(job: DSPDeliveryJob): DSPConnectorShell {
    return this.connectorFor(job);
  }

  private connectorFor(job: DSPDeliveryJob): DSPConnectorShell {
    const key = job.target.connectorId;
    const existing = this.connectors.get(key);
    if (existing) return existing;
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

  private requireRelease(job: DSPDeliveryJob): Release {
    if (!job.release) {
      throw new Error(`Release is required for connector ${job.target.connectorId}`);
    }
    return job.release;
  }
}
