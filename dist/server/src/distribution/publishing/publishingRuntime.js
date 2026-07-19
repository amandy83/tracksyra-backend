import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    return Object.freeze({ ...value });
}
function freezeList(values) {
    return Object.freeze([...values]);
}
function createId(prefix, parts = []) {
    const suffix = parts.filter(Boolean).join(":") || randomUUID();
    return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomUUID().slice(0, 8)}`;
}
function normalizeOptionalText(value) {
    if (value == null)
        return null;
    const text = value.trim();
    return text.length ? text : null;
}
function normalizeText(value) {
    const text = value.trim();
    if (!text) {
        throw new Error("Publishing text value must not be empty");
    }
    return text;
}
function normalizeName(value) {
    return normalizeText(value).replace(/\s+/g, " ");
}
function normalizedKey(value) {
    return normalizeName(value).toLowerCase();
}
function normalizeTerritories(values) {
    const territories = (values ?? []).map((entry) => normalizeText(entry).toUpperCase());
    return freezeList([...new Set(territories)]);
}
function normalizePercentage(value, field) {
    if (!Number.isFinite(value)) {
        throw new Error(`${field} must be finite`);
    }
    if (value < 0 || value > 100) {
        throw new Error(`${field} must be between 0 and 100`);
    }
    return Math.round(value * 10000) / 10000;
}
function normalizeIpi(value) {
    if (value == null)
        return null;
    const text = value.trim().replace(/\s+/g, "");
    return text.length ? text : null;
}
function normalizeIsni(value) {
    if (value == null)
        return null;
    const text = value.trim().replace(/[-\s]/g, "").toUpperCase();
    return text.length ? text : null;
}
function normalizeIswc(value) {
    if (value == null)
        return null;
    const text = value.trim().toUpperCase();
    return text.length ? text.replace(/\s+/g, "") : null;
}
function toIdentityInput(value) {
    return "normalizedName" in value
        ? {
            identityId: value.identityId,
            kind: value.kind,
            name: value.name,
            ipi: value.ipi,
            cae: value.cae,
            isni: value.isni,
            controlled: value.controlled,
            territories: value.territories,
            metadata: value.metadata,
        }
        : value;
}
export function isValidIswc(value) {
    const normalized = normalizeIswc(value);
    return Boolean(normalized && /^T-\d{3}\.\d{3}\.\d{3}-[0-9X]$/.test(normalized));
}
export function isValidIpi(value) {
    const normalized = normalizeIpi(value);
    return Boolean(normalized && /^\d{11,13}$/.test(normalized));
}
export function isValidIsni(value) {
    const normalized = normalizeIsni(value);
    return Boolean(normalized && /^[0-9A-Z]{16}$/.test(normalized));
}
function makeValidationIssue(code, path, message, severity, value) {
    return Object.freeze({
        code,
        path,
        message,
        severity,
        value,
    });
}
function makeConflict(workId, type, message, references, metadata = {}) {
    return Object.freeze({
        conflictId: createId("publishing-conflict", [workId, type]),
        workId,
        type,
        message,
        references: freezeList(references),
        createdAt: nowIso(),
        metadata: freeze({ ...metadata }),
    });
}
function makeAuditEvent(workId, action, oldValue, newValue, metadata = {}, actor = "system", reason = null, ipAddress = null, correlationId = null) {
    return Object.freeze({
        eventId: createId("publishing-audit", [workId, action]),
        workId,
        actor,
        action,
        occurredAt: nowIso(),
        ipAddress,
        correlationId,
        reason,
        oldValue,
        newValue,
        metadata: freeze({ ...metadata }),
    });
}
export class PublishingRegistry {
    works = new Map();
    workHistory = new Map();
    identities = new Map();
    writers = new Map();
    publishers = new Map();
    subPublishers = new Map();
    agreements = new Map();
    splits = new Map();
    mechanicalRights = new Map();
    performanceRights = new Map();
    neighbouringRights = new Map();
    conflicts = new Map();
    audits = new Map();
    iswcIndex = new Map();
    isrcIndex = new Map();
    ipiIndex = new Map();
    isniIndex = new Map();
    registerIdentity(input) {
        const normalizedInput = toIdentityInput(input);
        const identityId = normalizeOptionalText(normalizedInput.identityId) ?? createId("identity", [normalizedInput.kind, normalizedInput.name]);
        const now = nowIso();
        const record = Object.freeze({
            identityId,
            kind: normalizedInput.kind,
            name: normalizeName(normalizedInput.name),
            normalizedName: normalizedKey(normalizedInput.name),
            roles: freezeList([normalizedInput.kind]),
            ipi: normalizeIpi(normalizedInput.ipi),
            cae: normalizeOptionalText(normalizedInput.cae),
            isni: normalizeIsni(normalizedInput.isni),
            controlled: normalizedInput.controlled ?? false,
            territories: normalizeTerritories(normalizedInput.territories),
            metadata: freeze({ ...(normalizedInput.metadata ?? {}) }),
            createdAt: this.identities.get(identityId)?.createdAt ?? now,
            updatedAt: now,
        });
        const duplicate = this.findIdentityDuplicate(record);
        if (duplicate) {
            this.recordConflict(makeConflict(identityId, "duplicate_identity", `Identity duplicate detected for ${record.name}`, [duplicate.identityId, record.identityId], { kind: record.kind }));
        }
        this.identities.set(identityId, record);
        this.indexIdentity(record);
        this.categoryMap(record.kind).set(identityId, record);
        return record;
    }
    registerAgreement(input) {
        const agreementId = normalizeOptionalText(input.agreementId) ?? createId("agreement", [input.kind, input.partyId]);
        const now = nowIso();
        const record = Object.freeze({
            agreementId,
            kind: input.kind,
            partyId: normalizeText(input.partyId),
            effectiveFrom: normalizeOptionalText(input.effectiveFrom),
            effectiveTo: normalizeOptionalText(input.effectiveTo),
            exclusive: input.exclusive ?? false,
            territories: normalizeTerritories(input.territories),
            metadata: freeze({ ...(input.metadata ?? {}) }),
            createdAt: this.agreements.get(agreementId)?.createdAt ?? now,
            updatedAt: now,
        });
        this.agreements.set(agreementId, record);
        return record;
    }
    registerWork(input) {
        const workId = normalizeOptionalText(input.workId) ?? createId("work", [input.title]);
        const now = nowIso();
        const writers = freezeList((input.writers ?? []).map((writer) => this.registerIdentity(writer)));
        const publishers = freezeList((input.publishers ?? []).map((publisher) => this.registerIdentity(publisher)));
        const subPublishers = freezeList((input.subPublishers ?? []).map((subPublisher) => this.registerIdentity(subPublisher)));
        const agreements = freezeList((input.agreements ?? []).map((agreement) => this.registerAgreement(agreement)));
        const previousRevision = this.works.get(workId)?.revision ?? 0;
        const work = Object.freeze({
            workId,
            title: normalizeName(input.title),
            originalTitle: normalizeOptionalText(input.originalTitle),
            alternateTitles: freezeList((input.alternateTitles ?? []).map((title) => normalizeName(title))),
            arrangementType: normalizeOptionalText(input.arrangementType),
            adaptationType: normalizeOptionalText(input.adaptationType),
            medley: input.medley ?? false,
            samples: freezeList((input.samples ?? []).map((sample) => normalizeName(sample))),
            composite: input.composite ?? false,
            territories: normalizeTerritories(input.territories),
            iswc: normalizeIswc(input.iswc),
            isrcs: freezeList((input.isrcs ?? []).map((isrc) => normalizeText(isrc).toUpperCase())),
            chainOfTitle: freezeList((input.chainOfTitle ?? []).map((entry) => normalizeName(entry))),
            publicDomain: input.publicDomain ?? false,
            writers,
            publishers,
            subPublishers,
            agreements,
            splits: freezeList(this.normalizeSplits(workId, input.splits ?? [])),
            mechanicalRights: freezeList(this.normalizeRights(workId, "mechanical", input.mechanicalRights ?? [])),
            performanceRights: freezeList(this.normalizeRights(workId, "performance", input.performanceRights ?? [])),
            neighbouringRights: freezeList(this.normalizeRights(workId, "neighboring", input.neighbouringRights ?? [])),
            revision: previousRevision + 1,
            deleted: false,
            deletedAt: null,
            metadata: freeze({ ...(input.metadata ?? {}) }),
            createdAt: this.works.get(workId)?.createdAt ?? now,
            updatedAt: now,
        });
        this.works.set(workId, work);
        this.splits.set(workId, work.splits);
        this.mechanicalRights.set(workId, work.mechanicalRights);
        this.performanceRights.set(workId, work.performanceRights);
        this.neighbouringRights.set(workId, work.neighbouringRights);
        this.persistHistory(workId, work);
        this.indexWork(work);
        return work;
    }
    updateWork(workId, patch) {
        const current = this.requireWork(workId);
        const next = this.registerWork({
            workId,
            title: patch.title ?? current.title,
            originalTitle: patch.originalTitle ?? current.originalTitle,
            alternateTitles: patch.alternateTitles ?? current.alternateTitles,
            arrangementType: patch.arrangementType ?? current.arrangementType,
            adaptationType: patch.adaptationType ?? current.adaptationType,
            medley: patch.medley ?? current.medley,
            samples: patch.samples ?? current.samples,
            composite: patch.composite ?? current.composite,
            territories: patch.territories ?? current.territories,
            iswc: patch.iswc ?? current.iswc,
            isrcs: patch.isrcs ?? current.isrcs,
            chainOfTitle: patch.chainOfTitle ?? current.chainOfTitle,
            writers: patch.writers ?? current.writers,
            publishers: patch.publishers ?? current.publishers,
            subPublishers: patch.subPublishers ?? current.subPublishers,
            agreements: patch.agreements ?? current.agreements,
            splits: patch.splits ?? current.splits,
            mechanicalRights: patch.mechanicalRights ?? current.mechanicalRights,
            performanceRights: patch.performanceRights ?? current.performanceRights,
            neighbouringRights: patch.neighbouringRights ?? current.neighbouringRights,
            publicDomain: patch.publicDomain ?? current.publicDomain,
            metadata: patch.metadata ?? current.metadata,
        });
        this.recordAudit(makeAuditEvent(workId, "UPDATE_COMPOSITION", current, next, { revision: next.revision }, "system"));
        return next;
    }
    deleteWork(workId, reason = null) {
        const current = this.requireWork(workId);
        const deleted = Object.freeze({
            ...current,
            deleted: true,
            deletedAt: nowIso(),
            updatedAt: nowIso(),
            revision: current.revision + 1,
        });
        this.works.set(workId, deleted);
        this.persistHistory(workId, deleted);
        this.recordAudit(makeAuditEvent(workId, "DELETE_COMPOSITION", current, deleted, { deleted: true }, "system", reason));
        return deleted;
    }
    saveSplit(workId, split) {
        const current = this.splits.get(workId) ?? [];
        this.splits.set(workId, freezeList([...current.filter((entry) => entry.splitId !== split.splitId), split]));
    }
    saveRight(workId, right) {
        const map = this.rightMap(right.kind);
        const current = map.get(workId) ?? [];
        map.set(workId, freezeList([...current.filter((entry) => entry.rightId !== right.rightId), right]));
    }
    recordConflict(conflict) {
        this.conflicts.set(conflict.conflictId, conflict);
        return conflict;
    }
    recordAudit(event) {
        const current = this.audits.get(event.workId) ?? [];
        this.audits.set(event.workId, freezeList([...current, event]));
        return event;
    }
    findWork(workId) {
        return this.works.get(workId) ?? null;
    }
    listWorks() {
        return freezeList([...this.works.values()]);
    }
    listIdentities(kind) {
        if (!kind) {
            return freezeList([...this.identities.values()]);
        }
        return freezeList([...this.categoryMap(kind).values()]);
    }
    listAgreements() {
        return freezeList([...this.agreements.values()]);
    }
    listConflicts(workId) {
        return freezeList([...this.conflicts.values()].filter((entry) => workId ? entry.workId === workId : true));
    }
    listAuditEvents(workId) {
        return freezeList([...this.audits.values()].flat().filter((entry) => workId ? entry.workId === workId : true));
    }
    getWorkHistory(workId) {
        return this.workHistory.get(workId) ?? freezeList([]);
    }
    getCounts() {
        const works = this.listWorks();
        const writerKinds = ["writer", "composer", "lyricist"];
        const writers = this.listIdentities().filter((identity) => writerKinds.includes(identity.kind)).length;
        const publishers = this.listIdentities("publisher").length;
        const subPublishers = this.listIdentities("sub_publisher").length;
        const splits = works.reduce((count, work) => count + work.splits.length, 0);
        const rights = works.reduce((count, work) => count + work.mechanicalRights.length + work.performanceRights.length + work.neighbouringRights.length, 0);
        const pendingIswcGeneration = works.filter((work) => !work.deleted && !work.iswc).length;
        return Object.freeze({
            works: works.length,
            writers,
            publishers,
            subPublishers,
            splits,
            rights,
            agreements: this.agreements.size,
            conflicts: this.conflicts.size,
            auditEvents: this.listAuditEvents().length,
            pendingIswcGeneration,
            metadata: freeze({}),
        });
    }
    resolveIdentity(input) {
        if (input.identityId) {
            const record = this.identities.get(input.identityId);
            if (record)
                return record;
        }
        const normalizedName = input.name ? normalizedKey(input.name) : null;
        const normalizedIpi = normalizeIpi(input.ipi);
        const normalizedIsni = normalizeIsni(input.isni);
        const candidates = [...this.identities.values()].filter((record) => (normalizedName ? record.normalizedName === normalizedName : true)
            && (normalizedIpi ? record.ipi === normalizedIpi : true)
            && (normalizedIsni ? record.isni === normalizedIsni : true)
            && (input.kind ? this.kindMatches(record.kind, input.kind) : true));
        return candidates[0] ?? null;
    }
    getByIswc(iswc) {
        const key = normalizeIswc(iswc);
        if (!key)
            return null;
        const workId = this.iswcIndex.get(key);
        return workId ? this.works.get(workId) ?? null : null;
    }
    getByIsrc(isrc) {
        const key = isrc ? normalizeText(isrc).toUpperCase() : null;
        if (!key)
            return null;
        const workId = this.isrcIndex.get(key);
        return workId ? this.works.get(workId) ?? null : null;
    }
    requireWork(workId) {
        const work = this.works.get(workId);
        if (!work) {
            throw new Error(`Publishing work not found: ${workId}`);
        }
        return work;
    }
    persistHistory(workId, work) {
        const history = this.workHistory.get(workId) ?? [];
        this.workHistory.set(workId, freezeList([...history, work]));
    }
    indexIdentity(record) {
        const existingIpi = record.ipi ? this.ipiIndex.get(record.ipi) : null;
        if (existingIpi && existingIpi !== record.identityId) {
            this.recordConflict(makeConflict(record.identityId, "duplicate_identity", "IPI already exists for another identity", [existingIpi, record.identityId], { ipi: record.ipi }));
        }
        if (record.ipi)
            this.ipiIndex.set(record.ipi, record.identityId);
        const existingIsni = record.isni ? this.isniIndex.get(record.isni) : null;
        if (existingIsni && existingIsni !== record.identityId) {
            this.recordConflict(makeConflict(record.identityId, "duplicate_identity", "ISNI already exists for another identity", [existingIsni, record.identityId], { isni: record.isni }));
        }
        if (record.isni)
            this.isniIndex.set(record.isni, record.identityId);
    }
    indexWork(work) {
        if (work.iswc) {
            const existing = this.iswcIndex.get(work.iswc);
            if (existing && existing !== work.workId) {
                this.recordConflict(makeConflict(work.workId, "duplicate_iswc", "ISWC already exists for another work", [existing, work.workId], { iswc: work.iswc }));
            }
            this.iswcIndex.set(work.iswc, work.workId);
        }
        for (const isrc of work.isrcs) {
            const existing = this.isrcIndex.get(isrc);
            if (existing && existing !== work.workId) {
                this.recordConflict(makeConflict(work.workId, "duplicate_isrc", "ISRC already exists for another work", [existing, work.workId], { isrc }));
            }
            this.isrcIndex.set(isrc, work.workId);
        }
    }
    findIdentityDuplicate(record) {
        return [...this.identities.values()].find((entry) => entry.identityId !== record.identityId
            && (entry.normalizedName === record.normalizedName
                || (record.ipi != null && entry.ipi === record.ipi)
                || (record.isni != null && entry.isni === record.isni))) ?? null;
    }
    normalizeSplits(workId, splits) {
        return splits.map((split, index) => {
            const partyId = normalizeOptionalText(split.partyId) ?? this.resolveSplitPartyId(split.partyName, split.role);
            return Object.freeze({
                splitId: createId("split", [workId, String(index)]),
                workId,
                partyId,
                partyName: normalizeName(split.partyName),
                role: split.role,
                percentage: normalizePercentage(split.percentage, "PublishingSplit.percentage"),
                territories: normalizeTerritories(split.territories),
                controlled: split.controlled ?? false,
                metadata: freeze({ ...(split.metadata ?? {}) }),
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
        });
    }
    normalizeRights(workId, kind, rights) {
        return rights.map((right, index) => Object.freeze({
            rightId: createId("right", [workId, kind, String(index)]),
            workId,
            ownerId: normalizeOptionalText(right.ownerId) ?? createId("owner", [kind, right.ownerName]),
            ownerName: normalizeName(right.ownerName),
            kind,
            percentage: normalizePercentage(right.percentage, `Publishing${kind}Right.percentage`),
            territories: normalizeTerritories(right.territories),
            exclusive: right.exclusive ?? false,
            metadata: freeze({ ...(right.metadata ?? {}) }),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        }));
    }
    resolveSplitPartyId(partyName, role) {
        const identity = this.resolveIdentity({ name: partyName, kind: role === "publisher" ? "publisher" : role === "sub_publisher" ? "sub_publisher" : "writer" });
        if (identity)
            return identity.identityId;
        return createId("party", [partyName, role]);
    }
    categoryMap(kind) {
        switch (kind) {
            case "publisher":
                return this.publishers;
            case "sub_publisher":
                return this.subPublishers;
            case "writer":
            case "composer":
            case "lyricist":
            case "artist":
            case "producer":
            case "label":
            default:
                return this.writers;
        }
    }
    rightMap(kind) {
        switch (kind) {
            case "mechanical":
                return this.mechanicalRights;
            case "performance":
                return this.performanceRights;
            case "neighboring":
            default:
                return this.neighbouringRights;
        }
    }
    kindMatches(recordKind, requestedKind) {
        const writerKinds = ["writer", "composer", "lyricist"];
        if (requestedKind === "writer") {
            return writerKinds.includes(recordKind);
        }
        if (requestedKind === "composer" || requestedKind === "lyricist") {
            return writerKinds.includes(recordKind);
        }
        if (requestedKind === "publisher") {
            return recordKind === "publisher";
        }
        if (requestedKind === "sub_publisher") {
            return recordKind === "sub_publisher";
        }
        return recordKind === requestedKind;
    }
}
export class PublishingSplitEngine {
    validate(work, registry) {
        const errors = [];
        const warnings = [];
        if (!work.writers.length && !work.publishers.length) {
            errors.push(makeValidationIssue("missing_ownership", "work.ownership", "Work must have at least one writer or publisher", "error", work.workId));
        }
        if (!work.chainOfTitle.length) {
            errors.push(makeValidationIssue("chain_of_title_missing", "work.chainOfTitle", "Chain of title is required", "error", work.chainOfTitle));
        }
        if (work.iswc && !isValidIswc(work.iswc)) {
            errors.push(makeValidationIssue("iswc_invalid", "work.iswc", "ISWC is invalid", "error", work.iswc));
        }
        const duplicateSplitKeys = new Set();
        const duplicateSplitEntries = [];
        let total = 0;
        for (const split of work.splits) {
            total += split.percentage;
            const key = `${split.partyId}:${split.role}:${split.partyName}`;
            if (duplicateSplitKeys.has(key)) {
                duplicateSplitEntries.push(key);
            }
            duplicateSplitKeys.add(key);
            if (split.percentage < 0) {
                errors.push(makeValidationIssue("negative_split", `splits.${split.partyName}`, "Split percentage cannot be negative", "error", split.percentage));
            }
            const territories = split.territories.length ? split.territories : work.territories;
            const invalidTerritories = territories.filter((territory) => !work.territories.includes(territory));
            if (invalidTerritories.length) {
                errors.push(makeValidationIssue("territory_conflict", `splits.${split.partyName}.territories`, "Split territories must be included in work territories", "error", invalidTerritories));
            }
            if ((split.role === "publisher" || split.role === "sub_publisher") && !registry.resolveIdentity({ identityId: split.partyId, kind: split.role === "publisher" ? "publisher" : "sub_publisher" })) {
                errors.push(makeValidationIssue("publisher_conflict", `splits.${split.partyName}.partyId`, "Publisher split must resolve to a registered publisher", "error", split.partyId));
            }
        }
        if (!work.splits.length) {
            errors.push(makeValidationIssue("missing_split", "work.splits", "Publishing splits are required", "error", work.splits));
        }
        else if (Math.abs(total - 100) > 0.01) {
            errors.push(makeValidationIssue("split_total", "work.splits", "Publishing splits must total 100%", "error", total));
        }
        if (duplicateSplitEntries.length) {
            errors.push(makeValidationIssue("duplicate_split", "work.splits", "Duplicate split entries were detected", "error", duplicateSplitEntries));
        }
        const writerKeys = new Set(work.writers.map((writer) => `${writer.normalizedName}:${writer.ipi ?? ""}:${writer.isni ?? ""}`));
        if (writerKeys.size !== work.writers.length) {
            errors.push(makeValidationIssue("duplicate_identity", "work.writers", "Duplicate contributor identities were detected", "error", work.writers.map((writer) => writer.name)));
        }
        if (work.publicDomain && (work.splits.length || work.publishers.length || work.writers.length)) {
            warnings.push(makeValidationIssue("public_domain", "work.publicDomain", "Public domain works should not carry exclusive publishing claims", "warning", work.publicDomain));
        }
        return Object.freeze({
            valid: errors.length === 0,
            errors: freezeList(errors),
            warnings: freezeList(warnings),
            conflicts: registry.listConflicts(work.workId),
            metadata: freeze({
                workId: work.workId,
                splitTotal: total,
            }),
        });
    }
}
export class PublishingCwrGenerator {
    generate(work, options = {}) {
        const messageType = work.deleted
            ? "WorkDeletion"
            : work.revision > 1
                ? "RevisedWorkRegistration"
                : "NewWorkRegistration";
        const records = this.buildRecords(work, messageType, options);
        const text = records.map((record) => [record.type, ...record.fields].join("|")).join("\n");
        const compressed = options.compress === false ? null : gzipSync(text);
        return Object.freeze({
            workId: work.workId,
            messageType,
            schemaVersion: "CWR 4.0",
            records: freezeList(records),
            text,
            compressed,
            signature: options.signature ?? createHash("sha256").update(text, "utf8").digest("hex"),
            createdAt: options.creationDateTime ?? nowIso(),
            metadata: freeze({
                sender: options.sender ?? null,
                recipient: options.recipient ?? null,
            }),
        });
    }
    buildRecords(work, messageType, options) {
        const records = [
            { type: "HDR", fields: freezeList(["TrackSyra", "CWR", "4.0", options.sender ?? "TrackSyra", options.recipient ?? "DSP", options.creationDateTime ?? nowIso(), messageType]) },
            { type: messageType === "WorkDeletion" ? "DWR" : messageType === "RevisedWorkRegistration" ? "RWR" : "NWR", fields: freezeList([work.workId, work.title, work.originalTitle ?? "", String(work.revision)]) },
            { type: "WKS", fields: freezeList([work.workId, work.title, work.arrangementType ?? "", work.adaptationType ?? "", work.medley ? "Y" : "N", work.composite ? "Y" : "N"]) },
        ];
        for (const title of [...work.alternateTitles].sort()) {
            records.push({ type: "ALT", fields: freezeList([work.workId, title]) });
        }
        for (const writer of [...work.writers].sort((left, right) => left.name.localeCompare(right.name))) {
            records.push({
                type: "WRT",
                fields: freezeList([
                    work.workId,
                    writer.identityId,
                    writer.name,
                    writer.kind,
                    writer.ipi ?? "",
                    writer.isni ?? "",
                    writer.controlled ? "Y" : "N",
                    writer.roles.join(","),
                    writer.territories.join(","),
                ]),
            });
        }
        for (const publisher of [...work.publishers, ...work.subPublishers].sort((left, right) => left.name.localeCompare(right.name))) {
            records.push({
                type: "PUB",
                fields: freezeList([
                    work.workId,
                    publisher.identityId,
                    publisher.name,
                    publisher.kind,
                    publisher.ipi ?? "",
                    publisher.isni ?? "",
                    publisher.territories.join(","),
                ]),
            });
        }
        for (const split of work.splits) {
            records.push({
                type: "SPL",
                fields: freezeList([
                    work.workId,
                    split.partyId,
                    split.partyName,
                    split.role,
                    split.percentage.toFixed(4),
                    split.controlled ? "Y" : "N",
                    split.territories.join(","),
                ]),
            });
        }
        if (work.iswc) {
            records.push({ type: "ISWC", fields: freezeList([work.workId, work.iswc]) });
        }
        for (const isrc of [...work.isrcs].sort()) {
            records.push({ type: "ISRC", fields: freezeList([work.workId, isrc]) });
        }
        for (const right of [...work.mechanicalRights, ...work.performanceRights, ...work.neighbouringRights]) {
            records.push({
                type: "RYT",
                fields: freezeList([
                    work.workId,
                    right.kind,
                    right.ownerId,
                    right.ownerName,
                    right.percentage.toFixed(4),
                    right.exclusive ? "Y" : "N",
                    right.territories.join(","),
                ]),
            });
        }
        records.push({ type: "END", fields: freezeList([work.workId, String(records.length + 1)]) });
        return freezeList(records);
    }
}
export class PublishingStandardsService {
    registry;
    splitEngine;
    cwrGenerator;
    logger;
    constructor(registry, splitEngine, cwrGenerator, logger = null) {
        this.registry = registry;
        this.splitEngine = splitEngine;
        this.cwrGenerator = cwrGenerator;
        this.logger = logger;
    }
    registerComposition(input) {
        const work = this.registry.registerWork(input);
        this.registry.recordAudit(makeAuditEvent(work.workId, "REGISTER_COMPOSITION", null, work, { revision: work.revision }));
        this.logger?.info("Publishing composition registered", { workId: work.workId, revision: work.revision });
        return work;
    }
    updateComposition(workId, patch) {
        const work = this.registry.updateWork(workId, patch);
        this.logger?.info("Publishing composition updated", { workId, revision: work.revision });
        return work;
    }
    deleteComposition(workId, reason = null) {
        const work = this.registry.deleteWork(workId, reason);
        this.logger?.warn("Publishing composition deleted", { workId, reason });
        return work;
    }
    registerPublisher(input) {
        const record = this.registry.registerIdentity({ ...input, kind: "publisher" });
        this.logger?.info("Publishing publisher registered", { identityId: record.identityId, name: record.name });
        return record;
    }
    registerWriter(input) {
        const record = this.registry.registerIdentity(input);
        this.logger?.info("Publishing writer registered", { identityId: record.identityId, name: record.name, kind: record.kind });
        return record;
    }
    validatePublishingRights(workId) {
        const work = this.registry.findWork(workId);
        if (!work) {
            return this.invalidResult(workId, "WORK_NOT_FOUND", "Publishing work not found", null);
        }
        const splitResult = this.splitEngine.validate(work, this.registry);
        const errors = [...splitResult.errors];
        const warnings = [...splitResult.warnings];
        if (work.publicDomain && (work.iswc || work.splits.length || work.publishers.length)) {
            errors.push(makeValidationIssue("public_domain", "work.publicDomain", "Public domain works cannot assert exclusive publishing ownership", "error", work.publicDomain));
        }
        if (work.iswc && !isValidIswc(work.iswc)) {
            errors.push(makeValidationIssue("iswc_invalid", "work.iswc", "ISWC format is invalid", "error", work.iswc));
        }
        if (work.writers.some((writer) => !isValidIpi(writer.ipi) && writer.ipi != null)) {
            warnings.push(makeValidationIssue("ipi_warning", "work.writers.ipi", "At least one writer has an invalid IPI value", "warning", work.writers.map((writer) => writer.ipi)));
        }
        if (work.writers.some((writer) => !isValidIsni(writer.isni) && writer.isni != null)) {
            warnings.push(makeValidationIssue("isni_warning", "work.writers.isni", "At least one identity has an invalid ISNI value", "warning", work.writers.map((writer) => writer.isni)));
        }
        const conflicts = [...splitResult.conflicts, ...this.registry.listConflicts(workId)].filter((conflict, index, list) => list.findIndex((entry) => entry.conflictId === conflict.conflictId) === index);
        return Object.freeze({
            valid: errors.length === 0,
            errors: freezeList(errors),
            warnings: freezeList(warnings),
            conflicts: freezeList(conflicts),
            metadata: freeze({
                workId,
                revision: work.revision,
            }),
        });
    }
    validateSplits(workId) {
        const work = this.registry.findWork(workId);
        if (!work) {
            return this.invalidResult(workId, "WORK_NOT_FOUND", "Publishing work not found", null);
        }
        return this.splitEngine.validate(work, this.registry);
    }
    generateCWR(workId, options = {}) {
        const work = this.registry.findWork(workId);
        if (!work) {
            throw new Error(`Publishing work not found: ${workId}`);
        }
        const document = this.cwrGenerator.generate(work, options);
        this.registry.recordAudit(makeAuditEvent(workId, "GENERATE_CWR", null, document, { messageType: document.messageType }));
        return document;
    }
    generatePublishingReport() {
        return this.registry.getCounts();
    }
    listAuditEvents(workId) {
        return this.registry.listAuditEvents(workId);
    }
    listConflicts(workId) {
        return this.registry.listConflicts(workId);
    }
    listWorks() {
        return this.registry.listWorks();
    }
    resolveIdentity(input) {
        return this.registry.resolveIdentity(input);
    }
    invalidResult(workId, code, message, value) {
        return Object.freeze({
            valid: false,
            errors: freezeList([makeValidationIssue(code, "workId", message, "error", value)]),
            warnings: freezeList([]),
            conflicts: freezeList(this.registry.listConflicts(workId)),
            metadata: freeze({ workId }),
        });
    }
}
export class PublishingValidationWorker {
    dependencies;
    name = "publishing-validation";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const result = this.dependencies.service.validatePublishingRights(job.workId);
        this.dependencies.logger?.info("Publishing validation worker processed", { workId: job.workId, valid: result.valid });
        return Object.freeze({
            workId: job.workId,
            processed: true,
            valid: result.valid,
            messageType: null,
            generated: false,
            warnings: result.warnings,
            errors: result.errors,
            metadata: freeze({ ...result.metadata, actor: job.actor ?? "system" }),
        });
    }
}
export class CwrExportWorker {
    dependencies;
    name = "publishing-cwr-export";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const document = this.dependencies.service.generateCWR(job.workId, {
            sender: job.actor ?? "TrackSyra",
            recipient: job.metadata?.recipient && typeof job.metadata.recipient === "string" ? job.metadata.recipient : "DSP",
            creationDateTime: job.metadata?.creationDateTime && typeof job.metadata.creationDateTime === "string" ? job.metadata.creationDateTime : nowIso(),
            compress: true,
        });
        this.dependencies.logger?.info("Publishing CWR worker exported document", { workId: job.workId, messageType: document.messageType });
        return Object.freeze({
            workId: job.workId,
            processed: true,
            valid: true,
            messageType: document.messageType,
            generated: true,
            warnings: [],
            errors: [],
            metadata: freeze({
                textLength: document.text.length,
                recordCount: document.records.length,
            }),
        });
    }
}
export class RightsVerificationWorker {
    dependencies;
    name = "publishing-rights-verification";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const result = this.dependencies.service.validatePublishingRights(job.workId);
        this.dependencies.logger?.info("Publishing rights worker verified rights", { workId: job.workId, conflicts: result.conflicts.length });
        return Object.freeze({
            workId: job.workId,
            processed: true,
            valid: result.valid,
            messageType: null,
            generated: false,
            warnings: result.warnings,
            errors: result.errors,
            metadata: freeze({ ...result.metadata }),
        });
    }
}
export class PublishingRetryWorker {
    dependencies;
    name = "publishing-retry";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const validation = this.dependencies.service.validatePublishingRights(job.workId);
        const generated = validation.valid ? this.dependencies.service.generateCWR(job.workId, { sender: job.actor ?? "TrackSyra", recipient: "DSP", compress: false }) : null;
        this.dependencies.logger?.warn("Publishing retry worker executed", { workId: job.workId, retried: Boolean(generated) });
        return Object.freeze({
            workId: job.workId,
            processed: true,
            valid: validation.valid,
            messageType: generated?.messageType ?? null,
            generated: Boolean(generated),
            warnings: validation.warnings,
            errors: validation.errors,
            metadata: freeze({
                retried: Boolean(generated),
                conflicts: validation.conflicts.length,
            }),
        });
    }
}
export function createPublishingStandardsRuntime(options = {}) {
    const registry = new PublishingRegistry();
    const splitEngine = new PublishingSplitEngine();
    const cwrGenerator = new PublishingCwrGenerator();
    const service = new PublishingStandardsService(registry, splitEngine, cwrGenerator, options.logger ?? null);
    const workerDependencies = {
        service,
        logger: options.logger ?? null,
    };
    return Object.freeze({
        registry,
        splitEngine,
        cwrGenerator,
        service,
        validationWorker: new PublishingValidationWorker(workerDependencies),
        cwrExportWorker: new CwrExportWorker(workerDependencies),
        rightsVerificationWorker: new RightsVerificationWorker(workerDependencies),
        retryWorker: new PublishingRetryWorker(workerDependencies),
    });
}
export function generatePublishingFingerprint(work) {
    return createHash("sha256").update(serializeCanonicalJSON(work), "utf8").digest("hex");
}
