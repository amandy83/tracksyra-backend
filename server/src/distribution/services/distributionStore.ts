import type {
  DistributionJob,
  DistributionJobStatus,
  NormalizedDistributionError,
  DistributionPlatformName,
  DistributionParticipant,
  DistributionRelease,
  DistributionTrack,
} from "../models/distributionTypes";
import { mapReleaseAndTracksToMusicRelease, mapMusicReleaseToDistribution } from "../../domain/music";
import type { DistributionAudioUrlResolver } from "./distributionMediaResolver";

export type DistributionStore = {
  getReleaseWithTracks(releaseId: string): Promise<{ release: DistributionRelease; tracks: DistributionTrack[] } | null>;
  getTrackWithRelease(trackId: string): Promise<{ release: DistributionRelease; track: DistributionTrack } | null>;
  getJobPayload(job: DistributionJob): Promise<{ release: DistributionRelease; track: DistributionTrack } | null>;
  ensurePlatformDelivery(input: {
    releaseId: string;
    trackId: string;
    userId: string;
    platform: DistributionPlatformName;
  }): Promise<void>;
  createDistributionJob(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<DistributionJob | null>;
  getPendingJobs(limit: number): Promise<DistributionJob[]>;
  updateJobStatus(jobId: string, status: DistributionJobStatus): Promise<void>;
  updateDeliveryStatus(input: {
    releaseId: string;
    trackId?: string | null;
    platform: DistributionPlatformName;
    status: "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED";
  }): Promise<void>;
  recordDeliveryResult(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
    status: "PUBLISHED" | "FAILED";
    platformTrackId?: string | null;
    rawResponse?: unknown;
    error?: NormalizedDistributionError | null;
  }): Promise<void>;
  isWebhookConfirmed(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<boolean>;
};

export type SqlExecutor = {
  query<T extends object = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
};

export class SqlDistributionStore implements DistributionStore {
  constructor(
    private db: SqlExecutor,
    private readonly resolveDistributionAudioUrl: DistributionAudioUrlResolver,
  ) {}

  async getReleaseWithTracks(releaseId: string): Promise<{ release: DistributionRelease; tracks: DistributionTrack[] } | null> {
    const releases = await this.db.query<{
      id: string;
      user_id: string;
      title: string;
      status: string | null;
      primary_artist: string;
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
      release_featured_artists: string | null;
      version: string | null;
      various_artists: boolean | null;
      metadata: Record<string, unknown> | null;
      release_date: string | null;
      original_release_date: string | null;
      genre: string | null;
      subgenre: string | null;
      label_name: string | null;
      format: string | null;
      language: string | null;
      upc: string | null;
      copyright_owner: string | null;
      copyright_declared: boolean | null;
      ai_content_declared: boolean | null;
      rights_owned: boolean | null;
      p_line: string | null;
      c_line: string | null;
      production_year: number | null;
      producer_catalogue_number: string | null;
      cover_art_url: string | null;
      release_type: string | null;
      created_at: string | null;
    }>(
      `SELECT id, COALESCE(artist_id, user_id) AS user_id, title, primary_artist, artist_mode, spotify_artist_id, apple_artist_id, provider_status, distribution_status, provider_release_id, provider_updated_at, provider_review_notes, provider_warning_notes, provider_validation_messages, provider_delivery_messages, featured_artists, version, various_artists, metadata, release_type, release_date, original_release_date, genre, subgenre, label_name, format, language, upc, copyright_owner, copyright_declared, ai_content_declared, rights_owned, p_line, c_line, production_year, producer_catalogue_number, cover_art_url, status, created_at
       FROM releases
       WHERE id = :releaseId
       LIMIT 1`,
      { releaseId },
    );
    const releaseRow = releases[0];
    if (!releaseRow) return null;

    const trackRows = await this.db.query<{
      id: string;
      release_id: string;
      user_id: string;
      title: string;
      status: string | null;
      version: string | null;
      primary_artist: string | null;
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
      track_featured_artists: string | null;
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
      production_year: number | null;
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
      duration_sec: string | number | null;
      file_size_bytes: string | number | null;
      audio_format: string | null;
      track_number: number | null;
    }>(
      `SELECT id, release_id, COALESCE(artist_id, user_id) AS user_id, title, status, version, primary_artist, artist_mode, spotify_artist_id, apple_artist_id, provider_status, provider_track_id, provider_isrc, provider_updated_at, provider_review_notes, provider_warning_notes, provider_validation_messages, provider_delivery_messages, featured_artists, content_type, primary_track_type, secondary_track_type, instrumental, remixer, author, composer, arranger, producer, p_line, production_year, publisher, genre, subgenre, secondary_genre, secondary_subgenre, price_tier, producer_catalogue_number, parental_advisory, preview_start, track_title_language, lyrics_language, metadata, audio_url, generate_isrc, isrc,
         explicit, lyrics, more_info, duration_sec, file_size_bytes, audio_format, track_number
       FROM tracks WHERE release_id = :releaseId ORDER BY track_number, created_at`,
      { releaseId },
    );
    const contributorRows = await this.db.query<{
      track_id: string | null;
      name: string;
      role: string;
    }>(
      `SELECT track_id, name, role
       FROM release_contributors
       WHERE release_id = :releaseId
         AND track_id IS NOT NULL
         AND role IN ('composer', 'lyricist', 'songwriter')`,
      { releaseId },
    );
    const contributorsByTrack = buildWriterParticipantMap(contributorRows);
    const musicRelease = mapReleaseAndTracksToMusicRelease({ release: releaseRow, tracks: trackRows });

    const mappedTracks = await Promise.all(musicRelease.audioFiles.map(async (audio) => {
      const mapped = mapMusicReleaseToDistribution({ release: musicRelease, trackId: audio.trackId }).track;
      const sourceTrack = trackRows.find((track) => track.id === audio.trackId);
      const resolvedAudio = await this.resolveDistributionAudioUrl(mapped.audioUrl);
      const writers = mergeWriterParticipants(
        sourceTrack?.composer ? [{ name: sourceTrack.composer, role: ["composer"] }] : [],
        contributorsByTrack.get(audio.trackId) ?? [],
      );
      const trackMetadata = normalizeTrackMetadata(sourceTrack?.metadata);
      return {
        ...mapped,
        status: sourceTrack?.status ?? null,
        artistMode: sourceTrack?.artist_mode ?? null,
        spotifyArtistId: sourceTrack?.spotify_artist_id ?? null,
        appleArtistId: sourceTrack?.apple_artist_id ?? null,
        providerStatus: sourceTrack?.provider_status ?? null,
        providerTrackId: sourceTrack?.provider_track_id ?? null,
        providerIsrc: sourceTrack?.provider_isrc ?? null,
        providerUpdatedAt: sourceTrack?.provider_updated_at ?? null,
        providerReviewNotes: sourceTrack?.provider_review_notes ?? null,
        providerWarningNotes: sourceTrack?.provider_warning_notes ?? null,
        providerValidationMessages: sourceTrack?.provider_validation_messages ?? null,
        providerDeliveryMessages: sourceTrack?.provider_delivery_messages ?? null,
        version: sourceTrack?.version ?? trackMetadata.version ?? null,
        contentType: sourceTrack?.content_type ?? trackMetadata.content_type ?? null,
        primaryTrackType: sourceTrack?.primary_track_type ?? trackMetadata.primary_track_type ?? null,
        secondaryTrackType: sourceTrack?.secondary_track_type ?? trackMetadata.secondary_track_type ?? null,
        instrumental: sourceTrack?.instrumental ?? Boolean(trackMetadata.instrumental),
        remixer: sourceTrack?.remixer ?? trackMetadata.remixer ?? null,
        author: sourceTrack?.author ?? trackMetadata.author ?? null,
        composer: sourceTrack?.composer ?? null,
        arranger: sourceTrack?.arranger ?? trackMetadata.arranger ?? null,
        producer: sourceTrack?.producer ?? trackMetadata.producer ?? null,
        pLine: sourceTrack?.p_line ?? trackMetadata.p_line ?? null,
        productionYear: sourceTrack?.production_year != null ? String(sourceTrack.production_year) : trackMetadata.production_year ?? null,
        publisher: sourceTrack?.publisher ?? trackMetadata.publisher ?? null,
        genre: sourceTrack?.genre ?? trackMetadata.genre ?? null,
        subgenre: sourceTrack?.subgenre ?? trackMetadata.subgenre ?? null,
        secondaryGenre: sourceTrack?.secondary_genre ?? trackMetadata.secondary_genre ?? null,
        secondarySubgenre: sourceTrack?.secondary_subgenre ?? trackMetadata.secondary_subgenre ?? null,
        priceTier: sourceTrack?.price_tier ?? trackMetadata.price_tier ?? null,
        producerCatalogueNumber: sourceTrack?.producer_catalogue_number ?? trackMetadata.producer_catalogue_number ?? null,
        parentalAdvisory: sourceTrack?.parental_advisory ?? trackMetadata.parental_advisory ?? null,
        previewStart: sourceTrack?.preview_start ?? nullableNumber(trackMetadata.preview_start),
        trackTitleLanguage: sourceTrack?.track_title_language ?? trackMetadata.track_title_language ?? null,
        lyricsLanguage: sourceTrack?.lyrics_language ?? trackMetadata.lyrics_language ?? null,
        lyrics: sourceTrack?.lyrics ?? null,
        moreInfo: sourceTrack?.more_info ?? trackMetadata.more_info ?? null,
        generateIsrc: resolveGenerateIsrc(sourceTrack?.generate_isrc, trackMetadata, sourceTrack?.isrc),
        writers: writers.length ? writers : undefined,
        audioUrl: resolvedAudio.signedAudioUrl ?? resolvedAudio.resolvedAudioUrl,
      };
    }));

    const releaseMetadata = normalizeReleaseMetadata(asRecordWithUnknown(releaseRow.metadata));
    const mappedRelease = mapMusicReleaseToDistribution({ release: musicRelease, trackId: musicRelease.audioFiles[0].trackId }).release;
    return {
      release: {
        ...mappedRelease,
        status: releaseRow.status,
        artistMode: releaseRow.artist_mode ?? null,
        spotifyArtistId: releaseRow.spotify_artist_id ?? null,
        appleArtistId: releaseRow.apple_artist_id ?? null,
        copyrightOwner: releaseRow.copyright_owner ?? releaseMetadata.copyright_owner ?? null,
        copyrightDeclared: releaseRow.copyright_declared ?? undefined,
        aiContentDeclared: releaseRow.ai_content_declared ?? undefined,
        rightsOwned: releaseRow.rights_owned ?? undefined,
        providerStatus: releaseRow.provider_status ?? null,
        distributionStatus: releaseRow.distribution_status ?? null,
        providerReleaseId: releaseRow.provider_release_id ?? null,
        providerUpdatedAt: releaseRow.provider_updated_at ?? null,
        providerReviewNotes: releaseRow.provider_review_notes ?? null,
        providerWarningNotes: releaseRow.provider_warning_notes ?? null,
        providerValidationMessages: releaseRow.provider_validation_messages ?? null,
        providerDeliveryMessages: releaseRow.provider_delivery_messages ?? null,
        version: releaseRow.version ?? releaseMetadata.version ?? null,
        featuredArtists: splitArtists(releaseRow.release_featured_artists ?? releaseMetadata.featured_artists),
        variousArtists: releaseRow.various_artists ?? Boolean(releaseMetadata.various_artists),
        originalReleaseDate: releaseRow.original_release_date ?? releaseMetadata.original_release_date ?? null,
        labelName: releaseRow.label_name ?? releaseMetadata.label_name ?? null,
        format: releaseRow.format ?? releaseMetadata.format ?? null,
        pLine: releaseRow.p_line ?? releaseMetadata.p_line ?? null,
        cLine: releaseRow.c_line ?? releaseMetadata.c_line ?? null,
        productionYear: releaseRow.production_year != null ? String(releaseRow.production_year) : releaseMetadata.production_year ?? null,
        producerCatalogueNumber: releaseRow.producer_catalogue_number ?? releaseMetadata.producer_catalogue_number ?? null,
      },
      tracks: mappedTracks,
    };
  }

  async getTrackWithRelease(trackId: string): Promise<{ release: DistributionRelease; track: DistributionTrack } | null> {
    const rows = await this.db.query<{
      release_id: string;
      release_user_id: string;
      release_artist_mode: string | null;
      release_spotify_artist_id: string | null;
      release_apple_artist_id: string | null;
      track_id: string;
      track_user_id: string;
      track_artist_mode: string | null;
      track_spotify_artist_id: string | null;
      track_apple_artist_id: string | null;
    }>(
      `SELECT r.id AS release_id, COALESCE(r.artist_id, r.user_id) AS release_user_id,
              r.artist_mode AS release_artist_mode, r.spotify_artist_id AS release_spotify_artist_id, r.apple_artist_id AS release_apple_artist_id,
              t.id AS track_id, COALESCE(t.artist_id, t.user_id) AS track_user_id,
              t.artist_mode AS track_artist_mode, t.spotify_artist_id AS track_spotify_artist_id, t.apple_artist_id AS track_apple_artist_id
       FROM tracks t
       JOIN releases r ON r.id = t.release_id
       WHERE t.id = :trackId
       LIMIT 1`,
      { trackId },
    );
    const row = rows[0];
    if (!row) return null;

    return {
      release: {
        id: row.release_id,
        userId: row.release_user_id,
        artistMode: row.release_artist_mode,
        spotifyArtistId: row.release_spotify_artist_id,
        appleArtistId: row.release_apple_artist_id,
      },
      track: {
        id: row.track_id,
        releaseId: row.release_id,
        userId: row.track_user_id,
        artistMode: row.track_artist_mode,
        spotifyArtistId: row.track_spotify_artist_id,
        appleArtistId: row.track_apple_artist_id,
      },
    };
  }

  async getJobPayload(job: DistributionJob): Promise<{ release: DistributionRelease; track: DistributionTrack } | null> {
    if (!job.releaseId || !job.trackId) return null;

    const rows = await this.db.query<{
      release_id: string;
      release_user_id: string;
      release_title: string;
      release_primary_artist: string;
      release_artist_mode: string | null;
      release_spotify_artist_id: string | null;
      release_apple_artist_id: string | null;
      release_date: string | null;
      original_release_date: string | null;
      genre: string | null;
      subgenre: string | null;
      release_featured_artists: string | null;
      version: string | null;
      various_artists: boolean | null;
      label_name: string | null;
      format: string | null;
      language: string | null;
      upc: string | null;
      copyright_owner: string | null;
      p_line: string | null;
      c_line: string | null;
      production_year: number | null;
      producer_catalogue_number: string | null;
      cover_art_url: string | null;
      release_type: string | null;
      release_status: string | null;
      release_created_at: string | null;
      track_id: string;
      track_user_id: string;
      track_title: string;
      track_version: string | null;
      track_primary_artist: string;
      track_artist_mode: string | null;
      track_spotify_artist_id: string | null;
      track_apple_artist_id: string | null;
      track_featured_artists: string | null;
      content_type: string | null;
      primary_track_type: string | null;
      secondary_track_type: string | null;
      instrumental: boolean | null;
      remixer: string | null;
      author: string | null;
      composer: string | null;
      arranger: string | null;
      producer: string | null;
      track_p_line: string | null;
      track_production_year: number | null;
      publisher: string | null;
      track_genre: string | null;
      track_subgenre: string | null;
      secondary_genre: string | null;
      secondary_subgenre: string | null;
      price_tier: string | null;
      track_producer_catalogue_number: string | null;
      parental_advisory: "none" | "explicit" | "clean" | null;
      preview_start: number | null;
      track_title_language: string | null;
      lyrics_language: string | null;
      audio_url: string | null;
      generate_isrc: boolean | null;
      isrc: string | null;
      explicit: boolean;
      lyrics: string | null;
      more_info: string | null;
      metadata: Record<string, unknown> | null;
      duration_sec: string | number | null;
      file_size_bytes: string | number | null;
      audio_format: string | null;
      track_number: number | null;
    }>(
      `SELECT
         r.id AS release_id,
         COALESCE(r.artist_id, r.user_id) AS release_user_id,
         r.title AS release_title,
         r.primary_artist AS release_primary_artist,
         r.artist_mode AS release_artist_mode,
         r.spotify_artist_id AS release_spotify_artist_id,
         r.apple_artist_id AS release_apple_artist_id,
         r.featured_artists AS release_featured_artists,
         r.version,
         r.various_artists,
         r.release_type,
         r.status AS release_status,
         r.created_at AS release_created_at,
         r.release_date,
         r.original_release_date,
         r.genre,
         r.subgenre,
         r.label_name,
         r.format,
         r.language,
         r.upc,
         r.copyright_owner,
         r.p_line,
         r.c_line,
         r.production_year,
         r.producer_catalogue_number,
         r.cover_art_url,
         t.id AS track_id,
         COALESCE(t.artist_id, t.user_id) AS track_user_id,
         t.title AS track_title,
         t.version AS track_version,
         t.primary_artist AS track_primary_artist,
         t.artist_mode AS track_artist_mode,
         t.spotify_artist_id AS track_spotify_artist_id,
         t.apple_artist_id AS track_apple_artist_id,
         t.featured_artists AS track_featured_artists,
         t.content_type,
         t.primary_track_type,
         t.secondary_track_type,
         t.instrumental,
         t.remixer,
         t.author,
         t.composer,
         t.arranger,
         t.producer,
         t.p_line AS track_p_line,
         t.production_year AS track_production_year,
         t.publisher,
         t.genre AS track_genre,
         t.subgenre AS track_subgenre,
         t.secondary_genre,
         t.secondary_subgenre,
         t.price_tier,
         t.producer_catalogue_number AS track_producer_catalogue_number,
         t.parental_advisory,
         t.preview_start,
         t.track_title_language,
         t.lyrics_language,
         t.audio_url,
         t.generate_isrc,
         t.isrc,
         t.explicit,
         t.lyrics,
         t.more_info,
         t.metadata,
         t.duration_sec,
         t.file_size_bytes,
         t.audio_format,
         t.track_number
       FROM distribution_jobs j
       JOIN releases r ON r.id = j.release_id
       JOIN tracks t ON t.id = j.track_id
       WHERE j.id = :jobId
       LIMIT 1`,
      { jobId: job.id },
    );

    const row = rows[0];
    if (!row) return null;
    const contributorRows = await this.db.query<{
      track_id: string | null;
      name: string;
      role: string;
    }>(
      `SELECT track_id, name, role
       FROM release_contributors
       WHERE release_id = :releaseId
         AND track_id = :trackId
         AND role IN ('composer', 'lyricist', 'songwriter')`,
      { releaseId: row.release_id, trackId: row.track_id },
    );

    const musicRelease = mapReleaseAndTracksToMusicRelease({
      release: {
        id: row.release_id,
        user_id: row.release_user_id,
        title: row.release_title,
        primary_artist: row.release_primary_artist,
        artist_mode: row.release_artist_mode,
        spotify_artist_id: row.release_spotify_artist_id,
        apple_artist_id: row.release_apple_artist_id,
        release_type: row.release_type,
        release_date: row.release_date,
        genre: row.genre,
        subgenre: row.subgenre,
        language: row.language,
        upc: row.upc,
        copyright_owner: row.copyright_owner,
        cover_art_url: row.cover_art_url,
        status: row.release_status,
        created_at: row.release_created_at,
      },
      tracks: [{
        id: row.track_id,
        release_id: row.release_id,
        user_id: row.track_user_id,
        title: row.track_title,
        primary_artist: row.track_primary_artist,
        artist_mode: row.track_artist_mode,
        spotify_artist_id: row.track_spotify_artist_id,
        apple_artist_id: row.track_apple_artist_id,
        featured_artists: row.track_featured_artists,
        composer: row.composer,
        audio_url: row.audio_url,
        generate_isrc: row.generate_isrc,
        isrc: row.isrc,
        explicit: row.explicit,
        lyrics: row.lyrics,
        more_info: row.more_info,
        metadata: row.metadata,
        duration_sec: row.duration_sec,
        file_size_bytes: row.file_size_bytes,
        audio_format: row.audio_format,
        track_number: row.track_number,
      }],
    });
      const mapped = mapMusicReleaseToDistribution({ release: musicRelease, trackId: row.track_id });
    const resolvedAudio = await this.resolveDistributionAudioUrl(mapped.track.audioUrl);
    const writers = mergeWriterParticipants(
      row.composer ? [{ name: row.composer, role: ["composer"] }] : [],
      buildWriterParticipantMap(contributorRows).get(row.track_id) ?? [],
    );
    const releaseMetadata = normalizeReleaseMetadata(asRecordWithUnknown(mapped.release.metadata));
    const trackMetadata = normalizeTrackMetadata(asRecordWithUnknown(row.metadata));
    return {
      release: {
        ...mapped.release,
        version: row.version ?? releaseMetadata.version ?? null,
        featuredArtists: splitArtists(row.release_featured_artists ?? releaseMetadata.featured_artists),
        variousArtists: row.various_artists ?? Boolean(releaseMetadata.various_artists),
        originalReleaseDate: row.original_release_date ?? releaseMetadata.original_release_date ?? null,
        labelName: row.label_name ?? releaseMetadata.label_name ?? null,
        format: row.format ?? releaseMetadata.format ?? null,
        pLine: row.p_line ?? releaseMetadata.p_line ?? null,
        cLine: row.c_line ?? releaseMetadata.c_line ?? null,
        productionYear: row.production_year != null ? String(row.production_year) : releaseMetadata.production_year ?? null,
        producerCatalogueNumber: row.producer_catalogue_number ?? releaseMetadata.producer_catalogue_number ?? null,
      },
      track: {
        ...mapped.track,
        version: row.track_version ?? trackMetadata.version ?? null,
        contentType: row.content_type ?? trackMetadata.content_type ?? null,
        primaryTrackType: row.primary_track_type ?? trackMetadata.primary_track_type ?? null,
        secondaryTrackType: row.secondary_track_type ?? trackMetadata.secondary_track_type ?? null,
        instrumental: row.instrumental ?? Boolean(trackMetadata.instrumental),
        remixer: row.remixer ?? trackMetadata.remixer ?? null,
        author: row.author ?? trackMetadata.author ?? null,
        composer: row.composer ?? null,
        arranger: row.arranger ?? trackMetadata.arranger ?? null,
        producer: row.producer ?? trackMetadata.producer ?? null,
        pLine: row.track_p_line ?? trackMetadata.p_line ?? null,
        productionYear: row.track_production_year != null ? String(row.track_production_year) : trackMetadata.production_year ?? null,
        publisher: row.publisher ?? trackMetadata.publisher ?? null,
        genre: row.track_genre ?? trackMetadata.genre ?? null,
        subgenre: row.track_subgenre ?? trackMetadata.subgenre ?? null,
        secondaryGenre: row.secondary_genre ?? trackMetadata.secondary_genre ?? null,
        secondarySubgenre: row.secondary_subgenre ?? trackMetadata.secondary_subgenre ?? null,
        priceTier: row.price_tier ?? trackMetadata.price_tier ?? null,
        producerCatalogueNumber: row.track_producer_catalogue_number ?? trackMetadata.producer_catalogue_number ?? null,
        parentalAdvisory: row.parental_advisory ?? trackMetadata.parental_advisory ?? null,
        previewStart: row.preview_start ?? nullableNumber(trackMetadata.preview_start),
        trackTitleLanguage: row.track_title_language ?? trackMetadata.track_title_language ?? null,
        lyricsLanguage: row.lyrics_language ?? trackMetadata.lyrics_language ?? null,
        lyrics: row.lyrics ?? null,
        moreInfo: row.more_info ?? trackMetadata.more_info ?? null,
        generateIsrc: resolveGenerateIsrc(row.generate_isrc, trackMetadata, row.isrc),
        writers: writers.length ? writers : undefined,
        audioUrl: resolvedAudio.signedAudioUrl ?? resolvedAudio.resolvedAudioUrl,
      },
    };
  }

  async ensurePlatformDelivery(input: {
    releaseId: string;
    trackId: string;
    userId: string;
    platform: DistributionPlatformName;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO platform_deliveries (release_id, track_id, user_id, platform, status)
       VALUES (:releaseId, :trackId, :userId, :platform, 'PENDING')
       ON CONFLICT (track_id, platform) WHERE track_id IS NOT NULL DO NOTHING`,
      input,
    );
  }

  async createDistributionJob(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<DistributionJob | null> {
    const rows = await this.db.query<{
      id: string;
      release_id: string;
      track_id: string;
      platform: DistributionPlatformName;
      status: DistributionJobStatus;
      created_at: string;
      attempts: number;
      next_retry_at: string | null;
    }>(
      `INSERT INTO distribution_jobs (release_id, track_id, platform, status)
       VALUES (:releaseId, :trackId, :platform, 'PENDING')
       ON CONFLICT (track_id, platform) DO NOTHING
       RETURNING id, release_id, track_id, platform, status, created_at, attempts, next_retry_at`,
      input,
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      releaseId: row.release_id,
      trackId: row.track_id,
      platform: row.platform,
      status: row.status,
      createdAt: new Date(row.created_at),
      attempts: row.attempts,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
    };
  }

  async getPendingJobs(limit: number): Promise<DistributionJob[]> {
    const rows = await this.db.query<{
      id: string;
      release_id: string;
      track_id: string;
      platform: DistributionPlatformName;
      status: DistributionJobStatus;
      created_at: string;
      attempts: number;
      next_retry_at: string | null;
    }>(
      `SELECT id, release_id, track_id, platform, status, created_at, attempts, next_retry_at
       FROM distribution_jobs
       WHERE status = 'PENDING'
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at
       LIMIT :limit`,
      { limit },
    );

    return rows.map((row) => ({
      id: row.id,
      releaseId: row.release_id,
      trackId: row.track_id,
      platform: row.platform,
      status: row.status,
      createdAt: new Date(row.created_at),
      attempts: row.attempts,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
    }));
  }

  async updateJobStatus(jobId: string, status: DistributionJobStatus): Promise<void> {
    await this.db.query(
      `UPDATE distribution_jobs
       SET status = :status, updated_at = now(), processed_at = CASE WHEN :status IN ('PUBLISHED', 'FAILED') THEN now() ELSE processed_at END
       WHERE id = :jobId`,
      { jobId, status },
    );
  }

  async isWebhookConfirmed(input: {
    releaseId: string;
    trackId: string;
    platform: DistributionPlatformName;
  }): Promise<boolean> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM distribution_state_history
       WHERE release_id = :releaseId
         AND track_id = :trackId
         AND platform = :platform
         AND source = 'WEBHOOK'
         AND next_status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DELIVERED', 'REJECTED')`,
      input,
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async updateDeliveryStatus(input: {
    releaseId: string;
    trackId?: string | null;
    platform: DistributionPlatformName;
    status: "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED";
  }): Promise<void> {
    await this.db.query(
      `UPDATE platform_deliveries
       SET status = :status, updated_at = now(), delivered_at = CASE WHEN :status = 'PUBLISHED' THEN now() ELSE delivered_at END
       WHERE release_id = :releaseId
         AND (:trackId IS NULL OR track_id = :trackId)
         AND platform = :platform`,
      input,
    );
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
    await this.db.query(
      `UPDATE platform_deliveries
       SET status = :status,
           platform_track_id = :platformTrackId,
           raw_response = CAST(:rawResponse AS jsonb),
           error_code = :errorCode,
           error_message = :errorMessage,
           retryable = :retryable,
           delivered_at = CASE WHEN :status = 'PUBLISHED' THEN now() ELSE delivered_at END,
           updated_at = now()
       WHERE release_id = :releaseId AND track_id = :trackId AND platform = :platform`,
      {
        releaseId: input.releaseId,
        trackId: input.trackId,
        platform: input.platform,
        status: input.status,
        platformTrackId: input.platformTrackId ?? null,
        rawResponse: JSON.stringify(input.rawResponse ?? null),
        errorCode: input.error?.errorCode ?? null,
        errorMessage: input.error?.message ?? null,
        retryable: input.error?.retryable ?? null,
      },
    );

    await this.db.query(
      `UPDATE distribution_jobs
       SET api_request = CAST(:apiRequest AS jsonb),
           api_response = CAST(:apiResponse AS jsonb),
           failure_reason = :failureReason,
           retry_count = CASE WHEN :status = 'FAILED' THEN retry_count + 1 ELSE retry_count END,
           updated_at = now()
       WHERE release_id = :releaseId AND track_id = :trackId AND platform = :platform`,
      {
        releaseId: input.releaseId,
        trackId: input.trackId,
        platform: input.platform,
        status: input.status,
        apiRequest: JSON.stringify(extractApiRequest(input.rawResponse)),
        apiResponse: JSON.stringify(extractApiResponse(input.rawResponse)),
        failureReason: input.error?.message ?? null,
      },
    );

    await this.db.query(
      `INSERT INTO distribution_sync_logs (
         provider, release_id, track_id, sync_type, status, api_request, api_response, failure_reason, retry_count
       ) VALUES (
         'too_lost', :releaseId, :trackId, 'DELIVERY_RESULT', :status,
         CAST(:apiRequest AS jsonb), CAST(:apiResponse AS jsonb), :failureReason,
         CASE WHEN :status = 'FAILED' THEN 1 ELSE 0 END
       )`,
      {
        releaseId: input.releaseId,
        trackId: input.trackId,
        status: input.status,
        apiRequest: JSON.stringify(extractApiRequest(input.rawResponse)),
        apiResponse: JSON.stringify(extractApiResponse(input.rawResponse)),
        failureReason: input.error?.message ?? null,
      },
    );
  }

  private mapRelease(row: {
    id: string;
    user_id: string;
    title?: string;
    primary_artist?: string;
    release_date?: string | null;
    genre?: string | null;
    language?: string | null;
    cover_art_url?: string | null;
    upc?: string | null;
    copyright_owner?: string | null;
  }): DistributionRelease {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      primaryArtist: row.primary_artist,
      releaseDate: row.release_date,
      genre: row.genre,
      language: row.language,
      upc: row.upc,
      copyright: row.copyright_owner,
      coverArtUrl: row.cover_art_url,
    };
  }
}

function asRecordWithUnknown(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" ? value : {};
}

type DistributionReleaseMetadata = Readonly<Record<string, unknown>> & {
  release_metadata?: DistributionReleaseMetadata | null;
  copyright_owner?: string | null;
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
  preview_start?: string | number | null;
  track_title_language?: string | null;
  lyrics_language?: string | null;
  lyrics?: string | null;
  more_info?: string | null;
  generate_isrc?: boolean | null;
};

function normalizeReleaseMetadata(value: Record<string, unknown> | null | undefined): DistributionReleaseMetadata {
  const metadata = asRecordWithUnknown(value);
  const nested = metadata.release_metadata;
  return nested && typeof nested === "object" ? nested as DistributionReleaseMetadata : metadata as DistributionReleaseMetadata;
}

function normalizeTrackMetadata(value: Record<string, unknown> | null | undefined): DistributionTrackMetadata {
  return asRecordWithUnknown(value) as DistributionTrackMetadata;
}

function splitArtists(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
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
  if (typeof metadata.generate_isrc === "boolean") return metadata.generate_isrc;
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

function buildWriterParticipantMap(rows: Array<{ track_id: string | null; name: string; role: string }>): Map<string, DistributionParticipant[]> {
  const entries = new Map<string, DistributionParticipant[]>();
  for (const row of rows) {
    if (!row.track_id || !row.name?.trim()) continue;
    const current = entries.get(row.track_id) ?? [];
    current.push({ name: row.name.trim(), role: [row.role] });
    entries.set(row.track_id, mergeWriterParticipants(current));
  }
  return entries;
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
