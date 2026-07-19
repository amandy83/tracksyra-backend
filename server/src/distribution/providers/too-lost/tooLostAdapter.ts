import type { PlatformAdapter } from "../../adapters/platformAdapter";
import type { AnalyticsSyncAdapter, AnalyticsSyncResult } from "../../adapters/analyticsSyncAdapter";
import type { ReleaseSubmissionAdapter, ReleaseSubmissionInput, ReleaseSubmissionResult } from "../../adapters/releaseSubmissionAdapter";
import type { Release, Track } from "../../models/distributionTypes";
import { normalizeTooLostError } from "./tooLostError";
import { TooLostApiClient } from "./tooLostApiClient";
import { TooLostCredentialStore } from "./tooLostCredentialStore";
import type { TooLostConfig, TooLostReleasePayload } from "./tooLostTypes";

type HttpClient = typeof fetch;

type TooLostAdapterOptions = {
  config: TooLostConfig;
  httpClient: HttpClient;
  credentialStore: TooLostCredentialStore;
  api: TooLostApiClient;
};

export class TooLostAdapter implements PlatformAdapter, ReleaseSubmissionAdapter, AnalyticsSyncAdapter {
  readonly name = "too_lost";
  readonly provider = "too_lost";
  private readonly config: TooLostConfig;
  private readonly httpClient: HttpClient;
  private readonly credentials: TooLostCredentialStore;
  private readonly api: TooLostApiClient;

  constructor(options: TooLostAdapterOptions) {
    this.config = options.config;
    this.httpClient = options.httpClient;
    this.credentials = options.credentialStore;
    this.api = options.api;
  }

  async authenticate(): Promise<void> {
    await this.api.requestJson("/me", { method: "GET" });
  }

  async uploadTrack(input: { track: Track; release: Release }): Promise<{
    platformTrackId: string;
    status: "PUBLISHED" | "FAILED";
    rawResponse: unknown;
  }> {
    try {
      const payload = this.buildPayload({ release: input.release, tracks: [input.track] });
      const response = await this.api.requestJson("/releases", {
        method: "POST",
        body: JSON.stringify(payload.release),
      });
      const externalReleaseId = parseExternalReleaseId(response) ?? input.release.id;
      return {
        platformTrackId: externalReleaseId,
        status: "PUBLISHED",
        rawResponse: response,
      };
    } catch (error) {
      throw normalizeTooLostError(error);
    }
  }

  async submitRelease(input: ReleaseSubmissionInput): Promise<ReleaseSubmissionResult> {
    try {
      const payload = this.buildPayload({ release: input.release, tracks: input.tracks });
      const response = await this.api.requestJson("/releases", {
        method: "POST",
        body: JSON.stringify(payload.release),
      });
      const externalReleaseId = parseExternalReleaseId(response) ?? input.release.id;
      return {
        provider: this.provider,
        externalReleaseId,
        status: "SUBMITTED",
        request: payload,
        response,
      };
    } catch (error) {
      throw normalizeTooLostError(error);
    }
  }

  async syncAnalytics(input: { since?: string; platforms?: string[] }): Promise<AnalyticsSyncResult> {
    try {
      const response = await this.api.requestJson(`/analytics/overview`, { method: "GET" });
      return {
        provider: this.provider,
        mode: this.config.sandboxMode ? "sandbox" : "live",
        syncedAt: new Date().toISOString(),
        platforms: input.platforms ?? this.config.dspTargets,
        rawResponse: response,
      };
    } catch (error) {
      throw normalizeTooLostError(error);
    }
  }

  async updateMetadata(input: { platformTrackId: string; track: Track; release?: Release }): Promise<void> {
    try {
      const artist = input.release?.primaryArtist ?? input.track.primaryArtist ?? "Unknown Artist";
      const currentYear = yearFromValue(input.release?.productionYear) ?? String(new Date().getUTCFullYear());
      await this.api.requestJson(`/releases/${encodeURIComponent(input.platformTrackId)}/metadata`, {
        method: "PATCH",
        body: JSON.stringify({
          title: input.release?.title ?? input.track.title ?? null,
          version: input.release?.version ?? null,
          primaryArtist: artist,
          featuringArtists: input.release?.featuredArtists ?? input.track.featuredArtists ?? [],
          variousArtists: input.release?.variousArtists ?? false,
          label: artist,
          primaryGenre: input.release?.genre ?? null,
          subGenre: input.release?.subgenre ?? null,
          language: input.release?.language ?? null,
          upc: input.release?.upc ?? null,
          releaseDate: input.release?.releaseDate ?? null,
          originalReleaseDate: input.release?.originalReleaseDate ?? null,
          coverUrl: input.release?.coverArtUrl ?? null,
          format: input.release?.format ?? null,
          producerCatalogueNumber: input.release?.producerCatalogueNumber ?? null,
          cYear: currentYear,
          cLine: input.release?.cLine ?? input.release?.copyright ?? artist,
          pYear: currentYear,
          pLine: input.release?.pLine ?? input.release?.copyright ?? artist,
        }),
      });
    } catch (error) {
      throw normalizeTooLostError(error);
    }
  }

  private buildPayload(input: { release: Release; tracks: Track[] }): TooLostReleasePayload {
    const release = input.release;
    const primaryTrack = input.tracks[0];
    const artist = release.primaryArtist ?? primaryTrack?.primaryArtist ?? release.artistId ?? "Unknown Artist";
    const releaseTitle = release.title ?? primaryTrack?.title ?? "Untitled Release";
    const normalizedReleaseType = mapReleaseType(release.type);
    const currentYear = yearFromValue(release.productionYear) ?? String(new Date().getUTCFullYear());
    const label = release.labelName ?? artist;

    return {
      release: {
        type: normalizedReleaseType,
        title: releaseTitle,
        version: release.version ?? null,
        primaryArtist: artist,
        featuringArtists: release.featuredArtists ?? primaryTrack?.featuredArtists ?? [],
        variousArtists: release.variousArtists ?? false,
        participants: buildParticipants(artist, release.featuredArtists ?? primaryTrack?.featuredArtists ?? []),
        label,
        primaryGenre: release.genre ?? null,
        subGenre: release.subgenre ?? null,
        language: release.language ?? null,
        upc: release.upc ?? null,
        releaseDate: release.releaseDate ?? null,
        originalReleaseDate: release.originalReleaseDate ?? null,
        coverUrl: release.coverArtUrl ?? null,
        format: release.format ?? null,
        producerCatalogueNumber: release.producerCatalogueNumber ?? null,
        cYear: currentYear,
        cLine: release.cLine ?? release.copyright ?? label,
        pYear: currentYear,
        pLine: release.pLine ?? release.copyright ?? label,
      },
      tracks: input.tracks.map((track) => ({
        id: track.id,
        title: normalizedReleaseType === "Single" ? releaseTitle : track.title ?? releaseTitle,
        version: track.version ?? null,
        language: release.language ?? null,
        isrc: track.isrc ?? null,
        generateIsrc: track.generateIsrc ?? null,
        artists: buildParticipants(track.primaryArtist ?? artist, track.featuredArtists ?? release.featuredArtists ?? []),
        writers: buildWriterParticipants(track, track.primaryArtist ?? artist),
        contentType: track.contentType ?? null,
        primaryTrackType: track.primaryTrackType ?? null,
        secondaryTrackType: track.secondaryTrackType ?? null,
        instrumental: track.instrumental ?? false,
        remixer: track.remixer ?? null,
        author: track.author ?? null,
        composer: track.composer ?? null,
        arranger: track.arranger ?? null,
        producer: track.producer ?? null,
        pLine: track.pLine ?? null,
        pYear: yearFromValue(track.productionYear),
        publisher: track.publisher ?? null,
        primaryGenre: track.genre ?? release.genre ?? null,
        subGenre: track.subgenre ?? release.subgenre ?? null,
        secondaryGenre: track.secondaryGenre ?? null,
        secondarySubGenre: track.secondarySubgenre ?? null,
        priceTier: track.priceTier ?? null,
        producerCatalogueNumber: track.producerCatalogueNumber ?? null,
        parentalAdvisory: track.parentalAdvisory ?? (track.explicit ? "explicit" : "none"),
        previewStart: track.previewStart ?? null,
        trackTitleLanguage: track.trackTitleLanguage ?? null,
        lyricsLanguage: track.lyricsLanguage ?? null,
        lyrics: track.lyrics ?? null,
        moreInfo: track.moreInfo ?? null,
        audioFile: {
          url: track.audioUrl ?? null,
          filename: track.audioUrl
            ? normalizeAudioFilename(filenameFromUrl(track.audioUrl, `${track.id}.${audioFileExtension(track.audioFormat)}`), track.audioFormat)
            : `${track.id}.${audioFileExtension(track.audioFormat)}`,
          uploadContentType: audioFileContentType(track.audioFormat),
        },
        explicit: track.explicit ?? false,
      })),
    };
  }
}

function parseExternalReleaseId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown> & { data?: Record<string, unknown> };
  return String(body.releaseId ?? body.release_id ?? body.id ?? body.data?.releaseId ?? body.data?.id ?? "").trim() || null;
}

function filenameFromUrl(value: string, fallback: string): string {
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last || fallback;
  } catch {
    return fallback;
  }
}

function mapReleaseType(value: Release["type"] | string | null | undefined): string {
  const normalized = String(value || "single").trim().toLowerCase();
  if (normalized === "single") return "Single";
  if (normalized === "ep") return "EP";
  if (normalized === "album") return "Album";
  return "Single";
}

function buildParticipants(primary: string, featured: string[]): Array<{ name: string; role: string[] }> {
  const participants = [{ name: primary, role: ["artist"] }];
  for (const name of featured) {
    if (!name || name === primary) continue;
    participants.push({ name, role: ["featured_artist"] });
  }
  return participants;
}

function buildWriterParticipants(track: Track, fallbackName: string): Array<{ name: string; role: string[] }> {
  const explicit = normalizeParticipants(track.writers ?? []);
  if (explicit.length) return explicit;
  if (track.composer?.trim()) return [{ name: track.composer.trim(), role: ["composer"] }];
  return [{ name: fallbackName, role: ["composer"] }];
}

function normalizeParticipants(value: Array<{ name: string; role: string[] }>): Array<{ name: string; role: string[] }> {
  const merged = new Map<string, Set<string>>();
  for (const participant of value) {
    const name = participant.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const roles = merged.get(key) ?? new Set<string>();
    for (const role of participant.role ?? []) {
      const normalizedRole = String(role || "").trim();
      if (normalizedRole) roles.add(normalizedRole);
    }
    merged.set(key, roles);
  }

  return [...merged.entries()].map(([key, roles]) => ({
    name: value.find((participant) => participant.name.trim().toLowerCase() === key)?.name ?? key,
    role: [...roles],
  }));
}

function yearFromValue(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return /^\d{4}$/.test(normalized) ? normalized : null;
}

function normalizeAudioFilename(value: string, audioFormat: string | null = null): string {
  const stem = value.replace(/\.[^.]+$/, "");
  const currentExtension = value.includes(".") ? value.split(".").pop() || "" : "";
  const extension = audioFormat ? audioFileExtension(audioFormat) : currentExtension || "flac";
  return `${stem}.${extension}`;
}

function audioFileExtension(audioFormat: string | null | undefined): string {
  return "flac";
}

function audioFileContentType(audioFormat: string | null | undefined): string {
  return "audio/flac";
}
