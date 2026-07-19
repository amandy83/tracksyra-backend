import express from "express";
import { inspectQueue, retryQueueJob } from "../queue/queueFactory.js";
import { queueNames } from "../queue/queueNames.js";
import { validateProductionEnvironment } from "../config/environmentValidation.js";
import { loadRuntimeEnv, logRuntimeEnv } from "../config/envLoader.js";
import { getRedisHealthSnapshot, refreshRedisHealthSnapshot } from "../queue/redis.js";
import { getClientIp, checkRateLimit, rateLimitRules, suspiciousActivityLog } from "../security/rateLimiter.js";
import { serializeError } from "../observability/logger.js";
import { traceFromHeaders } from "../observability/tracing.js";
import { logFfmpegRuntime } from "../media/services/ffmpeg.js";
import { TOO_LOST_APPROVED_SCOPES, getTooLostProviderHealth, readTooLostConfig, } from "../distribution/providers/too-lost/index.js";
const queueSet = new Set(Object.values(queueNames).filter((value) => typeof value === "string"));
export async function startOperationsServer(dependencies, options = {}) {
    const { runtime, recovery, passwordResetService, resendWebhookService, tooLostCredentialStore, tooLostIntegrationService, tooLostWebhookController, enterpriseDistributionService, royaltyAccountingService, adminSupabaseClient, logger } = dependencies;
    logRuntimeEnv("operations-server");
    logFfmpegRuntime("operations-server");
    const tooLostConfig = readTooLostConfig();
    const port = options.port || Number(readEnv("PORT") || readEnv("WORKER_HTTP_PORT") || 3000);
    const app = express();
    app.use(express.raw({ type: "*/*", limit: "2mb" }));
    app.use((req, res, next) => {
        Object.entries(corsHeaders()).forEach(([name, value]) => res.setHeader(name, value));
        if (req.method === "OPTIONS")
            return res.status(204).end();
        const trace = traceFromHeaders(req.headers);
        const ip = getClientIp(req.headers, req.socket.remoteAddress);
        const rate = checkRateLimit(rateLimitRules.api, ip);
        if (!rate.allowed) {
            suspiciousActivityLog({ category: "api", ip, actorUserId: trace.actorUserId, reason: "operations endpoint rate limit" });
            return res.status(429).json({ error: "RATE_LIMITED", traceId: trace.traceId });
        }
        return next();
    });
    app.get("/health", (_req, res) => res.status(200).json({ status: "OK", uptime: process.uptime() }));
    app.get("/healthz", (_req, res) => res.status(200).json({ status: "OK", uptime: process.uptime() }));
    app.get("/readyz", (_req, res) => {
        const env = validateProductionEnvironment();
        return res.status(env.ok ? 200 : 503).json(env);
    });
    app.get("/api/health/redis", asyncHandler(async (_req, res) => {
        const health = getRedisHealthSnapshot();
        void refreshRedisHealthSnapshot({ background: true }).catch((error) => {
            logger.warn("redis health background refresh failed", {
                component: "operations-server",
                error: serializeError(error),
            });
        });
        res.status(200).json({ ok: true, data: health });
    }));
    app.get("/api/redis/health", asyncHandler(async (_req, res) => {
        const health = getRedisHealthSnapshot();
        void refreshRedisHealthSnapshot({ background: true }).catch((error) => {
            logger.warn("redis health background refresh failed", {
                component: "operations-server",
                error: serializeError(error),
            });
        });
        res.status(200).json({ ok: true, data: health });
    }));
    app.get("/metrics", asyncHandler(async (_req, res) => {
        const metrics = await runtime.prometheusMetrics();
        res.type("text/plain; version=0.0.4").send(metrics);
    }));
    app.post("/api/royalties/calculate", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.calculateRoyalties(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/statement", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.generateStatement(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/statement/approve", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.approveStatement({
            statementId: String(body.statementId || ""),
            approverId: String(body.approverId || "system"),
            metadata: toPlainRecord(body.metadata),
        });
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/payment/release", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.releasePayment({
            statementId: String(body.statementId || ""),
            approverId: String(body.approverId || "system"),
            scheduledFor: typeof body.scheduledFor === "string" ? body.scheduledFor : null,
            metadata: toPlainRecord(body.metadata),
        });
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/splits", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.calculateSplits(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/taxes", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.calculateTaxes(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/currency", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.convertCurrency(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/adjustments", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.applyAdjustment(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/chargebacks", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.applyChargeback(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/reserves", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.applyReserve(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.post("/api/royalties/forecast", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await royaltyAccountingService.generateForecast(body);
        res.status(200).json({ ok: true, data: result });
    }));
    app.get("/api/royalties/reports/:reportName", asyncHandler(async (req, res) => {
        const reportName = String(req.params.reportName || "").toLowerCase();
        const body = {
            currency: String(typeof req.query.currency === "string" ? req.query.currency : "USD"),
            payeeId: typeof req.query.payeeId === "string" ? req.query.payeeId : null,
        };
        if (reportName === "revenue")
            return res.status(200).json({ ok: true, data: await royaltyAccountingService.generateRevenueReport(body) });
        if (reportName === "payment")
            return res.status(200).json({ ok: true, data: await royaltyAccountingService.generatePaymentReport(body) });
        if (reportName === "audit")
            return res.status(200).json({ ok: true, data: await royaltyAccountingService.generateAuditReport(body) });
        return res.status(404).json({ error: "UNKNOWN_REPORT" });
    }));
    app.get("/api/royalties/health", asyncHandler(async (_req, res) => {
        res.status(200).json({ ok: true, data: await royaltyAccountingService.healthCheck() });
    }));
    app.post("/api/royalties/retry", asyncHandler(async (req, res) => {
        const body = readJson(req);
        res.status(200).json({ ok: true, data: await royaltyAccountingService.retry({
                queueName: String(body.queueName || "royaltyQueue"),
                jobId: typeof body.jobId === "string" ? body.jobId : null,
                reason: typeof body.reason === "string" ? body.reason : null,
                metadata: toPlainRecord(body.metadata),
            }) });
    }));
    app.post("/queues/pause", asyncHandler(async (_req, res) => {
        await runtime.pauseAll();
        res.status(200).json({ ok: true });
    }));
    app.post("/queues/resume", asyncHandler(async (_req, res) => {
        await runtime.resumeAll();
        res.status(200).json({ ok: true });
    }));
    app.all(/^\/queues\/([^/]+)(?:\/(retry|dlq))?$/, asyncHandler(async (req, res) => {
        const queueName = req.params[0];
        const action = req.params[1];
        if (!isQueueName(queueName))
            return res.status(404).json({ error: "UNKNOWN_QUEUE" });
        if (req.method === "GET" && !action)
            return res.status(200).json(await inspectQueue(queueName));
        if (req.method === "POST" && action === "retry") {
            const body = readJson(req);
            await retryQueueJob(queueName, String(body.jobId));
            return res.status(200).json({ ok: true });
        }
        if (req.method === "GET" && action === "dlq")
            return res.status(200).json(await recovery.inspectDeadLetters(queueName));
        return res.status(404).json({ error: "NOT_FOUND" });
    }));
    app.post("/admin/recovery/email", asyncHandler(async (req, res) => {
        const body = readJson(req);
        res.status(200).json(await recovery.replayFailedEmail(String(body.emailQueueId)));
    }));
    app.post("/admin/recovery/distribution", asyncHandler(async (req, res) => {
        const body = readJson(req);
        await recovery.replayDistributionJob(String(body.jobId));
        res.status(200).json({ ok: true });
    }));
    app.post("/admin/recovery/payout", asyncHandler(async (req, res) => {
        const body = readJson(req);
        await recovery.replayPayoutJob(String(body.jobId));
        res.status(200).json({ ok: true });
    }));
    app.post("/admin/recovery/webhook", asyncHandler(async (req, res) => {
        const body = readJson(req);
        await recovery.replayWebhookFailure(String(body.eventId));
        res.status(200).json({ ok: true });
    }));
    app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const result = await passwordResetService.forgotPassword(String(body.email || ""), String(body.redirectTo || "") || undefined);
        res.status(202).json({ ok: true, accepted: result.accepted });
    }));
    app.post("/api/webhooks/resend", asyncHandler(async (req, res) => {
        const rawBody = readRaw(req);
        res.status(200).json(await resendWebhookService.handle(rawBody, req.headers));
    }));
    app.post("/api/artists", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const name = normalizeArtistQuery(typeof body.name === "string" ? body.name : "");
        if (!name)
            return res.status(400).json({ error: "ARTIST_NAME_REQUIRED" });
        const slug = typeof body.slug === "string" && body.slug.trim() ? slugifyArtistName(body.slug) : slugifyArtistName(name);
        const supabase = adminSupabaseClient;
        const duplicate = await supabase
            .from("artists")
            .select("id")
            .or(`name.ilike.${escapeLike(name)},slug.eq.${slug}`)
            .maybeSingle();
        if (duplicate.error)
            throw duplicate.error;
        if (duplicate.data)
            return res.status(409).json({ error: "ARTIST_ALREADY_EXISTS" });
        const created = await upsertArtistRecord({
            name,
            displayName: typeof body.display_name === "string" && body.display_name.trim() ? body.display_name.trim() : name,
            slug,
            provider: typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : "local",
            country: nullableString(body.country),
            providerArtistId: nullableString(body.provider_artist_id),
            spotifyArtistId: nullableString(body.spotify_artist_id),
            appleArtistId: nullableString(body.apple_artist_id),
            imageUrl: nullableString(body.image_url),
            instagramUrl: nullableString(body.instagram_url),
            youtubeUrl: nullableString(body.youtube_url),
            websiteUrl: nullableString(body.website_url),
            biography: nullableString(body.biography),
            verified: Boolean(body.verified),
        }, supabase);
        return res.status(201).json(toArtistSelectionResponse(created));
    }));
    app.get("/api/artists/:id", asyncHandler(async (req, res) => {
        const supabase = adminSupabaseClient;
        const { data, error } = await supabase.from("artists").select("*").eq("id", req.params.id).maybeSingle();
        if (error)
            throw error;
        if (!data)
            return res.status(404).json({ error: "ARTIST_NOT_FOUND" });
        return res.status(200).json(data);
    }));
    app.get("/api/admin/dashboards/:dashboardName", asyncHandler(async (req, res) => {
        const dashboardName = normalizeDashboardName(requestParam(req.params.dashboardName));
        const limit = readLimit(req.query);
        if (!dashboardName)
            return res.status(404).json({ error: "UNKNOWN_DASHBOARD" });
        const dashboard = await enterpriseDistributionService.getDashboard(dashboardName, limit);
        res.status(200).json({ ok: true, data: dashboard });
    }));
    app.get("/api/admin/reports/:reportName", asyncHandler(async (req, res) => {
        const reportName = normalizeReportName(requestParam(req.params.reportName));
        const limit = readLimit(req.query);
        if (!reportName)
            return res.status(404).json({ error: "UNKNOWN_REPORT" });
        const report = await enterpriseDistributionService.getReport(reportName, limit);
        res.status(200).json({ ok: true, data: report });
    }));
    app.get("/api/admin/releases/:releaseId/catalog-report", asyncHandler(async (req, res) => {
        const report = await enterpriseDistributionService.getCatalogReport(requestParam(req.params.releaseId));
        if (!report)
            return res.status(404).json({ error: "RELEASE_NOT_FOUND" });
        res.status(200).json({ ok: true, data: report });
    }));
    app.get("/api/admin/releases/:releaseId/identifier-report", asyncHandler(async (req, res) => {
        const report = await enterpriseDistributionService.getIdentifierReportByRelease(requestParam(req.params.releaseId));
        if (!report)
            return res.status(404).json({ error: "RELEASE_NOT_FOUND" });
        res.status(200).json({ ok: true, data: report });
    }));
    app.post("/api/admin/review-queue/:queueId/assign", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const audit = auditContextFromRequest(req, body);
        const item = await enterpriseDistributionService.assignReviewQueueItem({
            queueId: requestParam(req.params.queueId),
            adminId: audit.actor,
            notes: typeof body.notes === "string" ? body.notes : "",
            audit,
        });
        if (!item)
            return res.status(404).json({ error: "REVIEW_QUEUE_ITEM_NOT_FOUND" });
        res.status(200).json({ ok: true, data: item });
    }));
    app.post("/api/admin/review-queue/:queueId/decision", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const decision = normalizeReviewDecision(typeof body.decision === "string" ? body.decision : "");
        if (!decision)
            return res.status(400).json({ error: "INVALID_DECISION" });
        const audit = auditContextFromRequest(req, body);
        const item = await enterpriseDistributionService.decideReviewQueueItem({
            queueId: requestParam(req.params.queueId),
            decision,
            notes: typeof body.notes === "string" ? body.notes : "",
            audit,
        });
        if (!item)
            return res.status(404).json({ error: "REVIEW_QUEUE_ITEM_NOT_FOUND" });
        res.status(200).json({ ok: true, data: item });
    }));
    app.post("/api/admin/fraud/:reviewId/decision", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const decision = normalizeFraudDecision(typeof body.decision === "string" ? body.decision : "");
        if (!decision)
            return res.status(400).json({ error: "INVALID_DECISION" });
        const audit = auditContextFromRequest(req, body);
        const item = await enterpriseDistributionService.decideFraudReview({
            reviewId: requestParam(req.params.reviewId),
            decision,
            notes: typeof body.notes === "string" ? body.notes : "",
            audit,
        });
        if (!item)
            return res.status(404).json({ error: "FRAUD_REVIEW_NOT_FOUND" });
        res.status(200).json({ ok: true, data: item });
    }));
    app.get("/api/distribution/too-lost/health", asyncHandler(async (_req, res) => {
        const health = getTooLostProviderHealth(readTooLostConfig());
        await optionalTooLostCredentialStore(logger, tooLostCredentialStore, async (store) => {
            await store.syncProviderConfiguration();
            await store.initializePendingCredentialRecord();
            await store.recordHealth(health);
        });
        res.status(200).json(health);
    }));
    app.get("/api/distribution/too-lost/oauth/authorize", asyncHandler(async (_req, res) => {
        const returnToPath = safeReturnToPath(typeof _req.query.returnTo === "string" ? _req.query.returnTo : null) ?? "/dashboard";
        const result = tooLostIntegrationService.buildAuthorizationUrl({ returnToPath });
        void optionalTooLostCredentialStore(logger, tooLostCredentialStore, async (store) => {
            await store.storeOAuthState({
                state: result.state,
                codeVerifier: result.codeVerifier,
                redirectUri: readTooLostConfig().redirectUri,
                returnToPath,
                scopes: [...TOO_LOST_APPROVED_SCOPES],
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            });
            await store.recordSandboxRun({
                runType: "oauth",
                status: "PASS",
                request: { authorizeUrl: "[REDACTED]" },
                response: { state: result.state, returnToPath },
            });
        });
        res.status(200).json({ url: result.url, state: result.state, codeVerifier: "[SERVER_STORED]" });
    }));
    app.get("/api/distribution/too-lost/oauth/callback", asyncHandler(async (req, res) => {
        const code = typeof req.query.code === "string" ? req.query.code : "";
        const state = typeof req.query.state === "string" ? req.query.state : "";
        const error = typeof req.query.error === "string" ? req.query.error : "";
        const errorDescription = typeof req.query.error_description === "string" ? req.query.error_description : "";
        if (error) {
            return res.status(400).json({ ok: false, error, error_description: errorDescription || null });
        }
        if (!code || !state) {
            return res.status(400).json({ ok: false, error: "MISSING_CODE_OR_STATE" });
        }
        const result = await tooLostIntegrationService.handleOAuthCallback({ code, state });
        const redirectTo = result.redirectTo || "/dashboard";
        if (acceptsHtml(req))
            return res.redirect(302, redirectTo);
        res.status(200).json({ ok: true, connection: result.connection, redirectTo });
    }));
    app.get("/api/distribution/too-lost/status", asyncHandler(async (_req, res) => {
        try {
            const status = await tooLostIntegrationService.getStatus();
            return res.status(200).json(status);
        }
        catch (error) {
            console.error(error);
            console.error(error?.stack);
            return res.status(500).json({
                success: false,
                stage: typeof error === "object" && error && "stage" in error ? String(error.stage) : "operationsServer.getTooLostStatus",
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }));
    app.post("/api/distribution/id-generation", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const trackCount = Number(body.trackCount ?? 0);
        const identifiers = await enterpriseDistributionService.generateIdentifiers(Number.isFinite(trackCount) ? Math.max(0, Math.floor(trackCount)) : 0);
        return res.status(200).json({ success: true, ...identifiers });
    }));
    app.post("/api/distribution/too-lost/disconnect", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const status = await tooLostIntegrationService.disconnect(typeof body.reason === "string" ? body.reason : "Disconnected by operator");
        res.status(200).json({ ok: true, status });
    }));
    app.post("/api/distribution/too-lost/sync-now", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const userId = typeof body.userId === "string" ? body.userId : "";
        const payload = body.payload ?? null;
        const result = await tooLostIntegrationService.syncNow({ userId, payload });
        res.status(200).json({ ok: true, ...result });
    }));
    app.post("/api/distribution/too-lost/releases/:releaseId/submit", asyncHandler(async (req, res) => {
        const result = await tooLostIntegrationService.submitRelease(requestParam(req.params.releaseId));
        res.status(200).json({ ok: true, ...result });
    }));
    app.post("/api/distribution/too-lost/releases/:releaseId/update", asyncHandler(async (req, res) => {
        const result = await tooLostIntegrationService.updateRelease(requestParam(req.params.releaseId));
        res.status(200).json({ ok: true, ...result });
    }));
    app.get("/api/distribution/too-lost/releases/:releaseId/status", asyncHandler(async (req, res) => {
        const result = await tooLostIntegrationService.syncReleaseByLocalReleaseId(requestParam(req.params.releaseId));
        res.status(200).json({ ok: true, status: result.release, updated: result.updated, reason: result.reason });
    }));
    app.get("/api/distribution/too-lost/releases/:releaseId/distribution-status", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, status: await tooLostIntegrationService.fetchDistributionStatus(requestParam(req.params.releaseId)) });
    }));
    app.post("/api/distribution/too-lost/analytics/import", asyncHandler(async (req, res) => {
        const body = readJson(req);
        const userId = typeof body.userId === "string" ? body.userId : "";
        const result = await tooLostIntegrationService.importAnalytics({ userId, payload: body.payload ?? body });
        res.status(200).json({ ok: true, ...result });
    }));
    app.get("/api/distribution/too-lost/me", asyncHandler(async (_req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.getProfile() });
    }));
    app.get("/api/distribution/too-lost/lookup/:resource", asyncHandler(async (req, res) => {
        const resource = normalizeTooLostCategory(requestParam(req.params.resource), ["genres", "languages", "countries", "platforms"]);
        if (!resource)
            return res.status(404).json({ error: "UNKNOWN_LOOKUP_RESOURCE" });
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.listLookup(resource) });
    }));
    app.get("/api/distribution/too-lost/preferences/:resource", asyncHandler(async (req, res) => {
        const resource = normalizeTooLostCategory(requestParam(req.params.resource), ["artist", "label", "spotify", "apple", "youtube", "search"]);
        if (!resource)
            return res.status(404).json({ error: "UNKNOWN_PREFERENCE_RESOURCE" });
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.getPreferences(resource) });
    }));
    app.get("/api/distribution/too-lost/sales/:resource", asyncHandler(async (req, res) => {
        const resource = normalizeTooLostCategory(requestParam(req.params.resource), ["overview", "releases", "tracks", "artists", "channels", "territories", "stream-rates"]);
        if (!resource)
            return res.status(404).json({ error: "UNKNOWN_SALES_RESOURCE" });
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.getSales(resource, queryTextRecord(req.query)) });
    }));
    app.get("/api/distribution/too-lost/analytics/:resource", asyncHandler(async (req, res) => {
        const resource = normalizeTooLostCategory(requestParam(req.params.resource), ["overview", "tracks", "platforms", "charts", "audience", "release-links", "usage-discovery"]);
        if (!resource)
            return res.status(404).json({ error: "UNKNOWN_ANALYTICS_RESOURCE" });
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.getAnalytics(resource, queryTextRecord(req.query)) });
    }));
    app.post("/api/distribution/too-lost/releases", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.createReleaseProxy(readJson(req)) });
    }));
    app.patch("/api/distribution/too-lost/releases/:releaseId/metadata", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.patchReleaseMetadataProxy(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.post("/api/distribution/too-lost/releases/:releaseId/artwork", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.uploadArtworkProxy(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.post("/api/distribution/too-lost/releases/:releaseId/tracks/upload-url", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.uploadTrackUploadUrl(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.put("/api/distribution/too-lost/releases/:releaseId/tracks", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.putReleaseTrackList(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.patch("/api/distribution/too-lost/releases/:releaseId/tracks/:trackId/metadata", asyncHandler(async (req, res) => {
        const body = readJson(req);
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.patchTrackMetadataProxy(requestParam(req.params.releaseId), requestParam(req.params.trackId), body) });
    }));
    app.patch("/api/distribution/too-lost/releases/:releaseId/tracks/:trackId/file", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.patchTrackFileProxy(requestParam(req.params.releaseId), requestParam(req.params.trackId), readJson(req)) });
    }));
    app.patch("/api/distribution/too-lost/releases/:releaseId/delivery", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.patchReleaseDelivery(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.post("/api/distribution/too-lost/releases/:releaseId/validate", asyncHandler(async (req, res) => {
        res.status(200).json({ ok: true, data: await tooLostIntegrationService.validateReleaseProxy(requestParam(req.params.releaseId), readJson(req)) });
    }));
    app.post("/api/distribution/too-lost/sandbox/:runType", asyncHandler(async (req, res) => {
        const runType = requestParam(req.params.runType);
        if (!["oauth", "release_submission", "analytics_sync", "webhook", "failure_recovery"].includes(runType)) {
            return res.status(400).json({ error: "UNKNOWN_SANDBOX_RUN_TYPE" });
        }
        const body = readJson(req);
        await tooLostCredentialStore.recordSandboxRun({
            runType: runType,
            status: String(body.status || "PASS"),
            request: body.request ?? { mode: "sandbox" },
            response: body.response ?? { ok: true },
            notes: typeof body.notes === "string" ? body.notes : "No live Too Lost API call performed.",
        });
        res.status(202).json({ ok: true });
    }));
    if (tooLostConfig.webhooksEnabled) {
        app.post("/api/webhooks/too-lost", asyncHandler(async (req, res) => {
            const rawBody = readRaw(req);
            res.status(200).json(await tooLostWebhookController.handle({ body: rawBody, headers: req.headers }));
        }));
    }
    else {
        logger.info("too lost webhook route disabled", { component: "operations-server", enabled: false });
    }
    app.use((_req, res) => res.status(404).json({ error: "NOT_FOUND" }));
    app.use((error, req, res, _next) => {
        const trace = traceFromHeaders(req.headers);
        logger.error("operations endpoint failed", { component: "operations-server", traceId: trace.traceId, error: serializeError(error) });
        const maybeError = isHttpErrorLike(error) ? error : null;
        const status = typeof maybeError?.status === "number" ? maybeError.status : 500;
        res.status(status).json({ error: status === 500 ? "INTERNAL_ERROR" : maybeError?.code || "REQUEST_FAILED", traceId: trace.traceId });
    });
    const server = app.listen(port, () => logger.info("operations server listening", { component: "operations-server", port, framework: "express" }));
    void optionalTooLostCredentialStore(logger, tooLostCredentialStore, async (store) => {
        await store.syncProviderConfiguration();
        await store.initializePendingCredentialRecord();
    });
    return {
        server,
        close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    };
}
function asyncHandler(handler) {
    return (req, res, next) => {
        void Promise.resolve(handler(req, res)).catch(next);
    };
}
async function optionalTooLostCredentialStore(logger, store, action) {
    try {
        await action(store);
    }
    catch (error) {
        logger.warn("too lost credential store unavailable", {
            component: "operations-server",
            error: serializeError(error),
        });
    }
}
function readJson(req) {
    const raw = readRaw(req);
    if (!raw)
        return {};
    return JSON.parse(raw);
}
function readRaw(req) {
    return Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
}
function acceptsHtml(req) {
    return String(req.headers.accept || "").includes("text/html");
}
function safeReturnToPath(value) {
    if (!value)
        return null;
    if (!value.startsWith("/") || value.startsWith("//"))
        return null;
    return value;
}
function toPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    return value;
}
function normalizeDashboardName(value) {
    const allowed = new Set([
        "overview",
        "rights-review",
        "fraud-review",
        "content-review",
        "dsp-queue",
        "catalog-health",
        "delivery-health",
        "metadata-errors",
        "royalty-health",
    ]);
    return allowed.has(value) ? value : null;
}
function normalizeReportName(value) {
    const allowed = new Set([
        "rejected-releases",
        "duplicate-releases",
        "rights-conflicts",
        "delivery-failures",
        "dsp-errors",
        "royalty-exceptions",
        "fraud-reports",
        "audit-reports",
    ]);
    return allowed.has(value) ? value : null;
}
function normalizeReviewDecision(value) {
    const allowed = new Set(["approve", "reject", "needs_changes", "escalate"]);
    return allowed.has(value) ? value : null;
}
function normalizeFraudDecision(value) {
    const allowed = new Set(["APPROVE", "REJECT", "ESCALATE"]);
    return allowed.has(value) ? value : null;
}
function auditContextFromRequest(req, body) {
    const trace = traceFromHeaders(req.headers);
    return {
        actor: typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : trace.actorUserId || "system",
        ipAddress: getClientIp(req.headers, req.socket.remoteAddress),
        correlationId: trace.traceId,
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
    };
}
function readLimit(query) {
    const value = query.limit;
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = typeof raw === "string" ? Number(raw) : Number(raw ?? 50);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 50;
}
function requestParam(value) {
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
function queryTextRecord(query) {
    const record = {};
    for (const [key, value] of Object.entries(query)) {
        if (typeof value === "string") {
            record[key] = value;
        }
        else if (Array.isArray(value) && typeof value[0] === "string") {
            record[key] = value[0];
        }
    }
    return record;
}
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": readEnv("CORS_ORIGIN") || "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization, svix-id, svix-timestamp, svix-signature",
    };
}
function readEnv(name) {
    loadRuntimeEnv();
    return process.env[name];
}
function isQueueName(value) {
    return queueSet.has(value);
}
function isHttpErrorLike(value) {
    return Boolean(value) && typeof value === "object";
}
function normalizeTooLostCategory(value, allowed) {
    for (const entry of allowed) {
        if (entry === value) {
            return entry;
        }
    }
    return null;
}
function normalizeArtistQuery(value) {
    return value.trim().replace(/\s+/g, " ");
}
function slugifyArtistName(value) {
    return normalizeArtistQuery(value)
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
function escapeLike(value) {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
function clampNumber(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
}
function nullableString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function mapArtistRow(row, fallbackProvider) {
    const name = typeof row.name === "string" ? row.name : "";
    const displayName = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : name;
    return {
        id: typeof row.id === "string" ? row.id : "",
        name,
        display_name: displayName,
        slug: typeof row.slug === "string" && row.slug.trim() ? row.slug : slugifyArtistName(displayName || name),
        provider: typeof row.provider === "string" && row.provider.trim() ? row.provider : fallbackProvider,
        provider_artist_id: nullableString(row.provider_artist_id),
        spotify_artist_id: nullableString(row.spotify_artist_id),
        apple_artist_id: nullableString(row.apple_artist_id),
        country: nullableString(row.country),
        image_url: nullableString(row.image_url),
        image: nullableString(row.image),
        spotify_url: nullableString(row.spotify_url),
        followers: typeof row.followers === "number" ? row.followers : null,
        popularity: typeof row.popularity === "number" ? row.popularity : null,
        picture: nullableString(row.picture),
        picture_small: nullableString(row.picture_small),
        picture_medium: nullableString(row.picture_medium),
        picture_big: nullableString(row.picture_big),
        link: nullableString(row.link),
        tracklist: nullableString(row.tracklist),
        nb_album: typeof row.nb_album === "number" ? row.nb_album : null,
        nb_fan: typeof row.nb_fan === "number" ? row.nb_fan : null,
        radio: typeof row.radio === "boolean" ? row.radio : null,
        source: (typeof row.source === "string" ? row.source : fallbackProvider),
        verified: Boolean(row.verified),
        instagram_url: nullableString(row.instagram_url),
        youtube_url: nullableString(row.youtube_url),
        website_url: nullableString(row.website_url),
        biography: nullableString(row.biography),
    };
}
function toArtistSelectionResponse(row) {
    return {
        artist_id: row.id,
        artist_name: row.display_name || row.name,
        provider: row.provider,
        provider_artist_id: row.provider_artist_id,
        spotify_artist_id: row.spotify_artist_id,
        apple_artist_id: row.apple_artist_id,
        country: row.country,
        image_url: row.image_url,
        image: row.image_url,
        spotify_url: row.spotify_url ?? null,
        followers: row.followers ?? null,
        popularity: row.popularity ?? null,
        picture: row.picture ?? null,
        picture_small: row.picture_small ?? null,
        picture_medium: row.picture_medium ?? null,
        picture_big: row.picture_big ?? null,
        link: row.link ?? null,
        tracklist: row.tracklist ?? null,
        nb_album: row.nb_album ?? null,
        nb_fan: row.nb_fan ?? null,
        radio: row.radio ?? null,
        source: row.source,
        verified: row.verified,
        display_name: row.display_name,
        slug: row.slug,
    };
}
async function ensureDistributedArtistCache(db, supabase, rows, query) {
    const matched = rows.filter((row) => row.name && row.name.toLowerCase().includes(query.toLowerCase()));
    const cached = [];
    for (const row of matched) {
        const name = normalizeArtistQuery(row.name);
        const slug = slugifyArtistName(name);
        const existing = await supabase
            .from("artists")
            .select("*")
            .or(`name.ilike.${escapeLike(name)},slug.eq.${slug}`)
            .maybeSingle();
        if (existing.error)
            throw existing.error;
        if (existing.data) {
            cached.push(mapArtistRow(existing.data, "distributed"));
            continue;
        }
        const created = await upsertArtistRecord({
            name,
            displayName: name,
            slug,
            provider: row.provider,
            providerArtistId: row.provider_artist_id,
            spotifyArtistId: row.spotify_artist_id,
            appleArtistId: row.apple_artist_id,
            imageUrl: row.image_url,
            verified: Boolean(row.verified),
        }, supabase);
        cached.push(created);
    }
    return cached;
}
async function searchArtistsAcrossSources(input) {
    const normalized = normalizeArtistQuery(input.query);
    const localArtists = await searchLocalArtists(input.supabase, normalized, input.limit);
    const pattern = `%${escapeLike(normalized)}%`;
    const [distributedRows] = await input.db.query(`SELECT DISTINCT ON (LOWER(TRIM(name)))
        TRIM(name) AS name,
        'distributed' AS provider,
        NULL::text AS provider_artist_id,
        NULL::text AS spotify_artist_id,
        NULL::text AS apple_artist_id,
        NULL::text AS image_url,
        FALSE AS verified
     FROM (
       SELECT primary_artist AS name FROM public.releases
       WHERE primary_artist ILIKE :pattern AND COALESCE(primary_artist, '') <> ''
       UNION ALL
       SELECT primary_artist AS name FROM public.tracks
       WHERE primary_artist ILIKE :pattern AND COALESCE(primary_artist, '') <> ''
     ) matches
     ORDER BY LOWER(TRIM(name)), name`, { pattern });
    const distributedArtists = await ensureDistributedArtistCache(input.db, input.supabase, distributedRows, normalized);
    const merged = mergeArtistSearchResults([
        ...localArtists,
        ...distributedArtists.map((artist) => ({ ...artist, source: "distributed" })),
    ], normalized);
    return merged.slice(0, input.limit);
}
async function searchLocalArtists(supabase, query, limit) {
    const pattern = `%${escapeLike(query)}%`;
    const slug = slugifyArtistName(query);
    const { data, error } = await supabase
        .from("artists")
        .select("*")
        .or(`name.ilike.${pattern},display_name.ilike.${pattern},slug.ilike.${escapeLike(slug)}`)
        .limit(limit * 2);
    if (error)
        throw error;
    return (data || []).map((row) => mapArtistRow({ ...row, source: typeof row.provider === "string" ? String(row.provider) : "local" }, "local"));
}
function mapDeezerArtistRow(artist) {
    return {
        id: artist.artist_id,
        name: artist.artist_name,
        display_name: artist.artist_name,
        slug: slugifyArtistName(artist.artist_name),
        provider: "deezer",
        provider_artist_id: artist.artist_id,
        spotify_artist_id: null,
        apple_artist_id: null,
        image_url: artist.picture_medium ?? artist.picture_small ?? artist.picture ?? artist.picture_big,
        image: artist.picture_medium ?? artist.picture_small ?? artist.picture ?? artist.picture_big,
        spotify_url: null,
        followers: null,
        popularity: null,
        picture: artist.picture,
        picture_small: artist.picture_small,
        picture_medium: artist.picture_medium,
        picture_big: artist.picture_big,
        link: artist.link,
        tracklist: artist.tracklist,
        country: null,
        nb_album: artist.nb_album,
        nb_fan: artist.nb_fan,
        radio: artist.radio,
        source: "deezer",
        verified: false,
        instagram_url: null,
        youtube_url: null,
        website_url: null,
        biography: null,
    };
}
function mapMusicBrainzArtistRow(artist) {
    return {
        id: artist.id,
        name: artist.name,
        display_name: artist.name,
        slug: slugifyArtistName(artist.name),
        provider: "musicbrainz",
        provider_artist_id: artist.id,
        spotify_artist_id: null,
        apple_artist_id: null,
        image_url: null,
        image: null,
        spotify_url: null,
        followers: null,
        popularity: artist.score,
        picture: null,
        picture_medium: null,
        picture_big: null,
        tracklist: null,
        country: artist.country,
        source: artist.source,
        verified: false,
        instagram_url: null,
        youtube_url: null,
        website_url: null,
        biography: artist.country || artist.type ? [artist.country, artist.type].filter(Boolean).join(" • ") : null,
    };
}
async function upsertArtistRecord(input, supabase) {
    const artistClient = supabase;
    const existing = await artistClient
        .from("artists")
        .select("*")
        .or(`name.ilike.${escapeLike(input.name)},slug.eq.${input.slug}`)
        .maybeSingle();
    if (existing.error)
        throw existing.error;
    if (existing.data) {
        return mapArtistRow(existing.data, input.provider);
    }
    const { data, error } = await artistClient.from("artists").insert({
        name: input.name,
        display_name: input.displayName,
        slug: input.slug,
        provider: input.provider,
        provider_artist_id: input.providerArtistId,
        spotify_artist_id: input.spotifyArtistId,
        apple_artist_id: input.appleArtistId,
        country: input.country ?? null,
        image_url: input.imageUrl,
        instagram_url: input.instagramUrl ?? null,
        youtube_url: input.youtubeUrl ?? null,
        website_url: input.websiteUrl ?? null,
        biography: input.biography ?? null,
        verified: input.verified,
    }).select("*").single();
    if (error)
        throw error;
    return mapArtistRow(data, input.provider);
}
function mergeArtistSearchResults(artists, query) {
    const normalizedQuery = normalizeArtistQuery(query).toLowerCase();
    const deduped = new Map();
    console.info("[ArtistSearch][Backend] merge input", {
        count: artists.length,
        names: artists.map((artist) => artist.display_name || artist.name),
    });
    artists.forEach((artist) => {
        const key = normalizeArtistKey(artist.display_name, artist.name, artist.spotify_artist_id, artist.provider_artist_id);
        const existing = deduped.get(key);
        const candidate = { ...artist, sortScore: scoreArtistMatch(artist, normalizedQuery) };
        if (!existing || sourceMetadataPriority(candidate.source) > sourceMetadataPriority(existing.source) || (sourceMetadataPriority(candidate.source) === sourceMetadataPriority(existing.source) && candidate.sortScore > existing.sortScore)) {
            deduped.set(key, candidate);
        }
    });
    console.info("[ArtistSearch][Backend] merge deduped", {
        count: deduped.size,
        names: [...deduped.values()].map((artist) => artist.display_name || artist.name),
    });
    return [...deduped.values()]
        .sort((a, b) => b.sortScore - a.sortScore || sourceRank(a.source) - sourceRank(b.source) || Number(b.verified) - Number(a.verified) || (b.popularity ?? 0) - (a.popularity ?? 0) || (b.followers ?? 0) - (a.followers ?? 0) || a.display_name.localeCompare(b.display_name))
        .map(({ sortScore: _score, ...artist }) => ({
        id: artist.id,
        name: artist.name,
        display_name: artist.display_name,
        slug: artist.slug,
        verified: artist.verified,
        provider: artist.provider,
        provider_artist_id: artist.provider_artist_id,
        spotify_artist_id: artist.spotify_artist_id,
        apple_artist_id: artist.apple_artist_id,
        image_url: artist.image_url,
        image: artist.image ?? artist.image_url,
        spotify_url: artist.spotify_url ?? null,
        followers: artist.followers ?? null,
        popularity: artist.popularity ?? null,
        picture: artist.picture ?? null,
        picture_medium: artist.picture_medium ?? null,
        picture_big: artist.picture_big ?? null,
        tracklist: artist.tracklist ?? null,
        source: artist.source,
    }));
}
function scoreArtistMatch(artist, query) {
    const haystack = `${artist.display_name} ${artist.name} ${artist.slug}`.toLowerCase();
    if (!query)
        return 0;
    if (haystack === query)
        return 500;
    if (haystack.startsWith(query))
        return 400;
    if (haystack.includes(query))
        return 300;
    return 0;
}
function normalizeArtistKey(displayName, name, spotifyArtistId, providerArtistId) {
    const normalizedDisplayName = normalizeArtistQuery(displayName).toLowerCase();
    const normalizedName = normalizeArtistQuery(name).toLowerCase();
    const normalizedKey = normalizedDisplayName || normalizedName;
    if (normalizedKey)
        return normalizedKey;
    return [spotifyArtistId || "", providerArtistId || ""].filter(Boolean).join("|");
}
function sourceRank(source) {
    switch (source) {
        case "local": return 0;
        case "deezer": return 1;
        case "musicbrainz": return 2;
        case "spotify": return 3;
        case "too_lost": return 4;
        case "distributed": return 5;
        case "apple_music": return 0;
        default: return 0;
    }
}
function sourceMetadataPriority(source) {
    switch (source) {
        case "local": return 4;
        case "deezer": return 3;
        case "musicbrainz": return 2;
        case "spotify": return 2;
        case "too_lost": return 1;
        case "distributed": return 0;
        case "apple_music": return 0;
        default: return 0;
    }
}
async function searchSpotifyArtists(query, limit, cacheRef) {
    const clientId = readEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = readEnv("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        console.error("[ArtistSearch][Spotify] missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
        return [];
    }
    const token = await getSpotifyAccessToken(clientId, clientSecret, cacheRef);
    if (!token) {
        console.error("[ArtistSearch][Spotify] access token acquisition failed");
        return [];
    }
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "artist");
    searchUrl.searchParams.set("limit", String(Math.min(limit, 20)));
    console.info(`[ArtistSearch][Spotify] GET /v1/search q=${query} type=artist limit=${Math.min(limit, 20)}`);
    const response = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const bodyText = await response.text();
    if (!response.ok) {
        console.error(`[ArtistSearch][Spotify] HTTP ${response.status}`, bodyText);
        throw new Error(`Spotify search failed with HTTP ${response.status}`);
    }
    const payload = safeJsonParse(bodyText);
    const items = (payload.artists?.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        popularity: typeof item.popularity === "number" ? item.popularity : null,
        followers: item.followers?.total ?? null,
        image: item.images?.[0]?.url ?? null,
        spotify_url: item.external_urls?.spotify ?? null,
    }));
    console.info("[ArtistSearch][Spotify] HTTP 200", {
        count: items.length,
        names: items.map((item) => item.name),
    });
    return items;
}
async function getSpotifyAccessToken(clientId, clientSecret, cacheRef) {
    const now = Date.now();
    if (cacheRef.current && cacheRef.current.expiresAt > now + 60_000)
        return cacheRef.current.token;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const bodyText = await response.text();
    if (!response.ok) {
        console.error(`[ArtistSearch][Spotify] token HTTP ${response.status}`, bodyText);
        return null;
    }
    const payload = safeJsonParse(bodyText);
    if (!payload.access_token) {
        console.error("[ArtistSearch][Spotify] token response missing access_token", bodyText);
        return null;
    }
    cacheRef.current = {
        token: payload.access_token,
        expiresAt: now + Math.max(0, Number(payload.expires_in || 0)) * 1000,
    };
    console.info("[ArtistSearch][Spotify] access token acquired", { expiresIn: payload.expires_in ?? null });
    return cacheRef.current.token;
}
async function fetchTooLostArtistSearch(query) {
    void query;
    return [];
}
function extractArtistCandidates(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value.filter((item) => item && typeof item === "object");
    if (typeof value === "object") {
        const record = value;
        for (const key of ["items", "data", "artists", "results"]) {
            const nested = record[key];
            if (Array.isArray(nested))
                return nested.filter((item) => item && typeof item === "object");
        }
    }
    return [];
}
function safeJsonParse(value) {
    try {
        return value ? JSON.parse(value) : {};
    }
    catch {
        return { raw: value };
    }
}
