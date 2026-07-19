import type { UniversalRelease, UniversalTrack, UniversalContributor } from "../metadata";

export type DdexSchemaVersion = "4.0" | "4.1" | "4.2" | "4.3";

export type DdexMessageType = "NewReleaseMessage" | "UpdateMessage" | "TakedownMessage" | "RecordingInformationNotification";

export type DdexTerritoryCode = string;

export type DdexCommercialModelType =
  | "subscription"
  | "ad_supported"
  | "download"
  | "preorder"
  | "instant_gratification"
  | "streaming_preview"
  | "bundle"
  | string;

export type DdexRightsClaimPolicy = "claim" | "block" | "monetize" | "allow" | "review" | string;

export type DdexResourceKind = "SoundRecording" | "Image" | "Video" | "Text";

export type DdexIdentifierScope = "release" | "track" | "contributor" | "resource" | "session";

export type DdexIdentifier = Readonly<{
  type: string;
  value: string;
  scope: DdexIdentifierScope;
  issuer: string | null;
}>;

export type DdexPriceInformation = Readonly<{
  currencyCode: string;
  retailPrice: string;
  territoryCode: DdexTerritoryCode;
  startDate: string | null;
  endDate: string | null;
}>;

export type DdexDeal = Readonly<{
  dealId: string;
  commercialModelType: DdexCommercialModelType;
  territoryCodes: readonly DdexTerritoryCode[];
  rightsClaimPolicy: DdexRightsClaimPolicy;
  priceInformation: readonly DdexPriceInformation[];
  startDate: string | null;
  endDate: string | null;
  preorder: boolean;
  instantGratification: boolean;
  streamingPreview: boolean;
  dspSpecificRights: readonly string[];
}>;

export type DdexDealList = Readonly<{ deals: readonly DdexDeal[] }>;

export type DdexTechnicalDetails = Readonly<{
  multiDisc: boolean;
  versionedRelease: boolean;
  bundle: boolean;
  previewAvailable: boolean;
  explicit: boolean;
  parentalAdvisory: string | null;
  format: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexContributor = Readonly<{
  contributorId: string;
  name: string;
  roles: readonly string[];
  splitPercentage: number | null;
  ipi: string | null;
  isPrimary: boolean;
  featured: boolean;
  publisher: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexParty = Readonly<{
  partyId: string;
  name: string;
  roles: readonly string[];
  isPrimary: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexPartyList = Readonly<{ parties: readonly DdexParty[] }>;

export type DdexResourceBase = Readonly<{
  resourceId: string;
  resourceType: DdexResourceKind;
  title: string;
  language: string | null;
  genre: string | null;
  subGenre: string | null;
  contributors: readonly DdexContributor[];
  technicalDetails: DdexTechnicalDetails;
  identifiers: readonly DdexIdentifier[];
  territories: readonly DdexTerritoryCode[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexSoundRecording = DdexResourceBase &
  Readonly<{
    resourceType: "SoundRecording";
    isrc: string;
    sequenceNumber: number;
    discNumber: number;
    releaseDate: string | null;
    originalReleaseDate: string | null;
    copyright: string | null;
    pLine: string | null;
    cLine: string | null;
    primaryArtist: string | null;
    featuredArtists: readonly string[];
    audioUrl: string | null;
    previewUrl: string | null;
    durationSeconds: number | null;
    explicit: boolean;
    lyrics: string | null;
  }>;

export type DdexImage = DdexResourceBase &
  Readonly<{
    resourceType: "Image";
    uri: string;
    width: number | null;
    height: number | null;
    checksum: string | null;
    altText: string | null;
  }>;

export type DdexVideo = DdexResourceBase &
  Readonly<{
    resourceType: "Video";
    uri: string;
    width: number | null;
    height: number | null;
    checksum: string | null;
    durationSeconds: number | null;
  }>;

export type DdexText = DdexResourceBase &
  Readonly<{
    resourceType: "Text";
    uri: string | null;
    text: string;
    checksum: string | null;
  }>;

export type DdexResource = DdexSoundRecording | DdexImage | DdexVideo | DdexText;

export type DdexResourceList = Readonly<{ resources: readonly DdexResource[] }>;

export type DdexRelease = Readonly<{
  releaseId: string;
  title: string;
  versionTitle: string | null;
  primaryArtist: string | null;
  featuredArtists: readonly string[];
  label: string | null;
  releaseDate: string | null;
  originalReleaseDate: string | null;
  releaseType: string | null;
  language: string | null;
  genre: string | null;
  subGenre: string | null;
  parentalAdvisory: string | null;
  copyright: string | null;
  pLine: string | null;
  cLine: string | null;
  identifiers: readonly DdexIdentifier[];
  territories: readonly DdexTerritoryCode[];
  technicalDetails: DdexTechnicalDetails;
  partyRefs: readonly string[];
  resourceRefs: readonly string[];
  dealRefs: readonly string[];
  preorder: boolean;
  instantGratification: boolean;
  streamingPreview: boolean;
  bundle: boolean;
  multiDisc: boolean;
  versioned: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexReleaseList = Readonly<{ releases: readonly DdexRelease[] }>;

export type DdexMessageHeader = Readonly<{
  messageId: string;
  messageType: DdexMessageType;
  sender: string;
  recipient: string;
  creationDateTime: string;
  schemaVersion: DdexSchemaVersion;
}>;

export type DdexErnMessage = Readonly<{
  messageHeader: DdexMessageHeader;
  releaseList: DdexReleaseList;
  resourceList: DdexResourceList;
  partyList: DdexPartyList;
  dealList: DdexDealList;
  technicalDetails: readonly DdexTechnicalDetails[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexMeadUpdate = Readonly<{
  releaseId: string;
  title?: string | null;
  artwork?: Readonly<{
    uri?: string | null;
    checksum?: string | null;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
  }>;
  resources?: readonly Partial<DdexResource>[];
  rights?: Readonly<{
    copyright?: string | null;
    pLine?: string | null;
    cLine?: string | null;
    territories?: readonly DdexTerritoryCode[];
    rightsClaimPolicy?: DdexRightsClaimPolicy;
  }>;
  territories?: readonly DdexTerritoryCode[];
  relationships?: readonly Readonly<{
    relationType: string;
    sourceId: string;
    targetId: string;
    metadata?: Readonly<Record<string, unknown>>;
  }>[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DdexMeadMessage = Readonly<{
  messageHeader: DdexMessageHeader;
  releaseId: string;
  updates: DdexMeadUpdate;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexRinContributor = Readonly<{
  name: string;
  role: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexRinMessage = Readonly<{
  messageHeader: DdexMessageHeader;
  sessionId: string;
  releaseId: string;
  recordingTitle: string;
  recordingDate: string | null;
  recordingLocation: string | null;
  studios: readonly string[];
  engineers: readonly DdexRinContributor[];
  musicians: readonly DdexRinContributor[];
  featuredArtists: readonly string[];
  mixEngineer: string | null;
  masterEngineer: string | null;
  isrc: string | null;
  identifiers: readonly DdexIdentifier[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexExportFormat = "xml" | "xml+gzip";

export type DdexExportArtifact = Readonly<{
  messageType: DdexMessageType;
  schemaVersion: DdexSchemaVersion;
  xml: string;
  compressed: Uint8Array | null;
  checksum: string;
  format: DdexExportFormat;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DdexSignatureProvider = Readonly<{
  createSignatureXml(documentXml: string, metadata: Readonly<Record<string, unknown>>): string | null;
}>;

export type DdexExportOptions = Readonly<{
  messageId?: string;
  sender?: string;
  recipient?: string;
  creationDateTime?: string;
  compress?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
  signatureMetadata?: Readonly<Record<string, unknown>>;
}>;

export type DdexSourceRelease = UniversalRelease;
export type DdexSourceTrack = UniversalTrack;
export type DdexSourceContributor = UniversalContributor;
