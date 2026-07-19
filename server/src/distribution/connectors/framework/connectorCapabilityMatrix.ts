import { OFFICIAL_DSP_CONNECTORS } from "../officialDspConnectors";
import type { DSPCapabilities, DSPConnectorCapabilityMatrix } from "./connectorFrameworkTypes";

const SHARED_CAPABILITIES: Omit<DSPCapabilities, "connectorId"> = Object.freeze({
  supportedAudioFormats: Object.freeze(["flac", "wav", "aiff", "mp3", "m4a"]),
  artworkRules: Object.freeze({
    maxSizeBytes: 10 * 1024 * 1024,
    minWidth: 1400,
    minHeight: 1400,
    squareRequired: true,
  }),
  metadataLimits: Object.freeze({
    maxTitleLength: 256,
    maxContributorCount: 100,
    maxTerritories: 250,
  }),
  genreMappings: Object.freeze({
    pop: "Pop",
    hiphop: "Hip-Hop",
    rap: "Hip-Hop",
    rnb: "R&B",
    electronic: "Electronic",
    dance: "Dance",
    rock: "Rock",
    jazz: "Jazz",
    classical: "Classical",
    soundtrack: "Soundtrack",
  }),
  languageMappings: Object.freeze({
    en: "English",
    hindi: "Hindi",
    hi: "Hindi",
    es: "Spanish",
    pt: "Portuguese",
    fr: "French",
  }),
  parentalAdvisoryRules: Object.freeze(["clean", "explicit", "none"]),
  territorySupport: Object.freeze(["WORLD", "GLOBAL"]),
  deliveryProtocol: "DDEX/ERN",
  identifierRequirements: Object.freeze(["UPC", "ISRC"]),
  lyricsSupport: true,
  canvasSupport: false,
  dolbySupport: false,
  spatialAudioSupport: false,
  videoSupport: false,
  metadata: Object.freeze({}),
});

export const SPOTIFY_CONNECTOR_CAPABILITIES: DSPCapabilities = Object.freeze({
  connectorId: "Spotify",
  ...SHARED_CAPABILITIES,
  canvasSupport: true,
  metadata: Object.freeze({
    ingestion: "configurable",
    partnerStatus: "architecture-shell",
    scopes: Object.freeze(["catalog", "metadata", "delivery", "status", "health", "reporting"]),
    endpoints: Object.freeze({
      oauthAuthorize: null,
      oauthToken: null,
      ingestion: null,
      webhook: null,
    }),
  }),
});

export function createConnectorCapabilityMatrix(): DSPConnectorCapabilityMatrix {
  const matrix: Record<string, DSPCapabilities> = {};
  for (const connectorId of OFFICIAL_DSP_CONNECTORS) {
    matrix[connectorId] = Object.freeze({
      ...SHARED_CAPABILITIES,
      connectorId,
      metadata: Object.freeze({
        partnerStatus: connectorId === "Spotify" ? "architecture-shell" : "supported",
        connectorId,
        contentIdSupport: connectorId === "YouTubeMusic",
        cmsSupport: connectorId === "YouTubeMusic",
      }),
      canvasSupport: connectorId === "Spotify",
      videoSupport: connectorId === "TikTok" || connectorId === "Meta" || connectorId === "YouTubeMusic",
      dolbySupport: connectorId === "AppleMusic" || connectorId === "AmazonMusic" || connectorId === "Tidal",
      spatialAudioSupport: connectorId === "AppleMusic" || connectorId === "AmazonMusic" || connectorId === "Tidal",
    });
  }
  matrix.Spotify = SPOTIFY_CONNECTOR_CAPABILITIES;
  return Object.freeze(matrix);
}
