import { randomUUID } from "node:crypto";
import { Contributor, DistributionVersion, Release, ReleaseId, ReleaseVersion, TerritorySet, Track } from "../../domain/index.js";
import { UniversalSerializer } from "../../metadata/metadataSerializer.js";
import { MetadataAudit } from "../../metadata/metadataAudit.js";
import { createMetadataSnapshot } from "../../metadata/metadataSnapshot.js";
import { listMetadataDspProfiles, METADATA_DSP_PROFILES } from "./metadataProfiles.js";
import { recordRetry, setWorkerHealth } from "../../../queue/metrics.js";
import { queueNames } from "../../../queue/queueNames.js";
import { logger as defaultLogger, serializeError } from "../../../observability/logger.js";
function nowIso(now) {
    return now ? now() : new Date().toISOString();
}
function freeze(value) {
    if (Array.isArray(value))
        return Object.freeze([...value]);
    if (value && typeof value === "object")
        return Object.freeze({ ...value });
    return value;
}
function normalizeRecord(value) {
    return value && typeof value === "object" ? freeze(value) : freeze({});
}
function asString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function dedupeText(values) {
    const seen = new Set();
    const output = [];
    for (const value of values) {
        const text = asString(value);
        if (!text)
            continue;
        const key = text.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        output.push(text);
    }
    return freeze(output);
}
function normalizeUnicode(value) {
    return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function cleanText(value, options = {}) {
    const text = asString(value);
    if (!text)
        return null;
    let normalized = normalizeUnicode(text).replace(/\s+/g, " ").trim();
    normalized = normalized.replace(/[<>]/g, "");
    if (!options.allowEmoji)
        normalized = normalized.replace(/\p{Extended_Pictographic}/gu, "");
    if (!options.preserveCase)
        normalized = Array.from(normalized).filter((character) => {
            const code = character.charCodeAt(0);
            return code >= 32 && code !== 127;
        }).join("");
    if (options.titleCase)
        normalized = toTitleCase(normalized);
    return normalized.length ? normalized : null;
}
function toTitleCase(value) {
    return value
        .split(/\s+/)
        .map((part) => {
        if (!part)
            return part;
        if (/^[A-Z0-9&.-]+$/.test(part))
            return part;
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
        .join(" ");
}
function normalizeIdentifier(value) {
    const text = asString(value);
    if (!text)
        return null;
    return text.replace(/[\s-]+/g, "").toUpperCase();
}
function isValidIsrc(value) {
    return Boolean(value && /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(value));
}
function repairIsrc(value) {
    const normalized = normalizeIdentifier(value);
    if (!normalized)
        return null;
    const compact = normalized.replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(compact))
        return compact;
    if (compact.length >= 12)
        return compact.slice(0, 12);
    return null;
}
function isValidUpc(value) {
    if (!value || !/^\d{12}$/.test(value))
        return false;
    return computeUpcCheckDigit(value.slice(0, 11)) === value[11];
}
function repairUpc(value) {
    const normalized = normalizeIdentifier(value)?.replace(/\D/g, "");
    if (!normalized)
        return null;
    const body = normalized.padEnd(11, "0").slice(0, 11);
    return `${body}${computeUpcCheckDigit(body)}`;
}
function computeUpcCheckDigit(body) {
    const digits = body.replace(/\D/g, "").split("").map((entry) => Number(entry));
    let sum = 0;
    for (let index = 0; index < digits.length; index += 1) {
        const digit = digits[index] ?? 0;
        sum += index % 2 === 0 ? digit * 3 : digit;
    }
    return String((10 - (sum % 10)) % 10);
}
function isValidIswc(value) {
    return Boolean(value && /^T-\d{3}\.\d{3}\.\d{3}-\d$/.test(value));
}
function repairIswc(value) {
    const normalized = normalizeIdentifier(value);
    if (!normalized)
        return null;
    if (/^T\d{9}\d$/.test(normalized)) {
        return `T-${normalized.slice(1, 4)}.${normalized.slice(4, 7)}.${normalized.slice(7, 10)}-${normalized.slice(10, 11)}`;
    }
    return null;
}
function isValidIpi(value) {
    return Boolean(value && /^\d{9,11}$/.test(value));
}
function repairIpi(value) {
    const normalized = normalizeIdentifier(value)?.replace(/\D/g, "");
    if (!normalized)
        return null;
    return normalized.slice(0, 11);
}
function isValidIsni(value) {
    return Boolean(value && /^\d{15}[\dX]$/.test(value));
}
function repairIsni(value) {
    const normalized = normalizeIdentifier(value)?.replace(/[^0-9X]/g, "");
    if (!normalized)
        return null;
    return normalized.slice(0, 16);
}
function detectDuplicateName(values) {
    const seen = new Set();
    const duplicates = [];
    for (const value of values) {
        const key = value.toLowerCase();
        if (seen.has(key))
            duplicates.push(value);
        else
            seen.add(key);
    }
    return freeze([...new Set(duplicates)]);
}
function scoreFromRatio(numerator, denominator) {
    if (denominator <= 0)
        return 0;
    return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}
function deriveMood(genre, explicit) {
    const normalized = (genre ?? "").toLowerCase();
    if (explicit)
        return freeze(["Intense", "Aggressive"]);
    if (/chill|ambient|lofi/.test(normalized))
        return freeze(["Chill", "Relaxed"]);
    if (/dance|club|electronic|house|techno/.test(normalized))
        return freeze(["Energetic", "Upbeat"]);
    if (/rock|metal|punk/.test(normalized))
        return freeze(["Intense", "Aggressive"]);
    if (/pop|rnb|soul/.test(normalized))
        return freeze(["Romantic", "Upbeat"]);
    return freeze(["Balanced"]);
}
function cleanMetadataRecord(record, profile) {
    const output = {};
    for (const [key, value] of Object.entries(record)) {
        if (value == null)
            continue;
        if (typeof value === "string") {
            output[key] = cleanText(value, {
                titleCase: ["title", "album", "label", "copyrightOwner"].includes(key) && profile?.titleCase !== false,
                allowEmoji: profile?.allowEmoji ?? false,
                preserveCase: profile?.preserveSubtitleCase && key === "subtitle",
            });
            continue;
        }
        if (Array.isArray(value)) {
            output[key] = freeze(dedupeText(value).map((entry) => cleanText(entry, { titleCase: false, allowEmoji: profile?.allowEmoji ?? false }) ?? entry));
            continue;
        }
        output[key] = value;
    }
    return freeze(output);
}
function mergeRecord(base, metadata) {
    return Object.freeze({ ...base, ...metadata });
}
function buildRepairAction(field, before, after, reason, confidence) {
    return freeze({ field, before, after, reason, confidence });
}
function toScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
export class MetadataIntelligenceEngine {
    deps;
    log;
    serializer = new UniversalSerializer();
    metadataAudit;
    constructor(deps) {
        this.deps = deps;
        this.log = deps.logger ?? defaultLogger.child({ component: "metadata-intelligence-engine" });
        this.metadataAudit = new MetadataAudit(deps.metadataComparator);
    }
    getProfiles() {
        return listMetadataDspProfiles();
    }
    getProfile(platform) {
        return METADATA_DSP_PROFILES[platform];
    }
    async suggestMetadata(input) {
        const source = await this.resolveSource(input);
        const prepared = await this.prepare({
            ...input,
            release: source.release,
            track: source.track,
        });
        const suggestions = this.buildSuggestions(prepared.release, prepared.track, prepared.universalRelease);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            suggestedGenres: suggestions.genres,
            suggestedMood: suggestions.mood,
            suggestedKeywords: suggestions.keywords,
            issues: suggestions.issues,
            metadata: freeze({
                validationValid: prepared.validation.valid,
            }),
        });
    }
    async validateMetadata(input) {
        const result = await this.normalizeInternal(input, { persistAction: "validate" });
        return freeze({
            generatedAt: result.generatedAt,
            releaseId: input.releaseId,
            trackId: input.trackId ?? result.track?.id ?? null,
            valid: result.validation.valid,
            validation: result.validation,
            conflicts: result.conflicts,
            repairs: result.repairs,
            metadata: result.metadata,
        });
    }
    async normalizeMetadata(input) {
        return this.normalizeInternal(input, { persistAction: "normalize" });
    }
    async repairMetadata(input) {
        const repaired = await this.repairInternal(input);
        return freeze({
            generatedAt: repaired.generatedAt,
            release: repaired.release,
            track: repaired.track,
            repairs: repaired.repairs,
            validation: repaired.validation,
            universalRelease: repaired.universalRelease,
            metadata: freeze({
                actor: input.actor ?? null,
                correlationId: input.correlationId ?? null,
            }),
        });
    }
    async compareMetadata(before, after) {
        return this.deps.metadataComparator.compare(before, after);
    }
    async recommendMetadata(input) {
        const prepared = await this.prepare(input);
        return this.buildRecommendations(prepared.release, prepared.track, prepared.universalRelease, prepared.validation, prepared.conflicts);
    }
    async predictDSPCompatibility(input) {
        const prepared = await this.prepare(input);
        const scores = this.computeCompatibility(prepared.release, prepared.track, prepared.universalRelease);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            scores: freeze(scores),
            summary: freeze({
                averageScore: scores.length ? Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length) : 0,
                compatibleCount: scores.filter((entry) => entry.compatible).length,
                incompatibleCount: scores.filter((entry) => !entry.compatible).length,
            }),
            metadata: freeze({
                releaseKind: prepared.universalRelease.kind,
            }),
        });
    }
    async generateMetadataReport(input) {
        const prepared = await this.prepare(input);
        const compatibility = this.computeCompatibility(prepared.release, prepared.track, prepared.universalRelease);
        const quality = this.computeQuality(prepared.release, prepared.track, prepared.universalRelease, prepared.validation, prepared.recommendations, prepared.conflicts, compatibility);
        const version = await this.persistVersion("report", input, prepared, quality, compatibility);
        const history = await this.loadHistory(input.releaseId, input.trackId ?? prepared.track?.id ?? null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            versionId: version.versionId,
            universalRelease: prepared.universalRelease,
            validation: prepared.validation,
            quality,
            compatibility: freeze(compatibility),
            recommendations: freeze(prepared.recommendations),
            conflicts: freeze(prepared.conflicts),
            history: freeze(history),
            metadata: freeze({
                snapshotId: version.versionId,
                fingerprint: version.fingerprint,
            }),
        });
    }
    async generateCompatibilityReport(input) {
        return this.predictDSPCompatibility(input);
    }
    async generateQualityReport(input) {
        const prepared = await this.prepare(input);
        const compatibility = this.computeCompatibility(prepared.release, prepared.track, prepared.universalRelease);
        const quality = this.computeQuality(prepared.release, prepared.track, prepared.universalRelease, prepared.validation, prepared.recommendations, prepared.conflicts, compatibility);
        await this.persistQuality(input, quality, compatibility, prepared);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            summary: freeze({
                releaseKind: prepared.universalRelease.kind,
                validationValid: prepared.validation.valid,
                conflictCount: prepared.conflicts.length,
                recommendationCount: prepared.recommendations.length,
            }),
            scores: quality,
            recommendations: freeze(prepared.recommendations),
            metadata: freeze({
                compatibilityCount: compatibility.length,
            }),
        });
    }
    async generateReleaseReadiness(input) {
        const qualityReport = await this.generateQualityReport(input);
        const blockers = qualityReport.recommendations
            .filter((entry) => entry.severity === "error" || entry.confidence >= 0.8)
            .map((entry) => entry.message);
        const warnings = qualityReport.recommendations.filter((entry) => entry.severity === "warning").map((entry) => entry.message);
        const ready = blockers.length === 0 && qualityReport.scores.overallReleaseScore >= 70;
        return freeze({
            generatedAt: qualityReport.generatedAt,
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            ready,
            score: qualityReport.scores.overallReleaseScore,
            blockers: freeze(blockers),
            warnings: freeze(warnings),
            metadata: freeze({
                quality: qualityReport.scores,
            }),
        });
    }
    async generateIdentifierReport(input) {
        const prepared = await this.prepare(input);
        const identifiers = prepared.universalRelease.identifiers;
        const trackIdentifiers = prepared.universalRelease.tracks.flatMap((track) => track.identifiers);
        const isrcs = identifiers.filter((entry) => entry.type.toLowerCase() === "isrc" || entry.type.toLowerCase() === "internal");
        const upcs = identifiers.filter((entry) => entry.type.toLowerCase() === "upc");
        const broken = identifiers.filter((entry) => entry.type.toLowerCase() === "unknown");
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            totalIdentifiers: identifiers.length + trackIdentifiers.length,
            isrcCount: isrcs.length,
            upcCount: upcs.length,
            brokenCount: broken.length,
            metadata: freeze({
                identifiers,
                trackIdentifiers,
            }),
        });
    }
    async generatePublishingReport(input) {
        const prepared = await this.prepare(input);
        const publishing = prepared.universalRelease.publishing;
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? prepared.track?.id ?? null,
            summary: freeze({
                publisherCount: publishing.writers.length,
                splitCount: publishing.splits.length,
                publisher: publishing.publisher,
            }),
            metadata: freeze({
                publishing,
            }),
        });
    }
    async generateRightsReport(input) {
        const rights = await this.deps.enterpriseRightsService.generateRightsReport(input.releaseId).catch(() => null);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            summary: freeze({
                ownershipVerified: rights?.ownershipVerified ?? false,
                chainOfTitleVerified: rights?.chainOfTitleVerified ?? false,
                conflictCount: rights?.conflicts.length ?? 0,
            }),
            metadata: freeze({ rights }),
        });
    }
    async generateDashboard(input) {
        switch (input.kind ?? "metadata") {
            case "compatibility":
                return this.generateCompatibilityReport(input);
            case "quality":
                return this.generateQualityReport(input);
            case "identifier":
                return this.generateIdentifierReport(input);
            case "release-readiness":
                return this.generateReleaseReadiness(input);
            case "recommendation":
                return this.recommendMetadata(input);
            default:
                return this.generateMetadataReport(input);
        }
    }
    async predictDSPIssues(input) {
        const compatibility = await this.predictDSPCompatibility(input);
        return freeze(compatibility.scores.flatMap((score) => score.issues.map((issue) => ({
            platform: score.platform,
            issue,
            severity: score.score < 40 ? "high" : score.score < 70 ? "medium" : "low",
            scoreImpact: Math.max(0, 100 - score.score),
            metadata: freeze({ platformScore: score.score }),
        }))));
    }
    async retry(input) {
        recordRetry(queueNames.metadataRetry);
        const result = await this.generateMetadataReport(input);
        if (input.error) {
            await this.persistRetry(input, input.error);
        }
        return result;
    }
    async healthCheck() {
        const rows = await this.deps.sql.query("SELECT COUNT(*)::int AS count FROM public.metadata_versions");
        const count = rows[0]?.count ?? 0;
        setWorkerHealth(queueNames.metadataValidation, "healthy");
        return freeze({
            healthy: true,
            generatedAt: nowIso(this.deps.now),
            versionCount: count,
            profiles: listMetadataDspProfiles().length,
        });
    }
    async audit(input) {
        const rows = await this.loadAuditRows(input.releaseId, input.trackId ?? null);
        return rows;
    }
    async prepare(input) {
        const repaired = await this.repairInternal(input);
        const validation = this.deps.metadataValidator.validate(repaired.universalRelease);
        const recommendations = this.buildRecommendations(repaired.release, repaired.track, repaired.universalRelease, validation, []);
        const conflicts = await this.detectConflicts(repaired.release, repaired.track, repaired.universalRelease);
        return freeze({
            release: repaired.release,
            track: repaired.track,
            universalRelease: repaired.universalRelease,
            validation,
            repairs: repaired.repairs,
            recommendations,
            conflicts,
            generatedAt: repaired.generatedAt,
            metadata: freeze({
                source: "metadata-intelligence",
                releaseId: input.releaseId,
                trackId: input.trackId ?? null,
            }),
        });
    }
    async normalizeInternal(input, options) {
        const repaired = await this.repairInternal(input);
        const compatibility = this.computeCompatibility(repaired.release, repaired.track, repaired.universalRelease);
        const quality = this.computeQuality(repaired.release, repaired.track, repaired.universalRelease, repaired.validation, repaired.recommendations, repaired.conflicts, compatibility);
        const metadata = freeze({
            action: options.persistAction,
            actor: input.actor ?? null,
            correlationId: input.correlationId ?? null,
            validation: repaired.validation.valid,
        });
        await this.persistNormalization(input, repaired, quality, compatibility, metadata, options.persistAction);
        return freeze({
            generatedAt: nowIso(this.deps.now),
            release: repaired.release,
            track: repaired.track,
            universalRelease: repaired.universalRelease,
            validation: repaired.validation,
            repairs: repaired.repairs,
            recommendations: repaired.recommendations,
            conflicts: repaired.conflicts,
            quality,
            compatibility: freeze(compatibility),
            metadata,
        });
    }
    async repairInternal(input) {
        const source = await this.resolveSource(input);
        const profile = this.profileForRelease(source.release);
        const releaseMetadata = cleanMetadataRecord(normalizeRecord(source.release.metadata), profile);
        const trackMetadata = cleanMetadataRecord(normalizeRecord(source.track?.metadata), profile);
        const repairs = [];
        const repairedRelease = mergeRecord(source.release, {
            title: cleanText(source.release.title, { titleCase: profile?.titleCase ?? true, allowEmoji: profile?.allowEmoji ?? false }) ?? source.release.title,
            primaryArtist: cleanText(source.release.primaryArtist, { titleCase: profile?.titleCase ?? true, allowEmoji: profile?.allowEmoji ?? false }) ?? source.release.primaryArtist,
            labelName: cleanText(source.release.labelName, { titleCase: profile?.titleCase ?? true, allowEmoji: profile?.allowEmoji ?? false }) ?? source.release.labelName ?? null,
            genre: this.mapGenre(source.release.genre, profile),
            subgenre: this.mapGenre(source.release.subgenre, profile),
            language: this.mapLanguage(source.release.language, profile),
            upc: repairUpc(source.release.upc) ?? source.release.upc ?? null,
            copyrightOwner: cleanText(source.release.copyrightOwner, { titleCase: true, allowEmoji: false }) ?? source.release.copyrightOwner ?? null,
            copyright: cleanText(source.release.copyright, { titleCase: false, allowEmoji: false }) ?? source.release.copyright ?? null,
            pLine: cleanText(source.release.pLine, { titleCase: false, allowEmoji: false }) ?? source.release.pLine ?? null,
            cLine: cleanText(source.release.cLine, { titleCase: false, allowEmoji: false }) ?? source.release.cLine ?? null,
            metadata: freeze({
                ...releaseMetadata,
                ...this.repairIdentifiers(normalizeRecord(source.release.metadata), repairs),
            }),
        });
        const repairedTrack = source.track ? mergeRecord(source.track, {
            title: cleanText(source.track.title, { titleCase: profile?.titleCase ?? true, allowEmoji: profile?.allowEmoji ?? false }) ?? source.track.title,
            primaryArtist: cleanText(source.track.primaryArtist, { titleCase: profile?.titleCase ?? true, allowEmoji: profile?.allowEmoji ?? false }) ?? source.track.primaryArtist ?? null,
            remixer: cleanText(source.track.remixer, { titleCase: true, allowEmoji: false }) ?? source.track.remixer ?? null,
            author: cleanText(source.track.author, { titleCase: true, allowEmoji: false }) ?? source.track.author ?? null,
            composer: cleanText(source.track.composer, { titleCase: true, allowEmoji: false }) ?? source.track.composer ?? null,
            arranger: cleanText(source.track.arranger, { titleCase: true, allowEmoji: false }) ?? source.track.arranger ?? null,
            producer: cleanText(source.track.producer, { titleCase: true, allowEmoji: false }) ?? source.track.producer ?? null,
            publisher: cleanText(source.track.publisher, { titleCase: true, allowEmoji: false }) ?? source.track.publisher ?? null,
            pLine: cleanText(source.track.pLine, { titleCase: false, allowEmoji: false }) ?? source.track.pLine ?? null,
            lyrics: cleanText(source.track.lyrics, { titleCase: false, allowEmoji: false }) ?? source.track.lyrics ?? null,
            isrc: repairIsrc(source.track.isrc) ?? source.track.isrc ?? null,
            metadata: freeze({
                ...trackMetadata,
                ...this.repairIdentifiers(normalizeRecord(source.track.metadata), repairs),
            }),
        }) : null;
        const normalizedRelease = this.deps.metadataTransformer.transform({
            release: repairedRelease,
            tracks: repairedTrack ? [repairedTrack] : [],
            metadata: freeze({
                source: "metadata-intelligence",
                releaseId: input.releaseId,
            }),
        });
        const validation = this.deps.metadataValidator.validate(normalizedRelease);
        const conflicts = await this.detectConflicts(repairedRelease, repairedTrack, normalizedRelease);
        const recommendations = this.buildRecommendations(repairedRelease, repairedTrack, normalizedRelease, validation, conflicts);
        if (repairedRelease.title !== source.release.title)
            repairs.push(buildRepairAction("release.title", source.release.title, repairedRelease.title, "Normalized capitalization and spacing", 0.95));
        if (repairedRelease.primaryArtist !== source.release.primaryArtist)
            repairs.push(buildRepairAction("release.primaryArtist", source.release.primaryArtist, repairedRelease.primaryArtist, "Normalized artist capitalization and spacing", 0.95));
        if (repairedRelease.upc !== source.release.upc)
            repairs.push(buildRepairAction("release.upc", source.release.upc, repairedRelease.upc, "Repaired UPC", 0.99));
        if (repairedTrack && source.track) {
            if (repairedTrack.title !== source.track.title)
                repairs.push(buildRepairAction("track.title", source.track.title, repairedTrack.title, "Normalized track title", 0.95));
            if (repairedTrack.isrc !== source.track.isrc)
                repairs.push(buildRepairAction("track.isrc", source.track.isrc, repairedTrack.isrc, "Repaired ISRC", 0.99));
        }
        return freeze({
            generatedAt: nowIso(this.deps.now),
            release: repairedRelease,
            track: repairedTrack,
            universalRelease: normalizedRelease,
            validation,
            repairs: freeze(repairs),
            recommendations: freeze(recommendations),
            conflicts: freeze(conflicts),
            metadata: freeze({
                source: "metadata-intelligence",
                releaseId: input.releaseId,
                trackId: input.trackId ?? null,
            }),
        });
    }
    repairIdentifiers(metadata, repairs) {
        const output = { ...metadata };
        const isrc = repairIsrc(metadata.isrc);
        if (isrc && isrc !== metadata.isrc)
            repairs.push(buildRepairAction("metadata.isrc", metadata.isrc, isrc, "Repaired ISRC", 0.99));
        if (isrc)
            output.isrc = isrc;
        const upc = repairUpc(metadata.upc);
        if (upc && upc !== metadata.upc)
            repairs.push(buildRepairAction("metadata.upc", metadata.upc, upc, "Repaired UPC", 0.99));
        if (upc)
            output.upc = upc;
        const iswc = repairIswc(metadata.iswc);
        if (iswc && iswc !== metadata.iswc)
            repairs.push(buildRepairAction("metadata.iswc", metadata.iswc, iswc, "Repaired ISWC", 0.9));
        if (iswc)
            output.iswc = iswc;
        const ipi = repairIpi(metadata.ipi);
        if (ipi && ipi !== metadata.ipi)
            repairs.push(buildRepairAction("metadata.ipi", metadata.ipi, ipi, "Repaired IPI", 0.9));
        if (ipi)
            output.ipi = ipi;
        const isni = repairIsni(metadata.isni);
        if (isni && isni !== metadata.isni)
            repairs.push(buildRepairAction("metadata.isni", metadata.isni, isni, "Repaired ISNI", 0.9));
        if (isni)
            output.isni = isni;
        return freeze(output);
    }
    async detectConflicts(release, track, universalRelease) {
        const conflicts = [];
        const title = cleanText(release.title, { titleCase: false });
        const artist = cleanText(release.primaryArtist, { titleCase: false });
        const releaseRows = await this.deps.sql.query(`SELECT id, title, primary_artist, upc
       FROM public.releases
       WHERE id <> :releaseId::uuid
         AND (LOWER(TRIM(title)) = LOWER(TRIM(:title)) OR (NULLIF(LOWER(TRIM(primary_artist)), '') = NULLIF(LOWER(TRIM(:artist)), '') AND NULLIF(LOWER(TRIM(title)), '') = NULLIF(LOWER(TRIM(:title)), '')))
         OR (NULLIF(upc, '') = NULLIF(:upc, ''))`, { releaseId: release.id, title, artist, upc: release.upc ?? null }).catch(() => []);
        for (const row of releaseRows) {
            conflicts.push({
                kind: "duplicate_release",
                releaseId: release.id,
                trackId: track?.id ?? null,
                relatedReleaseId: asString(row.id),
                relatedTrackId: null,
                message: "Potential duplicate release metadata detected.",
                severity: "medium",
                evidence: freeze({ title: row.title ?? null, primaryArtist: row.primary_artist ?? null, upc: row.upc ?? null }),
            });
        }
        if (track?.isrc) {
            const trackRows = await this.deps.sql.query(`SELECT id, release_id, title, primary_artist, isrc
         FROM public.tracks
         WHERE release_id <> :releaseId::uuid AND NULLIF(UPPER(TRIM(isrc)), '') = NULLIF(UPPER(TRIM(:isrc)), '')`, { releaseId: release.id, isrc: track.isrc }).catch(() => []);
            for (const row of trackRows) {
                conflicts.push({
                    kind: "duplicate_isrc",
                    releaseId: release.id,
                    trackId: track.id,
                    relatedReleaseId: asString(row.release_id),
                    relatedTrackId: asString(row.id),
                    message: "Duplicate ISRC detected across releases.",
                    severity: "high",
                    evidence: freeze({ isrc: row.isrc ?? null, title: row.title ?? null, primaryArtist: row.primary_artist ?? null }),
                });
            }
        }
        const contributorNames = dedupeText((track?.writers ?? []).map((writer) => writer.name));
        const duplicates = detectDuplicateName(contributorNames);
        for (const name of duplicates) {
            conflicts.push({
                kind: "duplicate_contributor",
                releaseId: release.id,
                trackId: track?.id ?? null,
                relatedReleaseId: null,
                relatedTrackId: null,
                message: `Duplicate contributor detected: ${name}`,
                severity: "low",
                evidence: freeze({ name }),
            });
        }
        if (universalRelease.identifiers.some((entry) => entry.type.toLowerCase() === "unknown")) {
            conflicts.push({
                kind: "duplicate_alias",
                releaseId: release.id,
                trackId: track?.id ?? null,
                relatedReleaseId: null,
                relatedTrackId: null,
                message: "Unknown identifiers were detected.",
                severity: "low",
                evidence: freeze({ identifiers: universalRelease.identifiers }),
            });
        }
        return freeze(conflicts);
    }
    buildSuggestions(release, track, universalRelease) {
        const genres = new Set();
        const keywords = new Set();
        const issues = new Set();
        const genre = asString(release.genre ?? track?.genre ?? universalRelease.genre.primary);
        if (genre)
            genres.add(this.mapGenre(genre, this.profileForRelease(release)) ?? genre);
        if (!release.genre && !track?.genre)
            issues.add("Missing genre metadata.");
        if (!release.labelName && !track?.publisher)
            issues.add("Missing label or publisher metadata.");
        if (!release.coverArtUrl)
            issues.add("Missing artwork.");
        if (!track?.lyrics)
            issues.add("Missing lyrics.");
        if (!release.upc)
            issues.add("Missing UPC.");
        if (!track?.isrc)
            issues.add("Missing ISRC.");
        for (const token of [release.title, release.primaryArtist, track?.title, track?.primaryArtist, universalRelease.kind]) {
            const text = asString(token);
            if (text)
                keywords.add(text);
        }
        return {
            genres: freeze([...genres]),
            mood: deriveMood(genre ?? null, Boolean(track?.explicit ?? release.copyrightDeclared)),
            keywords: freeze([...keywords]),
            issues: freeze([...issues]),
        };
    }
    buildRecommendations(release, track, universalRelease, validation, conflicts) {
        const recommendations = [];
        if (!release.title || release.title !== cleanText(release.title, { titleCase: true })) {
            recommendations.push(this.recommendation("title", null, "Normalize release title capitalization and spacing.", "warning", 0.92, { current: release.title }));
        }
        if (!release.genre && !track?.genre) {
            recommendations.push(this.recommendation("genre", null, "Add a canonical genre mapping for the release.", "warning", 0.88, { kind: universalRelease.kind }));
        }
        if (!release.coverArtUrl) {
            recommendations.push(this.recommendation("artwork", null, "Attach compliant artwork before delivery.", "error", 0.99, {}));
        }
        if (!track?.lyrics && universalRelease.kind !== "instrumental") {
            recommendations.push(this.recommendation("lyrics", null, "Add lyrics or mark the track instrumental.", "info", 0.75, {}));
        }
        if (!release.upc) {
            recommendations.push(this.recommendation("identifiers", null, "Provide a valid UPC.", "error", 0.98, {}));
        }
        if (!track?.isrc) {
            recommendations.push(this.recommendation("identifiers", null, "Provide a valid ISRC for the track.", "error", 0.98, {}));
        }
        if (!release.labelName && !track?.publisher) {
            recommendations.push(this.recommendation("publishers", null, "Add label or publisher metadata.", "warning", 0.9, {}));
        }
        if (!validation.valid) {
            recommendations.push(this.recommendation("platform_fix", null, "Resolve validation errors before delivery.", "error", 0.99, { errorCount: validation.errors.length }));
        }
        if (conflicts.length) {
            recommendations.push(this.recommendation("contributors", null, "Review duplicate metadata conflicts.", "warning", 0.86, { conflictCount: conflicts.length }));
        }
        return freeze(recommendations);
    }
    recommendation(kind, platform, message, severity, confidence, metadata) {
        return freeze({
            kind,
            platform,
            field: kind,
            message,
            severity,
            confidence,
            metadata,
        });
    }
    computeCompatibility(release, track, universalRelease) {
        const profile = this.profileForRelease(release);
        return freeze(listMetadataDspProfiles().map((entry) => {
            const issues = [];
            const warnings = [];
            const title = cleanText(release.title, { titleCase: entry.titleCase, allowEmoji: entry.allowEmoji });
            if (!title)
                issues.push("Missing release title");
            if (title && title.length > entry.maxTitleLength)
                issues.push("Title exceeds platform length");
            if (track?.title && track.title.length > entry.maxTitleLength)
                issues.push("Track title exceeds platform length");
            if (!release.primaryArtist)
                issues.push("Missing primary artist");
            if (release.genre && !entry.genreMap[(release.genre ?? "").toLowerCase()])
                warnings.push("Genre may need canonical mapping");
            if (release.language && !entry.supportedLanguages.includes(release.language.toLowerCase()))
                warnings.push("Language not listed in profile support");
            if (release.upc && !isValidUpc(repairUpc(release.upc)))
                issues.push("UPC invalid");
            if (track?.isrc && !isValidIsrc(repairIsrc(track.isrc)))
                issues.push("ISRC invalid");
            if (!release.coverArtUrl)
                warnings.push("Artwork missing");
            if (!track?.lyrics && universalRelease.kind !== "instrumental" && entry.platform !== "pandora")
                warnings.push("Lyrics missing");
            const baseScore = 100
                - issues.length * 18
                - warnings.length * 6
                - (profile.platform === entry.platform ? 0 : 0);
            return freeze({
                releaseId: release.id,
                trackId: track?.id ?? null,
                platform: entry.platform,
                score: toScore(baseScore),
                compatible: baseScore >= 70 && issues.length === 0,
                issues: freeze(issues),
                warnings: freeze(warnings),
                metadata: freeze({
                    supportedReleaseKinds: entry.supportedReleaseKinds,
                    identifierRequirements: entry.identifierRequirements,
                }),
            });
        }));
    }
    computeQuality(release, track, universalRelease, validation, recommendations, conflicts, compatibility) {
        const requiredReleaseFields = [release.title, release.primaryArtist, release.labelName, release.coverArtUrl, release.upc, release.releaseDate];
        const requiredTrackFields = track ? [track.title, track.isrc, track.lyrics, track.publisher] : [];
        const presentCount = [...requiredReleaseFields, ...requiredTrackFields].filter((value) => Boolean(asString(value) || typeof value === "boolean")).length;
        const totalCount = requiredReleaseFields.length + requiredTrackFields.length;
        const completeness = scoreFromRatio(presentCount, totalCount);
        const validationScore = validation.valid ? 100 : Math.max(0, 100 - validation.errors.length * 15 - validation.warnings.length * 4);
        const recommendationPenalty = recommendations.length * 5;
        const conflictPenalty = conflicts.length * 12;
        const compatibilityScore = compatibility.length ? Math.round(compatibility.reduce((sum, item) => sum + item.score, 0) / compatibility.length) : 0;
        const publishingScore = Math.max(0, 100 - (universalRelease.publishing.writers.length === 0 ? 20 : 0) - (universalRelease.publishing.publisher ? 0 : 15));
        const rightsScore = Math.max(0, 100 - (!release.rightsOwned ? 20 : 0) - (!release.copyrightDeclared ? 10 : 0) - conflicts.filter((entry) => entry.kind === "duplicate_release" || entry.kind === "duplicate_isrc").length * 10);
        const deliveryScore = this.deps.releaseDeliveryEngine?.validateRelease ? Math.max(0, 100 - this.deps.releaseDeliveryEngine.validateRelease(this.toDomainRelease(release, track)).errors.length * 12) : Math.max(0, validationScore - recommendationPenalty);
        const artworkScore = release.coverArtUrl ? 100 : 40;
        const qualityScore = Math.max(0, 100 - recommendationPenalty - conflictPenalty + Math.round(completeness * 0.2));
        const confidenceScore = Math.max(0, Math.min(100, Math.round((validationScore * 0.35) + (completeness * 0.2) + (compatibilityScore * 0.2) + (rightsScore * 0.1) + (publishingScore * 0.05) - conflictPenalty * 0.1)));
        const overall = Math.max(0, Math.min(100, Math.round((qualityScore + confidenceScore + completeness + compatibilityScore + publishingScore + rightsScore + deliveryScore + artworkScore) / 8)));
        return freeze({
            releaseId: release.id,
            trackId: track?.id ?? null,
            metadataQualityScore: toScore(qualityScore),
            metadataConfidenceScore: toScore(confidenceScore),
            metadataCompletenessScore: toScore(completeness),
            dspCompatibilityScore: toScore(compatibilityScore),
            publishingScore: toScore(publishingScore),
            rightsScore: toScore(rightsScore),
            deliveryScore: toScore(deliveryScore),
            artworkScore: toScore(artworkScore),
            overallReleaseScore: toScore(overall),
            metadata: freeze({
                validationValid: validation.valid,
                validationErrorCount: validation.errors.length,
                validationWarningCount: validation.warnings.length,
                recommendationCount: recommendations.length,
                conflictCount: conflicts.length,
            }),
        });
    }
    async persistNormalization(input, repaired, quality, compatibility, metadata, action) {
        await this.deps.sql.query(`INSERT INTO public.metadata_normalization (
         normalization_id, release_id, track_id, action, validation_valid, metadata, created_at
       ) VALUES (
         :normalizationId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :action, :validationValid, CAST(:metadata AS jsonb), now()
       )`, {
            normalizationId: randomUUID(),
            releaseId: input.releaseId,
            trackId: input.trackId ?? repaired.track?.id ?? null,
            action,
            validationValid: repaired.validation.valid,
            metadata: JSON.stringify({
                quality,
                compatibilityCount: compatibility.length,
                recommendationCount: repaired.recommendations.length,
                conflictCount: repaired.conflicts.length,
            }),
        }).catch(() => undefined);
        const version = await this.persistVersion(action, input, repaired, quality, compatibility);
        await this.persistRecommendations(input, repaired.recommendations, version);
        await this.persistConflicts(input, repaired.conflicts, version);
        await this.persistAudit(input, version, action, metadata, repaired.validation);
    }
    async persistQuality(input, quality, compatibility, repaired) {
        const payload = {
            releaseId: input.releaseId,
            trackId: input.trackId ?? repaired.track?.id ?? null,
            metadataQualityScore: quality.metadataQualityScore,
            metadataConfidenceScore: quality.metadataConfidenceScore,
            metadataCompletenessScore: quality.metadataCompletenessScore,
            dspCompatibilityScore: quality.dspCompatibilityScore,
            publishingScore: quality.publishingScore,
            rightsScore: quality.rightsScore,
            deliveryScore: quality.deliveryScore,
            artworkScore: quality.artworkScore,
            overallReleaseScore: quality.overallReleaseScore,
            metadata: JSON.stringify({ quality, compatibilityCount: compatibility.length }),
        };
        await this.deps.sql.query(`INSERT INTO public.metadata_quality (
         quality_id, release_id, track_id, metadata_quality_score, metadata_confidence_score, metadata_completeness_score, dsp_compatibility_score, publishing_score, rights_score, delivery_score, artwork_score, overall_release_score, metadata, created_at
       ) VALUES (
         :qualityId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :metadataQualityScore, :metadataConfidenceScore, :metadataCompletenessScore, :dspCompatibilityScore, :publishingScore, :rightsScore, :deliveryScore, :artworkScore, :overallReleaseScore, CAST(:metadata AS jsonb), now()
       )`, {
            qualityId: randomUUID(),
            ...payload,
        }).catch(() => undefined);
    }
    async persistVersion(action, input, repaired, quality, compatibility) {
        const snapshot = createMetadataSnapshot({
            releaseId: input.releaseId,
            metadata: repaired.universalRelease,
            serializer: this.serializer,
            hasher: this.deps.metadataHasher,
        });
        const previous = await this.loadLatestVersion(input.releaseId, input.trackId ?? repaired.track?.id ?? null);
        const diff = previous ? this.deps.metadataComparator.compare(previous.metadata, repaired.universalRelease) : null;
        await this.deps.sql.query(`INSERT INTO public.metadata_versions (
         version_id, release_id, track_id, fingerprint, metadata, diff, action, actor, correlation_id, quality_score, compatibility_score, created_at
       ) VALUES (
         :versionId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :fingerprint, CAST(:metadata AS jsonb), CAST(:diff AS jsonb), :action, :actor, :correlationId, :qualityScore, :compatibilityScore, now()
       )`, {
            versionId: snapshot.id,
            releaseId: input.releaseId,
            trackId: input.trackId ?? repaired.track?.id ?? null,
            fingerprint: snapshot.fingerprint,
            metadata: snapshot.serialized,
            diff: diff ? JSON.stringify(diff) : null,
            action,
            actor: input.actor ?? "system",
            correlationId: input.correlationId ?? null,
            qualityScore: quality.overallReleaseScore,
            compatibilityScore: quality.dspCompatibilityScore,
        }).catch(() => undefined);
        await this.deps.sql.query(`INSERT INTO public.metadata_history (
         history_id, release_id, track_id, action, before_version_id, after_version_id, metadata, created_at
       ) VALUES (
         :historyId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :action, :beforeVersionId, :afterVersionId, CAST(:metadata AS jsonb), now()
       )`, {
            historyId: randomUUID(),
            releaseId: input.releaseId,
            trackId: input.trackId ?? repaired.track?.id ?? null,
            action,
            beforeVersionId: previous?.versionId ?? null,
            afterVersionId: snapshot.id,
            metadata: JSON.stringify({
                quality,
                compatibilityCount: compatibility.length,
                recommendationCount: repaired.recommendations.length,
                conflictCount: repaired.conflicts.length,
            }),
        }).catch(() => undefined);
        return freeze({
            versionId: snapshot.id,
            releaseId: input.releaseId,
            trackId: input.trackId ?? repaired.track?.id ?? null,
            fingerprint: snapshot.fingerprint,
            createdAt: snapshot.createdAt.toISOString(),
            metadata: repaired.universalRelease,
            diff,
        });
    }
    async persistRecommendations(input, recommendations, version) {
        for (const recommendation of recommendations) {
            await this.deps.sql.query(`INSERT INTO public.metadata_recommendations (
           recommendation_id, release_id, track_id, kind, platform, field_name, message, severity, confidence_score, metadata, created_at
         ) VALUES (
           :recommendationId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :kind, :platform, :fieldName, :message, :severity, :confidenceScore, CAST(:metadata AS jsonb), now()
         )`, {
                recommendationId: randomUUID(),
                releaseId: input.releaseId,
                trackId: input.trackId ?? null,
                kind: recommendation.kind,
                platform: recommendation.platform,
                fieldName: recommendation.field,
                message: recommendation.message,
                severity: recommendation.severity,
                confidenceScore: recommendation.confidence,
                metadata: JSON.stringify({ versionId: version.versionId, metadata: recommendation.metadata }),
            }).catch(() => undefined);
        }
    }
    async persistConflicts(input, conflicts, version) {
        for (const conflict of conflicts) {
            await this.deps.sql.query(`INSERT INTO public.metadata_conflicts (
           conflict_id, release_id, track_id, conflict_kind, related_release_id, related_track_id, message, severity, evidence, created_at
         ) VALUES (
           :conflictId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :conflictKind, CASE WHEN :relatedReleaseId IS NULL OR :relatedReleaseId = '' THEN NULL ELSE :relatedReleaseId::uuid END, CASE WHEN :relatedTrackId IS NULL OR :relatedTrackId = '' THEN NULL ELSE :relatedTrackId::uuid END, :message, :severity, CAST(:evidence AS jsonb), now()
         )`, {
                conflictId: randomUUID(),
                releaseId: input.releaseId,
                trackId: input.trackId ?? null,
                conflictKind: conflict.kind,
                relatedReleaseId: conflict.relatedReleaseId,
                relatedTrackId: conflict.relatedTrackId,
                message: conflict.message,
                severity: conflict.severity,
                evidence: JSON.stringify({ versionId: version.versionId, ...conflict.evidence }),
            }).catch(() => undefined);
        }
    }
    async persistAudit(input, version, action, metadata, validation) {
        await this.deps.sql.query(`INSERT INTO public.metadata_audit (
         audit_id, release_id, track_id, version_id, action, actor, correlation_id, status, validation_valid, metadata, created_at
       ) VALUES (
         :auditId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :versionId, :action, :actor, :correlationId, :status, :validationValid, CAST(:metadata AS jsonb), now()
       )`, {
            auditId: randomUUID(),
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            versionId: version.versionId,
            action,
            actor: input.actor ?? "system",
            correlationId: input.correlationId ?? null,
            status: validation.valid ? "SUCCESS" : "UPDATED",
            validationValid: validation.valid,
            metadata: JSON.stringify(metadata),
        }).catch(() => undefined);
    }
    async persistRetry(input, error) {
        await this.deps.sql.query(`INSERT INTO public.metadata_repairs (
         repair_id, release_id, track_id, repair_type, status, attempts, max_attempts, last_error, metadata, created_at
       ) VALUES (
         :repairId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, 'retry', 'retrying', :attempts, 3, :lastError, CAST(:metadata AS jsonb), now()
       )`, {
            repairId: `metadata-retry:${input.releaseId}:${input.trackId ?? "release"}`,
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            attempts: 1,
            lastError: error instanceof Error ? error.message : String(error),
            metadata: JSON.stringify({ error: serializeError(error), source: "metadata-retry" }),
        }).catch(() => undefined);
    }
    async loadHistory(releaseId, trackId) {
        const rows = await this.deps.sql.query(`SELECT version_id, release_id, track_id, fingerprint, created_at::text AS created_at, metadata, diff, action, actor, correlation_id
       FROM public.metadata_versions
       WHERE release_id = :releaseId::uuid
         AND (:trackId IS NULL OR track_id = :trackId::uuid)
       ORDER BY created_at DESC
       LIMIT 20`, { releaseId, trackId }).catch(() => []);
        return freeze(rows.map((row) => freeze({
            versionId: row.version_id,
            releaseId: row.release_id,
            trackId: row.track_id,
            fingerprint: row.fingerprint,
            createdAt: row.created_at,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
            diff: typeof row.diff === "string" ? JSON.parse(row.diff) : row.diff,
        })));
    }
    async loadLatestVersion(releaseId, trackId) {
        const rows = await this.deps.sql.query(`SELECT version_id, release_id, track_id, fingerprint, created_at::text AS created_at, metadata, diff, action, actor, correlation_id
       FROM public.metadata_versions
       WHERE release_id = :releaseId::uuid
         AND (:trackId IS NULL OR track_id = :trackId::uuid)
       ORDER BY created_at DESC
       LIMIT 1`, { releaseId, trackId }).catch(() => []);
        const row = rows[0];
        if (!row)
            return null;
        const parsed = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
        return freeze({
            versionId: row.version_id,
            releaseId: row.release_id,
            trackId: row.track_id,
            fingerprint: row.fingerprint,
            createdAt: row.created_at,
            metadata: parsed,
            diff: row.diff ? row.diff : null,
        });
    }
    async loadAuditRows(releaseId, trackId) {
        const rows = await this.deps.sql.query(`SELECT audit_id, release_id, track_id, version_id, action, actor, correlation_id, created_at::text AS created_at, metadata
       FROM public.metadata_audit
       WHERE release_id = :releaseId::uuid
         AND (:trackId IS NULL OR track_id = :trackId::uuid)
       ORDER BY created_at DESC
       LIMIT 50`, { releaseId, trackId }).catch(() => []);
        return freeze(rows.map((row) => freeze({
            id: asString(row.audit_id) ?? randomUUID(),
            releaseId: asString(row.release_id) ?? releaseId,
            trackId: asString(row.track_id) ?? null,
            versionId: asString(row.version_id) ?? "",
            action: asString(row.action) ?? "audit",
            actor: asString(row.actor) ?? "system",
            correlationId: asString(row.correlation_id) ?? null,
            createdAt: asString(row.created_at) ?? nowIso(this.deps.now),
            metadata: normalizeRecord(row.metadata),
        })));
    }
    async resolveSource(input) {
        if (input.release) {
            if (input.track) {
                return freeze({ release: input.release, track: input.track });
            }
            const track = input.trackId
                ? await this.deps.distributionStore.getTrackWithRelease(input.trackId).then((bundle) => (bundle && bundle.release.id === input.release.id ? bundle.track : null)).catch(() => null)
                : null;
            return freeze({ release: input.release, track });
        }
        const bundle = await this.deps.distributionStore.getReleaseWithTracks(input.releaseId);
        if (!bundle) {
            throw new Error(`Release not found: ${input.releaseId}`);
        }
        const track = input.trackId ? bundle.tracks.find((entry) => entry.id === input.trackId) ?? null : null;
        return freeze({
            release: bundle.release,
            track: track ?? (input.trackId ? await this.deps.distributionStore.getTrackWithRelease(input.trackId).then((entry) => (entry?.release.id === bundle.release.id ? entry.track : null)).catch(() => null) : null),
        });
    }
    profileForRelease(release) {
        const platform = asString(release.metadata?.targetPlatform);
        return platform && platform in METADATA_DSP_PROFILES ? METADATA_DSP_PROFILES[platform] : METADATA_DSP_PROFILES.spotify;
    }
    mapGenre(value, profile) {
        const text = asString(value);
        if (!text)
            return null;
        const mapping = profile?.genreMap ?? {};
        return mapping[text.toLowerCase()] ?? text;
    }
    mapLanguage(value, profile) {
        const text = asString(value);
        if (!text)
            return null;
        return profile?.supportedLanguages.includes(text.toLowerCase()) ? text.toLowerCase() : text.toLowerCase();
    }
    toDomainRelease(release, track) {
        const contributor = new Contributor({
            name: release.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist",
            roles: ["primary_artist"],
            isPrimary: true,
        });
        return new Release({
            id: new ReleaseId(release.id),
            title: release.title ?? track?.title ?? "Untitled",
            primaryArtist: release.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist",
            version: release.version ? new ReleaseVersion(release.version) : null,
            state: "DRAFT",
            contributors: [contributor],
            tracks: [new Track({
                    id: track?.id ?? `${release.id}:track`,
                    title: track?.title ?? release.title ?? "Untitled",
                    version: track?.version ? new ReleaseVersion(track.version) : null,
                    discNumber: 1,
                    trackNumber: 1,
                    contributors: [contributor],
                    territories: new TerritorySet(["WORLD"]),
                    isrc: track?.isrc ?? null,
                    audioReference: track?.audioUrl ?? null,
                    artworkReference: release.coverArtUrl ?? null,
                    explicit: Boolean(track?.explicit ?? false),
                    lyrics: track?.lyrics ?? null,
                    metadata: { ...(release.metadata ?? {}), ...(track?.metadata ?? {}) },
                })],
            label: release.labelName ?? null,
            upc: release.upc ?? null,
            releaseDate: release.releaseDate ?? null,
            originalReleaseDate: release.originalReleaseDate ?? null,
            territories: new TerritorySet(["WORLD"]),
            distributionVersion: new DistributionVersion("1.0"),
            metadata: { ...(release.metadata ?? {}), ...(track?.metadata ?? {}) },
        });
    }
}
