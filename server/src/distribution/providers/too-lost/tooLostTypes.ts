import type { DistributionProvider, NormalizedDistributionError, Release, Track } from "../../models/distributionTypes";

export type TooLostConfig = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  webhooksEnabled: boolean;
  apiUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  accountProfileUrl: string | null;
  dspTargets: string[];
  sandboxMode: boolean;
  liveApproved: boolean;
};

export type TooLostOAuthToken = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  tokenType: "Bearer";
  scope?: string | null;
};

export type TooLostOAuthStateRecord = {
  state: string;
  codeVerifier: string;
  returnToPath: string | null;
  redirectUri: string | null;
  scopes: string[];
};

export type TooLostProviderHealth = {
  provider: "too_lost";
  mode: "sandbox" | "live";
  configured: boolean;
  oauthReady: boolean;
  webhookReady: boolean;
  liveApproved: boolean;
  status: "not_configured" | "sandbox_ready" | "credentials_pending" | "live_ready" | "blocked";
  checks: Array<{ name: string; ok: boolean; message: string }>;
};

export type TooLostConnectionStatus = {
  connected: boolean;
  connectionStatus: "connected" | "disconnected" | "expired" | "refresh_failed" | "needs_authorization" | "cached";
  accountStatus: string;
  distributionStatus: string;
  connectedAccount: {
    id: string | null;
    name: string | null;
    email: string | null;
  };
  lastSyncAt: string | null;
  lastRefreshAt: string | null;
  tokenExpiresAt: string | null;
  oauthStateExpiresAt: string | null;
  readyForLiveRequests: boolean;
  canRefresh: boolean;
  lastError: string | null;
  provider: "too_lost";
  cacheAgeMs?: number | null;
  cacheState?: "warming" | "fresh" | "stale" | "cached" | "degraded";
  cachedConnectionStatus?: "connected" | "disconnected" | "expired" | "refresh_failed" | "needs_authorization" | "cached" | null;
};

export type TooLostReleasePayload = {
  release: {
    type: string;
    title: string;
    version?: string | null;
    primaryArtist?: string | null;
    artistMode?: string | null;
    spotifyArtistId?: string | null;
    appleArtistId?: string | null;
    featuringArtists?: string[];
    variousArtists?: boolean;
    participants: Array<{
      name: string;
      role: string[];
    }>;
    label: string;
    primaryGenre: string | null;
    subGenre?: string | null;
    language: string | null;
    releaseDate: string | null;
    originalReleaseDate?: string | null;
    upc: string | null;
    copyrightOwner?: string | null;
    copyrightDeclared?: boolean;
    aiContentDeclared?: boolean;
    rightsOwned?: boolean;
    coverUrl: string | null;
    cYear: string;
    cLine: string;
    pYear: string;
    pLine: string;
    format?: string | null;
    producerCatalogueNumber?: string | null;
  };
  tracks: Array<{
    id: string;
    title: string;
    version?: string | null;
    language: string | null;
    isrc: string | null;
    generateIsrc?: boolean | null;
    artistMode?: string | null;
    spotifyArtistId?: string | null;
    appleArtistId?: string | null;
    artists: Array<{
      name: string;
      role: string[];
    }>;
    writers: Array<{
      name: string;
      role: string[];
    }>;
    contentType?: string | null;
    primaryTrackType?: string | null;
    secondaryTrackType?: string | null;
    instrumental?: boolean;
    remixer?: string | null;
    author?: string | null;
    composer?: string | null;
    arranger?: string | null;
    producer?: string | null;
    pLine?: string | null;
    pYear?: string | null;
    publisher?: string | null;
    primaryGenre?: string | null;
    subGenre?: string | null;
    secondaryGenre?: string | null;
    secondarySubGenre?: string | null;
    priceTier?: string | null;
    producerCatalogueNumber?: string | null;
    parentalAdvisory?: "none" | "explicit" | "clean" | null;
    previewStart?: number | null;
    trackTitleLanguage?: string | null;
    lyricsLanguage?: string | null;
    lyrics?: string | null;
    moreInfo?: string | null;
    audioFile: {
      url: string | null;
      filename: string | null;
      uploadContentType: string;
    };
    audioFormat?: string | null;
    explicit: boolean;
  }>;
};

export type TooLostUploadInput = {
  track: Track;
  release: Release;
};

export type TooLostAnalyticsSyncInput = {
  since?: string;
  platforms?: string[];
};

export type TooLostAnalyticsSyncResult = {
  provider: "too_lost";
  mode: "sandbox" | "live";
  syncedAt: string;
  platforms: string[];
  rawResponse: unknown;
};

export type TooLostError = NormalizedDistributionError & {
  provider: Extract<DistributionProvider, "too_lost">;
};
