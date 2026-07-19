import { createHash } from "node:crypto";
import type {
  DdexContributor,
  DdexDeal,
  DdexErnMessage,
  DdexExportOptions,
  DdexIdentifier,
  DdexMeadMessage,
  DdexMeadUpdate,
  DdexMessageType,
  DdexMessageHeader,
  DdexParty,
  DdexResource,
  DdexRelease,
  DdexRinMessage,
  DdexSchemaVersion,
  DdexSoundRecording,
  DdexTechnicalDetails,
  DdexText,
  DdexVideo,
  DdexImage,
} from "./types";
import type { DdexSourceRelease, DdexSourceTrack, DdexSourceContributor } from "./types";

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stableText(value: unknown): string | null {
  return isNonEmptyText(value) ? value.trim() : null;
}

function asArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

function hashId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function normalizeSchemaVersion(value: DdexSchemaVersion | undefined): DdexSchemaVersion {
  return value ?? "4.3";
}

function extractMetadataRecord(source: Record<string, unknown> | Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(source ?? {}) });
}

function getMetadataString(record: Readonly<Record<string, unknown>>, key: string): string | null {
  return stableText(record[key]);
}

function getMetadataBoolean(record: Readonly<Record<string, unknown>>, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : value == null ? null : Boolean(value);
}

function getMetadataNumber(record: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTerritories(values: readonly string[] | null | undefined): readonly string[] {
  const territories = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim().toUpperCase();
    if (normalized) territories.add(normalized);
  }
  if (territories.size === 0) territories.add("WORLD");
  return Object.freeze([...territories]);
}

function mapContributor(contributor: DdexSourceContributor, index: number): DdexContributor {
  return Object.freeze({
    contributorId: hashId("party", `${contributor.name}:${contributor.roles.join(",")}:${index}`),
    name: contributor.name,
    roles: Object.freeze([...contributor.roles]),
    splitPercentage: contributor.splitPercentage,
    ipi: contributor.ipi,
    isPrimary: contributor.isPrimary,
    featured: contributor.roles.some((role) => ["featured_artist", "performer", "remixer"].includes(role)),
    publisher: contributor.roles.includes("publisher") ? contributor.name : null,
    metadata: extractMetadataRecord(contributor.metadata),
  });
}

function mapParty(contributor: DdexContributor): DdexParty {
  return Object.freeze({
    partyId: contributor.contributorId,
    name: contributor.name,
    roles: contributor.roles,
    isPrimary: contributor.isPrimary,
    metadata: contributor.metadata,
  });
}

function mapTechnicalDetails(source: DdexSourceRelease | DdexSourceTrack, metadata: Readonly<Record<string, unknown>>, previewAvailable: boolean): DdexTechnicalDetails {
  return Object.freeze({
    multiDisc: Boolean((source as DdexSourceRelease).multiDisc ?? getMetadataBoolean(metadata, "multiDisc") ?? false),
    versionedRelease: isNonEmptyText((source as DdexSourceRelease).versionTitle ?? null) || isNonEmptyText((source as DdexSourceTrack).version ?? null),
    bundle: Boolean(getMetadataBoolean(metadata, "bundle") ?? false),
    previewAvailable,
    explicit: Boolean((source as DdexSourceRelease).explicit ?? (source as DdexSourceTrack).explicit ?? false),
    parentalAdvisory: stableText(getMetadataString(metadata, "parentalAdvisory") ?? getMetadataString(metadata, "advisory")),
    format: stableText(getMetadataString(metadata, "format") ?? getMetadataString(metadata, "releaseType")),
    metadata,
  });
}

function mapSoundRecording(release: DdexSourceRelease, track: DdexSourceTrack, index: number): DdexSoundRecording {
  const trackMetadata = extractMetadataRecord(track.metadata);
  const releaseMetadata = extractMetadataRecord(release.metadata);
  const combinedMetadata = Object.freeze({ ...releaseMetadata, ...trackMetadata });
  const contributors = mapTrackContributors(release, track);
  const previewUrl = stableText(getMetadataString(combinedMetadata, "previewUrl") ?? getMetadataString(combinedMetadata, "sampleUrl"));
  const audioUrl = stableText(track.audio?.url ?? getMetadataString(combinedMetadata, "audioUrl"));
  const isrc = stableText(track.identifiers?.find((identifier) => identifier.type === "isrc")?.value ?? getMetadataString(combinedMetadata, "isrc")) ?? `ISRC-${hashId("track", `${release.id}:${track.id}:${index}`)}`;

  return Object.freeze({
    resourceId: hashId("sr", `${release.id}:${track.id}:${index}`),
    resourceType: "SoundRecording",
    title: track.title,
    language: track.language?.code ?? release.language?.code ?? getMetadataString(combinedMetadata, "language"),
    genre: track.genre.primary ?? release.genre.primary ?? getMetadataString(combinedMetadata, "genre"),
    subGenre: track.genre.subgenre ?? release.genre.subgenre ?? getMetadataString(combinedMetadata, "subGenre"),
    contributors,
    technicalDetails: mapTechnicalDetails(track, combinedMetadata, Boolean(previewUrl)),
    identifiers: Object.freeze([
      Object.freeze({ type: "isrc", value: isrc, scope: "track", issuer: null }),
      ...(stableText(track.audio?.checksum) ? [Object.freeze({ type: "checksum", value: track.audio?.checksum ?? "", scope: "resource", issuer: null })] : []),
    ]),
    territories: normalizeTerritories(track.territories.map((territory) => territory.code)),
    metadata: combinedMetadata,
    isrc,
    sequenceNumber: track.trackNumber,
    discNumber: track.discNumber,
    releaseDate: release.releaseDate?.value ?? null,
    originalReleaseDate: release.originalReleaseDate?.value ?? null,
    copyright: release.rights?.copyrightNotice ?? getMetadataString(combinedMetadata, "copyright") ?? null,
    pLine: track.pLine ?? release.rights?.pLine ?? getMetadataString(combinedMetadata, "pLine") ?? null,
    cLine: track.cLine ?? release.rights?.cLine ?? getMetadataString(combinedMetadata, "cLine") ?? null,
    primaryArtist: track.primaryArtist ?? release.primaryArtist ?? null,
    featuredArtists: Object.freeze([...track.featuredArtists]),
    audioUrl,
    previewUrl,
    durationSeconds: track.audio?.durationSeconds ?? getMetadataNumber(combinedMetadata, "durationSeconds"),
    explicit: Boolean(track.explicit ?? release.explicit),
    lyrics: track.lyrics ?? getMetadataString(combinedMetadata, "lyrics"),
  });
}

function mapImageResource(release: DdexSourceRelease): DdexImage | null {
  const artwork = release.artwork;
  if (!artwork?.url) return null;
  return Object.freeze({
    resourceId: hashId("img", `${release.id}:${artwork.url}`),
    resourceType: "Image",
    title: artwork.title ?? release.title,
    language: release.language?.code ?? null,
    genre: release.genre.primary,
    subGenre: release.genre.subgenre,
    contributors: Object.freeze([]),
    technicalDetails: Object.freeze({
      multiDisc: false,
      versionedRelease: false,
      bundle: false,
      previewAvailable: false,
      explicit: false,
      parentalAdvisory: null,
      format: "image",
      metadata: extractMetadataRecord(artwork.metadata),
    }),
    identifiers: Object.freeze([
      Object.freeze({ type: "checksum", value: artwork.checksum ?? hashId("checksum", artwork.url), scope: "resource", issuer: null }),
    ]),
    territories: normalizeTerritories(release.territories.map((territory) => territory.code)),
    metadata: extractMetadataRecord(artwork.metadata),
    uri: artwork.url,
    width: artwork.width,
    height: artwork.height,
    checksum: artwork.checksum,
    altText: artwork.altText,
  });
}

function mapTextResource(release: DdexSourceRelease, track: DdexSourceTrack): DdexText | null {
  if (!track.lyrics) return null;
  return Object.freeze({
    resourceId: hashId("txt", `${release.id}:${track.id}:lyrics`),
    resourceType: "Text",
    title: `${track.title} Lyrics`,
    language: track.language?.code ?? release.language?.code ?? null,
    genre: track.genre.primary ?? release.genre.primary,
    subGenre: track.genre.subgenre ?? release.genre.subgenre,
    contributors: Object.freeze([]),
    technicalDetails: Object.freeze({
      multiDisc: false,
      versionedRelease: false,
      bundle: false,
      previewAvailable: false,
      explicit: Boolean(track.explicit),
      parentalAdvisory: null,
      format: "text",
      metadata: Object.freeze({}),
    }),
    identifiers: Object.freeze([
      Object.freeze({ type: "internal", value: `${release.id}:${track.id}:lyrics`, scope: "resource", issuer: null }),
    ]),
    territories: normalizeTerritories(track.territories.map((territory) => territory.code)),
    metadata: Object.freeze({}),
    uri: null,
    text: track.lyrics,
    checksum: null,
  });
}

function mapVideoResource(release: DdexSourceRelease): DdexVideo | null {
  const releaseMetadata = extractMetadataRecord(release.metadata);
  const videoUrl = getMetadataString(releaseMetadata, "videoUrl");
  if (!videoUrl) return null;
  return Object.freeze({
    resourceId: hashId("vid", `${release.id}:${videoUrl}`),
    resourceType: "Video",
    title: `${release.title} Video`,
    language: release.language?.code ?? null,
    genre: release.genre.primary,
    subGenre: release.genre.subgenre,
    contributors: Object.freeze([]),
    technicalDetails: Object.freeze({
      multiDisc: false,
      versionedRelease: false,
      bundle: false,
      previewAvailable: false,
      explicit: Boolean(release.explicit),
      parentalAdvisory: null,
      format: "video",
      metadata: Object.freeze({}),
    }),
    identifiers: Object.freeze([
      Object.freeze({ type: "internal", value: `${release.id}:video`, scope: "resource", issuer: null }),
    ]),
    territories: normalizeTerritories(release.territories.map((territory) => territory.code)),
    metadata: Object.freeze({}),
    uri: videoUrl,
    width: getMetadataNumber(releaseMetadata, "videoWidth"),
    height: getMetadataNumber(releaseMetadata, "videoHeight"),
    checksum: getMetadataString(releaseMetadata, "videoChecksum"),
    durationSeconds: getMetadataNumber(releaseMetadata, "videoDurationSeconds"),
  });
}

function mapTrackContributors(release: DdexSourceRelease, track: DdexSourceTrack): DdexContributor[] {
  const contributors = new Map<string, DdexContributor>();
  const trackContributors = [...release.contributors, ...track.contributors];
  for (const [index, contributor] of trackContributors.entries()) {
    const mapped = mapContributor(contributor, index);
    const key = `${mapped.name}:${mapped.roles.join(",")}`;
    if (!contributors.has(key)) contributors.set(key, mapped);
  }
  return [...contributors.values()];
}

function mapReleaseContributors(release: DdexSourceRelease, tracks: readonly DdexSourceTrack[]): DdexContributor[] {
  const contributors = new Map<string, DdexContributor>();
  const sourceContributors = [...release.contributors, ...tracks.flatMap((track) => track.contributors)];
  for (const [index, contributor] of sourceContributors.entries()) {
    const mapped = mapContributor(contributor, index);
    const key = `${mapped.name}:${mapped.roles.join(",")}`;
    if (!contributors.has(key)) contributors.set(key, mapped);
  }
  return [...contributors.values()];
}

function mapPartyList(contributors: readonly DdexContributor[]): DdexParty[] {
  return contributors.map((contributor) => mapParty(contributor));
}

function mapDeal(release: DdexSourceRelease): DdexDeal {
  const releaseMetadata = extractMetadataRecord(release.metadata);
  const commercialModelType = stableText(getMetadataString(releaseMetadata, "commercialModelType") ?? getMetadataString(releaseMetadata, "pricingModel")) ?? (release.pricing?.amount != null ? "download" : "subscription");
  const territoryCodes = normalizeTerritories(release.territories.map((territory) => territory.code));
  const priceInformation = release.pricing
    ? release.pricing.territories.map((territory) =>
        Object.freeze({
          currencyCode: release.pricing?.currency ?? "USD",
          retailPrice: release.pricing?.amount == null ? "0.00" : release.pricing.amount.toFixed(2),
          territoryCode: territory.code,
          startDate: null,
          endDate: null,
        }),
      )
    : [
        Object.freeze({
          currencyCode: "USD",
          retailPrice: "0.00",
          territoryCode: "WORLD",
          startDate: null,
          endDate: null,
        }),
      ];

  return Object.freeze({
    dealId: hashId("deal", `${release.id}:${commercialModelType}:${territoryCodes.join(",")}`),
    commercialModelType,
    territoryCodes,
    rightsClaimPolicy: stableText(getMetadataString(releaseMetadata, "rightsClaimPolicy")) ?? (release.rights?.rightsOwned === false ? "review" : "claim"),
    priceInformation,
    startDate: release.releaseDate?.value ?? null,
    endDate: null,
    preorder: Boolean(getMetadataBoolean(releaseMetadata, "preorder") ?? false),
    instantGratification: Boolean(getMetadataBoolean(releaseMetadata, "instantGratification") ?? false),
    streamingPreview: Boolean(getMetadataBoolean(releaseMetadata, "streamingPreview") ?? false),
    dspSpecificRights: asArray(releaseMetadata.dspSpecificRights ?? releaseMetadata.dspRights ?? []),
  });
}

function mapRelease(release: DdexSourceRelease, resources: readonly DdexResource[], deals: readonly DdexDeal[]): DdexRelease {
  const releaseMetadata = extractMetadataRecord(release.metadata);
  const identifiers = [
    Object.freeze({ type: "upc", value: release.identifiers.find((identifier) => identifier.type === "upc")?.value ?? release.id, scope: "release", issuer: null }) as DdexIdentifier,
    ...release.identifiers.map((identifier) =>
      Object.freeze({
        type: identifier.type,
        value: identifier.value,
        scope: identifier.scope === "track" ? "track" : identifier.scope === "rights" ? "release" : "release",
        issuer: identifier.issuer,
      }),
    ),
  ];
  const resourceRefs = resources.map((resource) => resource.resourceId);
  const partyRefs = release.contributors.map((contributor) => hashId("party", `${contributor.name}:${contributor.roles.join(",")}`));
  const dealRefs = deals.map((deal) => deal.dealId);
  return Object.freeze({
    releaseId: release.id,
    title: release.title,
    versionTitle: release.versionTitle,
    primaryArtist: release.primaryArtist,
    featuredArtists: Object.freeze([...release.featuringArtists]),
    label: release.label,
    releaseDate: release.releaseDate?.value ?? null,
    originalReleaseDate: release.originalReleaseDate?.value ?? null,
    releaseType: release.releaseType,
    language: release.language?.code ?? null,
    genre: release.genre.primary,
    subGenre: release.genre.subgenre,
    parentalAdvisory: release.advisory,
    copyright: release.rights?.copyrightNotice ?? getMetadataString(releaseMetadata, "copyright") ?? null,
    pLine: release.rights?.pLine ?? null,
    cLine: release.rights?.cLine ?? null,
    identifiers: Object.freeze(identifiers),
    territories: normalizeTerritories(release.territories.map((territory) => territory.code)),
    technicalDetails: mapTechnicalDetails(
      release,
      releaseMetadata,
      resources.some((resource) => resource.resourceType === "SoundRecording" && Boolean(resource.previewUrl)),
    ),
    partyRefs: Object.freeze(partyRefs),
    resourceRefs: Object.freeze(resourceRefs),
    dealRefs: Object.freeze(dealRefs),
    preorder: Boolean(getMetadataBoolean(releaseMetadata, "preorder") ?? false),
    instantGratification: Boolean(getMetadataBoolean(releaseMetadata, "instantGratification") ?? false),
    streamingPreview: Boolean(getMetadataBoolean(releaseMetadata, "streamingPreview") ?? false),
    bundle: Boolean(getMetadataBoolean(releaseMetadata, "bundle") ?? false),
    multiDisc: release.multiDisc,
    versioned: Boolean(release.versionTitle),
    metadata: releaseMetadata,
  });
}

function createHeader(messageType: DdexMessageType, options: DdexExportOptions, schemaVersion: DdexSchemaVersion): DdexMessageHeader {
  const creationDateTime = options.creationDateTime ?? new Date().toISOString();
  return Object.freeze({
    messageId: options.messageId ?? hashId("msg", `${messageType}:${creationDateTime}`),
    messageType,
    sender: options.sender ?? "TrackSyra",
    recipient: options.recipient ?? "Spotify",
    creationDateTime,
    schemaVersion,
  });
}

export class DdexErnMapper {
  mapNewRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexErnMessage {
    return this.map(release, "NewReleaseMessage", options);
  }

  mapUpdateRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexErnMessage {
    return this.map(release, "UpdateMessage", options);
  }

  mapTakedownRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexErnMessage {
    return this.map(release, "TakedownMessage", options);
  }

  private map(release: DdexSourceRelease, messageType: DdexMessageType, options: DdexExportOptions): DdexErnMessage {
    const schemaVersion = normalizeSchemaVersion(undefined);
    const contributors = mapReleaseContributors(release, release.tracks);
    const partyList = Object.freeze({ parties: Object.freeze(mapPartyList(contributors)) });
    const resources = this.buildResourceList(release);
    const deals = Object.freeze({ deals: Object.freeze([mapDeal(release)]) });
    const releaseList = Object.freeze({ releases: Object.freeze([mapRelease(release, resources.resources, deals.deals)]) });
    const header = createHeader(messageType, options, schemaVersion);
    return Object.freeze({
      messageHeader: header,
      releaseList,
      resourceList: resources,
      partyList,
      dealList: deals,
      technicalDetails: Object.freeze(releaseList.releases.map((entry) => entry.technicalDetails)),
      metadata: Object.freeze({ ...(options.metadata ?? {}), messageType }),
    });
  }

  private buildResourceList(release: DdexSourceRelease): { resources: readonly DdexResource[] } {
    const resources: DdexResource[] = release.tracks.map((track, index) => mapSoundRecording(release, track, index));
    const image = mapImageResource(release);
    if (image) resources.push(image);
    const video = mapVideoResource(release);
    if (video) resources.push(video);
    for (const track of release.tracks) {
      const text = mapTextResource(release, track);
      if (text) resources.push(text);
    }
    return Object.freeze({ resources: Object.freeze(resources) });
  }
}

export class DdexMeadMapper {
  map(release: DdexSourceRelease, updates: DdexMeadUpdate, options: DdexExportOptions = {}): DdexMeadMessage {
    return Object.freeze({
      messageHeader: createHeader("UpdateMessage", options, normalizeSchemaVersion(undefined)),
      releaseId: release.id,
      updates: Object.freeze({
        ...updates,
        metadata: Object.freeze({ ...(updates.metadata ?? {}), messageType: "UpdateMessage" }),
      }),
      metadata: Object.freeze({ ...(options.metadata ?? {}), updateType: "MEAD" }),
    });
  }
}

export class DdexRinMapper {
  map(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexRinMessage {
    const sessionId = hashId("rin", `${release.id}:${release.title}`);
    const engineers = release.tracks.flatMap((track) =>
      track.contributors
        .filter((contributor) => contributor.roles.some((role) => ["producer", "engineer", "mix_engineer", "master_engineer"].includes(role)))
        .map((contributor) =>
          Object.freeze({
            name: contributor.name,
            role: contributor.roles.join(","),
            metadata: Object.freeze({ source: "track" }),
          }),
        ),
    );
    const musicians = release.tracks.flatMap((track) =>
      track.contributors
        .filter((contributor) => contributor.roles.some((role) => ["performer", "musician", "featured_artist"].includes(role)))
        .map((contributor) =>
          Object.freeze({
            name: contributor.name,
            role: contributor.roles.join(","),
            metadata: Object.freeze({ source: "track" }),
          }),
        ),
    );
    return Object.freeze({
      messageHeader: createHeader("RecordingInformationNotification", options, normalizeSchemaVersion(undefined)),
      sessionId,
      releaseId: release.id,
      recordingTitle: release.title,
      recordingDate: release.releaseDate?.value ?? null,
      recordingLocation: stableText(getMetadataString(extractMetadataRecord(release.metadata), "recordingLocation") ?? getMetadataString(extractMetadataRecord(release.metadata), "studioLocation")),
      studios: Object.freeze(asArray(extractMetadataRecord(release.metadata).studios ?? [])),
      engineers: Object.freeze(engineers),
      musicians: Object.freeze(musicians),
      featuredArtists: Object.freeze([...release.featuringArtists]),
      mixEngineer: stableText(getMetadataString(extractMetadataRecord(release.metadata), "mixEngineer")),
      masterEngineer: stableText(getMetadataString(extractMetadataRecord(release.metadata), "masterEngineer")),
      isrc: release.tracks[0]?.identifiers.find((identifier) => identifier.type === "isrc")?.value ?? null,
      identifiers: Object.freeze(
        release.identifiers.map((identifier) =>
          Object.freeze({
            type: identifier.type,
            value: identifier.value,
            scope: identifier.scope === "track" ? "track" : "release",
            issuer: identifier.issuer,
          }),
        ),
      ),
      metadata: Object.freeze({ ...(options.metadata ?? {}), notificationType: "RIN" }),
    });
  }
}
