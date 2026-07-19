import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  Package,
  ManifestChecksum,
  PackageFingerprint,
  PackageArtifact as DomainPackageArtifact,
  Release,
  Track,
  ReleaseVersion,
} from "../domain";
import type {
  DistributionRelease,
  DistributionTrack,
  DistributionParticipant,
} from "../models/distributionTypes";
import { PackageBuilder } from "../packaging/packageBuilder";
import { PackageConfiguration } from "../packaging/packageConfiguration";
import { PackageDirector } from "../packaging/packageDirector";
import { PackageIntegrity } from "../packaging/packageIntegrity";
import { PackageComparator } from "../packaging/packageComparator";
import { PackageAudit } from "../packaging/packageAudit";
import { PackageSerializer } from "../packaging/packageSerializer";
import { PackageManifest } from "../packaging/packageManifest";
import { PackageArtifactFactory } from "../packaging/packageArtifact";
import { PackageLayout } from "../packaging/packageLayout";
import { PackageVersionInfo, CURRENT_PACKAGE_VERSION } from "../packaging/packageVersion";
import type { PackageArtifact, PackageManifestDocument } from "../packaging/packageTypes";
import { PackageResult } from "../packaging/packageResult";
import type { PackageSigning } from "../packaging/packageSigning";
import { ChecksumGenerator } from "./checksumGenerator";
import { serializeCanonicalJSON } from "./canonicalSerializer";
import type { DeliveryAuditRecord, DeliveryCheckpoint, DeliveryCheckpointStage, DeliveryPackage, DeliveryPackageArtifact, DeliveryPackageSnapshot, DeliveryValidationIssue, DeliveryValidationReport } from "./deliveryPackage";
import { DeliveryPackage as DeliveryPackageModel } from "./deliveryPackage";
import { MetadataTransformer } from "../metadata/metadataTransformer";
import { MetadataValidator } from "../metadata/metadataValidator";
import type { UniversalRelease, UniversalTrack, UniversalContributor } from "../metadata/metadataTypes";
import type { DeliveryLogger } from "./distributionEngine";
import type { DdexExportArtifact, DdexExportOptions, DdexFoundationService } from "../ddex";
import type { DSPConnectorFramework, DSPConnectorCapabilityReport, DSPDeliveryErrorReport, DSPDeliveryJob, DSPDeliveryPackage, DSPDeliveryReport, DSPDeliveryResult, DSPHealthSnapshot, DSPRetryDecision, DSPStatusSnapshot } from "../connectors/framework";

export type ReleaseDeliveryEngineOptions = Readonly<{
  metadataTransformer: MetadataTransformer;
  metadataValidator: MetadataValidator;
  packageBuilder: PackageBuilder;
  packageDirector: PackageDirector;
  packageIntegrity: PackageIntegrity;
  packageComparator: PackageComparator;
  packageAudit: PackageAudit;
  checksumGenerator: ChecksumGenerator;
  packageLayout: PackageLayout;
  packageSerializer: PackageSerializer;
  packageVersion: PackageVersionInfo;
  packageSigning: PackageSigning | null;
  logger: DeliveryLogger;
  ddexFoundation?: DdexFoundationService | null;
  connectorFramework?: DSPConnectorFramework | null;
  workspaceRoot: string;
  outputRoot: string;
  cleanupTemporaryWorkspace: boolean;
  resumeInterrupted: boolean;
}>;

export type ReleaseDeliveryBuildOptions = Readonly<{
  requestedBy?: string | null;
  scheduledFor?: string | Date | null;
  batchId?: string | null;
  previousPackage?: DeliveryPackage | null;
  checkpointId?: string | null;
  resumeFromCheckpointId?: string | null;
  rollbackOfPackageId?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type ReleaseDeliveryRecovery = Readonly<{
  recovered: boolean;
  checkpoint: DeliveryCheckpoint | null;
  package: DeliveryPackage | null;
  reason: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ReleaseDeliveryBatchResult = Readonly<{
  packages: readonly DeliveryPackage[];
  errors: readonly string[];
}>;

type DeliveryVersionRecord = Readonly<{
  version: string;
  packageId: string;
  package: DeliveryPackage | null;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSchedule(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function isHttpUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function inferMimeType(pathOrUrl: string | null | undefined, fallback: string): string | null {
  if (!pathOrUrl) return null;
  const ext = extname(pathOrUrl).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".aiff" || ext === ".aif") return "audio/aiff";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return fallback;
}

function stableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeValue(value: unknown): string {
  return stableText(value) ?? "";
}

function toRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" ? (value as Readonly<Record<string, unknown>>) : {};
}

function buildSyntheticParticipants(values: readonly unknown[] | null | undefined): DistributionParticipant[] {
  const result: DistributionParticipant[] = [];
  for (const value of values ?? []) {
    if (!value || typeof value !== "object") continue;
    const participant = value as { name?: unknown; role?: unknown };
    const name = stableText(participant.name);
    if (!name) continue;
    const roles = Array.isArray(participant.role) ? participant.role.map((role) => safeValue(role)).filter(Boolean) : [safeValue(participant.role)].filter(Boolean);
    result.push({ name, role: roles.length ? roles : ["contributor"] });
  }
  return result;
}

function extractFeaturedArtists(track: Track): readonly string[] {
  const names = new Set<string>();
  for (const contributor of track.contributors) {
    if (contributor.isPrimary) continue;
    if (contributor.roles.some((role) => ["featured_artist", "remixer", "performer"].includes(role))) {
      names.add(contributor.name);
    }
  }
  return Object.freeze([...names]);
}

function extractWriterName(track: Track): string | null {
  const contributor = track.contributors.find((entry) => entry.roles.some((role) => ["composer", "writer", "lyricist"].includes(role)));
  return contributor?.name ?? null;
}

function extractPrimaryArtist(track: Track, release: Release): string {
  const contributor = track.contributors.find((entry) => entry.isPrimary) ?? release.contributors.find((entry) => entry.isPrimary);
  return contributor?.name ?? release.primaryArtist;
}

function extractCoverReference(release: Release): string | null {
  return stableText(release.metadata.coverArtUrl ?? release.metadata.artworkUrl ?? release.metadata.coverUrl ?? null);
}

function extractGenre(release: Release): string | null {
  return stableText(release.metadata.genre ?? release.metadata.primaryGenre ?? null);
}

function extractSubgenre(release: Release): string | null {
  return stableText(release.metadata.subgenre ?? release.metadata.secondaryGenre ?? null);
}

function extractLanguage(release: Release): string | null {
  return stableText(release.metadata.language ?? release.metadata.languageCode ?? null);
}

function extractReleaseType(release: Release): string | null {
  return stableText(release.metadata.releaseType ?? release.metadata.type ?? null);
}

function inferReleaseUserId(release: Release): string {
  return stableText(release.metadata.userId ?? release.metadata.artistId ?? release.metadata.ownerId ?? null) ?? release.primaryArtist;
}

function inferUpcValue(release: Release): string {
  const existing = stableText(release.upc);
  if (existing) return existing;
  const digits = createHash("sha256").update(`${release.id.value}:${release.title}:${release.primaryArtist}`).digest("hex").replace(/\D/g, "");
  const body = digits.padEnd(11, "0").slice(0, 11);
  return `${body}${computeUpcCheckDigit(body)}`;
}

function inferIsrcValue(release: Release, track: Track, index: number): string {
  const existing = stableText(track.isrc ?? null);
  if (existing) return existing;
  const year = String(new Date().getUTCFullYear()).slice(-2);
  const hash = createHash("sha256").update(`${release.id.value}:${track.id}:${track.title}:${index}`).digest("hex").replace(/\D/g, "").padEnd(5, "0").slice(0, 5);
  return `USTSA${year}${hash}`;
}

function computeUpcCheckDigit(body: string): string {
  const digits = body.replace(/\D/g, "").split("").map((entry) => Number(entry));
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = digits[index] ?? 0;
    sum += index % 2 === 0 ? digit * 3 : digit;
  }
  return String((10 - (sum % 10)) % 10);
}

function normalizeTerritoryValues(values: readonly string[] | null | undefined): readonly string[] {
  const entries = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim().toUpperCase();
    if (normalized) entries.add(normalized);
  }
  if (entries.size === 0) {
    entries.add("WORLD");
  }
  return Object.freeze([...entries]);
}

function buildUniversalRelease(release: Release): UniversalRelease {
  const tracks = release.tracks.map((track, index) => buildUniversalTrack(release, track, index));
  const releaseGenre = extractGenre(release);
  const releaseLanguage = extractLanguage(release);
  const releaseType = extractReleaseType(release);
  const coverArtUrl = extractCoverReference(release);

  return Object.freeze({
    version: "1.0",
    id: release.id.value,
    kind: inferReleaseKind(release, tracks.length),
    title: release.title,
    releaseType,
    versionTitle: release.version?.value ?? null,
    primaryArtist: release.primaryArtist,
    featuringArtists: Object.freeze(release.contributors.filter((contributor) => !contributor.isPrimary).map((contributor) => contributor.name)),
    variousArtists: release.contributors.length > 1 && release.contributors.some((contributor) => contributor.isPrimary),
    label: release.label,
    releaseDate: toUniversalDate(release.releaseDate, "release"),
    originalReleaseDate: toUniversalDate(release.originalReleaseDate, "original_release"),
    recordingYear: inferYear(release.releaseDate ?? release.originalReleaseDate ?? null),
    genre: Object.freeze({
      primary: releaseGenre,
      subgenre: extractSubgenre(release),
      secondary: stableText(release.metadata.secondaryGenre ?? null),
      secondarySubgenre: stableText(release.metadata.secondarySubgenre ?? null),
      metadata: Object.freeze({}),
    }),
    language: releaseLanguage ? Object.freeze({ code: releaseLanguage.toLowerCase(), name: stableText(release.metadata.languageName ?? null), metadata: Object.freeze({}) }) : null,
    advisory: release.metadata.explicit ?? release.metadata.advisory === "explicit" ? "explicit" : release.metadata.clean ? "clean" : "none",
    explicit: Boolean(release.metadata.explicit ?? false),
    clean: Boolean(release.metadata.clean ?? false),
    identifiers: buildIdentifiers(release, tracks),
    rights: buildRights(release),
    artwork: coverArtUrl
      ? Object.freeze({
          url: coverArtUrl,
          checksum: stableText(release.metadata.coverArtChecksum ?? release.metadata.artworkChecksum ?? null),
          mimeType: inferMimeType(coverArtUrl, "image/jpeg"),
          width: toNumber(release.metadata.coverArtWidth ?? release.metadata.artworkWidth),
          height: toNumber(release.metadata.coverArtHeight ?? release.metadata.artworkHeight),
          title: stableText(release.metadata.coverArtTitle ?? release.title),
          altText: stableText(release.metadata.coverArtAltText ?? release.title),
          metadata: Object.freeze({}),
        })
      : null,
    audio: null,
    publishing: buildPublishing(release),
    contributors: dedupeContributors([...release.contributors, ...release.tracks.flatMap((track) => track.contributors)]),
    territories: Object.freeze(normalizeTerritorySet(release.territories.values, release.tracks)),
    pricing: buildPricing(release),
    tracks,
    multiDisc: release.tracks.some((track) => track.discNumber > 1),
    podcast: Boolean(release.metadata.releaseKind === "podcast"),
    audiobook: Boolean(release.metadata.releaseKind === "audiobook"),
    compilation: Boolean(release.metadata.releaseKind === "compilation" || release.contributors.length > 1),
    instrumental: release.tracks.every((track) => !track.lyrics || !track.lyrics.trim()),
    metadata: Object.freeze({ ...toRecord(release.metadata) }),
  } as UniversalRelease);
}

function inferReleaseKind(release: Release, trackCount: number): UniversalRelease["kind"] {
  const explicitKind = stableText(release.metadata.releaseKind ?? null);
  if (explicitKind === "compilation" || explicitKind === "podcast" || explicitKind === "audiobook" || explicitKind === "instrumental" || explicitKind === "multi_disc") {
    return explicitKind;
  }
  if (trackCount > 1) return "album";
  return release.version ? "single" : "single";
}

function buildUniversalTrack(release: Release, track: Track, index: number): UniversalTrack {
  const primaryArtist = extractPrimaryArtist(track, release);
  const featuredArtists = extractFeaturedArtists(track);
  const releaseTerritories = normalizeTerritoryValues(release.territories.values);
  const trackTerritories = normalizeTerritoryValues(track.territories.values);
  const territories = Object.freeze([...new Set([...releaseTerritories, ...trackTerritories])].map((code) => Object.freeze({
    code,
    name: null,
    isrc: inferIsrcValue(release, track, index),
    upc: inferUpcValue(release),
    release: true,
    track: true,
    metadata: Object.freeze({}),
  })));
  const audioUrl = stableText(track.audioReference);
  const artworkUrl = stableText(track.artworkReference ?? extractCoverReference(release));

  return Object.freeze({
    id: track.id,
    title: track.title,
    version: track.version?.value ?? stableText(track.metadata.version ?? null),
    discNumber: track.discNumber,
    trackNumber: track.trackNumber,
    primaryArtist,
    featuredArtists,
    remixer: stableText(track.metadata.remixer ?? null),
    contributorNames: Object.freeze([...new Set([primaryArtist, ...featuredArtists, ...track.contributors.map((contributor) => contributor.name)])]),
    contributors: dedupeContributors(track.contributors),
    publishing: buildTrackPublishing(track),
    audio: audioUrl
      ? Object.freeze({
          url: audioUrl,
          checksum: stableText(track.audioChecksum),
          mimeType: inferMimeType(audioUrl, stableText(track.metadata.audioMimeType ?? null) ?? inferMimeType(audioUrl, "audio/wav") ?? "audio/wav"),
          format: stableText(track.metadata.audioFormat ?? null) ?? inferMimeType(audioUrl, "audio/wav"),
          durationSeconds: toNumber(track.metadata.durationSeconds ?? track.metadata.durationSec ?? null),
          sampleRateHz: toNumber(track.metadata.sampleRateHz ?? null),
          channels: toNumber(track.metadata.channels ?? null),
          bitrateKbps: toNumber(track.metadata.bitrateKbps ?? null),
          explicit: Boolean(track.explicit),
          metadata: Object.freeze({}),
        })
      : null,
    rights: buildTrackRights(release, track, territories),
    artwork: artworkUrl
      ? Object.freeze({
          url: artworkUrl,
          checksum: stableText(track.metadata.artworkChecksum ?? null),
          mimeType: inferMimeType(artworkUrl, "image/jpeg"),
          width: toNumber(track.metadata.artworkWidth ?? null),
          height: toNumber(track.metadata.artworkHeight ?? null),
          title: stableText(track.metadata.artworkTitle ?? track.title),
          altText: stableText(track.metadata.artworkAltText ?? track.title),
          metadata: Object.freeze({}),
        })
      : null,
    identifiers: Object.freeze([
      Object.freeze({ type: "internal", value: track.id, scope: "track", issuer: null, metadata: Object.freeze({}) }),
      Object.freeze({ type: "isrc", value: inferIsrcValue(release, track, index), scope: "track", issuer: "TrackSyra", metadata: Object.freeze({ generated: true }) }),
      Object.freeze({ type: "catalogue", value: stableText(track.metadata.producerCatalogueNumber ?? null) ?? release.id.value, scope: "track", issuer: "TrackSyra", metadata: Object.freeze({}) }),
    ]),
    territories,
    pricing: buildTrackPricing(track),
    language: buildLanguage(track.metadata.lyricsLanguage ?? track.metadata.trackTitleLanguage ?? release.metadata.language ?? null),
    genre: Object.freeze({
      primary: stableText(track.metadata.genre ?? release.metadata.genre ?? null),
      subgenre: stableText(track.metadata.subgenre ?? release.metadata.subgenre ?? null),
      secondary: stableText(track.metadata.secondaryGenre ?? null),
      secondarySubgenre: stableText(track.metadata.secondarySubgenre ?? null),
      metadata: Object.freeze({}),
    }),
    advisory: track.explicit ? "explicit" : "none",
    explicit: Boolean(track.explicit),
    clean: !track.explicit,
    pLine: stableText(track.metadata.pLine ?? null),
    cLine: stableText(track.metadata.cLine ?? release.metadata.cLine ?? null),
    lyrics: stableText(track.lyrics),
    recordingYear: inferYear(stableText(track.metadata.productionYear)),
    metadata: Object.freeze({
      ...toRecord(track.metadata),
      releaseId: release.id.value,
      releaseUpc: inferUpcValue(release),
      generatedIsrc: inferIsrcValue(release, track, index),
    }),
  } as UniversalTrack);
}

function buildIdentifiers(release: Release, tracks: readonly UniversalTrack[]): readonly unknown[] {
  const releaseUpc = inferUpcValue(release);
  const identifiers = [
    Object.freeze({ type: "internal", value: release.id.value, scope: "release", issuer: null, metadata: Object.freeze({}) }),
    Object.freeze({ type: "upc", value: releaseUpc, scope: "release", issuer: "TrackSyra", metadata: Object.freeze({ generated: !stableText(release.upc) }) }),
    ...tracks.flatMap((track) => track.identifiers.filter((identifier) => identifier.scope === "track")),
  ];
  return Object.freeze(identifiers);
}

function buildRights(release: Release): UniversalRelease["rights"] {
  const territories = Object.freeze(normalizeTerritorySet(release.territories.values, release.tracks));
  const rightsOwned = stableText(release.metadata.rightsOwned ?? null);
  const aiContentDeclared = stableText(release.metadata.aiContentDeclared ?? null);
  if (!release.label && !rightsOwned && !aiContentDeclared && territories.length === 0) {
    return null;
  }
  return Object.freeze({
    copyrightOwner: stableText(release.metadata.copyrightOwner ?? release.label ?? null),
    copyrightYear: inferYear(release.releaseDate ?? null),
    copyrightNotice: stableText(release.metadata.copyright ?? null),
    pLine: stableText(release.metadata.pLine ?? null),
    cLine: stableText(release.metadata.cLine ?? null),
    rightsOwned: typeof release.metadata.rightsOwned === "boolean" ? release.metadata.rightsOwned : null,
    aiContentDeclared: typeof release.metadata.aiContentDeclared === "boolean" ? release.metadata.aiContentDeclared : null,
    territories,
    metadata: Object.freeze({}),
  });
}

function buildTrackRights(release: Release, track: Track, territories: UniversalRelease["territories"]): UniversalRelease["rights"] {
  return Object.freeze({
    copyrightOwner: stableText(release.metadata.copyrightOwner ?? release.label ?? null),
    copyrightYear: inferYear(stableText(track.metadata.productionYear)),
    copyrightNotice: stableText(track.metadata.copyrightNotice ?? null),
    pLine: stableText(track.metadata.pLine ?? null),
    cLine: stableText(track.metadata.cLine ?? release.metadata.cLine ?? null),
    rightsOwned: typeof track.metadata.rightsOwned === "boolean" ? track.metadata.rightsOwned : typeof release.metadata.rightsOwned === "boolean" ? release.metadata.rightsOwned : null,
    aiContentDeclared: typeof release.metadata.aiContentDeclared === "boolean" ? release.metadata.aiContentDeclared : null,
    territories,
    metadata: Object.freeze({}),
  });
}

function buildPublishing(release: Release): UniversalRelease["publishing"] {
  const writers = release.contributors.filter((contributor) => contributor.roles.some((role) => ["writer", "composer", "lyricist"].includes(role)));
  return Object.freeze({
    publisher: stableText(release.metadata.publisher ?? release.label ?? null),
    writers: dedupeContributors(writers),
    splits: release.contributors.filter((contributor) => typeof contributor.splitPercentage === "number"),
    metadata: Object.freeze({}),
  });
}

function buildTrackPublishing(track: Track): UniversalRelease["publishing"] {
  const writers = track.contributors.filter((contributor) => contributor.roles.some((role) => ["writer", "composer", "lyricist"].includes(role)));
  return Object.freeze({
    publisher: stableText(track.metadata.publisher ?? null),
    writers: dedupeContributors(writers),
    splits: track.contributors.filter((contributor) => typeof contributor.splitPercentage === "number"),
    metadata: Object.freeze({}),
  });
}

function buildPricing(release: Release): UniversalRelease["pricing"] {
  const territories = normalizeTerritorySet(release.territories.values, release.tracks);
  return Object.freeze({
    currency: stableText(release.metadata.currency ?? null),
    amount: toNumber(release.metadata.price ?? null),
    tier: stableText(release.metadata.priceTier ?? null),
    territories,
    metadata: Object.freeze({}),
  });
}

function buildTrackPricing(track: Track): UniversalRelease["pricing"] {
  const territories = normalizeTerritorySet(track.territories.values, []);
  return Object.freeze({
    currency: stableText(track.metadata.currency ?? null),
    amount: toNumber(track.metadata.price ?? null),
    tier: stableText(track.metadata.priceTier ?? null),
    territories,
    metadata: Object.freeze({}),
  });
}

function buildLanguage(value: unknown): UniversalRelease["language"] {
  const code = stableText(value);
  if (!code) return null;
  return Object.freeze({ code: code.toLowerCase(), name: null, metadata: Object.freeze({}) });
}

function normalizeTerritorySet(values: readonly string[], tracks: readonly Track[]): UniversalRelease["territories"] {
  const combined = new Set<string>(values.map((entry) => entry.trim().toUpperCase()).filter(Boolean));
  for (const track of tracks) {
    for (const territory of track.territories.values) {
      combined.add(territory.trim().toUpperCase());
    }
  }
  if (combined.size === 0) combined.add("WORLD");
  return [...combined].map((code) => Object.freeze({
    code,
    name: null,
    isrc: null,
    upc: null,
    release: true,
    track: true,
    metadata: Object.freeze({}),
  }));
}

function dedupeContributors(contributors: readonly { name: string; roles: readonly string[]; splitPercentage?: number | null; ipi?: string | null; isPrimary?: boolean; metadata?: Readonly<Record<string, unknown>> }[]): readonly UniversalContributor[] {
  const seen = new Set<string>();
  const result: UniversalContributor[] = [];
  for (const contributor of contributors) {
    const name = contributor.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(Object.freeze({
      name,
      roles: Object.freeze([...new Set(contributor.roles.map((role) => role.trim()).filter(Boolean))]),
      splitPercentage: contributor.splitPercentage ?? null,
      ipi: contributor.ipi ?? null,
      isPrimary: contributor.isPrimary ?? false,
      metadata: Object.freeze({ ...(contributor.metadata ?? {}) }),
    }));
  }
  return Object.freeze(result);
}

function toUniversalDate(value: string | null, kind: "release" | "original_release") {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = normalized.slice(0, 10);
  return Object.freeze({
    kind,
    value: normalized,
    year: inferYear(normalized),
    month: normalized.length >= 7 ? Number(normalized.slice(5, 7)) || null : null,
    day: normalized.length >= 10 ? Number(normalized.slice(8, 10)) || null : null,
    isExact: /^\d{4}-\d{2}-\d{2}$/.test(parsed),
    metadata: Object.freeze({}),
  });
}

function inferYear(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapReleaseToDistributionRelease(release: Release, normalized: UniversalRelease): DistributionRelease {
  return {
    id: release.id.value,
    userId: inferReleaseUserId(release),
    artistId: inferReleaseUserId(release),
    title: release.title,
    status: release.state,
    artistMode: stableText(release.metadata.artistMode ?? null),
    spotifyArtistId: stableText(release.metadata.spotifyArtistId ?? null),
    appleArtistId: stableText(release.metadata.appleArtistId ?? null),
    providerStatus: stableText(release.metadata.providerStatus ?? null),
    distributionStatus: stableText(release.metadata.distributionStatus ?? null),
    providerReleaseId: stableText(release.metadata.providerReleaseId ?? null),
    providerUpdatedAt: stableText(release.metadata.providerUpdatedAt ?? null),
    providerReviewNotes: stableText(release.metadata.providerReviewNotes ?? null),
    providerWarningNotes: stableText(release.metadata.providerWarningNotes ?? null),
    providerValidationMessages: release.metadata.providerValidationMessages ?? null,
    providerDeliveryMessages: release.metadata.providerDeliveryMessages ?? null,
    version: release.version?.value ?? null,
    primaryArtist: release.primaryArtist,
    featuredArtists: [...normalized.featuringArtists],
    variousArtists: normalized.variousArtists,
    metadata: { ...toRecord(release.metadata) },
    releaseDate: release.releaseDate,
    originalReleaseDate: release.originalReleaseDate,
    genre: extractGenre(release),
    subgenre: extractSubgenre(release),
    language: extractLanguage(release),
    upc: inferUpcValue(release),
    copyrightOwner: stableText(release.metadata.copyrightOwner ?? release.label ?? null),
    copyright: stableText(release.metadata.copyright ?? null),
    copyrightDeclared: typeof release.metadata.copyrightDeclared === "boolean" ? release.metadata.copyrightDeclared : undefined,
    aiContentDeclared: typeof release.metadata.aiContentDeclared === "boolean" ? release.metadata.aiContentDeclared : undefined,
    rightsOwned: typeof release.metadata.rightsOwned === "boolean" ? release.metadata.rightsOwned : undefined,
    pLine: stableText(release.metadata.pLine ?? null),
    cLine: stableText(release.metadata.cLine ?? null),
    productionYear: inferYear(release.releaseDate ?? release.originalReleaseDate ?? null)?.toString() ?? null,
    producerCatalogueNumber: stableText(release.metadata.producerCatalogueNumber ?? null),
    coverArtUrl: extractCoverReference(release),
    type: stableText(release.metadata.releaseType ?? null) as DistributionRelease["type"] | undefined,
  };
}

function mapTrackToDistributionTrack(release: Release, track: Track, normalized: UniversalRelease, index: number): DistributionTrack {
  const userId = inferReleaseUserId(release);
  return {
    id: track.id,
    releaseId: release.id.value,
    userId,
    artistId: userId,
    status: release.state,
    artistMode: stableText(track.metadata.artistMode ?? release.metadata.artistMode ?? null),
    spotifyArtistId: stableText(track.metadata.spotifyArtistId ?? release.metadata.spotifyArtistId ?? null),
    appleArtistId: stableText(track.metadata.appleArtistId ?? release.metadata.appleArtistId ?? null),
    providerStatus: stableText(track.metadata.providerStatus ?? null),
    providerTrackId: stableText(track.metadata.providerTrackId ?? null),
    providerIsrc: inferIsrcValue(release, track, index),
    providerUpdatedAt: stableText(track.metadata.providerUpdatedAt ?? null),
    providerReviewNotes: stableText(track.metadata.providerReviewNotes ?? null),
    providerWarningNotes: stableText(track.metadata.providerWarningNotes ?? null),
    providerValidationMessages: track.metadata.providerValidationMessages ?? null,
    providerDeliveryMessages: track.metadata.providerDeliveryMessages ?? null,
    title: track.title,
    version: track.version?.value ?? null,
    primaryArtist: extractPrimaryArtist(track, release),
    featuredArtists: [...extractFeaturedArtists(track)],
    contentType: stableText(track.metadata.contentType ?? null),
    primaryTrackType: stableText(track.metadata.primaryTrackType ?? null),
    secondaryTrackType: stableText(track.metadata.secondaryTrackType ?? null),
    instrumental: Boolean(track.metadata.instrumental ?? false),
    remixer: stableText(track.metadata.remixer ?? null),
    author: stableText(track.metadata.author ?? null),
    composer: extractWriterName(track),
    arranger: stableText(track.metadata.arranger ?? null),
    producer: stableText(track.metadata.producer ?? null),
    pLine: stableText(track.metadata.pLine ?? null),
    productionYear: inferYear(stableText(track.metadata.productionYear))?.toString() ?? null,
    publisher: stableText(track.metadata.publisher ?? release.metadata.publisher ?? null),
    genre: stableText(track.metadata.genre ?? release.metadata.genre ?? null),
    subgenre: stableText(track.metadata.subgenre ?? release.metadata.subgenre ?? null),
    secondaryGenre: stableText(track.metadata.secondaryGenre ?? null),
    secondarySubgenre: stableText(track.metadata.secondarySubgenre ?? null),
    priceTier: stableText(track.metadata.priceTier ?? null),
    producerCatalogueNumber: stableText(track.metadata.producerCatalogueNumber ?? null),
    parentalAdvisory: track.explicit ? "explicit" : "none",
    previewStart: toNumber(track.metadata.previewStart ?? null),
    trackTitleLanguage: stableText(track.metadata.trackTitleLanguage ?? null),
    lyricsLanguage: stableText(track.metadata.lyricsLanguage ?? null),
    lyrics: track.lyrics,
    moreInfo: stableText(track.metadata.moreInfo ?? null),
    generateIsrc: !stableText(track.isrc ?? null),
    writers: buildSyntheticParticipants(track.metadata.writers as readonly unknown[] | undefined) || undefined,
    metadata: { ...toRecord(track.metadata) },
    audioUrl: stableText(track.audioReference),
    isrc: inferIsrcValue(release, track, index),
    explicit: Boolean(track.explicit),
    audioFormat: stableText(track.metadata.audioFormat ?? null),
    trackNumber: track.trackNumber,
    duration_sec: toNumber(track.metadata.durationSec ?? track.metadata.durationSeconds ?? null),
    file_size_bytes: toNumber(track.metadata.fileSizeBytes ?? null),
  } as DistributionTrack;
}

function buildAdditionalArtifacts(release: Release, normalized: UniversalRelease, packageLayout: PackageLayout): readonly PackageArtifact[] {
  const artifacts: PackageArtifact[] = [];
  const packageLayoutPaths = packageLayout.paths();

  artifacts.push(PackageArtifactFactory.text(join(packageLayoutPaths.metadata, "delivery", "release.json"), "metadata", `${serializeCanonicalJSON({
    releaseId: release.id.value,
    title: release.title,
    version: release.version?.value ?? null,
    normalizedKind: normalized.kind,
  })}\n`, "application/json"));

  for (const [index, track] of release.tracks.entries()) {
    const audioReference = stableText(track.audioReference);
    const artworkReference = stableText(track.artworkReference ?? extractCoverReference(release));
    const trackSummary = {
      trackId: track.id,
      title: track.title,
      audioReference,
      artworkReference,
      isrc: inferIsrcValue(release, track, index),
      hasLyrics: Boolean(track.lyrics?.trim()),
      territories: track.territories.values,
    };

    artifacts.push(PackageArtifactFactory.text(join(packageLayoutPaths.metadata, "delivery", "tracks", `${track.id}.json`), "metadata", `${serializeCanonicalJSON(trackSummary)}\n`, "application/json"));

    if (track.lyrics?.trim()) {
      artifacts.push(PackageArtifactFactory.text(join(packageLayoutPaths.lyrics, `${track.id}.txt`), "lyrics", `${track.lyrics.trim()}\n`, "text/plain"));
    }

    if (audioReference) {
      const kind = isHttpUrl(audioReference) ? "metadata" : "audio";
      artifacts.push(PackageArtifactFactory.text(join(packageLayoutPaths.audio, `${track.id}.json`), kind, `${serializeCanonicalJSON({ audioReference, inferredMimeType: inferMimeType(audioReference, "audio/wav") })}\n`, "application/json"));
    }
  }

  const coverReference = extractCoverReference(release);
  if (coverReference) {
    artifacts.push(PackageArtifactFactory.text(join(packageLayoutPaths.artwork, `${release.id.value}.json`), "artwork", `${serializeCanonicalJSON({
      releaseId: release.id.value,
      artworkReference: coverReference,
      inferredMimeType: inferMimeType(coverReference, "image/jpeg"),
    })}\n`, "application/json"));
  }

  return Object.freeze(artifacts);
}

export class ReleaseDeliveryEngine {
  private readonly metadataTransformer: MetadataTransformer;
  private readonly metadataValidator: MetadataValidator;
  private readonly packageBuilder: PackageBuilder;
  private readonly packageDirector: PackageDirector;
  private readonly packageIntegrity: PackageIntegrity;
  private readonly packageComparator: PackageComparator;
  private readonly packageAudit: PackageAudit;
  private readonly checksumGenerator: ChecksumGenerator;
  private readonly packageLayout: PackageLayout;
  private readonly packageSerializer: PackageSerializer;
  private readonly packageVersion: PackageVersionInfo;
  private readonly packageSigning: PackageSigning | null;
  private readonly logger: DeliveryLogger;
  private readonly ddexFoundation: DdexFoundationService | null;
  private readonly connectorFramework: DSPConnectorFramework | null;
  private readonly deliveryState = new Map<string, DeliveryVersionRecord>();
  private readonly checkpoints = new Map<string, DeliveryCheckpoint>();
  private readonly audits: DeliveryAuditRecord[] = [];
  private readonly snapshots = new Map<string, DeliveryPackageSnapshot>();

  constructor(options: ReleaseDeliveryEngineOptions) {
    this.metadataTransformer = options.metadataTransformer;
    this.metadataValidator = options.metadataValidator;
    this.packageBuilder = options.packageBuilder;
    this.packageDirector = options.packageDirector;
    this.packageIntegrity = options.packageIntegrity;
    this.packageComparator = options.packageComparator;
    this.packageAudit = options.packageAudit;
    this.checksumGenerator = options.checksumGenerator;
    this.packageLayout = options.packageLayout;
    this.packageSerializer = options.packageSerializer;
    this.packageVersion = options.packageVersion;
    this.packageSigning = options.packageSigning;
    this.logger = options.logger;
    this.ddexFoundation = options.ddexFoundation ?? null;
    this.connectorFramework = options.connectorFramework ?? null;
    this.workspaceRoot = options.workspaceRoot;
    this.outputRoot = options.outputRoot;
    this.cleanupTemporaryWorkspace = options.cleanupTemporaryWorkspace;
    this.resumeInterrupted = options.resumeInterrupted;
  }

  readonly workspaceRoot: string;
  readonly outputRoot: string;
  readonly cleanupTemporaryWorkspace: boolean;
  readonly resumeInterrupted: boolean;

  exportDdexArtifacts(release: Release, options: DdexExportOptions = {}): Readonly<{
    newRelease: DdexExportArtifact;
    update: DdexExportArtifact;
    takedown: DdexExportArtifact;
    mead: DdexExportArtifact;
    rin: DdexExportArtifact;
  }> | null {
    if (!this.ddexFoundation) return null;
    const normalized = buildUniversalRelease(release);
    const meadUpdate = {
      releaseId: normalized.id,
      title: normalized.title,
      artwork: normalized.artwork
        ? {
            uri: normalized.artwork.url,
            checksum: normalized.artwork.checksum,
            width: normalized.artwork.width,
            height: normalized.artwork.height,
            altText: normalized.artwork.altText,
          }
        : undefined,
      rights: normalized.rights
        ? {
            copyright: normalized.rights.copyrightNotice,
            pLine: normalized.rights.pLine,
            cLine: normalized.rights.cLine,
            territories: normalized.rights.territories.map((territory) => territory.code),
            rightsClaimPolicy: normalized.rights.rightsOwned === false ? "review" : "claim",
          }
        : undefined,
      territories: normalized.territories.map((territory) => territory.code),
    } as const;
    return Object.freeze({
      newRelease: this.ddexFoundation.exportNewRelease(normalized, options),
      update: this.ddexFoundation.exportUpdateRelease(normalized, options),
      takedown: this.ddexFoundation.exportTakedownRelease(normalized, options),
      mead: this.ddexFoundation.exportMead(normalized, meadUpdate, options),
      rin: this.ddexFoundation.exportRin(normalized, options),
    });
  }

  validateRelease(release: Release): DeliveryValidationReport {
    const normalized = buildUniversalRelease(release);
    const validation = this.metadataValidator.validate(normalized);
    const errors = [...validation.errors.map((entry) => this.toIssue("metadata", "METADATA_INVALID", entry.message, "error", entry.path, entry.value)), ...this.inspectAudio(normalized, release).errors, ...this.inspectArtwork(normalized, release).errors, ...this.inspectRights(normalized, release).errors, ...this.inspectIdentifiers(normalized, release).errors, ...this.inspectTerritories(normalized, release).errors];
    const warnings = [...validation.warnings.map((entry) => this.toIssue("metadata", "METADATA_WARNING", entry.message, "warning", entry.path, entry.value)), ...this.inspectAudio(normalized, release).warnings, ...this.inspectArtwork(normalized, release).warnings, ...this.inspectRights(normalized, release).warnings, ...this.inspectIdentifiers(normalized, release).warnings, ...this.inspectTerritories(normalized, release).warnings];
    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      metadata: Object.freeze({
        releaseId: release.id.value,
        normalizedReleaseKind: normalized.kind,
        trackCount: normalized.tracks.length,
      }),
    });
  }

  async buildDeliveryPackage(release: Release, options: ReleaseDeliveryBuildOptions = {}): Promise<DeliveryPackage> {
    const validation = this.validateRelease(release);
    if (!validation.valid) {
      this.recordAudit(release.id.value, this.nextPackageId(release, options), this.versionFor(release), "VALIDATION_FAILED", "FAILED", { errors: validation.errors });
      throw new Error(`Release validation failed: ${validation.errors.map((issue) => issue.message).join("; ")}`);
    }

    const normalized = buildUniversalRelease(release);
    const packageId = this.nextPackageId(release, options);
    const version = this.versionFor(release);
    const scheduledFor = normalizeSchedule(options.scheduledFor);
    const additionalAssets = buildAdditionalArtifacts(release, normalized, this.packageLayout);
    const context = this.packageBuilder
      .withPackageId(packageId)
      .withOutputPath(join(this.outputRoot, `${packageId}.zip`))
      .withWorkspacePath(join(this.workspaceRoot, packageId))
      .withVersion(CURRENT_PACKAGE_VERSION)
      .withConfiguration(new PackageConfiguration({
        version: CURRENT_PACKAGE_VERSION,
        cleanupTemporaryWorkspace: this.cleanupTemporaryWorkspace,
        resumeInterrupted: this.resumeInterrupted,
        signed: Boolean(this.packageSigning),
        workspaceRoot: join(this.workspaceRoot, packageId),
        outputRoot: join(this.outputRoot, `${packageId}.zip`),
      }))
      .fromRelease(normalized)
      .withAssets(additionalAssets)
      .build();

    const packageResult = await this.packageDirector.execute(context);
    const manifest = packageResult.metadata.manifest as PackageManifestDocument;
    const manifestChecksum = new ManifestChecksum(this.checksumGenerator.generateObject(manifest));
    const checksum = packageResult.checksum;
    const signature = this.packageSigning ? this.packageSigning.sign(manifest) : null;
    const packageModel = this.toDomainPackage(release, normalized, packageResult, manifestChecksum);
    const checkpoint = this.createCheckpoint(release.id.value, packageId, version, "PACKAGE", options.checkpointId ?? options.resumeFromCheckpointId ?? null, {
      checksum,
      manifestChecksum: manifestChecksum.value,
      scheduledFor,
      requestedBy: options.requestedBy ?? null,
    });
    const snapshot = this.createSnapshot(packageId, release.id.value, version, packageResult, manifest);
    const auditTrail = this.appendAuditTrail(release.id.value, packageId, version, snapshot, options.previousPackage ?? null, options.rollbackOfPackageId ?? null);
    const deliveryPackage = new DeliveryPackageModel({
      packageId,
      releaseId: release.id.value,
      version,
      generatedAt: packageResult.createdAt.toISOString(),
      scheduledFor,
      normalizedRelease: normalized,
      packageModel,
      packageResult,
      manifest,
      checksum,
      signature,
      artifacts: this.mapArtifacts(packageResult),
      validation,
      checkpoint,
      resumedFromCheckpointId: options.resumeFromCheckpointId ?? null,
      rollbackOfPackageId: options.rollbackOfPackageId ?? null,
      snapshot,
      auditTrail,
      metadata: Object.freeze({
        requestedBy: options.requestedBy ?? null,
        batchId: options.batchId ?? null,
        previousPackageId: options.previousPackage?.packageId ?? null,
        packageVersion: this.packageVersion.value,
      }),
    });

    this.store(deliveryPackage);
    this.logger.info("[delivery] package built", {
      releaseId: release.id.value,
      packageId,
      version,
      checksum,
      fingerprint: packageResult.fingerprint,
      trackCount: release.tracks.length,
    });
    return deliveryPackage;
  }

  async buildPackage(release: Release): Promise<Package> {
    return (await this.buildDeliveryPackage(release)).toPackage();
  }

  buildConnectorDeliveryJob(release: Release, target: Readonly<{
    connectorId: string;
    partnerName: string;
    endpointUrl: string | null;
    territories: readonly string[];
    metadata?: Readonly<Record<string, unknown>>;
    connectorVersion?: string | null;
  }>, options: ReleaseDeliveryBuildOptions = {}): DSPDeliveryJob {
    return Object.freeze({
      jobId: `${release.id.value}:${target.connectorId}:${Date.now().toString(36)}`,
      releaseId: release.id.value,
      release,
      packageModel: null,
      target: Object.freeze({
        connectorId: target.connectorId,
        connectorVersion: target.connectorVersion ?? this.packageVersion.value,
        partnerName: target.partnerName,
        endpointUrl: target.endpointUrl,
        territories: Object.freeze([...(target.territories ?? [])]),
        metadata: Object.freeze({ ...(target.metadata ?? {}) }),
      }),
      requestedBy: options.requestedBy ?? null,
      scheduledFor: options.scheduledFor ?? null,
      metadata: Object.freeze({ ...(options.metadata ?? {}), connectorId: target.connectorId }),
    });
  }

  validateConnectorRelease(job: DSPDeliveryJob): DeliveryValidationReport {
    if (this.connectorFramework) {
      return this.connectorFramework.validateRelease(job);
    }
    if (!job.release) {
      throw new Error(`Release is required for connector ${job.target.connectorId}`);
    }
    return this.validateRelease(job.release);
  }

  async buildConnectorPackage(job: DSPDeliveryJob): Promise<DSPDeliveryPackage> {
    if (!this.connectorFramework) {
      if (!job.release) throw new Error(`Release is required for connector ${job.target.connectorId}`);
      return this.buildDeliveryPackage(job.release, {
        requestedBy: job.requestedBy,
        scheduledFor: job.scheduledFor,
        metadata: job.metadata,
      }) as unknown as DSPDeliveryPackage;
    }
    return this.connectorFramework.buildPackage(job);
  }

  async deliverConnector(job: DSPDeliveryJob): Promise<DSPDeliveryResult> {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.deliver(job);
  }

  async pollConnectorStatus(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.pollStatus(job);
  }

  async retryConnector(job: DSPDeliveryJob, attempt = 0, error: unknown = null): Promise<DSPRetryDecision> {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.retry(job, attempt, error);
  }

  async withdrawConnector(job: DSPDeliveryJob) {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.withdraw(job);
  }

  async restoreConnector(job: DSPDeliveryJob): Promise<DSPStatusSnapshot> {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.restore(job);
  }

  async healthCheckConnector(job: DSPDeliveryJob): Promise<DSPHealthSnapshot> {
    if (!this.connectorFramework) {
      throw new Error("Connector framework is not configured on the release delivery engine.");
    }
    return this.connectorFramework.healthCheck(job);
  }

  generateConnectorReports(job: DSPDeliveryJob, result: DSPDeliveryResult, errors: readonly string[] = []) {
    if (!this.connectorFramework) {
      return null;
    }
    return Object.freeze({
      spotify: this.connectorFramework.generateSpotifyDeliveryReport(job, result),
      health: this.connectorFramework.generateConnectorHealthReport(job.target.connectorId, {
        connectorId: job.target.connectorId,
        healthy: result.success,
        latencyMs: null,
        checkedAt: nowIso(),
        details: Object.freeze({ releaseId: job.releaseId, connectorStatus: result.connectorStatus }),
      }),
      capability: this.connectorFramework.generateConnectorCapabilityReport(job.target.connectorId),
      errors: this.connectorFramework.generateDeliveryErrorReport(job, errors),
    });
  }

  async verifyPackage(packageModel: Package): Promise<{ manifestValid: boolean; checksumValid: boolean; fingerprintValid: boolean }> {
    const stored = this.deliveryState.get(packageModel.fingerprint.value) ?? null;
    if (!stored || !stored.package) {
      return {
        manifestValid: true,
        checksumValid: true,
        fingerprintValid: true,
      };
    }

    const manifest = stored.package.manifest;
    const manifestChecksum = this.checksumGenerator.generateObject(manifest);
    const checksumValid = manifestChecksum === packageModel.manifestChecksum.value;
    const fingerprintValid = stored.package.packageResult.fingerprint === packageModel.fingerprint.value;
    const integrity = this.packageIntegrity.verify(manifest, new Map(stored.package.packageResult.files.map((file) => [file.path, file.checksum])));
    const signatureValid = !stored.package.signature || !this.packageSigning || this.packageSigning.sign(manifest).value === stored.package.signature.value;
    const manifestValid = integrity.valid && signatureValid;

    if (!manifestValid || !checksumValid || !fingerprintValid) {
      this.recordAudit(stored.package.releaseId, stored.package.packageId, stored.package.version, "PACKAGE_VERIFICATION_FAILED", "FAILED", {
        manifestValid,
        checksumValid,
        fingerprintValid,
        signatureValid,
      });
    } else {
      this.recordAudit(stored.package.releaseId, stored.package.packageId, stored.package.version, "PACKAGE_VERIFIED", "SUCCESS", {});
    }

    return { manifestValid, checksumValid, fingerprintValid };
  }

  async prepareScheduledDelivery(release: Release, scheduledFor: string | Date): Promise<DeliveryPackage> {
    return await this.buildDeliveryPackage(release, { scheduledFor });
  }

  async buildBatch(releases: readonly Release[], options: ReleaseDeliveryBuildOptions = {}): Promise<ReleaseDeliveryBatchResult> {
    const packages: DeliveryPackage[] = [];
    const errors: string[] = [];
    for (const release of releases) {
      try {
        packages.push(await this.buildDeliveryPackage(release, options));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return Object.freeze({
      packages: Object.freeze(packages),
      errors: Object.freeze(errors),
    });
  }

  async buildIncrementalPackage(release: Release, previousPackage?: DeliveryPackage | null, options: ReleaseDeliveryBuildOptions = {}): Promise<DeliveryPackage> {
    const next = await this.buildDeliveryPackage(release, {
      ...options,
      previousPackage: previousPackage ?? undefined,
    });
    if (previousPackage && previousPackage.packageResult.fingerprint === next.packageResult.fingerprint) {
      this.recordAudit(release.id.value, previousPackage.packageId, previousPackage.version, "PACKAGE_REUSED", "UPDATED", { fingerprint: next.packageResult.fingerprint });
      return previousPackage;
    }
    return next;
  }

  async createRollbackPackage(release: Release, currentPackage: DeliveryPackage, options: ReleaseDeliveryBuildOptions = {}): Promise<DeliveryPackage> {
    const rollback = await this.buildDeliveryPackage(release, {
      ...options,
      previousPackage: currentPackage,
      rollbackOfPackageId: currentPackage.packageId,
    });
    const diff = this.packageComparator.compare(currentPackage.manifest, rollback.manifest);
    this.recordAudit(release.id.value, rollback.packageId, rollback.version, diff.identical ? "ROLLBACK_NOOP" : "ROLLBACK_CREATED", "ROLLED_BACK", { diff });
    return rollback;
  }

  async resumeFromCheckpoint(checkpointId: string): Promise<DeliveryPackage | null> {
    const checkpoint = this.checkpoints.get(checkpointId) ?? null;
    if (!checkpoint) return null;
    const record = this.deliveryState.get(checkpoint.packageId) ?? null;
    return record?.package ?? null;
  }

  recover(releaseId: string, reason = "Recovery requested"): ReleaseDeliveryRecovery {
    const checkpoint = [...this.checkpoints.values()].reverse().find((entry) => entry.releaseId === releaseId) ?? null;
    const packageRecord = checkpoint ? this.deliveryState.get(checkpoint.packageId) ?? null : null;
    const recovered = Boolean(checkpoint && packageRecord?.package);
    if (recovered && packageRecord?.package) {
      this.recordAudit(releaseId, packageRecord.package.packageId, packageRecord.package.version, "RECOVERED", "RECOVERED", { checkpointId: checkpoint?.checkpointId ?? null, reason });
    }
    return Object.freeze({
      recovered,
      checkpoint,
      package: packageRecord?.package ?? null,
      reason,
      metadata: Object.freeze({
        releaseId,
        packageId: checkpoint?.packageId ?? null,
      }),
    });
  }

  listAudits(): readonly DeliveryAuditRecord[] {
    return Object.freeze([...this.audits]);
  }

  private inspectAudio(normalized: UniversalRelease, release: Release): { errors: DeliveryValidationIssue[]; warnings: DeliveryValidationIssue[] } {
    const errors: DeliveryValidationIssue[] = [];
    const warnings: DeliveryValidationIssue[] = [];
    for (const [index, track] of release.tracks.entries()) {
      const audioReference = stableText(track.audioReference);
      const normalizedTrack = normalized.tracks[index];
      if (!audioReference) {
        errors.push(this.toIssue("audio", "AUDIO_REFERENCE_MISSING", `Track ${track.id} is missing an audio reference`, "error", `tracks[${index}].audioReference`, null));
        continue;
      }
      if (!isHttpUrl(audioReference) && !audioReference.includes(":") && !audioReference.includes("/") && !audioReference.includes("\\")) {
        warnings.push(this.toIssue("audio", "AUDIO_REFERENCE_AMBIGUOUS", `Track ${track.id} audio reference is not a file path or URL`, "warning", `tracks[${index}].audioReference`, audioReference));
      }
      if (normalizedTrack?.audio?.durationSeconds != null && normalizedTrack.audio.durationSeconds < 30) {
        errors.push(this.toIssue("audio", "AUDIO_TOO_SHORT", `Track ${track.id} audio duration is too short`, "error", `tracks[${index}].audio.durationSeconds`, normalizedTrack.audio.durationSeconds));
      }
      if (normalizedTrack?.audio?.sampleRateHz != null && normalizedTrack.audio.sampleRateHz < 44100) {
        errors.push(this.toIssue("audio", "AUDIO_SAMPLE_RATE_LOW", `Track ${track.id} audio sample rate is below 44.1 kHz`, "error", `tracks[${index}].audio.sampleRateHz`, normalizedTrack.audio.sampleRateHz));
      }
    }
    return { errors, warnings };
  }

  private inspectArtwork(normalized: UniversalRelease, release: Release): { errors: DeliveryValidationIssue[]; warnings: DeliveryValidationIssue[] } {
    const errors: DeliveryValidationIssue[] = [];
    const warnings: DeliveryValidationIssue[] = [];
    const coverReference = extractCoverReference(release) ?? normalized.artwork?.url ?? null;
    if (!coverReference) {
      errors.push(this.toIssue("artwork", "ARTWORK_REFERENCE_MISSING", "Release artwork is required", "error", "release.artwork", null));
      return { errors, warnings };
    }
    if (!isHttpUrl(coverReference) && !coverReference.includes(":") && !coverReference.includes("/") && !coverReference.includes("\\")) {
      warnings.push(this.toIssue("artwork", "ARTWORK_REFERENCE_AMBIGUOUS", "Artwork reference is not a file path or URL", "warning", "release.artwork", coverReference));
    }
    if (normalized.artwork?.width != null && normalized.artwork?.height != null && normalized.artwork.width !== normalized.artwork.height) {
      errors.push(this.toIssue("artwork", "ARTWORK_NOT_SQUARE", "Artwork must be square", "error", "release.artwork", { width: normalized.artwork.width, height: normalized.artwork.height }));
    }
    return { errors, warnings };
  }

  private inspectRights(normalized: UniversalRelease, release: Release): { errors: DeliveryValidationIssue[]; warnings: DeliveryValidationIssue[] } {
    const errors: DeliveryValidationIssue[] = [];
    const warnings: DeliveryValidationIssue[] = [];
    if (!normalized.rights) {
      warnings.push(this.toIssue("rights", "RIGHTS_INFERRED", "Rights were inferred from release metadata", "warning", "release.rights", release.metadata));
    }
    if (!release.territories.values.length) {
      warnings.push(this.toIssue("rights", "TERRITORIES_DEFAULTED", "Release territories were defaulted to WORLD", "warning", "release.territories", null));
    }
    return { errors, warnings };
  }

  private inspectIdentifiers(normalized: UniversalRelease, release: Release): { errors: DeliveryValidationIssue[]; warnings: DeliveryValidationIssue[] } {
    const errors: DeliveryValidationIssue[] = [];
    const warnings: DeliveryValidationIssue[] = [];
    const releaseUpc = inferUpcValue(release);
    if (!/^\d{12}$/.test(releaseUpc)) {
      errors.push(this.toIssue("identifiers", "UPC_INVALID", "UPC must contain 12 digits", "error", "release.upc", releaseUpc));
    }
    for (const [index, track] of release.tracks.entries()) {
      const isrc = inferIsrcValue(release, track, index);
      if (!/^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(isrc)) {
        errors.push(this.toIssue("identifiers", "ISRC_INVALID", `Track ${track.id} ISRC is invalid`, "error", `tracks[${index}].isrc`, isrc));
      }
    }
    if (!normalized.identifiers.length) {
      warnings.push(this.toIssue("identifiers", "IDENTIFIERS_INFERRED", "Release identifiers were inferred", "warning", "release.identifiers", null));
    }
    return { errors, warnings };
  }

  private inspectTerritories(normalized: UniversalRelease, release: Release): { errors: DeliveryValidationIssue[]; warnings: DeliveryValidationIssue[] } {
    const errors: DeliveryValidationIssue[] = [];
    const warnings: DeliveryValidationIssue[] = [];
    if (!normalized.territories.length) {
      warnings.push(this.toIssue("territories", "TERRITORIES_DEFAULTED", "Release territories defaulted to WORLD", "warning", "release.territories", release.territories.values));
    }
    for (const [index, track] of release.tracks.entries()) {
      if (!track.territories.values.length) {
        warnings.push(this.toIssue("territories", "TRACK_TERRITORIES_DEFAULTED", `Track ${track.id} territories defaulted to WORLD`, "warning", `tracks[${index}].territories`, track.territories.values));
      }
    }
    return { errors, warnings };
  }

  private createCheckpoint(releaseId: string, packageId: string, version: string, stage: DeliveryCheckpointStage, resumedFromCheckpointId: string | null, metadata: Readonly<Record<string, unknown>>): DeliveryCheckpoint {
    const checkpoint = Object.freeze({
      checkpointId: `${packageId}:${stage}:${Date.now().toString(36)}`,
      releaseId,
      packageId,
      version,
      stage,
      createdAt: nowIso(),
      resumedFromCheckpointId,
      metadata: Object.freeze({ ...metadata }),
    });
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    return checkpoint;
  }

  private createSnapshot(packageId: string, releaseId: string, version: string, packageResult: PackageResult, manifest: PackageManifestDocument): DeliveryPackageSnapshot {
    const snapshot: DeliveryPackageSnapshot = Object.freeze({
      id: `${packageId}:snapshot`,
      version,
      packageId,
      releaseId,
      fingerprint: packageResult.fingerprint,
      createdAt: packageResult.createdAt.toISOString(),
      serialized: this.packageSerializer.serializeManifest(new PackageManifest(manifest)),
      manifest,
      metadata: Object.freeze({
        checksum: packageResult.checksum,
        manifestChecksum: this.checksumGenerator.generateObject(manifest),
      }),
    });
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  private appendAuditTrail(releaseId: string, packageId: string, version: string, snapshot: DeliveryPackageSnapshot, previousPackage: DeliveryPackage | null, rollbackOfPackageId: string | null): readonly DeliveryAuditRecord[] {
    const beforeSnapshot = previousPackage ? this.snapshots.get(previousPackage.snapshot.id) ?? null : null;
    const diff = previousPackage ? this.packageComparator.compare(previousPackage.manifest, snapshot.manifest) : null;
    this.packageAudit.append(beforeSnapshot as unknown as Parameters<PackageAudit["append"]>[0], snapshot as unknown as Parameters<PackageAudit["append"]>[1], diff as unknown as Parameters<PackageAudit["append"]>[2]);
    this.recordAudit(releaseId, packageId, version, "PACKAGE_CREATED", "SUCCESS", {
      diff,
      snapshotId: snapshot.id,
      rollbackOfPackageId,
    });
    return Object.freeze([...this.audits]);
  }

  private recordAudit(releaseId: string, packageId: string, version: string, action: string, status: DeliveryAuditRecord["status"], metadata: Readonly<Record<string, unknown>>): DeliveryAuditRecord {
    const record: DeliveryAuditRecord = Object.freeze({
      auditId: `${packageId}:${action}:${Date.now().toString(36)}`,
      releaseId,
      packageId,
      version,
      action,
      status,
      createdAt: nowIso(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.audits.push(record);
    return record;
  }

  private store(deliveryPackage: DeliveryPackage): void {
    this.deliveryState.set(deliveryPackage.packageResult.fingerprint, {
      version: deliveryPackage.version,
      packageId: deliveryPackage.packageId,
      package: deliveryPackage,
    });
    this.deliveryState.set(deliveryPackage.releaseId, {
      version: deliveryPackage.version,
      packageId: deliveryPackage.packageId,
      package: deliveryPackage,
    });
    this.deliveryState.set(deliveryPackage.packageId, {
      version: deliveryPackage.version,
      packageId: deliveryPackage.packageId,
      package: deliveryPackage,
    });
  }

  private mapArtifacts(packageResult: PackageResult): readonly DeliveryPackageArtifact[] {
    return Object.freeze(packageResult.files.map((entry) => Object.freeze({
      path: entry.path,
      kind: entry.kind,
      checksum: entry.checksum,
      sizeBytes: entry.size,
      contentType: entry.mediaType,
      metadata: Object.freeze({}),
    })));
  }

  private toDomainPackage(release: Release, normalized: UniversalRelease, packageResult: PackageResult, manifestChecksum: ManifestChecksum): Package {
    const artifacts = packageResult.files.map((entry) =>
      new DomainPackageArtifact({
        path: entry.path,
        kind: entry.kind,
        checksum: entry.checksum,
        sizeBytes: entry.size,
        mediaType: entry.mediaType,
      }),
    );
    return new Package({
      fingerprint: new PackageFingerprint(packageResult.fingerprint),
      manifestChecksum,
      artifacts,
      version: new ReleaseVersion(release.version?.value ?? this.versionFor(release)),
      metadata: Object.freeze({
        releaseId: release.id.value,
        packageId: packageResult.packageId,
        normalizedRelease: normalized,
        manifest: packageResult.metadata.manifest,
        checksum: packageResult.checksum,
        version: packageResult.version,
      }),
    });
  }

  private nextPackageId(release: Release, options: ReleaseDeliveryBuildOptions): string {
    const existing = this.deliveryState.get(release.id.value);
    const revision = existing ? Number(existing.version.replace(/^v/i, "")) + 1 : 1;
    const tag = options.batchId ? `${options.batchId}:${revision}` : `v${revision}`;
    return `delivery:${release.id.value}:${tag}`;
  }

  private versionFor(release: Release): string {
    const existing = this.deliveryState.get(release.id.value);
    if (!existing) return "v1";
    const current = Number(existing.version.replace(/^v/i, "")) || 1;
    return `v${current + 1}`;
  }

  private toIssue(category: string, code: string, message: string, severity: "error" | "warning", target: string, value: unknown): DeliveryValidationIssue {
    return Object.freeze({ category, code, message, severity, target, value });
  }
}
