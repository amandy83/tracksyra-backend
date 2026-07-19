import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DistributionJob,
  DistributionJobStatus,
  DistributionPlatformName,
  DistributionParticipant,
  DistributionRelease,
  DistributionTrack,
  NormalizedDistributionError,
} from "../models/distributionTypes";
import type { DistributionStore } from "./distributionStore";
import { resolveDistributionAudioUrl } from "./distributionMediaResolver";

type DbClient = SupabaseClient;

type DistributionTrackRow = {
  id: string;
  release_id: string;
  artist_id: string | null;
  user_id: string | null;
  status: string | null;
  artist_mode: string | null;
  spotify_artist_id: string | null;
  apple_artist_id: string | null;
  provider_status: string | null;
  provider_track_id: string | null;
  provider_isrc: string | null;
  provider_updated_at: string | null;
  provider_review_notes: string | null;
  provider_warning_notes: string | null;
  provider_validation_messages: unknown | null;
  provider_delivery_messages: unknown | null;
  title: string | null;
  version: string | null;
  primary_artist: string | null;
  featured_artists: string | null;
  content_type: string | null;
  primary_track_type: string | null;
  secondary_track_type: string | null;
  instrumental: boolean | null;
  remixer: string | null;
  author: string | null;
  composer: string | null;
  arranger: string | null;
  producer: string | null;
  p_line: string | null;
  production_year: string | null;
  publisher: string | null;
  genre: string | null;
  subgenre: string | null;
  secondary_genre: string | null;
  secondary_subgenre: string | null;
  price_tier: string | null;
  producer_catalogue_number: string | null;
  parental_advisory: "none" | "explicit" | "clean" | null;
  preview_start: number | null;
  track_title_language: string | null;
  lyrics_language: string | null;
  metadata: Record<string, unknown> | null;
  audio_url: string | null;
  generate_isrc: boolean | null;
  isrc: string | null;
  explicit: boolean | null;
  lyrics: string | null;
  more_info: string | null;
  audio_format: string | null;
};

type DistributionReleaseRow = {
  id: string;
  artist_id: string | null;
  user_id: string | null;
  status: string | null;
  artist_mode: string | null;
  spotify_artist_id: string | null;
  apple_artist_id: string | null;
  provider_status: string | null;
  distribution_status: string | null;
  provider_release_id: string | null;
  provider_updated_at: string | null;
  provider_review_notes: string | null;
  provider_warning_notes: string | null;
  provider_validation_messages: unknown | null;
  provider_delivery_messages: unknown | null;
  title: string | null;
  version: string | null;
  primary_artist: string | null;
  featured_artists: string | null;
  various_artists: boolean | null;
  release_date: string | null;
  original_release_date: string | null;
  genre: string | null;
  subgenre: string | null;
  label_name: string | null;
  format: string | null;
  language: string | null;
  upc: string | null;
  copyright_owner: string | null;
  p_line: string | null;
  c_line: string | null;
  production_year: string | null;
  producer_catalogue_number: string | null;
  cover_art_url: string | null;
  release_type: "single" | "ep" | "album" | null;
  metadata: Record<string, unknown> | null;
};

type DistributionJobRow = {
  id: string;
  release_id: string;
  track_id: string;
  platform: DistributionPlatformName;
  status: DistributionJobStatus;
  created_at: string | Date;
  attempts: number | null;
  next_retry_at: string | Date | null;
};

export class SupabaseDistributionStore implements DistributionStore {
  constructor(private client: DbClient) {}

  async getReleaseWithTracks(releaseId: string): Promise<{ release: DistributionRelease; tracks: DistributionTrack[] } | null> {
    const { data: release, error: releaseError } = await this.client
      .from("releases")
      .select("*")
      .eq("id", releaseId)
      .maybeSingle();
    if (releaseError) throw new Error(`Failed to read release ${releaseId}: ${releaseError.message}`);
    if (!release) return null;

    const { data: tracks, error: tracksError } = await this.client
      .from("tracks")
      .select("*")
      .eq("release_id", releaseId)
      .order("track_number", { ascending: true });
    if (tracksError) throw new Error(`Failed to read tracks for release ${releaseId}: ${tracksError.message}`);
    const releaseRow = release as DistributionReleaseRow;
    const trackRows = (tracks || []) as DistributionTrackRow[];
    const writersByTrack = await this.loadWriterContributorsByTrack(releaseId, trackRows.map((track) => track.id));

    return {
      release: this.mapRelease(releaseRow),
      tracks: await Promise.all(trackRows.map((track) => this.mapTrack(track, writersByTrack.get(track.id) ?? []))),
    };
  }

  async getTrackWithRelease(trackId: string): Promise<{ release: DistributionRelease; track: DistributionTrack } | null> {
    const { data: track, error: trackError } = await this.client
      .from("tracks")
      .select("*")
      .eq("id", trackId)
      .maybeSingle();
    if (trackError) throw new Error(`Failed to read track ${trackId}: ${trackError.message}`);
    if (!track) return null;

    const { data: release, error: releaseError } = await this.client
      .from("releases")
      .select("*")
      .eq("id", track.release_id)
      .maybeSingle();
    if (releaseError) throw new Error(`Failed to read release ${track.release_id}: ${releaseError.message}`);
    if (!release) return null;
    const trackRow = track as DistributionTrackRow;
    const releaseRow = release as DistributionReleaseRow;
    const writersByTrack = await this.loadWriterContributorsByTrack(trackRow.release_id, [trackRow.id]);

    return { release: this.mapRelease(releaseRow), track: await this.mapTrack(trackRow, writersByTrack.get(trackRow.id) ?? []) };
  }

  async getJobPayload(job: DistributionJob): Promise<{ release: DistributionRelease; track: DistributionTrack } | null> {
    if (!job.trackId) return null;
    return this.getTrackWithRelease(job.trackId);
  }

  async ensurePlatformDelivery(input: {
    releaseId: string;
    trackId: string;
    userId: string;
    platform: DistributionPlatformName;
  }): Promise<void> {
    const { error } = await this.client
      .from("platform_deliveries")
      .upsert({
        release_id: input.releaseId,
        track_id: input.trackId,
        user_id: input.userId,
        platform: input.platform,
        status: "PENDING",
      }, { onConflict: "track_id,platform", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to ensure platform delivery: ${error.message}`);
  }

  async createDistributionJob(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<DistributionJob | null> {
    const { data, error } = await this.client
      .from("distribution_jobs")
      .upsert({
        release_id: input.releaseId,
        track_id: input.trackId,
        platform: input.platform,
        status: "PENDING",
      }, { onConflict: "track_id,platform", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Failed to create distribution job: ${error.message}`);
    return data ? this.mapJob(data as DistributionJobRow) : null;
  }

  async getPendingJobs(limit: number): Promise<DistributionJob[]> {
    const { data, error } = await this.client
      .from("distribution_jobs")
      .select("*")
      .eq("status", "PENDING")
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Failed to read pending distribution jobs: ${error.message}`);
    return (data || []).map((row) => this.mapJob(row as DistributionJobRow));
  }

  async updateJobStatus(jobId: string, status: DistributionJobStatus): Promise<void> {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (["PUBLISHED", "FAILED", "DELIVERED", "REJECTED", "DEAD_LETTER"].includes(status)) {
      patch.processed_at = new Date().toISOString();
    }
    const { error } = await this.client.from("distribution_jobs").update(patch).eq("id", jobId);
    if (error) throw new Error(`Failed to update distribution job ${jobId}: ${error.message}`);
  }

  async updateDeliveryStatus(input: {
    releaseId: string;
    trackId?: string | null;
    platform: DistributionPlatformName;
    status: "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED";
  }): Promise<void> {
    const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
    if (input.status === "PUBLISHED") patch.delivered_at = new Date().toISOString();
    let query = this.client
      .from("platform_deliveries")
      .update(patch)
      .eq("release_id", input.releaseId)
      .eq("platform", input.platform);
    query = input.trackId ? query.eq("track_id", input.trackId) : query;
    const { error } = await query;
    if (error) throw new Error(`Failed to update delivery status: ${error.message}`);
  }

  async recordDeliveryResult(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
    status: "PUBLISHED" | "FAILED";
    platformTrackId?: string | null;
    rawResponse?: unknown;
    error?: NormalizedDistributionError | null;
  }): Promise<void> {
    const patch: Record<string, unknown> = {
      status: input.status,
      platform_track_id: input.platformTrackId ?? null,
      raw_response: input.rawResponse ?? null,
      error_code: input.error?.errorCode ?? null,
      error_message: input.error?.message ?? null,
      retryable: input.error?.retryable ?? null,
      updated_at: new Date().toISOString(),
    };
    if (input.status === "PUBLISHED") patch.delivered_at = new Date().toISOString();

    const { error } = await this.client
      .from("platform_deliveries")
      .update(patch)
      .eq("release_id", input.releaseId)
      .eq("track_id", input.trackId)
      .eq("platform", input.platform);
    if (error) throw new Error(`Failed to record delivery result: ${error.message}`);

    const request = extractApiRequest(input.rawResponse);
    const response = extractApiResponse(input.rawResponse);
    const failureReason = input.error?.message ?? null;
    const { error: jobError } = await this.client
      .from("distribution_jobs")
      .update({
        api_request: request,
        api_response: response,
        failure_reason: failureReason,
        retry_count: input.status === "FAILED" ? 1 : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("release_id", input.releaseId)
      .eq("track_id", input.trackId)
      .eq("platform", input.platform);
    if (jobError) throw new Error(`Failed to persist distribution API audit fields: ${jobError.message}`);

    await this.client.from("distribution_sync_logs").insert({
      provider: "too_lost",
      release_id: input.releaseId,
      track_id: input.trackId,
      sync_type: "DELIVERY_RESULT",
      status: input.status,
      api_request: request,
      api_response: response,
      failure_reason: failureReason,
      retry_count: input.status === "FAILED" ? 1 : 0,
    });

    await this.audit({
      releaseId: input.releaseId,
      trackId: input.trackId,
      provider: input.platform,
      action: "DELIVERY_RESULT",
      status: input.status,
      metadata: { platformTrackId: input.platformTrackId ?? null, error: input.error ?? null },
    });
  }

  async isWebhookConfirmed(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<boolean> {
    const { data, error } = await this.client
      .from("distribution_state_history")
      .select("id")
      .eq("release_id", input.releaseId)
      .eq("track_id", input.trackId)
      .eq("platform", input.platform)
      .eq("source", "WEBHOOK")
      .in("next_status", ["SUBMITTED", "IN_REVIEW", "APPROVED", "DELIVERED", "REJECTED"])
      .limit(1);
    if (error) throw new Error(`Failed to check webhook state: ${error.message}`);
    return Boolean(data?.length);
  }

  private async mapTrack(row: DistributionTrackRow, contributors: DistributionParticipant[] = []): Promise<DistributionTrack> {
    const resolvedAudio = await resolveDistributionAudioUrl(row.audio_url, this.client);
    const writers = mergeWriterParticipants(
      row.composer ? [{ name: row.composer, role: ["composer"] }] : [],
      contributors,
    );
    const metadata = normalizeTrackMetadata(row.metadata);
    return {
      id: row.id,
      releaseId: row.release_id,
      userId: row.artist_id ?? row.user_id ?? "",
      artistId: row.artist_id ?? row.user_id ?? "",
      status: row.status ?? null,
      artistMode: row.artist_mode ?? null,
      spotifyArtistId: row.spotify_artist_id ?? null,
      appleArtistId: row.apple_artist_id ?? null,
      providerStatus: row.provider_status ?? null,
      providerTrackId: row.provider_track_id ?? null,
      providerIsrc: row.provider_isrc ?? null,
      providerUpdatedAt: row.provider_updated_at ?? null,
      providerReviewNotes: row.provider_review_notes ?? null,
      providerWarningNotes: row.provider_warning_notes ?? null,
      providerValidationMessages: row.provider_validation_messages ?? null,
      providerDeliveryMessages: row.provider_delivery_messages ?? null,
      title: row.title ?? "",
      version: row.version ?? metadata.version ?? null,
      primaryArtist: row.primary_artist || undefined,
      featuredArtists: splitArtists(row.featured_artists),
      contentType: row.content_type ?? metadata.content_type ?? null,
      primaryTrackType: row.primary_track_type ?? metadata.primary_track_type ?? null,
      secondaryTrackType: row.secondary_track_type ?? metadata.secondary_track_type ?? null,
      instrumental: row.instrumental ?? Boolean(metadata.instrumental),
      remixer: row.remixer ?? metadata.remixer ?? null,
      author: row.author ?? metadata.author ?? null,
      composer: row.composer ?? null,
      arranger: row.arranger ?? metadata.arranger ?? null,
      producer: row.producer ?? metadata.producer ?? null,
      pLine: row.p_line ?? metadata.p_line ?? null,
      productionYear: row.production_year != null ? String(row.production_year) : metadata.production_year ?? null,
      publisher: row.publisher ?? metadata.publisher ?? null,
      genre: row.genre ?? metadata.genre ?? null,
      subgenre: row.subgenre ?? metadata.subgenre ?? null,
      secondaryGenre: row.secondary_genre ?? metadata.secondary_genre ?? null,
      secondarySubgenre: row.secondary_subgenre ?? metadata.secondary_subgenre ?? null,
      priceTier: row.price_tier ?? metadata.price_tier ?? null,
      producerCatalogueNumber: row.producer_catalogue_number ?? metadata.producer_catalogue_number ?? null,
      parentalAdvisory: row.parental_advisory ?? metadata.parental_advisory ?? null,
      previewStart: row.preview_start ?? nullableNumber(metadata.preview_start),
      trackTitleLanguage: row.track_title_language ?? metadata.track_title_language ?? null,
      lyricsLanguage: row.lyrics_language ?? metadata.lyrics_language ?? null,
      lyrics: row.lyrics ?? null,
      moreInfo: row.more_info ?? metadata.more_info ?? null,
      generateIsrc: resolveGenerateIsrc(row.generate_isrc, metadata, row.isrc),
      writers: writers.length ? writers : undefined,
      audioUrl: resolvedAudio.signedAudioUrl ?? resolvedAudio.resolvedAudioUrl,
      audioFormat: row.audio_format ?? null,
      isrc: row.isrc,
      explicit: Boolean(row.explicit),
    };
  }

  private mapRelease(row: DistributionReleaseRow): DistributionRelease {
    const metadata = normalizeReleaseMetadata(row.metadata);
    return {
      id: row.id,
      userId: row.artist_id ?? row.user_id ?? "",
      artistId: row.artist_id ?? row.user_id ?? "",
      status: row.status ?? null,
      artistMode: row.artist_mode ?? null,
      spotifyArtistId: row.spotify_artist_id ?? null,
      appleArtistId: row.apple_artist_id ?? null,
      providerStatus: row.provider_status ?? null,
      distributionStatus: row.distribution_status ?? null,
      providerReleaseId: row.provider_release_id ?? null,
      providerUpdatedAt: row.provider_updated_at ?? null,
      providerReviewNotes: row.provider_review_notes ?? null,
      providerWarningNotes: row.provider_warning_notes ?? null,
      providerValidationMessages: row.provider_validation_messages ?? null,
      providerDeliveryMessages: row.provider_delivery_messages ?? null,
      title: row.title ?? "",
      version: row.version ?? metadata.version ?? null,
      primaryArtist: row.primary_artist ?? undefined,
      featuredArtists: splitArtists(row.featured_artists ?? metadata.featured_artists),
      variousArtists: row.various_artists ?? Boolean(metadata.various_artists),
      releaseDate: row.release_date,
      originalReleaseDate: row.original_release_date ?? metadata.original_release_date ?? null,
      genre: row.genre,
      subgenre: row.subgenre ?? metadata.subgenre ?? null,
      labelName: row.label_name ?? metadata.label_name ?? null,
      format: row.format ?? metadata.format ?? null,
      language: row.language,
      upc: row.upc,
      copyright: row.copyright_owner,
      pLine: row.p_line ?? metadata.p_line ?? null,
      cLine: row.c_line ?? metadata.c_line ?? null,
      productionYear: row.production_year != null ? String(row.production_year) : metadata.production_year ?? null,
      producerCatalogueNumber: row.producer_catalogue_number ?? metadata.producer_catalogue_number ?? null,
      coverArtUrl: row.cover_art_url,
      type: row.release_type ?? undefined,
    };
  }

  private mapJob(row: DistributionJobRow): DistributionJob {
    return {
      id: row.id,
      releaseId: row.release_id,
      trackId: row.track_id,
      platform: row.platform,
      status: row.status,
      createdAt: new Date(row.created_at),
      attempts: row.attempts ?? 0,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
    };
  }

  private async audit(input: {
    releaseId: string;
    trackId: string;
    provider: DistributionPlatformName;
    action: string;
    status: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.client.from("distribution_audit_logs").insert({
      release_id: input.releaseId,
      track_id: input.trackId,
      provider: input.provider,
      action: input.action,
      status: input.status,
      actor: "worker",
      metadata: input.metadata ?? {},
    });
  }

  private async loadWriterContributorsByTrack(releaseId: string, trackIds: string[]): Promise<Map<string, DistributionParticipant[]>> {
    if (!trackIds.length) return new Map();

    const { data, error } = await this.client
      .from("release_contributors")
      .select("track_id,name,role")
      .eq("release_id", releaseId)
      .in("track_id", trackIds)
      .in("role", ["composer", "songwriter"]);
    if (error) throw new Error(`Failed to read release contributors for ${releaseId}: ${error.message}`);

    const writersByTrack = new Map<string, DistributionParticipant[]>();
    for (const row of data || []) {
      if (!row.track_id || !row.name?.trim()) continue;
      const current = writersByTrack.get(row.track_id) ?? [];
      current.push({ name: row.name.trim(), role: [row.role] });
      writersByTrack.set(row.track_id, mergeWriterParticipants(current));
    }
    return writersByTrack;
  }
}

function splitArtists(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

type DistributionReleaseMetadata = Readonly<Record<string, unknown>> & {
  release_metadata?: DistributionReleaseMetadata | null;
  version?: string | null;
  featured_artists?: string | null;
  various_artists?: boolean | null;
  original_release_date?: string | null;
  label_name?: string | null;
  format?: string | null;
  p_line?: string | null;
  c_line?: string | null;
  production_year?: string | null;
  producer_catalogue_number?: string | null;
  subgenre?: string | null;
};

type DistributionTrackMetadata = Readonly<Record<string, unknown>> & {
  version?: string | null;
  content_type?: string | null;
  primary_track_type?: string | null;
  secondary_track_type?: string | null;
  instrumental?: boolean | null;
  remixer?: string | null;
  author?: string | null;
  composer?: string | null;
  arranger?: string | null;
  producer?: string | null;
  p_line?: string | null;
  production_year?: string | null;
  publisher?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  secondary_genre?: string | null;
  secondary_subgenre?: string | null;
  price_tier?: string | null;
  producer_catalogue_number?: string | null;
  parental_advisory?: "none" | "explicit" | "clean" | null;
  preview_start?: number | null;
  track_title_language?: string | null;
  lyrics_language?: string | null;
  more_info?: string | null;
  generate_isrc?: boolean | null;
};

function normalizeReleaseMetadata(value: Record<string, unknown> | null | undefined): DistributionReleaseMetadata {
  if (!value || typeof value !== "object") return {};
  const nested = (value as Record<string, unknown>).release_metadata;
  return nested && typeof nested === "object" ? nested as DistributionReleaseMetadata : value as DistributionReleaseMetadata;
}

function normalizeTrackMetadata(value: Record<string, unknown> | null | undefined): DistributionTrackMetadata {
  return value && typeof value === "object" ? value as DistributionTrackMetadata : {};
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveGenerateIsrc(
  value: unknown,
  metadata: DistributionTrackMetadata,
  isrc: string | null | undefined,
): boolean {
  if (typeof value === "boolean") return value;
  if (typeof metadata.generate_isrc === "boolean") return metadata.generate_isrc as boolean;
  return !String(isrc || "").trim();
}

function extractApiRequest(value: unknown): unknown {
  if (value && typeof value === "object" && "payload" in value) return (value as { payload?: unknown }).payload ?? {};
  return {};
}

function extractApiResponse(value: unknown): unknown {
  if (!value || typeof value !== "object") return value ?? {};
  const { payload: _payload, ...response } = value as Record<string, unknown>;
  return response;
}

function mergeWriterParticipants(...groups: Array<DistributionParticipant[]>): DistributionParticipant[] {
  const merged = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const participant of group) {
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
  }

  return [...merged.entries()].map(([key, roles]) => ({
    name: [...groups.flatMap((group) => group)].find((participant) => participant.name.trim().toLowerCase() === key)?.name ?? key,
    role: [...roles],
  }));
}
