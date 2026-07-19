import { mkdtemp } from "node:fs/promises";
import { mapProviderStatus } from "../../intelligence/index.js";
import { rethrowTooLostStageError } from "./tooLostError.js";
import { createTooLostOAuthAuthorizationUrl, exchangeTooLostOAuthCode, TOO_LOST_APPROVED_SCOPES, } from "./tooLostOAuth.js";
import { logger } from "../../../observability/logger.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
export class TooLostIntegrationService {
    store;
    db;
    config;
    httpClient;
    credentials;
    api;
    intelligence;
    ffmpeg;
    resolveAudioUrl;
    log = logger.child({ component: "too-lost-integration" });
    constructor(store, db, options) {
        this.store = store;
        this.db = db;
        this.config = options.config;
        this.httpClient = options.httpClient;
        this.credentials = options.credentialStore;
        this.api = options.api;
        this.intelligence = options.intelligence;
        this.ffmpeg = options.ffmpeg;
        this.resolveAudioUrl = options.resolveAudioUrl;
    }
    buildAuthorizationUrl(input = {}) {
        return createTooLostOAuthAuthorizationUrl({
            config: this.config,
            scopes: [...TOO_LOST_APPROVED_SCOPES],
            returnToPath: sanitizeReturnToPath(input.returnToPath),
        });
    }
    async handleOAuthCallback(input) {
        const oauthState = await this.credentials.loadOAuthState(input.state);
        if (!oauthState) {
            throw httpError(400, "INVALID_STATE", "Too Lost OAuth state is invalid or expired.");
        }
        const token = await exchangeTooLostOAuthCode({
            code: input.code,
            codeVerifier: oauthState.codeVerifier,
            config: this.config,
            httpClient: this.httpClient,
        });
        let profile;
        try {
            profile = await this.fetchAccountProfile(token);
        }
        catch (error) {
            try {
                await this.credentials.recordSandboxRun({
                    runType: "oauth",
                    status: "WARN",
                    request: { callback: true, state: input.state, tokenVerification: "GET /me" },
                    response: { error: serializeError(error) },
                    notes: "Too Lost OAuth token verification via GET /me failed.",
                });
            }
            catch {
                // Best effort only; preserve the OAuth failure.
            }
            throw error;
        }
        await this.credentials.storeTokenSet(token, {
            connectedAccountId: profile?.id ?? null,
            connectedAccountName: profile?.name ?? profile?.display_name ?? profile?.account_name ?? null,
            connectedAccountEmail: profile?.email ?? null,
        });
        await this.credentials.markOAuthStateCompleted(input.state);
        await this.credentials.updateProviderSyncStatus({
            syncStatus: "connected",
            lastSyncAt: new Date().toISOString(),
            isEnabled: true,
        });
        void this.refreshStatusCache("oauth_callback");
        await this.credentials.recordSandboxRun({
            runType: "oauth",
            status: "PASS",
            request: { callback: true, state: input.state },
            response: { connectedAccount: profile ?? null, tokenVerifiedViaMe: Boolean(profile) },
            notes: profile ? "Live OAuth callback completed and token verified via GET /me." : "Live OAuth callback completed.",
        });
        return {
            connection: await this.credentials.getConnectionStatus(),
            redirectTo: sanitizeReturnToPath(oauthState.returnToPath) ?? "/dashboard",
        };
    }
    async disconnect(reason = "Disconnected by operator") {
        try {
            await this.credentials.clearConnection(reason);
        }
        catch (error) {
            rethrowTooLostStageError("TooLostIntegrationService.disconnect.clearConnection", error);
        }
        try {
            await this.credentials.recordSandboxRun({
                runType: "failure_recovery",
                status: "PASS",
                request: { action: "disconnect" },
                response: { ok: true },
                notes: reason,
            });
        }
        catch (error) {
            rethrowTooLostStageError("TooLostIntegrationService.disconnect.recordSandboxRun", error);
        }
        try {
            void this.refreshStatusCache("disconnect");
            return await this.credentials.getConnectionStatus();
        }
        catch (error) {
            rethrowTooLostStageError("TooLostIntegrationService.disconnect.getConnectionStatus", error);
        }
    }
    async getStatus() {
        try {
            return await this.credentials.getConnectionStatus();
        }
        catch (error) {
            rethrowTooLostStageError("TooLostIntegrationService.getStatus", error);
        }
    }
    async submitRelease(releaseId) {
        const payload = await this.buildReleasePayload(releaseId);
        await this.validateReleaseIdentifiers(payload);
        const createResponse = await this.api.requestJson("/releases", {
            method: "POST",
            body: JSON.stringify(payload.release),
        });
        const externalReleaseId = parseExternalReleaseId(createResponse) ?? releaseId;
        await this.updateReleaseMetadata(externalReleaseId, payload);
        await this.uploadReleaseArtwork(externalReleaseId, payload);
        const trackPayload = await this.uploadReleaseTracks(externalReleaseId, payload);
        const trackResponse = await this.putReleaseTrackList(externalReleaseId, trackPayload);
        const submitResponse = await this.api.requestJson(`/releases/${encodeURIComponent(externalReleaseId)}/submit`, {
            method: "POST",
            body: JSON.stringify({ acceptTerms: true, confirmRights: true }),
        });
        await this.persistSubmission(releaseId, externalReleaseId, payload, trackResponse, submitResponse);
        await this.credentials.updateProviderSyncStatus({
            syncStatus: "connected",
            lastSyncAt: new Date().toISOString(),
            isEnabled: true,
        });
        return {
            release: await this.fetchReleaseStatus(releaseId),
            request: payload,
            response: submitResponse,
            externalReleaseId,
        };
    }
    async updateRelease(releaseId) {
        const snapshot = await this.fetchReleaseStatus(releaseId);
        const release = await this.store.getReleaseWithTracks(releaseId);
        if (!release) {
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${releaseId} was not found.`);
        }
        if (!snapshot.providerReleaseId) {
            return { release: snapshot, updated: false, reason: "Too Lost release identifier unavailable." };
        }
        const payload = buildReleasePayload({
            release: release.release,
            tracks: release.tracks,
            contributors: await this.db.query(`SELECT track_id, name, role
         FROM release_contributors
         WHERE release_id = :releaseId`, { releaseId }),
            dspTargets: this.config.dspTargets,
        });
        await this.updateReleaseMetadata(snapshot.providerReleaseId, payload);
        return { release: snapshot, updated: true, reason: "Too Lost release metadata updated." };
    }
    async syncReleaseByLocalReleaseId(releaseId) {
        const local = await this.readLocalReleaseSyncContext({ releaseId });
        if (!local) {
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${releaseId} was not found.`);
        }
        const providerReleaseId = local.provider_release_id ?? releaseId;
        return this.syncReleaseByProviderReleaseId(providerReleaseId, {
            localReleaseId: local.id,
            source: "MANUAL_REFRESH",
        });
    }
    async syncReleaseByProviderReleaseId(providerReleaseId, input) {
        const local = await this.readLocalReleaseSyncContext({
            releaseId: input.localReleaseId ?? null,
            providerReleaseId,
        });
        if (!local) {
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${providerReleaseId} was not found.`);
        }
        const currentSnapshot = await this.fetchReleaseStatus(local.id);
        const syncTimestamp = new Date().toISOString();
        let providerBody;
        try {
            providerBody = await this.api.requestJson(`/releases/${encodeURIComponent(providerReleaseId)}`, { method: "GET" });
        }
        catch (error) {
            await this.credentials.recordSyncLog({
                syncType: `RELEASE_SYNC_${input.source}`,
                status: "FAIL",
                releaseId: local.id,
                request: { providerReleaseId, source: input.source },
                response: { error: serializeError(error) },
                failureReason: error instanceof Error ? error.message : String(error),
            });
            return {
                release: currentSnapshot,
                updated: false,
                reason: error instanceof Error ? error.message : String(error),
            };
        }
        const parsed = normalizeTooLostReleaseSyncPayload(providerBody);
        const normalizedProviderStatus = normalizeTooLostProviderStatus(parsed.status ?? currentSnapshot.providerStatus ?? local.provider_status ?? null);
        const nextReleaseStatus = mapTooLostProviderReleaseStatus(normalizedProviderStatus);
        if (local.provider_status === normalizedProviderStatus) {
            await this.credentials.recordSyncLog({
                syncType: `RELEASE_SYNC_${input.source}`,
                status: "SKIPPED",
                releaseId: local.id,
                request: { providerReleaseId, source: input.source },
                response: {
                    provider_release_id: providerReleaseId,
                    provider_status: normalizedProviderStatus,
                    reason: "Provider status unchanged.",
                },
            });
            return {
                release: currentSnapshot,
                updated: false,
                reason: "Provider status unchanged.",
            };
        }
        const providerUpdatedAt = parsed.updatedAt ?? syncTimestamp;
        const changedFields = [];
        await this.db.query(`UPDATE releases
       SET status = :status::public.release_status,
           provider_status = :providerStatus,
           distribution_status = :distributionStatus,
           provider_release_id = :providerReleaseId,
           provider_updated_at = :providerUpdatedAt::timestamptz,
           last_synced_at = :lastSyncedAt::timestamptz,
           updated_at = now()
       WHERE id = :releaseId`, {
            releaseId: local.id,
            status: nextReleaseStatus,
            providerStatus: normalizedProviderStatus,
            distributionStatus: mapTooLostProviderToDistributionStatus(normalizedProviderStatus),
            providerReleaseId,
            providerUpdatedAt,
            lastSyncedAt: syncTimestamp,
        });
        changedFields.push("releases.status", "releases.provider_status", "releases.distribution_status", "releases.provider_updated_at", "releases.last_synced_at");
        const localTracks = await this.readLocalTrackSyncTargets(local.id);
        await this.syncLocalTracks(local.id, localTracks, parsed, syncTimestamp, changedFields);
        await this.syncLocalDeliveries(local.id, localTracks, parsed, syncTimestamp, changedFields);
        await this.syncLocalJobs(local.id, localTracks, parsed, providerReleaseId, syncTimestamp, changedFields);
        await this.syncLocalReleaseAudit(local.id, parsed, providerReleaseId, syncTimestamp, changedFields);
        const updatedSnapshot = await this.fetchReleaseStatus(local.id);
        await this.credentials.recordSyncLog({
            syncType: `RELEASE_SYNC_${input.source}`,
            status: "PASS",
            releaseId: local.id,
            request: { providerReleaseId, source: input.source },
            response: {
                provider_release_id: providerReleaseId,
                provider_status: normalizedProviderStatus,
                release_status: nextReleaseStatus,
                distribution_status: mapTooLostProviderToDistributionStatus(normalizedProviderStatus),
                provider_updated_at: providerUpdatedAt,
                changed_fields: changedFields,
                raw_response: redact(providerBody),
            },
        });
        await this.intelligence.appendStateHistory({
            releaseId: local.id,
            trackId: null,
            platform: "too_lost",
            previousStatus: mapProviderStatus(local.provider_status ?? "pending"),
            nextStatus: mapProviderStatus(normalizedProviderStatus),
            source: input.source === "WEBHOOK" ? "WEBHOOK" : "WORKER",
            eventId: `too_lost:release:${providerReleaseId}:${providerUpdatedAt}`,
            metadata: {
                provider_release_id: providerReleaseId,
                provider_status: normalizedProviderStatus,
                release_status: nextReleaseStatus,
                distribution_status: mapTooLostProviderToDistributionStatus(normalizedProviderStatus),
            },
        });
        return {
            release: updatedSnapshot,
            updated: true,
            reason: "Too Lost release synchronized.",
        };
    }
    async fetchReleaseStatus(releaseId) {
        const rows = await this.db.query(`SELECT
         r.id::text AS release_id,
         r.title AS release_title,
         r.status AS release_status,
         r.provider_status,
         r.distribution_status,
         r.provider_release_id,
         j.status AS job_status,
         j.provider_job_id,
         pd.status AS delivery_status,
         t.id::text AS track_id,
         t.title AS track_title,
         GREATEST(COALESCE(j.updated_at, t.updated_at, r.updated_at), COALESCE(pd.updated_at, r.updated_at)) AS updated_at
       FROM releases r
       LEFT JOIN tracks t ON t.release_id = r.id
       LEFT JOIN distribution_jobs j ON j.release_id = r.id AND j.track_id = t.id AND j.provider = 'too_lost'
       LEFT JOIN platform_deliveries pd ON pd.release_id = r.id AND pd.track_id = t.id AND pd.platform = 'too_lost'
       WHERE r.id = :releaseId
       ORDER BY t.track_number ASC NULLS LAST, t.created_at ASC`, { releaseId });
        if (!rows.length)
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${releaseId} was not found.`);
        const first = rows[0];
        return {
            releaseId: first.release_id,
            releaseTitle: first.release_title,
            releaseStatus: normalizeReleaseStatus(first.release_status),
            providerStatus: normalizeProviderStatus(first.provider_status ?? deriveProviderStatus(rows, first.release_status)),
            distributionStatus: normalizeProviderStatus(first.distribution_status ?? deriveDistributionStatus(rows, first.release_status)),
            providerReleaseId: first.provider_release_id ?? first.provider_job_id ?? null,
            trackStatuses: rows.map((row) => ({
                trackId: row.track_id,
                title: row.track_title,
                jobStatus: row.job_status,
                deliveryStatus: row.delivery_status,
                providerTrackId: row.provider_job_id ?? null,
                updatedAt: row.updated_at,
            })),
        };
    }
    async fetchDistributionStatus(releaseId) {
        return this.fetchReleaseStatus(releaseId);
    }
    async listLookup(resource) {
        return this.api.requestJson(`/lookup/${resource}`, { method: "GET" });
    }
    async getPreferences(resource) {
        return this.api.requestJson(`/preferences/${resource}`, { method: "GET" });
    }
    async getSales(resource, query = {}) {
        return this.api.requestJson(`/sales/${resource}${buildQuery(query)}`, { method: "GET" });
    }
    async getAnalytics(resource, query = {}) {
        return this.api.requestJson(`/analytics/${resource}${buildQuery(query)}`, { method: "GET" });
    }
    async getProfile() {
        return this.api.requestJson("/me", { method: "GET" });
    }
    async createReleaseProxy(body) {
        return this.api.requestJson("/releases", {
            method: "POST",
            body: JSON.stringify(normalizeReleaseCreateRequest(body)),
        });
    }
    async patchReleaseMetadataProxy(releaseId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/metadata`, {
            method: "PATCH",
            body: JSON.stringify(normalizeReleaseMetadataRequest(body)),
        });
    }
    async uploadTrackUploadUrl(releaseId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/tracks/upload-url`, { method: "POST", body: JSON.stringify(normalizeTrackUploadRequest(body)) });
    }
    async putReleaseTrackList(releaseId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/tracks`, {
            method: "PUT",
            body: JSON.stringify(normalizeTrackListRequest(body)),
        });
    }
    async patchTrackMetadataProxy(releaseId, trackId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/tracks/${encodeURIComponent(trackId)}/metadata`, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    }
    async patchTrackFileProxy(releaseId, trackId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/tracks/${encodeURIComponent(trackId)}/file`, {
            method: "PATCH",
            body: JSON.stringify(normalizeTrackFileRequest(body)),
        });
    }
    async patchReleaseDelivery(releaseId, body) {
        return this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/delivery`, { method: "PATCH", body: JSON.stringify(body) });
    }
    async validateReleaseProxy(releaseId, body = {}) {
        void body;
        const release = await this.store.getReleaseWithTracks(releaseId);
        if (!release) {
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${releaseId} was not found.`);
        }
        return buildImplicitValidationResult(releaseId, release.tracks.length);
    }
    async uploadArtworkProxy(releaseId, body) {
        return this.patchReleaseMetadataProxy(releaseId, normalizeArtworkMetadata(body));
    }
    async updateReleaseMetadata(releaseId, payload) {
        return this.patchReleaseMetadataProxy(releaseId, {
            title: payload.release.title,
            version: payload.release.version,
            primaryArtist: payload.release.primaryArtist,
            featuringArtists: payload.release.featuringArtists,
            variousArtists: payload.release.variousArtists,
            label: payload.release.label,
            primaryGenre: payload.release.primaryGenre,
            subGenre: payload.release.subGenre,
            language: payload.release.language,
            upc: payload.release.upc,
            releaseDate: payload.release.releaseDate,
            originalReleaseDate: payload.release.originalReleaseDate,
            coverUrl: payload.release.coverUrl,
            format: payload.release.format,
            producerCatalogueNumber: payload.release.producerCatalogueNumber,
            cYear: payload.release.cYear,
            cLine: payload.release.cLine,
            pYear: payload.release.pYear,
            pLine: payload.release.pLine,
        });
    }
    async uploadReleaseArtwork(releaseId, payload) {
        if (!payload.release.coverUrl)
            return null;
        return this.patchReleaseMetadataProxy(releaseId, { coverUrl: payload.release.coverUrl });
    }
    async uploadReleaseTracks(releaseId, payload) {
        const tracks = [];
        for (let index = 0; index < payload.tracks.length; index += 1) {
            const track = payload.tracks[index];
            const sourceUrl = track.audioFile.url;
            let audioFileKey = null;
            if (!sourceUrl) {
                tracks.push(buildTrackPayloadEntry(track, null));
                continue;
            }
            const source = await fetch(sourceUrl);
            if (!source.ok) {
                throw new Error(`Failed to fetch track source: ${source.status} ${source.statusText}`);
            }
            this.log.info("Too Lost audio source downloaded", {
                releaseId,
                trackId: track.title,
                sourceUrl,
                sourceContentType: source.headers.get("content-type"),
            });
            const uploadUrlResponse = await this.api.requestJson(`/releases/${encodeURIComponent(releaseId)}/tracks/upload-url`, {
                method: "POST",
                body: JSON.stringify({
                    kind: "audio",
                    fileName: track.audioFile.filename,
                    contentType: track.audioFile.uploadContentType,
                }),
            });
            const uploadUrl = extractUploadUrl(uploadUrlResponse);
            audioFileKey = extractFileKey(uploadUrlResponse);
            if (!audioFileKey) {
                throw new Error("Too Lost upload URL response did not include a fileKey.");
            }
            if (!uploadUrl) {
                tracks.push(buildTrackPayloadEntry(track, audioFileKey));
                continue;
            }
            const audioBlob = await source.blob();
            const flacBlob = await this.ensureFlacBlob(audioBlob, track.id, releaseId, track.title);
            const uploadResponse = await this.api.uploadBinary(uploadUrl, flacBlob, {
                "Content-Type": track.audioFile.uploadContentType,
            });
            if (!uploadResponse.ok) {
                throw new Error(`Track upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
            }
            tracks.push(buildTrackPayloadEntry(track, audioFileKey));
        }
        return { tracks };
    }
    async persistReleaseLifecycleStatus(releaseId, desiredStatus) {
        const candidates = legacyReleaseStatus(desiredStatus);
        for (const status of candidates) {
            try {
                await this.db.query(`UPDATE releases
           SET status = :status::public.release_status,
               submitted_at = COALESCE(submitted_at, now()),
               updated_at = now()
           WHERE id = :releaseId`, { releaseId, status });
                return;
            }
            catch (error) {
                if (status !== candidates[candidates.length - 1])
                    continue;
                throw error;
            }
        }
    }
    async persistReleaseSubmissionState(input) {
        await this.db.query(`UPDATE releases
       SET status = :status::public.release_status,
           provider_status = :providerStatus,
           distribution_status = :distributionStatus,
           submitted_at = :submittedAt::timestamptz,
           provider_release_id = :providerReleaseId,
           provider_updated_at = :lastSyncedAt::timestamptz,
           last_synced_at = :lastSyncedAt::timestamptz,
           updated_at = now()
       WHERE id = :releaseId`, {
            releaseId: input.releaseId,
            providerReleaseId: input.providerReleaseId,
            status: input.status,
            distributionStatus: input.distributionStatus,
            providerStatus: input.providerStatus,
            submittedAt: input.submittedAt,
            lastSyncedAt: input.lastSyncedAt,
        });
    }
    async readLocalReleaseSyncContext(input) {
        const rows = await this.db.query(`SELECT id, provider_release_id, provider_status, distribution_status, status, last_synced_at, provider_updated_at
       FROM releases
       WHERE (:releaseId IS NOT NULL AND id = :releaseId)
          OR (:providerReleaseId IS NOT NULL AND provider_release_id = :providerReleaseId)
       ORDER BY updated_at DESC
       LIMIT 1`, { releaseId: input.releaseId ?? null, providerReleaseId: input.providerReleaseId ?? null });
        return rows[0] ?? null;
    }
    async readLocalTrackSyncTargets(releaseId) {
        const rows = await this.db.query(`SELECT id, provider_track_id
       FROM tracks
       WHERE release_id = :releaseId
       ORDER BY track_number ASC, created_at ASC`, { releaseId });
        return rows;
    }
    async syncLocalReleaseAudit(releaseId, parsed, providerReleaseId, syncTimestamp, changedFields) {
        const releaseNotes = uniqueStrings([
            ...parsed.reviewNotes,
            ...parsed.warnings,
            ...parsed.validationMessages,
            ...parsed.deliveryMessages,
            parsed.rejectionReason ?? "",
        ]);
        await this.db.query(`UPDATE releases
       SET admin_notes = CASE
             WHEN :adminNotes::text IS NOT NULL THEN :adminNotes::text
             ELSE admin_notes
           END,
           provider_review_notes = COALESCE(:providerReviewNotes::text, provider_review_notes),
           provider_warning_notes = COALESCE(:providerWarningNotes::text, provider_warning_notes),
           provider_validation_messages = CAST(:providerValidationMessages AS jsonb),
           provider_delivery_messages = CAST(:providerDeliveryMessages AS jsonb),
           rejection_reason = COALESCE(:rejectionReason::text, rejection_reason),
           provider_updated_at = COALESCE(:providerUpdatedAt::timestamptz, provider_updated_at),
           last_synced_at = :lastSyncedAt::timestamptz,
           updated_at = now()
       WHERE id = :releaseId`, {
            releaseId,
            adminNotes: releaseNotes.length ? releaseNotes.join("\n") : null,
            providerReviewNotes: parsed.reviewNotes.join("\n") || null,
            providerWarningNotes: parsed.warnings.join("\n") || null,
            providerValidationMessages: JSON.stringify(parsed.validationMessages),
            providerDeliveryMessages: JSON.stringify(parsed.deliveryMessages),
            rejectionReason: parsed.rejectionReason ?? null,
            providerUpdatedAt: parsed.updatedAt ?? null,
            lastSyncedAt: syncTimestamp,
        });
        if (releaseNotes.length)
            changedFields.push("releases.admin_notes", "releases.rejection_reason");
        await this.credentials.recordSyncLog({
            syncType: "RELEASE_SYNC_AUDIT",
            status: "PASS",
            releaseId,
            request: { providerReleaseId },
            response: {
                review_notes: parsed.reviewNotes,
                warnings: parsed.warnings,
                validation_messages: parsed.validationMessages,
                delivery_messages: parsed.deliveryMessages,
                rejection_reason: parsed.rejectionReason,
            },
        });
    }
    async syncLocalJobs(releaseId, localTracks, parsed, providerReleaseId, syncTimestamp, changedFields) {
        for (const [index, track] of parsed.tracks.entries()) {
            const localTrack = resolveLocalTrackTarget(localTracks, track, index);
            if (!localTrack)
                continue;
            await this.db.query(`UPDATE distribution_jobs
         SET status = :status,
             provider_job_id = COALESCE(:providerJobId, provider_job_id),
             api_response = CAST(:apiResponse AS jsonb),
             updated_at = now()
         WHERE release_id = :releaseId
           AND track_id = :trackId
           AND provider = 'too_lost'`, {
                releaseId,
                trackId: localTrack.id,
                providerJobId: providerReleaseId,
                status: mapTooLostProviderToJobStatus(track.status ?? parsed.status),
                apiResponse: JSON.stringify({
                    sync_timestamp: syncTimestamp,
                    provider_release_id: providerReleaseId,
                    provider_track_id: track.providerTrackId ?? null,
                    provider_status: normalizeTooLostProviderStatus(track.status ?? parsed.status),
                    raw: redact(track.raw),
                }),
            });
        }
        changedFields.push("distribution_jobs.status");
    }
    async syncLocalDeliveries(releaseId, localTracks, parsed, syncTimestamp, changedFields) {
        for (const [index, track] of parsed.tracks.entries()) {
            const localTrack = resolveLocalTrackTarget(localTracks, track, index);
            if (!localTrack)
                continue;
            await this.db.query(`UPDATE platform_deliveries
         SET status = :status,
             provider_status = :providerStatus,
             provider_track_id = COALESCE(:providerTrackId, provider_track_id),
             provider_updated_at = :providerUpdatedAt::timestamptz,
             provider_review_notes = COALESCE(:providerReviewNotes::text, provider_review_notes),
             provider_warning_notes = COALESCE(:providerWarningNotes::text, provider_warning_notes),
             provider_validation_messages = CAST(:providerValidationMessages AS jsonb),
             provider_delivery_messages = CAST(:providerDeliveryMessages AS jsonb),
             notes = COALESCE(:notes::text, notes),
             live_url = COALESCE(:liveUrl::text, live_url),
             updated_at = now(),
             delivered_at = CASE WHEN :status = 'PUBLISHED' THEN COALESCE(delivered_at, now()) ELSE delivered_at END
         WHERE release_id = :releaseId
           AND track_id = :trackId
           AND platform = 'too_lost'`, {
                releaseId,
                trackId: localTrack.id,
                status: mapTooLostProviderToDeliveryStatus(track.status ?? parsed.status),
                providerStatus: normalizeTooLostProviderStatus(track.status ?? parsed.status),
                providerTrackId: track.providerTrackId ?? null,
                providerUpdatedAt: track.updatedAt ?? syncTimestamp,
                providerReviewNotes: track.reviewNotes.join("\n") || null,
                providerWarningNotes: track.warnings.join("\n") || null,
                providerValidationMessages: JSON.stringify(track.validationMessages),
                providerDeliveryMessages: JSON.stringify(track.deliveryMessages),
                notes: joinNotes([
                    ...track.reviewNotes,
                    ...track.warnings,
                    ...track.validationMessages,
                    ...track.deliveryMessages,
                ]),
                liveUrl: track.liveUrl ?? null,
            });
        }
        changedFields.push("platform_deliveries.status");
    }
    async syncLocalTracks(releaseId, localTracks, parsed, syncTimestamp, changedFields) {
        for (const [index, track] of parsed.tracks.entries()) {
            const localTrack = resolveLocalTrackTarget(localTracks, track, index);
            if (!localTrack)
                continue;
            await this.db.query(`UPDATE tracks
         SET status = :status,
             provider_status = :providerStatus,
             provider_track_id = COALESCE(:providerTrackId, provider_track_id),
             provider_isrc = COALESCE(:providerIsrc, provider_isrc),
             provider_updated_at = :providerUpdatedAt::timestamptz,
             provider_review_notes = COALESCE(:providerReviewNotes::text, provider_review_notes),
             provider_warning_notes = COALESCE(:providerWarningNotes::text, provider_warning_notes),
             provider_validation_messages = CAST(:providerValidationMessages AS jsonb),
             provider_delivery_messages = CAST(:providerDeliveryMessages AS jsonb),
             lyrics = COALESCE(:lyrics::text, lyrics),
             more_info = COALESCE(:moreInfo::text, more_info),
             updated_at = now()
         WHERE release_id = :releaseId
           AND id = :trackId`, {
                releaseId,
                trackId: localTrack.id,
                status: mapTooLostProviderReleaseStatus(normalizeTooLostProviderStatus(track.status ?? parsed.status)),
                providerStatus: normalizeTooLostProviderStatus(track.status ?? parsed.status),
                providerTrackId: track.providerTrackId ?? null,
                providerIsrc: track.isrc ?? null,
                providerUpdatedAt: track.updatedAt ?? syncTimestamp,
                providerReviewNotes: track.reviewNotes.join("\n") || null,
                providerWarningNotes: track.warnings.join("\n") || null,
                providerValidationMessages: JSON.stringify(track.validationMessages),
                providerDeliveryMessages: JSON.stringify(track.deliveryMessages),
                lyrics: track.lyrics ?? null,
                moreInfo: track.moreInfo ?? null,
            });
        }
        changedFields.push("tracks.status", "tracks.provider_track_id", "tracks.provider_isrc");
    }
    async syncNow(input = { userId: "" }) {
        const releaseCount = await this.db.query(`SELECT COUNT(DISTINCT release_id)::int AS count
       FROM distribution_jobs
       WHERE provider = 'too_lost'`);
        let analytics = null;
        try {
            analytics = await this.importAnalytics({ userId: input.userId, payload: input.payload });
        }
        catch (error) {
            analytics = null;
            await this.credentials.recordSandboxRun({
                runType: "failure_recovery",
                status: "WARN",
                request: { action: "sync_now" },
                response: { error: serializeError(error) },
                notes: error instanceof Error ? error.message : String(error),
            });
        }
        await this.credentials.updateProviderSyncStatus({
            syncStatus: "connected",
            lastSyncAt: new Date().toISOString(),
            isEnabled: true,
        });
        void this.refreshStatusCache("sync_now");
        return {
            status: await this.credentials.getConnectionStatus(),
            syncedAt: new Date().toISOString(),
            releaseCount: releaseCount[0]?.count ?? 0,
            analytics,
        };
    }
    async refreshStatusCache(reason = "background_refresh") {
        try {
            await this.credentials.refreshConnectionStatus(reason);
        }
        catch (error) {
            this.log.warn("too lost status cache refresh failed", {
                component: "too-lost-integration",
                reason,
                error: serializeError(error),
            });
        }
    }
    async importAnalytics(input = { userId: "" }) {
        if (!input.userId) {
            throw httpError(400, "MISSING_USER_ID", "A userId is required to store analytics in the existing per-user models.");
        }
        const payload = input.payload ?? await this.getAnalytics("overview", {});
        const streams = numberFrom(payload, ["streams", "total_streams", "stream_count"]);
        const audience = numberFrom(payload, ["audience", "followers", "listeners"]);
        const earnings = numberFrom(payload, ["earnings", "revenue", "gross_revenue"]);
        const sales = numberFrom(payload, ["sales", "units", "orders"]);
        await this.persistAnalyticsSnapshot({ userId: input.userId, streams, audience, earnings, sales, rawPayload: payload });
        await this.credentials.recordSandboxRun({
            runType: "analytics_sync",
            status: "PASS",
            request: { source: input.payload ? "provided" : "unverified" },
            response: payload,
            notes: "Analytics payload stored in existing analytics tables.",
        });
        return { imported: true, reason: "Stored using existing analytics models.", streams, audience, earnings, sales };
    }
    async buildReleasePayload(releaseId) {
        const release = await this.store.getReleaseWithTracks(releaseId);
        if (!release)
            throw httpError(404, "RELEASE_NOT_FOUND", `Release ${releaseId} was not found.`);
        const primaryTrack = release.tracks[0];
        if (!primaryTrack)
            throw httpError(400, "MISSING_TRACKS", "Release does not contain any tracks.");
        const contributorRows = await this.db.query(`SELECT track_id, name, role
       FROM release_contributors
       WHERE release_id = :releaseId`, { releaseId });
        return buildReleasePayload({
            release: release.release,
            tracks: release.tracks,
            contributors: contributorRows,
            dspTargets: this.config.dspTargets,
        });
    }
    async validateReleaseIdentifiers(payload) {
        const upc = payload.release.upc?.trim();
        if (upc) {
            const upcValidation = await this.api.requestJson("/releases/validate/upc", {
                method: "POST",
                body: JSON.stringify({ upc }),
            });
            if (isTooLostValidationFailure(upcValidation)) {
                throw new Error("Too Lost UPC validation failed.");
            }
        }
        for (const track of payload.tracks) {
            const isrc = track.isrc?.trim();
            if (!isrc)
                continue;
            const isrcValidation = await this.api.requestJson("/releases/validate/isrc", {
                method: "POST",
                body: JSON.stringify({ isrc }),
            });
            if (isTooLostValidationFailure(isrcValidation)) {
                throw new Error(`Too Lost ISRC validation failed for ${track.id}.`);
            }
        }
    }
    async persistSubmission(releaseId, externalReleaseId, payload, trackResponse, response) {
        const tracks = await this.store.getReleaseWithTracks(releaseId);
        if (!tracks)
            return;
        const providerTrackIds = parseProviderTrackIds(trackResponse);
        const syncTimestamp = new Date().toISOString();
        await this.persistReleaseSubmissionState({
            releaseId,
            providerReleaseId: externalReleaseId,
            status: "in_review",
            distributionStatus: "processing",
            providerStatus: "in_review",
            submittedAt: syncTimestamp,
            lastSyncedAt: syncTimestamp,
        });
        for (let index = 0; index < tracks.tracks.length; index += 1) {
            const track = tracks.tracks[index];
            const providerTrackId = providerTrackIds[index] ?? null;
            const resolvedAudio = await this.resolveAudioUrl(track.audioUrl);
            const syncSnapshot = buildSyncSnapshot({
                releaseId,
                providerReleaseId: externalReleaseId,
                providerTrackId,
                artworkUrl: payload.release.coverUrl,
                audioUrl: resolvedAudio.resolvedAudioUrl,
                signedAudioUrl: resolvedAudio.signedAudioUrl,
                distributionStatus: "processing",
                providerStatus: "in_review",
                validationStatus: "implicit_on_submit",
                submissionCompleted: true,
                syncTimestamp,
                providerMetadata: {
                    createRequest: payload.release,
                    trackRequest: payload.tracks[index] ?? null,
                    trackResponse: redact(trackResponse),
                    submitResponse: redact(response),
                },
            });
            await this.store.ensurePlatformDelivery({
                releaseId,
                trackId: track.id,
                userId: tracks.release.userId,
                platform: "too_lost",
            });
            await this.store.createDistributionJob({
                releaseId,
                trackId: track.id,
                platform: "too_lost",
            });
            await this.db.query(`UPDATE distribution_jobs
         SET status = 'IN_REVIEW',
             provider_job_id = :providerJobId,
             api_request = CAST(:apiRequest AS jsonb),
             api_response = CAST(:apiResponse AS jsonb),
             updated_at = now()
         WHERE release_id = :releaseId
           AND track_id = :trackId
           AND provider = 'too_lost'`, {
                releaseId,
                trackId: track.id,
                providerJobId: externalReleaseId,
                apiRequest: JSON.stringify(payload),
                apiResponse: JSON.stringify(syncSnapshot),
            });
            await this.db.query(`UPDATE platform_deliveries
         SET status = 'PROCESSING',
             platform_track_id = COALESCE(:providerTrackId, platform_track_id),
             raw_response = CAST(:rawResponse AS jsonb),
             updated_at = now()
         WHERE release_id = :releaseId
           AND track_id = :trackId
           AND platform = 'too_lost'`, {
                releaseId,
                trackId: track.id,
                providerTrackId,
                rawResponse: JSON.stringify(syncSnapshot),
            });
        }
        await this.credentials.recordSyncLog({
            syncType: "RELEASE_SUBMISSION",
            status: "PASS",
            releaseId,
            request: payload,
            response: {
                provider_release_id: externalReleaseId,
                provider_track_ids: providerTrackIds,
                sync_timestamp: syncTimestamp,
                provider_metadata: {
                    trackResponse: redact(trackResponse),
                    submitResponse: redact(response),
                },
            },
        });
    }
    async fetchAccountProfile(token) {
        const response = await this.httpClient(`${this.config.apiUrl}/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token.accessToken}`,
                Accept: "application/json",
            },
        });
        const body = await response.text();
        const parsed = body ? safeJsonParse(body) : null;
        if (response.status === 401 || response.status === 403) {
            throw httpError(response.status, "TOO_LOST_PROFILE_VERIFICATION_FAILED", `Too Lost OAuth token verification failed: GET /me returned ${response.status}.`);
        }
        if (!response.ok)
            throw new Error(`Too Lost account profile request failed: ${response.statusText}`);
        return parsed;
    }
    async persistAnalyticsSnapshot(input) {
        const today = new Date().toISOString().slice(0, 10);
        await this.db.query(`INSERT INTO dsp_analytics_snapshots (
         user_id, snapshot_date, streams, saves, playlist_adds, followers, reach, engagement
       ) VALUES (
         :userId, :snapshotDate, :streams, 0, 0, :followers, :reach, :engagement
       )
       ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
         streams = EXCLUDED.streams,
         followers = EXCLUDED.followers,
         reach = EXCLUDED.reach,
         engagement = EXCLUDED.engagement,
         updated_at = now()`, {
            userId: input.userId,
            snapshotDate: today,
            streams: input.streams,
            followers: input.audience,
            reach: input.audience,
            engagement: input.streams + input.audience,
        });
        await this.db.query(`INSERT INTO dsp_audience_metrics (
         user_id, metric_date, country, city, followers, reach, engagement, growth_rate
       ) VALUES (
         :userId, :metricDate, 'Global', 'Global', :followers, :reach, :engagement, :growthRate
       )
       ON CONFLICT (user_id, metric_date, country, city) DO UPDATE SET
         followers = EXCLUDED.followers,
         reach = EXCLUDED.reach,
         engagement = EXCLUDED.engagement,
         growth_rate = EXCLUDED.growth_rate,
         updated_at = now()`, {
            userId: input.userId,
            metricDate: today,
            followers: input.audience,
            reach: input.audience,
            engagement: input.streams + input.audience,
            growthRate: input.audience ? (input.audience / Math.max(input.streams, 1)) * 100 : 0,
        });
        await this.db.query(`INSERT INTO earnings_imports (
         source, imported_by_user_id, currency, gross_amount, status, period_start, period_end, created_at, updated_at
       ) VALUES (
         'too_lost', :userId, 'USD', :grossAmount, 'IMPORTED', :periodStart, :periodEnd, now(), now()
       )`, {
            userId: input.userId,
            grossAmount: input.earnings,
            periodStart: today,
            periodEnd: today,
        }).catch(() => undefined);
        await this.db.query(`INSERT INTO royalty_records (
         user_id, release_id, track_id, platform, streams_count, total_revenue, created_at, updated_at
       ) VALUES (
         :userId, gen_random_uuid(), gen_random_uuid(), 'too_lost', :streamsCount, :totalRevenue, now(), now()
       )`, {
            userId: input.userId,
            streamsCount: input.sales,
            totalRevenue: input.earnings,
        }).catch(() => undefined);
        await this.credentials.recordSyncLog({
            syncType: "ANALYTICS_IMPORT",
            status: "PASS",
            request: input.rawPayload,
            response: { streams: input.streams, audience: input.audience, earnings: input.earnings, sales: input.sales },
        });
    }
    async ensureFlacBlob(sourceBlob, trackId, releaseId, trackTitle) {
        const workDir = await mkdtemp(join(tmpdir(), `toolost-flac-${trackId}-`));
        const inputPath = join(workDir, "source-audio");
        const outputPath = join(workDir, "track.flac");
        try {
            const sourceBytes = Buffer.from(await sourceBlob.arrayBuffer());
            await this.ffmpeg.write(inputPath, sourceBytes);
            const sourceProbe = await this.ffmpeg.probe(inputPath);
            const sourceAudio = readPrimaryAudioProbe(sourceProbe);
            this.log.info("Too Lost source audio probed", {
                releaseId,
                trackId,
                trackTitle,
                source: sourceAudio,
            });
            await this.ffmpeg.runFfmpeg(["-i", inputPath, "-vn", "-map_metadata", "0", "-c:a", "flac", outputPath]);
            const outputProbe = await this.ffmpeg.probe(outputPath);
            const outputAudio = readPrimaryAudioProbe(outputProbe);
            const outputBytes = await this.ffmpeg.read(outputPath);
            verifyFlacBinary(outputBytes, outputAudio, { releaseId, trackId, trackTitle });
            this.log.info("Too Lost FLAC conversion verified", {
                releaseId,
                trackId,
                trackTitle,
                output: outputAudio,
            });
            return new Blob([outputBytes], { type: "audio/flac" });
        }
        finally {
            await this.ffmpeg.remove(workDir);
        }
    }
}
function sanitizeReturnToPath(value) {
    if (!value)
        return null;
    if (!value.startsWith("/") || value.startsWith("//"))
        return null;
    return value;
}
function buildQuery(query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === null || value === undefined || value === "")
            continue;
        params.set(key, String(value));
    }
    const text = params.toString();
    return text ? `?${text}` : "";
}
export function buildReleasePayload(input) {
    const primaryTrack = input.tracks[0];
    const artist = input.release.primaryArtist ?? primaryTrack?.primaryArtist ?? "Unknown Artist";
    const releaseTitle = input.release.title ?? primaryTrack?.title ?? "Untitled Release";
    const normalizedReleaseType = mapReleaseType(input.release.type);
    const currentYear = yearFromValue(input.release.productionYear) ?? String(new Date().getUTCFullYear());
    const label = input.release.labelName ?? artist;
    const releaseContributorRows = input.contributors.filter((row) => !row.track_id);
    const trackContributorRows = new Map();
    for (const row of input.contributors) {
        if (!row.track_id)
            continue;
        const rows = trackContributorRows.get(row.track_id) ?? [];
        rows.push(row);
        trackContributorRows.set(row.track_id, rows);
    }
    const payload = {
        release: {
            type: normalizedReleaseType,
            title: releaseTitle,
            version: input.release.version ?? null,
            primaryArtist: artist,
            artistMode: input.release.artistMode ?? null,
            spotifyArtistId: input.release.spotifyArtistId ?? null,
            appleArtistId: input.release.appleArtistId ?? null,
            featuringArtists: input.release.featuredArtists ?? primaryTrack?.featuredArtists ?? [],
            variousArtists: input.release.variousArtists ?? false,
            participants: normalizeParticipants([
                ...buildParticipants(artist, input.release.featuredArtists ?? primaryTrack?.featuredArtists ?? []),
                ...buildContributorParticipants(releaseContributorRows, artist),
            ]),
            label,
            primaryGenre: input.release.genre ?? null,
            subGenre: input.release.subgenre ?? null,
            language: input.release.language ?? null,
            upc: input.release.upc ?? null,
            copyrightOwner: input.release.copyrightOwner ?? input.release.copyright ?? label,
            copyrightDeclared: input.release.copyrightDeclared ?? false,
            aiContentDeclared: input.release.aiContentDeclared ?? false,
            rightsOwned: input.release.rightsOwned ?? false,
            releaseDate: input.release.releaseDate ?? null,
            originalReleaseDate: input.release.originalReleaseDate ?? null,
            coverUrl: input.release.coverArtUrl ?? null,
            format: input.release.format ?? null,
            producerCatalogueNumber: input.release.producerCatalogueNumber ?? null,
            cYear: currentYear,
            cLine: input.release.cLine ?? input.release.copyright ?? label,
            pYear: currentYear,
            pLine: input.release.pLine ?? input.release.copyright ?? label,
        },
        tracks: input.tracks.map((track) => ({
            id: track.id,
            title: normalizedReleaseType === "Single" ? releaseTitle : track.title ?? releaseTitle,
            version: track.version ?? null,
            language: input.release.language ?? null,
            isrc: track.isrc ?? null,
            generateIsrc: track.generateIsrc ?? null,
            artistMode: track.artistMode ?? input.release.artistMode ?? null,
            spotifyArtistId: track.spotifyArtistId ?? input.release.spotifyArtistId ?? null,
            appleArtistId: track.appleArtistId ?? input.release.appleArtistId ?? null,
            artists: normalizeParticipants([
                ...buildParticipants(track.primaryArtist ?? artist, track.featuredArtists ?? input.release.featuredArtists ?? []),
                ...buildContributorParticipants(trackContributorRows.get(track.id) ?? [], track.primaryArtist ?? artist),
            ]),
            writers: normalizeParticipants([
                ...buildWriterParticipants(track, track.primaryArtist ?? artist),
                ...buildContributorWriters(trackContributorRows.get(track.id) ?? [], track.primaryArtist ?? artist),
            ]),
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
            primaryGenre: track.genre ?? input.release.genre ?? null,
            subGenre: track.subgenre ?? input.release.subgenre ?? null,
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
    return payload;
}
function buildTrackPayloadEntry(track, audioFileKey) {
    return compactObject({
        title: track.title,
        version: track.version ?? null,
        language: track.language,
        isrc: track.isrc ?? null,
        generateIsrc: track.generateIsrc ?? null,
        artistMode: track.artistMode ?? null,
        spotifyArtistId: track.spotifyArtistId ?? null,
        appleArtistId: track.appleArtistId ?? null,
        audioFileKey,
        artists: track.artists,
        writers: track.writers,
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
        pYear: track.pYear ?? null,
        publisher: track.publisher ?? null,
        primaryGenre: track.primaryGenre ?? null,
        subGenre: track.subGenre ?? null,
        secondaryGenre: track.secondaryGenre ?? null,
        secondarySubGenre: track.secondarySubGenre ?? null,
        priceTier: track.priceTier ?? null,
        producerCatalogueNumber: track.producerCatalogueNumber ?? null,
        parentalAdvisory: track.parentalAdvisory ?? null,
        previewStart: track.previewStart ?? null,
        trackTitleLanguage: track.trackTitleLanguage ?? null,
        lyricsLanguage: track.lyricsLanguage ?? null,
        lyrics: track.lyrics ?? null,
        moreInfo: track.moreInfo ?? null,
    });
}
function buildImplicitValidationResult(releaseId, trackCount) {
    return {
        releaseId,
        valid: true,
        validationMode: "implicit_on_submit",
        providerEndpointCalled: false,
        trackCount,
        message: "Too Lost sandbox validates the release during submit; no standalone validation endpoint is available.",
    };
}
function buildSyncSnapshot(input) {
    return {
        release_id: input.releaseId,
        provider_release_id: input.providerReleaseId,
        provider_track_id: input.providerTrackId,
        artwork_url: input.artworkUrl,
        audio_url: input.audioUrl,
        signed_audio_url: input.signedAudioUrl,
        distribution_status: input.distributionStatus,
        provider_status: input.providerStatus,
        validation_status: input.validationStatus,
        submission_completed: input.submissionCompleted,
        sync_timestamp: input.syncTimestamp,
        provider_metadata: input.providerMetadata,
    };
}
function normalizeTooLostProviderStatus(value) {
    const normalized = String(value ?? "unknown").trim().toLowerCase();
    if (!normalized)
        return "unknown";
    if (normalized === "under_review")
        return "in_review";
    if (normalized === "sent_to_stores")
        return "delivered";
    if (normalized === "published")
        return "live";
    if (normalized === "delivery_failed")
        return "failed";
    return normalized;
}
function normalizeProviderStatus(value) {
    return normalizeTooLostProviderStatus(value);
}
function mapTooLostProviderReleaseStatus(status) {
    switch (normalizeTooLostProviderStatus(status)) {
        case "pending":
            return "pending";
        case "processing":
            return "processing";
        case "in_review":
            return "in_review";
        case "approved":
            return "approved";
        case "scheduled":
            return "scheduled";
        case "delivered":
            return "delivered";
        case "live":
            return "live";
        case "takedown_requested":
            return "takedown_requested";
        case "takedown":
            return "takedown";
        case "rejected":
            return "rejected";
        case "failed":
            return "failed";
        case "cancelled":
            return "cancelled";
        case "draft":
            return "draft";
        default:
            return "unknown";
    }
}
function mapTooLostProviderToDistributionStatus(status) {
    switch (normalizeTooLostProviderStatus(status)) {
        case "pending":
        case "draft":
        case "unknown":
            return "PENDING";
        case "scheduled":
        case "processing":
            return "PROCESSING";
        case "in_review":
            return "IN_REVIEW";
        case "approved":
            return "APPROVED";
        case "delivered":
            return "DELIVERED";
        case "live":
            return "PUBLISHED";
        case "takedown_requested":
        case "takedown":
        case "rejected":
            return "REJECTED";
        case "failed":
        case "cancelled":
            return "FAILED";
        default:
            return "PROCESSING";
    }
}
function mapTooLostProviderToJobStatus(status) {
    switch (normalizeTooLostProviderStatus(status)) {
        case "pending":
        case "draft":
        case "unknown":
            return "PENDING";
        case "scheduled":
        case "processing":
            return "PROCESSING";
        case "in_review":
            return "IN_REVIEW";
        case "approved":
            return "APPROVED";
        case "delivered":
            return "DELIVERED";
        case "live":
            return "PUBLISHED";
        case "takedown_requested":
        case "takedown":
        case "rejected":
            return "REJECTED";
        case "failed":
        case "cancelled":
            return "FAILED";
        default:
            return "PROCESSING";
    }
}
function mapTooLostProviderToDeliveryStatus(status) {
    switch (normalizeTooLostProviderStatus(status)) {
        case "pending":
        case "draft":
        case "unknown":
            return "pending";
        case "scheduled":
        case "processing":
            return "processing";
        case "in_review":
        case "approved":
            return "processing";
        case "delivered":
            return "delivered";
        case "live":
            return "live";
        case "takedown_requested":
        case "takedown":
        case "rejected":
        case "failed":
        case "cancelled":
            return "rejected";
        default:
            return "processing";
    }
}
function joinNotes(values) {
    const notes = uniqueStrings(values);
    return notes.length ? notes.join("\n") : null;
}
function normalizeTooLostReleaseSyncPayload(value) {
    const root = asRecord(value);
    const data = asRecord(root.data);
    const release = asRecord(root.release ?? data.release ?? root.item ?? root);
    const tracks = normalizeTooLostReleaseTracks(root);
    return {
        status: firstNonEmptyString(release.status, root.status, root.release_status, root.lifecycle, root.state, data.status) ?? null,
        updatedAt: firstNonEmptyString(release.updatedAt, release.updated_at, root.updatedAt, root.updated_at, data.updatedAt, data.updated_at) ?? null,
        reviewNotes: normalizeNoteList([
            release.reviewNotes,
            release.review_notes,
            root.reviewNotes,
            root.review_notes,
            root.reviewMessage,
            root.review_message,
        ]),
        warnings: normalizeNoteList([
            release.warnings,
            root.warnings,
            root.validationWarnings,
            root.validation_warnings,
            root.warning,
            root.warning_message,
        ]),
        validationMessages: normalizeNoteList([
            release.validationMessages,
            release.validation_messages,
            root.validationMessages,
            root.validation_messages,
            root.messages,
        ]),
        deliveryMessages: normalizeNoteList([
            release.deliveryMessages,
            release.delivery_messages,
            root.deliveryMessages,
            root.delivery_messages,
            root.message,
        ]),
        rejectionReason: firstNonEmptyString(release.rejectionReason, release.rejection_reason, root.rejectionReason, root.rejection_reason, root.reason) ?? null,
        tracks,
    };
}
function normalizeTooLostReleaseTracks(root) {
    const data = asRecord(root.data);
    const candidates = [
        root.tracks,
        data.tracks,
        root.items,
        data.items,
        root.deliveries,
        root.platformDeliveries,
        root.platform_deliveries,
    ];
    const source = candidates.find(Array.isArray);
    if (!source)
        return [];
    return source
        .map((entry, index) => normalizeTooLostTrackSyncPayload(entry, index))
        .filter((entry) => Boolean(entry));
}
function normalizeTooLostTrackSyncPayload(value, index) {
    const track = asRecord(value);
    const trackId = firstNonEmptyString(track.trackId, track.track_id, track.id, track.releaseTrackId, track.release_track_id, track.providerTrackId, track.provider_track_id, String(index));
    if (!trackId)
        return null;
    return {
        trackId,
        providerTrackId: firstNonEmptyString(track.providerTrackId, track.provider_track_id, track.trackId, track.track_id, track.id) ?? null,
        status: firstNonEmptyString(track.status, track.state, track.lifecycle, track.deliveryStatus, track.delivery_status) ?? null,
        isrc: firstNonEmptyString(track.isrc, track.providerIsrc, track.provider_isrc) ?? null,
        updatedAt: firstNonEmptyString(track.updatedAt, track.updated_at, track.lastUpdatedAt, track.last_updated_at) ?? null,
        liveUrl: firstNonEmptyString(track.liveUrl, track.live_url, track.url, track.link) ?? null,
        reviewNotes: normalizeNoteList([track.reviewNotes, track.review_notes, track.reviewMessage, track.review_message]),
        warnings: normalizeNoteList([track.warnings, track.warning, track.warning_message, track.validationWarnings, track.validation_warnings]),
        validationMessages: normalizeNoteList([track.validationMessages, track.validation_messages, track.messages]),
        deliveryMessages: normalizeNoteList([track.deliveryMessages, track.delivery_messages, track.message]),
        lyrics: firstNonEmptyString(track.lyrics) ?? null,
        moreInfo: firstNonEmptyString(track.moreInfo, track.more_info) ?? null,
        raw: track,
    };
}
function resolveLocalTrackTarget(localTracks, track, index) {
    if (track.providerTrackId) {
        const providerMatch = localTracks.find((localTrack) => localTrack.provider_track_id === track.providerTrackId);
        if (providerMatch)
            return providerMatch;
    }
    return localTracks[index] ?? null;
}
function normalizeNoteList(value) {
    const notes = [];
    for (const entry of value) {
        if (Array.isArray(entry)) {
            for (const nested of entry) {
                if (typeof nested === "string" && nested.trim())
                    notes.push(nested.trim());
                else if (nested && typeof nested === "object") {
                    const record = asRecord(nested);
                    const message = firstNonEmptyString(record.message, record.note, record.reason, record.title);
                    if (message)
                        notes.push(message);
                }
            }
            continue;
        }
        if (typeof entry === "string" && entry.trim()) {
            notes.push(entry.trim());
            continue;
        }
        if (entry && typeof entry === "object") {
            const record = asRecord(entry);
            const message = firstNonEmptyString(record.message, record.note, record.reason, record.title);
            if (message)
                notes.push(message);
        }
    }
    return notes;
}
function parseExternalReleaseId(value) {
    if (!value || typeof value !== "object")
        return null;
    const body = value;
    const data = asRecord(body.data);
    return String(body.releaseId ?? body.release_id ?? body.id ?? data.releaseId ?? data.id ?? "").trim() || null;
}
function extractUploadUrl(value) {
    if (!value || typeof value !== "object")
        return null;
    const body = value;
    const data = asRecord(body.data);
    return String(body.uploadUrl ?? body.upload_url ?? body.url ?? data.uploadUrl ?? data.upload_url ?? data.url ?? "").trim() || null;
}
function extractFileKey(value) {
    if (!value || typeof value !== "object")
        return null;
    const body = value;
    const data = asRecord(body.data);
    return String(body.fileKey ?? body.file_key ?? body.key ?? data.fileKey ?? data.file_key ?? data.key ?? "").trim() || null;
}
function parseProviderTrackIds(value) {
    const body = asRecord(value);
    const data = asRecord(body.data);
    const tracks = Array.isArray(body.tracks)
        ? body.tracks
        : Array.isArray(data.tracks)
            ? data.tracks
            : Array.isArray(body.items)
                ? body.items
                : Array.isArray(data.items)
                    ? data.items
                    : Array.isArray(value)
                        ? value
                        : [];
    return tracks
        .map((entry) => {
        const track = asRecord(entry);
        return firstNonEmptyString(track.trackId, track.track_id, track.providerTrackId, track.provider_track_id, track.id, asRecord(track.data).trackId, asRecord(track.data).track_id, asRecord(track.data).providerTrackId, asRecord(track.data).provider_track_id, asRecord(track.data).id);
    })
        .filter((entry) => Boolean(entry));
}
function mapReleaseType(value) {
    const normalized = String(value || "single").trim().toLowerCase();
    if (normalized === "single")
        return "Single";
    if (normalized === "ep")
        return "EP";
    if (normalized === "album")
        return "Album";
    if (normalized === "compilation")
        return "Compilation";
    return "Single";
}
function buildParticipants(primary, featured) {
    const participants = [{ name: primary, role: ["artist"] }];
    for (const name of featured) {
        if (!name || name === primary)
            continue;
        participants.push({ name, role: ["featured_artist"] });
    }
    return participants;
}
function buildWriterParticipants(track, fallbackName) {
    const explicit = normalizeParticipants(track.writers ?? []);
    if (explicit.length)
        return explicit;
    if (track.composer?.trim())
        return [{ name: track.composer.trim(), role: ["composer"] }];
    return [{ name: fallbackName, role: ["composer"] }];
}
function buildContributorParticipants(rows, fallbackName) {
    const rowsByName = new Map();
    for (const row of rows) {
        const name = row.name?.trim();
        const role = String(row.role || "").trim();
        if (!name || !role)
            continue;
        const normalizedRole = role.toLowerCase();
        if (normalizedRole === "composer" || normalizedRole === "lyricist" || normalizedRole === "songwriter")
            continue;
        const key = name.toLowerCase();
        const current = rowsByName.get(key) ?? { name, roles: new Set() };
        current.roles.add(normalizedRole);
        rowsByName.set(key, current);
    }
    const participants = [...rowsByName.values()].map((entry) => ({
        name: entry.name,
        role: [...entry.roles],
    }));
    if (participants.length)
        return participants;
    return [{ name: fallbackName, role: ["artist"] }];
}
function buildContributorWriters(rows, fallbackName) {
    const rowsByName = new Map();
    for (const row of rows) {
        const name = row.name?.trim();
        const role = String(row.role || "").trim();
        if (!name || !role)
            continue;
        const normalizedRole = role.toLowerCase();
        if (normalizedRole !== "composer" && normalizedRole !== "lyricist" && normalizedRole !== "songwriter")
            continue;
        const key = name.toLowerCase();
        const current = rowsByName.get(key) ?? { name, roles: new Set() };
        current.roles.add(normalizedRole);
        rowsByName.set(key, current);
    }
    const writers = [...rowsByName.values()].map((entry) => ({
        name: entry.name,
        role: [...entry.roles],
    }));
    if (writers.length)
        return writers;
    return [{ name: fallbackName, role: ["composer"] }];
}
function isTooLostValidationFailure(value) {
    const body = asRecord(value);
    const data = asRecord(body.data);
    const record = Object.keys(data).length ? data : body;
    const status = String(record.status ?? record.state ?? record.result ?? "").trim().toLowerCase();
    if (record.valid === false || record.isValid === false || record.success === false || record.ok === false)
        return true;
    if (["invalid", "failed", "error", "rejected"].includes(status))
        return true;
    const message = String(record.message ?? record.error ?? record.reason ?? "").trim().toLowerCase();
    return message.includes("invalid") || message.includes("failed");
}
function normalizeAudioFilename(value, audioFormat = null) {
    const trimmed = value.trim();
    const stem = trimmed.replace(/\.[^.]+$/, "");
    const currentExtension = trimmed.includes(".") ? trimmed.split(".").pop() || "" : "";
    const extension = audioFormat ? audioFileExtension(audioFormat) : currentExtension || "flac";
    return `${stem}.${extension}`;
}
function yearFromValue(value) {
    const normalized = String(value || "").trim();
    return /^\d{4}$/.test(normalized) ? normalized : null;
}
function normalizeTrackUploadRequest(body) {
    const source = asRecord(body);
    return {
        kind: String(source.kind || "audio"),
        fileName: normalizeAudioFilename(String(source.fileName || source.filename || "track.flac")),
        contentType: normalizeAudioContentType(String(source.contentType || source.content_type || "audio/flac")),
    };
}
function normalizeTrackFileRequest(body) {
    const source = asRecord(body);
    return {
        kind: String(source.kind || "audio"),
        fileKey: source.fileKey ?? source.audioFileKey ?? null,
    };
}
function normalizeArtworkMetadata(body) {
    const source = asRecord(body);
    return {
        coverUrl: source.coverUrl ?? source.url ?? source.artworkUrl ?? null,
    };
}
function normalizeReleaseCreateRequest(body) {
    const currentYear = String(new Date().getUTCFullYear());
    const source = asRecord(body);
    const release = source.release ? asRecord(source.release) : source;
    const primaryArtist = firstNonEmptyString(release.primaryArtist, release.artist, source.primaryArtist, source.artist) ?? "Unknown Artist";
    const featuredArtists = uniqueStrings([
        ...stringList(release.featuredArtists),
        ...stringList(release.featuringArtist),
        ...stringList(source.featuredArtists),
        ...stringList(source.featuringArtist),
    ]);
    const label = firstNonEmptyString(release.label, source.label, primaryArtist) ?? primaryArtist;
    const artistMode = firstNonEmptyString(release.artistMode, release.artist_mode, source.artistMode, source.artist_mode);
    const spotifyArtistId = firstNonEmptyString(release.spotifyArtistId, release.spotify_artist_id, source.spotifyArtistId, source.spotify_artist_id);
    const appleArtistId = firstNonEmptyString(release.appleArtistId, release.apple_artist_id, source.appleArtistId, source.apple_artist_id);
    return compactObject({
        type: mapReleaseType(firstNonEmptyString(release.type, source.type, "single")),
        title: firstNonEmptyString(release.title, source.title, "Untitled Release"),
        version: nullableString(release.version, source.version),
        primaryArtist,
        artistMode,
        spotifyArtistId,
        appleArtistId,
        featuringArtists: featuredArtists,
        variousArtists: Boolean(release.variousArtists ?? source.variousArtists ?? false),
        participants: hasParticipants(release.participants) ? normalizeParticipants(release.participants) : buildParticipants(primaryArtist, featuredArtists),
        label,
        primaryGenre: nullableString(release.primaryGenre, release.genre, source.primaryGenre, source.genre),
        subGenre: nullableString(release.subGenre, release.subgenre, source.subGenre, source.subgenre),
        language: nullableString(release.language, source.language),
        releaseDate: nullableString(release.releaseDate, source.releaseDate),
        originalReleaseDate: nullableString(release.originalReleaseDate, source.originalReleaseDate),
        upc: nullableString(release.upc, source.upc),
        coverUrl: nullableString(release.coverUrl, release.artworkUrl, asRecord(release.artwork).url, source.coverUrl, source.artworkUrl, asRecord(source.artwork).url),
        format: nullableString(release.format, source.format),
        producerCatalogueNumber: nullableString(release.producerCatalogueNumber, source.producerCatalogueNumber),
        cYear: firstNonEmptyString(release.cYear, source.cYear, currentYear) ?? currentYear,
        cLine: firstNonEmptyString(release.cLine, source.cLine, release.copyright, source.copyright, label) ?? label,
        pYear: firstNonEmptyString(release.pYear, source.pYear, currentYear) ?? currentYear,
        pLine: firstNonEmptyString(release.pLine, source.pLine, release.copyright, source.copyright, label) ?? label,
    });
}
function normalizeReleaseMetadataRequest(body) {
    const source = asRecord(body);
    const metadata = {};
    const label = firstNonEmptyString(source.label, source.primaryArtist, source.artist);
    if (hasOwn(source, "title"))
        metadata.title = nullableString(source.title);
    if (hasOwn(source, "version"))
        metadata.version = nullableString(source.version);
    if (hasOwn(source, "primaryArtist") || hasOwn(source, "artist"))
        metadata.primaryArtist = nullableString(source.primaryArtist, source.artist);
    if (hasOwn(source, "artistMode") || hasOwn(source, "artist_mode"))
        metadata.artistMode = nullableString(source.artistMode, source.artist_mode);
    if (hasOwn(source, "spotifyArtistId") || hasOwn(source, "spotify_artist_id"))
        metadata.spotifyArtistId = nullableString(source.spotifyArtistId, source.spotify_artist_id);
    if (hasOwn(source, "appleArtistId") || hasOwn(source, "apple_artist_id"))
        metadata.appleArtistId = nullableString(source.appleArtistId, source.apple_artist_id);
    if (hasOwn(source, "featuringArtists"))
        metadata.featuringArtists = Array.isArray(source.featuringArtists) ? source.featuringArtists : undefined;
    if (hasOwn(source, "variousArtists"))
        metadata.variousArtists = Boolean(source.variousArtists);
    if (hasOwn(source, "label") || hasOwn(source, "primaryArtist") || hasOwn(source, "artist"))
        metadata.label = label;
    if (hasOwn(source, "primaryGenre") || hasOwn(source, "genre"))
        metadata.primaryGenre = nullableString(source.primaryGenre, source.genre);
    if (hasOwn(source, "subGenre") || hasOwn(source, "subgenre"))
        metadata.subGenre = nullableString(source.subGenre, source.subgenre);
    if (hasOwn(source, "language"))
        metadata.language = nullableString(source.language);
    if (hasOwn(source, "upc"))
        metadata.upc = nullableString(source.upc);
    if (hasOwn(source, "releaseDate"))
        metadata.releaseDate = nullableString(source.releaseDate);
    if (hasOwn(source, "originalReleaseDate"))
        metadata.originalReleaseDate = nullableString(source.originalReleaseDate);
    if (hasOwn(source, "coverUrl") || hasOwn(source, "artworkUrl") || hasOwn(source, "url") || hasOwn(asRecord(source.artwork), "url")) {
        metadata.coverUrl = nullableString(source.coverUrl, source.artworkUrl, asRecord(source.artwork).url, source.url);
    }
    if (hasOwn(source, "format"))
        metadata.format = nullableString(source.format);
    if (hasOwn(source, "producerCatalogueNumber"))
        metadata.producerCatalogueNumber = nullableString(source.producerCatalogueNumber);
    if (hasOwn(source, "cYear"))
        metadata.cYear = nullableString(source.cYear);
    if (hasOwn(source, "cLine") || hasOwn(source, "copyright") || hasOwn(source, "label") || hasOwn(source, "primaryArtist") || hasOwn(source, "artist")) {
        metadata.cLine = nullableString(source.cLine, source.copyright, label);
    }
    if (hasOwn(source, "pYear"))
        metadata.pYear = nullableString(source.pYear);
    if (hasOwn(source, "pLine") || hasOwn(source, "copyright") || hasOwn(source, "label") || hasOwn(source, "primaryArtist") || hasOwn(source, "artist")) {
        metadata.pLine = nullableString(source.pLine, source.copyright, label);
    }
    return compactObject(metadata);
}
function normalizeTrackListRequest(body) {
    const source = asRecord(body);
    const release = source.release ? asRecord(source.release) : null;
    const releaseFeatured = uniqueStrings([
        ...stringList(release?.featuredArtists),
        ...stringList(release?.featuringArtist),
        ...stringList(source.featuredArtists),
        ...stringList(source.featuringArtist),
    ]);
    const releaseArtist = firstNonEmptyString(release?.primaryArtist, release?.artist, source.primaryArtist, source.artist) ?? "Unknown Artist";
    const releaseArtistMode = nullableString(release?.artistMode, release?.artist_mode, source.artistMode, source.artist_mode);
    const releaseSpotifyArtistId = nullableString(release?.spotifyArtistId, release?.spotify_artist_id, source.spotifyArtistId, source.spotify_artist_id);
    const releaseAppleArtistId = nullableString(release?.appleArtistId, release?.apple_artist_id, source.appleArtistId, source.apple_artist_id);
    const language = nullableString(source.language, release?.language);
    const tracks = Array.isArray(source.tracks) ? source.tracks : [];
    return {
        tracks: tracks.map((entry, index) => {
            const track = asRecord(entry);
            const primaryArtist = firstNonEmptyString(track.primaryArtist, track.artist, releaseArtist) ?? releaseArtist;
            const participants = hasParticipants(track.artists)
                ? normalizeParticipants(track.artists)
                : buildParticipants(primaryArtist, uniqueStrings([
                    ...stringList(track.featuredArtists),
                    ...stringList(track.featuringArtist),
                    ...releaseFeatured,
                ]));
            const writers = hasParticipants(track.writers)
                ? normalizeParticipants(track.writers)
                : normalizeParticipants([
                    track.composer ? { name: String(track.composer).trim(), role: ["composer"] } : null,
                    firstNonEmptyString(track.writer, track.songwriter) ? { name: firstNonEmptyString(track.writer, track.songwriter), role: ["songwriter"] } : null,
                ].filter(Boolean));
            return compactObject({
                title: firstNonEmptyString(track.title, `Track ${index + 1}`),
                version: nullableString(track.version),
                language: nullableString(track.language, language),
                isrc: nullableString(track.isrc),
                generateIsrc: hasOwn(track, "generateIsrc") || hasOwn(track, "generate_isrc")
                    ? Boolean(track.generateIsrc ?? track.generate_isrc)
                    : undefined,
                artistMode: nullableString(track.artistMode, track.artist_mode, releaseArtistMode),
                spotifyArtistId: nullableString(track.spotifyArtistId, track.spotify_artist_id, releaseSpotifyArtistId),
                appleArtistId: nullableString(track.appleArtistId, track.apple_artist_id, releaseAppleArtistId),
                audioFileKey: nullableString(track.audioFileKey, track.fileKey, track.audioKey, asRecord(track.audioFile).fileKey, asRecord(track.audioFile).key, asRecord(track.audioFile).uploadKey),
                artists: participants,
                writers: writers.length ? writers : [{ name: primaryArtist, role: ["composer"] }],
                contentType: nullableString(track.contentType, track.content_type),
                primaryTrackType: nullableString(track.primaryTrackType, track.primary_track_type),
                secondaryTrackType: nullableString(track.secondaryTrackType, track.secondary_track_type),
                instrumental: Boolean(track.instrumental),
                remixer: nullableString(track.remixer),
                author: nullableString(track.author),
                composer: nullableString(track.composer),
                arranger: nullableString(track.arranger),
                producer: nullableString(track.producer),
                pLine: nullableString(track.pLine, track.p_line),
                pYear: nullableString(track.pYear, track.productionYear, track.production_year),
                publisher: nullableString(track.publisher),
                primaryGenre: nullableString(track.primaryGenre, track.genre),
                subGenre: nullableString(track.subGenre, track.subgenre),
                secondaryGenre: nullableString(track.secondaryGenre, track.secondary_genre),
                secondarySubGenre: nullableString(track.secondarySubGenre, track.secondary_subgenre),
                priceTier: nullableString(track.priceTier, track.price_tier),
                producerCatalogueNumber: nullableString(track.producerCatalogueNumber, track.producer_catalogue_number),
                parentalAdvisory: nullableString(track.parentalAdvisory, track.parental_advisory),
                previewStart: numericOrNull(track.previewStart, track.preview_start),
                trackTitleLanguage: nullableString(track.trackTitleLanguage, track.track_title_language),
                lyricsLanguage: nullableString(track.lyricsLanguage, track.lyrics_language),
                lyrics: nullableString(track.lyrics),
                moreInfo: nullableString(track.moreInfo, track.more_info),
            });
        }),
    };
}
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
function firstNonEmptyString(...values) {
    for (const value of values) {
        if (typeof value !== "string")
            continue;
        const trimmed = value.trim();
        if (trimmed)
            return trimmed;
    }
    return null;
}
function nullableString(...values) {
    for (const value of values) {
        if (value === null)
            return null;
        if (typeof value !== "string")
            continue;
        const trimmed = value.trim();
        if (trimmed)
            return trimmed;
    }
    return null;
}
function numericOrNull(...values) {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function stringList(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => typeof entry === "string" ? entry.trim() : "")
        .filter(Boolean);
}
function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function hasParticipants(value) {
    return Array.isArray(value) && value.some((entry) => typeof asRecord(entry).name === "string");
}
function normalizeParticipants(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => {
        const participant = asRecord(entry);
        const name = firstNonEmptyString(participant.name);
        if (!name)
            return null;
        const roles = Array.isArray(participant.role)
            ? participant.role.map((role) => typeof role === "string" ? role.trim() : "").filter(Boolean)
            : [];
        return { name, role: roles.length ? roles : ["artist"] };
    })
        .filter((entry) => Boolean(entry));
}
function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function deriveProviderStatus(rows, releaseStatus) {
    if (rows.some((row) => row.job_status === "FAILED" || row.job_status === "REJECTED" || row.delivery_status === "FAILED"))
        return "failed";
    if (rows.some((row) => row.job_status === "PUBLISHED" || row.delivery_status === "PUBLISHED") || releaseStatus === "live")
        return "live";
    if (rows.some((row) => row.job_status === "DELIVERED") || releaseStatus === "delivered")
        return "delivered";
    if (rows.some((row) => row.job_status === "APPROVED") || releaseStatus === "approved")
        return "approved";
    if (rows.some((row) => row.job_status === "IN_REVIEW") || releaseStatus === "in_review" || releaseStatus === "under_review")
        return "in_review";
    if (rows.some((row) => row.job_status === "SUBMITTED" || row.job_status === "PROCESSING" || row.delivery_status === "PROCESSING")
        || releaseStatus === "processing")
        return "processing";
    return "pending";
}
function deriveDistributionStatus(rows, releaseStatus) {
    if (rows.some((row) => row.job_status === "FAILED" || row.job_status === "REJECTED" || row.delivery_status === "FAILED"))
        return "failed";
    if (rows.some((row) => row.delivery_status === "PUBLISHED" || row.job_status === "PUBLISHED") || releaseStatus === "live")
        return "live";
    if (rows.some((row) => row.job_status === "DELIVERED") || releaseStatus === "delivered")
        return "delivered";
    if (rows.some((row) => row.job_status === "APPROVED") || releaseStatus === "approved")
        return "approved";
    if (rows.some((row) => row.delivery_status === "PROCESSING"
        || row.job_status === "IN_REVIEW"
        || row.job_status === "SUBMITTED"
        || row.job_status === "PROCESSING")
        || releaseStatus === "processing"
        || releaseStatus === "in_review")
        return "processing";
    return "pending";
}
function normalizeReleaseStatus(value) {
    if (!value)
        return null;
    if (value === "under_review")
        return "in_review";
    if (value === "sent_to_stores")
        return "delivered";
    return value;
}
function legacyReleaseStatus(desiredStatus) {
    if (desiredStatus === "in_review")
        return ["in_review", "under_review"];
    if (desiredStatus === "delivered")
        return ["delivered", "sent_to_stores"];
    return [desiredStatus];
}
function numberFrom(payload, keys) {
    if (!payload || typeof payload !== "object")
        return 0;
    const source = payload;
    for (const key of keys) {
        const value = source[key];
        const num = Number(value);
        if (Number.isFinite(num))
            return num;
    }
    return 0;
}
function filenameFromUrl(value, fallback) {
    try {
        const url = new URL(value);
        const last = url.pathname.split("/").filter(Boolean).pop();
        return last || fallback;
    }
    catch {
        return fallback;
    }
}
function audioFileExtension(audioFormat) {
    return "flac";
}
function audioFileContentType(audioFormat) {
    return "audio/flac";
}
function normalizeAudioContentType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "audio/wave" || normalized === "audio/x-wav")
        return "audio/wav";
    if (normalized === "audio/x-flac")
        return "audio/flac";
    return normalized || "audio/flac";
}
function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return { raw: value };
    }
}
function redact(value) {
    if (!value || typeof value !== "object")
        return value;
    return JSON.parse(JSON.stringify(value, (key, entry) => {
        if (/token|authorization|api[-_]?key|secret/i.test(key))
            return "[REDACTED]";
        return entry;
    }));
}
function serializeError(error) {
    return error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
}
function readPrimaryAudioProbe(probe) {
    const stream = probe.streams?.find((entry) => entry.codec_type === "audio") ?? null;
    return {
        codecName: stream?.codec_name ?? null,
        container: probe.format?.format_name ?? null,
        durationSec: numericValue(stream?.duration ?? probe.format?.duration),
        channels: numericValue(stream?.channels),
        sampleRateHz: numericValue(stream?.sample_rate),
        bitRate: numericValue(stream?.bit_rate ?? probe.format?.bit_rate),
    };
}
function verifyFlacBinary(bytes, probe, context) {
    const signature = bytes.subarray(0, 4).toString("utf8");
    if (signature !== "fLaC") {
        throw new Error(`Too Lost FLAC verification failed: invalid magic bytes for track ${context.trackId} (${context.trackTitle || "untitled"}).`);
    }
    if (String(probe.codecName || "").toLowerCase() !== "flac") {
        throw new Error(`Too Lost FLAC verification failed: codec_name=${probe.codecName || "unknown"} for track ${context.trackId}.`);
    }
    if (!String(probe.container || "").toLowerCase().includes("flac")) {
        throw new Error(`Too Lost FLAC verification failed: container=${probe.container || "unknown"} for track ${context.trackId}.`);
    }
    if (!probe.durationSec || probe.durationSec <= 0) {
        throw new Error(`Too Lost FLAC verification failed: invalid duration for track ${context.trackId}.`);
    }
    if (!probe.channels || probe.channels < 1) {
        throw new Error(`Too Lost FLAC verification failed: invalid channels for track ${context.trackId}.`);
    }
    if (!probe.sampleRateHz || probe.sampleRateHz < 8000) {
        throw new Error(`Too Lost FLAC verification failed: invalid sample rate for track ${context.trackId}.`);
    }
}
function numericValue(value) {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
}
function httpError(status, code, message) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}
