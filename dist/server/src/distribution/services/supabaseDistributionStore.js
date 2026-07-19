import { resolveDistributionAudioUrl } from "./distributionMediaResolver.js";
export class SupabaseDistributionStore {
    client;
    constructor(client) {
        this.client = client;
    }
    async getReleaseWithTracks(releaseId) {
        const { data: release, error: releaseError } = await this.client
            .from("releases")
            .select("*")
            .eq("id", releaseId)
            .maybeSingle();
        if (releaseError)
            throw new Error(`Failed to read release ${releaseId}: ${releaseError.message}`);
        if (!release)
            return null;
        const { data: tracks, error: tracksError } = await this.client
            .from("tracks")
            .select("*")
            .eq("release_id", releaseId)
            .order("track_number", { ascending: true });
        if (tracksError)
            throw new Error(`Failed to read tracks for release ${releaseId}: ${tracksError.message}`);
        const releaseRow = release;
        const trackRows = (tracks || []);
        const writersByTrack = await this.loadWriterContributorsByTrack(releaseId, trackRows.map((track) => track.id));
        return {
            release: this.mapRelease(releaseRow),
            tracks: await Promise.all(trackRows.map((track) => this.mapTrack(track, writersByTrack.get(track.id) ?? []))),
        };
    }
    async getTrackWithRelease(trackId) {
        const { data: track, error: trackError } = await this.client
            .from("tracks")
            .select("*")
            .eq("id", trackId)
            .maybeSingle();
        if (trackError)
            throw new Error(`Failed to read track ${trackId}: ${trackError.message}`);
        if (!track)
            return null;
        const { data: release, error: releaseError } = await this.client
            .from("releases")
            .select("*")
            .eq("id", track.release_id)
            .maybeSingle();
        if (releaseError)
            throw new Error(`Failed to read release ${track.release_id}: ${releaseError.message}`);
        if (!release)
            return null;
        const trackRow = track;
        const releaseRow = release;
        const writersByTrack = await this.loadWriterContributorsByTrack(trackRow.release_id, [trackRow.id]);
        return { release: this.mapRelease(releaseRow), track: await this.mapTrack(trackRow, writersByTrack.get(trackRow.id) ?? []) };
    }
    async getJobPayload(job) {
        if (!job.trackId)
            return null;
        return this.getTrackWithRelease(job.trackId);
    }
    async ensurePlatformDelivery(input) {
        const { error } = await this.client
            .from("platform_deliveries")
            .upsert({
            release_id: input.releaseId,
            track_id: input.trackId,
            user_id: input.userId,
            platform: input.platform,
            status: "PENDING",
        }, { onConflict: "track_id,platform", ignoreDuplicates: true });
        if (error)
            throw new Error(`Failed to ensure platform delivery: ${error.message}`);
    }
    async createDistributionJob(input) {
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
        if (error)
            throw new Error(`Failed to create distribution job: ${error.message}`);
        return data ? this.mapJob(data) : null;
    }
    async getPendingJobs(limit) {
        const { data, error } = await this.client
            .from("distribution_jobs")
            .select("*")
            .eq("status", "PENDING")
            .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
            .order("created_at", { ascending: true })
            .limit(limit);
        if (error)
            throw new Error(`Failed to read pending distribution jobs: ${error.message}`);
        return (data || []).map((row) => this.mapJob(row));
    }
    async updateJobStatus(jobId, status) {
        const patch = { status, updated_at: new Date().toISOString() };
        if (["PUBLISHED", "FAILED", "DELIVERED", "REJECTED", "DEAD_LETTER"].includes(status)) {
            patch.processed_at = new Date().toISOString();
        }
        const { error } = await this.client.from("distribution_jobs").update(patch).eq("id", jobId);
        if (error)
            throw new Error(`Failed to update distribution job ${jobId}: ${error.message}`);
    }
    async updateDeliveryStatus(input) {
        const patch = { status: input.status, updated_at: new Date().toISOString() };
        if (input.status === "PUBLISHED")
            patch.delivered_at = new Date().toISOString();
        let query = this.client
            .from("platform_deliveries")
            .update(patch)
            .eq("release_id", input.releaseId)
            .eq("platform", input.platform);
        query = input.trackId ? query.eq("track_id", input.trackId) : query;
        const { error } = await query;
        if (error)
            throw new Error(`Failed to update delivery status: ${error.message}`);
    }
    async recordDeliveryResult(input) {
        const patch = {
            status: input.status,
            platform_track_id: input.platformTrackId ?? null,
            raw_response: input.rawResponse ?? null,
            error_code: input.error?.errorCode ?? null,
            error_message: input.error?.message ?? null,
            retryable: input.error?.retryable ?? null,
            updated_at: new Date().toISOString(),
        };
        if (input.status === "PUBLISHED")
            patch.delivered_at = new Date().toISOString();
        const { error } = await this.client
            .from("platform_deliveries")
            .update(patch)
            .eq("release_id", input.releaseId)
            .eq("track_id", input.trackId)
            .eq("platform", input.platform);
        if (error)
            throw new Error(`Failed to record delivery result: ${error.message}`);
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
        if (jobError)
            throw new Error(`Failed to persist distribution API audit fields: ${jobError.message}`);
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
    async isWebhookConfirmed(input) {
        const { data, error } = await this.client
            .from("distribution_state_history")
            .select("id")
            .eq("release_id", input.releaseId)
            .eq("track_id", input.trackId)
            .eq("platform", input.platform)
            .eq("source", "WEBHOOK")
            .in("next_status", ["SUBMITTED", "IN_REVIEW", "APPROVED", "DELIVERED", "REJECTED"])
            .limit(1);
        if (error)
            throw new Error(`Failed to check webhook state: ${error.message}`);
        return Boolean(data?.length);
    }
    async mapTrack(row, contributors = []) {
        const resolvedAudio = await resolveDistributionAudioUrl(row.audio_url, this.client);
        const writers = mergeWriterParticipants(row.composer ? [{ name: row.composer, role: ["composer"] }] : [], contributors);
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
    mapRelease(row) {
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
    mapJob(row) {
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
    async audit(input) {
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
    async loadWriterContributorsByTrack(releaseId, trackIds) {
        if (!trackIds.length)
            return new Map();
        const { data, error } = await this.client
            .from("release_contributors")
            .select("track_id,name,role")
            .eq("release_id", releaseId)
            .in("track_id", trackIds)
            .in("role", ["composer", "songwriter"]);
        if (error)
            throw new Error(`Failed to read release contributors for ${releaseId}: ${error.message}`);
        const writersByTrack = new Map();
        for (const row of data || []) {
            if (!row.track_id || !row.name?.trim())
                continue;
            const current = writersByTrack.get(row.track_id) ?? [];
            current.push({ name: row.name.trim(), role: [row.role] });
            writersByTrack.set(row.track_id, mergeWriterParticipants(current));
        }
        return writersByTrack;
    }
}
function splitArtists(value) {
    return String(value || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}
function normalizeReleaseMetadata(value) {
    if (!value || typeof value !== "object")
        return {};
    const nested = value.release_metadata;
    return nested && typeof nested === "object" ? nested : value;
}
function normalizeTrackMetadata(value) {
    return value && typeof value === "object" ? value : {};
}
function nullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function resolveGenerateIsrc(value, metadata, isrc) {
    if (typeof value === "boolean")
        return value;
    if (typeof metadata.generate_isrc === "boolean")
        return metadata.generate_isrc;
    return !String(isrc || "").trim();
}
function extractApiRequest(value) {
    if (value && typeof value === "object" && "payload" in value)
        return value.payload ?? {};
    return {};
}
function extractApiResponse(value) {
    if (!value || typeof value !== "object")
        return value ?? {};
    const { payload: _payload, ...response } = value;
    return response;
}
function mergeWriterParticipants(...groups) {
    const merged = new Map();
    for (const group of groups) {
        for (const participant of group) {
            const name = participant.name?.trim();
            if (!name)
                continue;
            const key = name.toLowerCase();
            const roles = merged.get(key) ?? new Set();
            for (const role of participant.role ?? []) {
                const normalizedRole = String(role || "").trim();
                if (normalizedRole)
                    roles.add(normalizedRole);
            }
            merged.set(key, roles);
        }
    }
    return [...merged.entries()].map(([key, roles]) => ({
        name: [...groups.flatMap((group) => group)].find((participant) => participant.name.trim().toLowerCase() === key)?.name ?? key,
        role: [...roles],
    }));
}
