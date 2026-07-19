import { createHash, randomUUID } from "node:crypto";
import { queueNames } from "../../queue/queueNames.js";
import { createWorker } from "../../queue/queueFactory.js";
function nowIso() {
    return new Date().toISOString();
}
function freeze(value) {
    if (Array.isArray(value))
        return Object.freeze([...value]);
    if (value && typeof value === "object")
        return Object.freeze({ ...value });
    return value;
}
function freezeList(values) {
    return Object.freeze([...values]);
}
function createId(prefix, parts = []) {
    const suffix = parts.filter(Boolean).join(":") || randomUUID();
    return `${prefix}:${suffix}:${Date.now().toString(36)}:${randomUUID().slice(0, 8)}`;
}
function normalizeText(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text)
        throw new Error("Text value is required.");
    return text.replace(/\s+/g, " ");
}
function normalizeOptionalText(value) {
    if (value == null)
        return null;
    const text = value.trim();
    return text.length ? text.replace(/\s+/g, " ") : null;
}
function normalizeTerritories(values) {
    const territories = new Set();
    for (const value of values ?? []) {
        const territory = value.trim().toUpperCase();
        if (territory)
            territories.add(territory);
    }
    if (territories.size === 0)
        territories.add("WORLD");
    return freezeList([...territories]);
}
function normalizeOptionalTerritories(values) {
    const territories = new Set();
    for (const value of values ?? []) {
        const territory = value.trim().toUpperCase();
        if (territory)
            territories.add(territory);
    }
    return freezeList([...territories]);
}
function normalizePercentage(value) {
    if (value == null)
        return null;
    if (!Number.isFinite(value))
        throw new Error("percentage must be finite");
    if (value < 0 || value > 100)
        throw new Error("percentage must be between 0 and 100");
    return Math.round(value * 10000) / 10000;
}
function normalizeWindow(input) {
    return freeze({
        start: normalizeOptionalText(input?.start ?? null),
        end: normalizeOptionalText(input?.end ?? null),
    });
}
function normalizeStatus(value) {
    return value ?? "enabled";
}
function normalizeTerritoryMode(value) {
    return value ?? "worldwide";
}
function normalizeDsp(value) {
    return normalizeOptionalText(value ?? null);
}
function recordOwnershipKey(input) {
    return [input.releaseId, input.trackId ?? "", input.ownerType, input.ownerName.toLowerCase(), input.rightsScope, input.territory].join("|");
}
function recordLicenseKey(input) {
    return [
        input.releaseId,
        input.trackId ?? "",
        input.territoryMode,
        input.territories.join(","),
        input.includeTerritories.join(","),
        input.excludeTerritories.join(","),
        input.blacklistTerritories.join(","),
        input.territoryGroup ?? "",
        input.dsp ?? "",
    ].join("|");
}
function recordConflictKey(input) {
    return [input.releaseId, input.trackId ?? "", input.conflictType, ...input.references].join("|");
}
function ownershipFromRow(row) {
    const metadata = readMetadata(row.metadata);
    const territories = normalizeTerritories(Array.isArray(metadata.territories) ? metadata.territories.map((territory) => String(territory)) : [String(row.territory ?? "WORLD")]);
    const rightsScope = String(row.rights_scope ?? metadata.rightsScope ?? "master");
    const ownershipKey = String(metadata.ownershipKey ?? recordOwnershipKey({
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        ownerType: String(row.owner_type ?? "rightsholder"),
        ownerName: String(row.owner_name ?? "Unknown"),
        rightsScope,
        territory: territories[0] ?? "WORLD",
    }));
    return freeze({
        rightsId: String(row.id ?? createId("rights", [ownershipKey])),
        ownershipKey,
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        ownerType: String(row.owner_type ?? "rightsholder"),
        ownerName: String(row.owner_name ?? "Unknown"),
        rightsScope,
        territories,
        percentage: normalizePercentage(typeof metadata.percentage === "number" ? metadata.percentage : null),
        exclusive: Boolean(metadata.exclusive ?? row.exclusive ?? false),
        coExclusive: Boolean(metadata.coExclusive ?? false),
        transferable: Boolean(metadata.transferable ?? false),
        inherited: Boolean(metadata.inherited ?? false),
        status: normalizeStatus(String(row.status ?? metadata.status ?? "enabled")),
        source: String(row.source ?? metadata.source ?? "system"),
        licenseWindow: normalizeWindow(metadata.licenseWindow),
        metadata: freeze({ ...metadata }),
        createdAt: String(row.created_at ?? nowIso()),
        updatedAt: String(row.updated_at ?? row.created_at ?? nowIso()),
    });
}
function licenseFromRow(row) {
    const metadata = readMetadata(row.metadata);
    const territories = normalizeTerritories(Array.isArray(metadata.territories) ? metadata.territories.map((territory) => String(territory)) : []);
    const includeTerritories = normalizeOptionalTerritories(Array.isArray(metadata.includeTerritories) ? metadata.includeTerritories.map((territory) => String(territory)) : []);
    const excludeTerritories = normalizeOptionalTerritories(Array.isArray(metadata.excludeTerritories) ? metadata.excludeTerritories.map((territory) => String(territory)) : []);
    const blacklistTerritories = normalizeOptionalTerritories(Array.isArray(metadata.blacklistTerritories) ? metadata.blacklistTerritories.map((territory) => String(territory)) : []);
    const territoryMode = normalizeTerritoryMode(String(metadata.territoryMode ?? "worldwide"));
    const dsp = normalizeDsp(metadata.dsp ? String(metadata.dsp) : null);
    const licenseKey = String(metadata.licenseKey ?? recordLicenseKey({
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        territoryMode,
        territories,
        includeTerritories,
        excludeTerritories,
        blacklistTerritories,
        territoryGroup: normalizeOptionalText(metadata.territoryGroup ? String(metadata.territoryGroup) : null),
        dsp,
    }));
    return freeze({
        licenseId: String(row.id ?? createId("license", [licenseKey])),
        licenseKey,
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        territoryMode,
        territories,
        includeTerritories,
        excludeTerritories,
        blacklistTerritories,
        territoryGroup: normalizeOptionalText(metadata.territoryGroup ? String(metadata.territoryGroup) : null),
        dsp,
        status: normalizeStatus(String(row.status ?? metadata.status ?? "enabled")),
        licenseWindow: normalizeWindow(metadata.licenseWindow),
        metadata: freeze({ ...metadata }),
        createdAt: String(row.created_at ?? nowIso()),
        updatedAt: String(row.updated_at ?? row.created_at ?? nowIso()),
    });
}
function conflictFromRow(row) {
    const details = readMetadata(row.details);
    const references = Array.isArray(details.references) ? details.references.map((value) => String(value)) : [];
    const conflictType = String(row.conflict_type ?? details.conflictType ?? "duplicate_ownership");
    const conflictKey = String(details.conflictKey ?? recordConflictKey({
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        conflictType,
        references,
    }));
    return freeze({
        conflictId: String(row.id ?? createId("rights-conflict", [conflictKey])),
        conflictKey,
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        conflictType,
        severity: String(row.severity ?? details.severity ?? "warning"),
        message: String(details.message ?? row.message ?? conflictType),
        references: freezeList(references),
        resolved: Boolean(row.resolved ?? details.resolved ?? false),
        resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
        resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
        details: freeze({ ...details }),
        createdAt: String(row.created_at ?? nowIso()),
    });
}
function withdrawalFromRow(row) {
    const metadata = readMetadata(row.metadata);
    const kind = String(metadata.kind ?? "catalog");
    const withdrawalKey = String(metadata.withdrawalKey ?? [String(row.release_id ?? ""), String(row.track_id ?? ""), kind, String(metadata.dsp ?? ""), String(metadata.territory ?? "")].join("|"));
    return freeze({
        withdrawalId: String(row.id ?? createId("rights-withdrawal", [withdrawalKey])),
        withdrawalKey,
        releaseId: String(row.release_id ?? ""),
        trackId: row.track_id ? String(row.track_id) : null,
        kind,
        dsp: normalizeDsp(metadata.dsp ? String(metadata.dsp) : null),
        territory: normalizeOptionalText(metadata.territory ? String(metadata.territory) : null),
        reason: String(row.reason ?? metadata.reason ?? "rights withdrawal"),
        status: normalizeStatus(String(row.status ?? metadata.status ?? "pending")),
        metadata: freeze({ ...metadata }),
        createdAt: String(row.created_at ?? nowIso()),
        updatedAt: String(row.updated_at ?? row.created_at ?? nowIso()),
    });
}
function auditFromRow(row) {
    const metadata = readMetadata(row.metadata);
    return freeze({
        eventId: String(row.id ?? createId("rights-audit", [String(row.aggregate_id ?? ""), String(row.action ?? "")])),
        aggregateType: String(row.aggregate_type ?? "rights"),
        aggregateId: String(row.aggregate_id ?? ""),
        action: String(row.action ?? "UNKNOWN"),
        oldValue: row.old_value ?? null,
        newValue: row.new_value ?? null,
        actor: String(row.actor ?? metadata.actor ?? "system"),
        reason: row.reason ? String(row.reason) : null,
        correlationId: row.correlation_id ? String(row.correlation_id) : null,
        ipAddress: row.ip_address ? String(row.ip_address) : null,
        metadata: freeze({ ...metadata }),
        createdAt: String(row.created_at ?? nowIso()),
    });
}
function readMetadata(value) {
    return value && typeof value === "object" ? freeze(value) : freeze({});
}
function parseIso(value) {
    if (value == null || value === "")
        return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}
function territoriesOverlap(a, b) {
    if (a.includes("WORLD") || b.includes("WORLD"))
        return true;
    const shared = new Set(a);
    return b.some((territory) => shared.has(territory));
}
function licenseActive(record, referenceTime) {
    if (record.status !== "enabled" && record.status !== "pending")
        return false;
    const endTime = parseIso(record.licenseWindow.end);
    return endTime == null || endTime >= Date.parse(referenceTime);
}
function makeConflict(releaseId, trackId, conflictType, severity, message, references, details = {}) {
    const conflictKey = recordConflictKey({ releaseId, trackId, conflictType, references });
    return freeze({
        conflictId: createId("rights-conflict", [releaseId, conflictIdSuffix(conflictType, references)]),
        conflictKey,
        releaseId,
        trackId,
        conflictType,
        severity,
        message,
        references: freezeList(references),
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        details: freeze({ ...details }),
        createdAt: nowIso(),
    });
}
function conflictIdSuffix(type, references) {
    return [type, ...references].join(":").replace(/[^a-zA-Z0-9:_-]/g, "_");
}
function buildAudit(aggregateType, aggregateId, action, oldValue, newValue, actor, reason, correlationId, ipAddress, metadata = {}) {
    return freeze({
        eventId: createId("rights-audit", [aggregateType, aggregateId, action]),
        aggregateType,
        aggregateId,
        action,
        oldValue,
        newValue,
        actor,
        reason,
        correlationId,
        ipAddress,
        metadata: freeze({ ...metadata }),
        createdAt: nowIso(),
    });
}
class RightsRegistry {
    ownerships = new Map();
    ownershipVersions = new Map();
    licenses = new Map();
    licenseVersions = new Map();
    conflicts = new Map();
    withdrawals = new Map();
    audits = new Map();
    replaceOwnership(record) {
        this.ownerships.set(record.ownershipKey, record);
        this.ownershipVersions.set(record.rightsId, { key: record.ownershipKey, id: record.rightsId, createdAt: record.createdAt });
        return record;
    }
    replaceLicense(record) {
        this.licenses.set(record.licenseKey, record);
        this.licenseVersions.set(record.licenseId, { key: record.licenseKey, id: record.licenseId, createdAt: record.createdAt });
        return record;
    }
    replaceConflict(record) {
        this.conflicts.set(record.conflictKey, record);
        return record;
    }
    resolveConflict(conflictKey, resolvedBy) {
        const existing = this.conflicts.get(conflictKey);
        if (!existing || existing.resolved)
            return existing ?? null;
        const resolved = freeze({
            ...existing,
            resolved: true,
            resolvedAt: nowIso(),
            resolvedBy,
        });
        this.conflicts.set(conflictKey, resolved);
        return resolved;
    }
    replaceWithdrawal(record) {
        this.withdrawals.set(record.withdrawalKey, record);
        return record;
    }
    recordAudit(event) {
        const current = this.audits.get(event.aggregateId) ?? [];
        this.audits.set(event.aggregateId, freezeList([...current, event]));
        return event;
    }
    listOwnerships(releaseId, trackId) {
        return freezeList([...this.ownerships.values()].filter((record) => (releaseId ? record.releaseId === releaseId : true) &&
            (trackId == null ? true : record.trackId === trackId)));
    }
    listLicenses(releaseId, trackId) {
        return freezeList([...this.licenses.values()].filter((record) => (releaseId ? record.releaseId === releaseId : true) &&
            (trackId == null ? true : record.trackId === trackId)));
    }
    listConflicts(releaseId, trackId) {
        return freezeList([...this.conflicts.values()].filter((record) => (releaseId ? record.releaseId === releaseId : true) &&
            (trackId == null ? true : record.trackId === trackId)));
    }
    listWithdrawals(releaseId, trackId) {
        return freezeList([...this.withdrawals.values()].filter((record) => (releaseId ? record.releaseId === releaseId : true) &&
            (trackId == null ? true : record.trackId === trackId)));
    }
    listAuditEvents(releaseId) {
        return freezeList([...this.audits.values()].flat().filter((record) => (releaseId ? record.aggregateId === releaseId : true)));
    }
    getOwnershipById(rightsId) {
        const version = this.ownershipVersions.get(rightsId);
        return version ? this.ownerships.get(version.key) ?? null : null;
    }
    getLicenseById(licenseId) {
        const version = this.licenseVersions.get(licenseId);
        return version ? this.licenses.get(version.key) ?? null : null;
    }
    hydrateOwnerships(records) {
        for (const record of records)
            this.replaceOwnership(record);
    }
    hydrateLicenses(records) {
        for (const record of records)
            this.replaceLicense(record);
    }
    hydrateConflicts(records) {
        for (const record of records)
            this.replaceConflict(record);
    }
    hydrateWithdrawals(records) {
        for (const record of records)
            this.replaceWithdrawal(record);
    }
    hydrateAudits(records) {
        for (const event of records)
            this.recordAudit(event);
    }
}
export class EnterpriseRightsService {
    dependencies;
    registry;
    hydrated = false;
    constructor(dependencies, registry) {
        this.dependencies = dependencies;
        this.registry = registry;
    }
    async hydrate() {
        if (this.hydrated)
            return;
        const [ownershipRows, licenseRows, conflictRows, withdrawalRows, auditRows] = await Promise.all([
            this.dependencies.sql.query("SELECT * FROM public.rights_ownership ORDER BY created_at ASC"),
            this.dependencies.sql.query("SELECT * FROM public.rights_ownership WHERE COALESCE(CAST(metadata ->> 'recordKind' AS text), 'ownership') = 'license' ORDER BY created_at ASC"),
            this.dependencies.sql.query("SELECT * FROM public.ownership_conflicts ORDER BY created_at ASC"),
            this.dependencies.sql.query("SELECT * FROM public.withdrawal_queue ORDER BY created_at ASC"),
            this.dependencies.sql.query("SELECT * FROM public.audit_events WHERE aggregate_type IN ('rights_ownership', 'rights_license', 'rights_conflict', 'rights_withdrawal', 'rights_audit') ORDER BY created_at ASC"),
        ]);
        this.registry.hydrateOwnerships(ownershipRows.map(ownershipFromRow));
        this.registry.hydrateLicenses(licenseRows.map(licenseFromRow));
        this.registry.hydrateConflicts(conflictRows.map(conflictFromRow));
        this.registry.hydrateWithdrawals(withdrawalRows.map(withdrawalFromRow));
        this.registry.hydrateAudits(auditRows.map(auditFromRow));
        this.hydrated = true;
    }
    async registerRights(input) {
        await this.hydrate();
        const ownerships = [];
        const releaseId = normalizeText(input.releaseId);
        const trackId = normalizeOptionalText(input.trackId ?? null);
        const actor = normalizeOptionalText(input.actor ?? null) ?? "system";
        const reason = normalizeOptionalText(input.reason ?? null);
        const correlationId = normalizeOptionalText(input.correlationId ?? null);
        const ipAddress = normalizeOptionalText(input.ipAddress ?? null);
        const territories = normalizeTerritories(input.territories);
        const percentage = normalizePercentage(input.percentage);
        const window = normalizeWindow(input.licenseWindow);
        for (const rightsScope of (input.rightsScopes.length ? input.rightsScopes : ["master"])) {
            for (const territory of territories) {
                const rightsId = createId(normalizeOptionalText(input.rightsId ?? null) ?? "rights-ownership", [releaseId, trackId ?? "release", rightsScope, territory]);
                const record = freeze({
                    rightsId,
                    ownershipKey: recordOwnershipKey({ releaseId, trackId, ownerType: input.ownerType, ownerName: normalizeText(input.ownerName), rightsScope, territory }),
                    releaseId,
                    trackId,
                    ownerType: input.ownerType,
                    ownerName: normalizeText(input.ownerName),
                    rightsScope,
                    territories: freezeList([territory]),
                    percentage,
                    exclusive: Boolean(input.exclusive ?? true),
                    coExclusive: Boolean(input.coExclusive ?? false),
                    transferable: Boolean(input.transferable ?? false),
                    inherited: Boolean(input.inherited ?? false),
                    status: normalizeStatus(input.status),
                    source: normalizeOptionalText(input.source ?? null) ?? "manual",
                    licenseWindow: window,
                    metadata: freeze({
                        ...(input.metadata ?? {}),
                        recordKind: "ownership",
                        ownerType: input.ownerType,
                        rightsScope,
                        territory,
                        percentage,
                        rightsId,
                    }),
                    createdAt: this.now(),
                    updatedAt: this.now(),
                });
                await this.persistOwnership(record, actor, reason, correlationId, ipAddress);
                ownerships.push(this.registry.replaceOwnership(record));
            }
        }
        for (const license of [...(input.dspLicenses ?? []), ...(input.territoryLicenses ?? [])]) {
            const record = await this.persistLicense(license, actor, reason, correlationId, ipAddress);
            ownerships.push({
                rightsId: record.licenseId,
                ownershipKey: record.licenseKey,
                releaseId: record.releaseId,
                trackId: record.trackId,
                ownerType: "licensee",
                ownerName: record.dsp ?? record.territoryGroup ?? "Territory License",
                rightsScope: "streaming",
                territories: record.territories,
                percentage: null,
                exclusive: false,
                coExclusive: false,
                transferable: false,
                inherited: false,
                status: record.status,
                source: "system",
                licenseWindow: record.licenseWindow,
                metadata: record.metadata,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
            });
        }
        await this.persistAuditEvent({
            aggregateType: "rights_ownership",
            aggregateId: releaseId,
            action: "RIGHTS_REGISTERED",
            actor,
            reason,
            correlationId,
            oldValue: null,
            newValue: ownerships,
            metadata: { territories: input.territories ?? [], scopes: input.rightsScopes, releaseId, trackId },
            ipAddress,
        });
        return freezeList(ownerships);
    }
    async updateRights(input) {
        await this.hydrate();
        const current = this.registry.getOwnershipById(input.rightsId);
        if (!current)
            return null;
        const next = freeze({
            ...current,
            ownerType: input.ownerType ?? current.ownerType,
            ownerName: input.ownerName ? normalizeText(input.ownerName) : current.ownerName,
            rightsScope: current.rightsScope,
            territories: input.territories ? normalizeTerritories(input.territories) : current.territories,
            percentage: normalizePercentage(input.percentage ?? current.percentage),
            exclusive: input.exclusive ?? current.exclusive,
            coExclusive: input.coExclusive ?? current.coExclusive,
            transferable: input.transferable ?? current.transferable,
            inherited: input.inherited ?? current.inherited,
            status: normalizeStatus(input.status ?? current.status),
            source: normalizeOptionalText(input.source ?? null) ?? current.source,
            licenseWindow: input.licenseWindow ? normalizeWindow(input.licenseWindow) : current.licenseWindow,
            metadata: freeze({ ...current.metadata, ...(input.metadata ?? {}), updatedFrom: "updateRights" }),
            updatedAt: this.now(),
        });
        await this.persistOwnership(next, normalizeOptionalText(input.actor ?? null) ?? "system", normalizeOptionalText(input.reason ?? null), normalizeOptionalText(input.correlationId ?? null), normalizeOptionalText(input.ipAddress ?? null), current);
        this.registry.replaceOwnership(next);
        return next;
    }
    async transferRights(input) {
        await this.hydrate();
        const current = this.registry.getOwnershipById(input.rightsId);
        if (!current)
            return null;
        const actor = normalizeOptionalText(input.actor ?? null) ?? "system";
        const reason = normalizeOptionalText(input.reason ?? null);
        const correlationId = normalizeOptionalText(input.correlationId ?? null);
        const ipAddress = normalizeOptionalText(input.ipAddress ?? null);
        const withdrawn = freeze({
            ...current,
            status: "withdrawn",
            updatedAt: this.now(),
            metadata: freeze({ ...current.metadata, transferredTo: input.newOwnerName, transferredAt: this.now(), transferReason: reason }),
        });
        await this.persistOwnership(withdrawn, actor, reason, correlationId, ipAddress, current);
        this.registry.replaceOwnership(withdrawn);
        const transferred = freeze({
            ...current,
            rightsId: createId("rights-ownership", [current.releaseId, input.newOwnerName]),
            ownershipKey: recordOwnershipKey({
                releaseId: input.releaseId ?? current.releaseId,
                trackId: input.trackId ?? current.trackId,
                ownerType: input.newOwnerType,
                ownerName: normalizeText(input.newOwnerName),
                rightsScope: current.rightsScope,
                territory: current.territories[0] ?? "WORLD",
            }),
            ownerType: input.newOwnerType,
            ownerName: normalizeText(input.newOwnerName),
            status: "enabled",
            metadata: freeze({ ...current.metadata, ...(input.metadata ?? {}), transferredFrom: current.ownerName, transferredAt: this.now() }),
            updatedAt: this.now(),
        });
        await this.persistOwnership(transferred, actor, reason, correlationId, ipAddress, current);
        this.registry.replaceOwnership(transferred);
        await this.persistAuditEvent({
            aggregateType: "rights_ownership",
            aggregateId: transferred.releaseId,
            action: "RIGHTS_TRANSFERRED",
            actor,
            reason,
            correlationId,
            oldValue: current,
            newValue: transferred,
            metadata: { rightsId: current.rightsId, transferredTo: transferred.ownerName },
            ipAddress,
        });
        return transferred;
    }
    async assignTerritories(input) {
        await this.hydrate();
        const actor = normalizeOptionalText(input.actor ?? null) ?? "system";
        const reason = normalizeOptionalText(input.reason ?? null);
        const correlationId = normalizeOptionalText(input.correlationId ?? null);
        const ipAddress = normalizeOptionalText(input.ipAddress ?? null);
        const record = await this.persistLicense(input, actor, reason, correlationId, ipAddress);
        this.registry.replaceLicense(record);
        await this.persistAuditEvent({
            aggregateType: "rights_license",
            aggregateId: record.releaseId,
            action: "TERRITORIES_ASSIGNED",
            actor,
            reason,
            correlationId,
            oldValue: null,
            newValue: record,
            metadata: { dsp: record.dsp, territoryMode: record.territoryMode },
            ipAddress,
        });
        return record;
    }
    async withdrawRights(input) {
        await this.hydrate();
        const actor = normalizeOptionalText(input.actor ?? null) ?? "system";
        const correlationId = normalizeOptionalText(input.correlationId ?? null);
        const ipAddress = normalizeOptionalText(input.ipAddress ?? null);
        const withdrawalKey = [input.releaseId, input.trackId ?? "", input.kind, input.dsp ?? "", input.territory ?? ""].join("|");
        const record = freeze({
            withdrawalId: createId("rights-withdrawal", [input.releaseId, input.kind]),
            withdrawalKey,
            releaseId: input.releaseId,
            trackId: input.trackId ?? null,
            kind: input.kind,
            dsp: input.dsp ?? null,
            territory: normalizeOptionalText(input.territory ?? null),
            reason: normalizeText(input.reason),
            status: "withdrawn",
            metadata: freeze({
                ...(input.metadata ?? {}),
                kind: input.kind,
                dsp: input.dsp ?? null,
                territory: input.territory ?? null,
                withdrawalKey,
            }),
            createdAt: this.now(),
            updatedAt: this.now(),
        });
        await this.sql("withdrawal_queue", record, actor, correlationId, ipAddress);
        if (input.kind === "emergency" || input.kind === "scheduled" || input.kind === "partial") {
            await this.sql("takedown_queue", record, actor, correlationId, ipAddress);
        }
        this.registry.replaceWithdrawal(record);
        for (const ownership of this.registry.listOwnerships(input.releaseId, input.trackId)) {
            if (input.dsp && ownership.metadata.dsp !== input.dsp)
                continue;
            if (input.territory && !ownership.territories.includes(input.territory.toUpperCase()))
                continue;
            const withdrawnOwnership = freeze({ ...ownership, status: "withdrawn", updatedAt: this.now(), metadata: freeze({ ...ownership.metadata, withdrawnAt: this.now(), withdrawalKey }) });
            await this.persistOwnership(withdrawnOwnership, actor, input.reason, correlationId, ipAddress, ownership);
            this.registry.replaceOwnership(withdrawnOwnership);
        }
        for (const license of this.registry.listLicenses(input.releaseId, input.trackId)) {
            if (input.dsp && license.dsp !== input.dsp)
                continue;
            if (input.territory && !license.territories.includes(input.territory.toUpperCase()))
                continue;
            const withdrawnLicense = await this.persistLicense({
                licenseId: license.licenseId,
                releaseId: license.releaseId,
                trackId: license.trackId,
                territoryMode: license.territoryMode,
                territories: license.territories,
                includeTerritories: license.includeTerritories,
                excludeTerritories: license.excludeTerritories,
                blacklistTerritories: license.blacklistTerritories,
                territoryGroup: license.territoryGroup,
                dsp: license.dsp,
                status: "withdrawn",
                licenseWindow: license.licenseWindow,
                metadata: { ...license.metadata, withdrawnAt: this.now(), withdrawalKey },
            }, actor, input.reason, correlationId, ipAddress);
            this.registry.replaceLicense(withdrawnLicense);
        }
        await this.persistAuditEvent({
            aggregateType: "rights_withdrawal",
            aggregateId: input.releaseId,
            action: "RIGHTS_WITHDRAWN",
            actor,
            reason: input.reason,
            correlationId,
            oldValue: null,
            newValue: record,
            metadata: { kind: input.kind, dsp: input.dsp, territory: input.territory },
            ipAddress,
        });
        return record;
    }
    async restoreRights(input) {
        await this.hydrate();
        const withdrawal = [...this.registry.listWithdrawals()].find((entry) => entry.withdrawalId === input.withdrawalId) ?? null;
        if (!withdrawal)
            return null;
        const actor = normalizeOptionalText(input.actor ?? null) ?? "system";
        const reason = normalizeOptionalText(input.reason ?? null);
        const correlationId = normalizeOptionalText(input.correlationId ?? null);
        const ipAddress = normalizeOptionalText(input.ipAddress ?? null);
        const restored = freeze({
            ...withdrawal,
            status: "enabled",
            updatedAt: this.now(),
            metadata: freeze({ ...withdrawal.metadata, restoredAt: this.now(), restoreReason: reason }),
        });
        this.registry.replaceWithdrawal(restored);
        for (const ownership of this.registry.listOwnerships(restored.releaseId, restored.trackId)) {
            if (restored.dsp && ownership.metadata.dsp !== restored.dsp)
                continue;
            if (restored.territory && !ownership.territories.includes(restored.territory.toUpperCase()))
                continue;
            if (ownership.status === "withdrawn") {
                const revived = freeze({ ...ownership, status: "enabled", updatedAt: this.now(), metadata: freeze({ ...ownership.metadata, restoredAt: this.now(), restoreReason: reason }) });
                await this.persistOwnership(revived, actor, reason, correlationId, ipAddress, ownership);
                this.registry.replaceOwnership(revived);
            }
        }
        for (const license of this.registry.listLicenses(restored.releaseId, restored.trackId)) {
            if (restored.dsp && license.dsp !== restored.dsp)
                continue;
            if (restored.territory && !license.territories.includes(restored.territory.toUpperCase()))
                continue;
            if (license.status === "withdrawn") {
                const revivedLicense = await this.persistLicense({
                    licenseId: license.licenseId,
                    releaseId: license.releaseId,
                    trackId: license.trackId,
                    territoryMode: license.territoryMode,
                    territories: license.territories,
                    includeTerritories: license.includeTerritories,
                    excludeTerritories: license.excludeTerritories,
                    blacklistTerritories: license.blacklistTerritories,
                    territoryGroup: license.territoryGroup,
                    dsp: license.dsp,
                    status: "enabled",
                    licenseWindow: license.licenseWindow,
                    metadata: { ...license.metadata, restoredAt: this.now(), restoreReason: reason },
                }, actor, reason, correlationId, ipAddress);
                this.registry.replaceLicense(revivedLicense);
            }
        }
        await this.persistAuditEvent({
            aggregateType: "rights_withdrawal",
            aggregateId: restored.releaseId,
            action: "RIGHTS_RESTORED",
            actor,
            reason,
            correlationId,
            oldValue: withdrawal,
            newValue: restored,
            metadata: { withdrawalId: withdrawal.withdrawalId },
            ipAddress,
        });
        return restored;
    }
    async verifyRights(releaseId) {
        await this.hydrate();
        await this.refreshExpirations(releaseId);
        const bundle = await this.dependencies.distributionStore.getReleaseWithTracks(releaseId);
        const ownerships = this.registry.listOwnerships(releaseId);
        const licenses = this.registry.listLicenses(releaseId);
        const conflicts = this.detectConflicts(bundle?.release ?? null, bundle?.tracks ?? [], ownerships, licenses);
        await this.syncConflicts(conflicts);
        const withdrawals = this.registry.listWithdrawals(releaseId);
        const auditEvents = this.registry.listAuditEvents(releaseId);
        const ownershipVerified = ownerships.some((record) => record.status === "enabled" || record.status === "pending") && conflicts.every((entry) => entry.severity !== "blocker");
        const chainOfTitleVerified = ownerships.length > 0 && auditEvents.some((event) => event.action.includes("RIGHTS")) && conflicts.filter((entry) => entry.conflictType === "duplicate_ownership").length === 0;
        const territoryVerified = licenses.every((license) => license.status !== "blocked" && license.status !== "withdrawn" && license.status !== "expired") || licenses.length === 0;
        const errors = conflicts.filter((entry) => entry.severity === "blocker").map((entry) => this.toIssue(entry, "error"));
        const warnings = conflicts.filter((entry) => entry.severity === "warning").map((entry) => this.toIssue(entry, "warning"));
        const validation = freeze({
            valid: errors.length === 0 && ownershipVerified && chainOfTitleVerified && territoryVerified,
            ownershipVerified,
            chainOfTitleVerified,
            territoryVerified,
            errors: freezeList(errors),
            warnings: freezeList(warnings),
            conflicts: freezeList(conflicts),
            ownerships: freezeList(ownerships),
            licenses: freezeList(licenses),
            withdrawals: freezeList(withdrawals),
            auditEvents: freezeList(auditEvents),
            metadata: freeze({
                releaseId,
                evaluatedAt: this.now(),
                ownershipCount: ownerships.length,
                licenseCount: licenses.length,
                conflictCount: conflicts.length,
            }),
        });
        await this.persistValidationResult(releaseId, validation);
        await this.persistAuditEvent({
            aggregateType: "rights_audit",
            aggregateId: releaseId,
            action: "RIGHTS_VERIFIED",
            actor: "system",
            reason: null,
            correlationId: null,
            oldValue: null,
            newValue: validation,
            metadata: { valid: validation.valid, conflicts: conflicts.length },
            ipAddress: null,
        });
        return validation;
    }
    async generateRightsReport(releaseId) {
        await this.hydrate();
        const ownerships = this.registry.listOwnerships(releaseId);
        const licenses = this.registry.listLicenses(releaseId);
        const conflicts = this.registry.listConflicts(releaseId);
        const withdrawals = this.registry.listWithdrawals(releaseId);
        const auditEvents = this.registry.listAuditEvents(releaseId);
        const ownershipVerified = ownerships.length > 0 && conflicts.every((entry) => entry.severity !== "blocker");
        const chainOfTitleVerified = ownershipVerified && auditEvents.some((event) => event.action.includes("RIGHTS"));
        const territoryCoverage = freezeList([...new Set([...ownerships.flatMap((record) => record.territories), ...licenses.flatMap((record) => record.territories), ...licenses.flatMap((record) => record.includeTerritories)])]);
        return freeze({
            generatedAt: this.now(),
            ownerships: freezeList(ownerships),
            licenses: freezeList(licenses),
            conflicts: freezeList(conflicts),
            withdrawals: freezeList(withdrawals),
            auditEvents: freezeList(auditEvents),
            rightsByScope: freeze(this.countByScope(ownerships)),
            territoriesByCode: freeze(this.countByTerritory(ownerships)),
            licenseMatrix: freezeList(this.buildLicenseMatrix(licenses)),
            ownershipVerified,
            chainOfTitleVerified,
            territoryCoverage,
            summary: freeze({
                ownerships: ownerships.length,
                licenses: licenses.length,
                conflicts: conflicts.length,
                withdrawals: withdrawals.length,
                auditEvents: auditEvents.length,
            }),
        });
    }
    async generateTerritoryReport(releaseId) {
        await this.hydrate();
        const licenses = this.registry.listLicenses(releaseId);
        return freeze({
            generatedAt: this.now(),
            territories: freezeList(licenses),
            coverage: freezeList([...new Set(licenses.flatMap((license) => [...license.territories, ...license.includeTerritories]))]),
            licenseMatrix: freezeList(this.buildLicenseMatrix(licenses)),
            withdrawals: freezeList(this.registry.listWithdrawals(releaseId)),
        });
    }
    async generateConflictReport(releaseId) {
        await this.hydrate();
        const conflicts = this.registry.listConflicts(releaseId);
        return freeze({
            generatedAt: this.now(),
            conflicts: freezeList(conflicts),
            blockerCount: conflicts.filter((entry) => entry.severity === "blocker").length,
            warningCount: conflicts.filter((entry) => entry.severity === "warning").length,
            infoCount: conflicts.filter((entry) => entry.severity === "info").length,
        });
    }
    async generateLicenseMatrix(releaseId) {
        await this.hydrate();
        return freezeList(this.buildLicenseMatrix(this.registry.listLicenses(releaseId)));
    }
    async listAuditEvents(releaseId) {
        await this.hydrate();
        return this.registry.listAuditEvents(releaseId);
    }
    async listConflicts(releaseId) {
        await this.hydrate();
        return this.registry.listConflicts(releaseId);
    }
    async listOwnerships(releaseId) {
        await this.hydrate();
        return this.registry.listOwnerships(releaseId);
    }
    async persistOwnership(record, actor, reason, correlationId, ipAddress, previous = null) {
        const payload = {
            releaseId: record.releaseId,
            trackId: record.trackId,
            ownerType: record.ownerType,
            ownerName: record.ownerName,
            rightsScope: record.rightsScope,
            territory: record.territories[0] ?? "WORLD",
            exclusive: record.exclusive,
            status: record.status,
            source: record.source,
            metadata: JSON.stringify(record.metadata),
        };
        await this.dependencies.sql.query(`INSERT INTO public.rights_ownership (
         release_id,
         track_id,
         owner_type,
         owner_name,
         rights_scope,
         territory,
         exclusive,
         status,
         source,
         metadata
       ) VALUES (
         :releaseId,
         :trackId,
         :ownerType,
         :ownerName,
         :rightsScope,
         :territory,
         :exclusive,
         :status,
         :source,
         CAST(:metadata AS jsonb)
       )`, payload);
        await this.dependencies.sql.query(`INSERT INTO public.ownership_history (
         ownership_id,
         release_id,
         track_id,
         action,
         old_value,
         new_value,
         reason,
         actor,
         correlation_id,
         ip_address,
         metadata
       ) VALUES (
         :ownershipId,
         :releaseId,
         :trackId,
         :action,
         CAST(:oldValue AS jsonb),
         CAST(:newValue AS jsonb),
         :reason,
         :actor,
         :correlationId,
         CASE WHEN :ipAddress IS NOT NULL AND :ipAddress <> '' THEN :ipAddress::inet ELSE NULL END,
         CAST(:metadata AS jsonb)
       )`, {
            ownershipId: record.rightsId,
            releaseId: record.releaseId,
            trackId: record.trackId,
            action: previous ? "UPDATE" : "INSERT",
            oldValue: JSON.stringify(previous ?? null),
            newValue: JSON.stringify(record),
            reason,
            actor,
            correlationId,
            ipAddress,
            metadata: JSON.stringify({ ownershipKey: record.ownershipKey, rightsScope: record.rightsScope, territory: record.territories[0] ?? "WORLD" }),
        });
    }
    async persistLicense(input, actor, reason, correlationId, ipAddress) {
        const territories = normalizeTerritories(input.territories);
        const includeTerritories = normalizeOptionalTerritories(input.includeTerritories);
        const excludeTerritories = normalizeOptionalTerritories(input.excludeTerritories);
        const blacklistTerritories = normalizeOptionalTerritories(input.blacklistTerritories);
        const territoryMode = normalizeTerritoryMode(input.territoryMode);
        const dsp = normalizeDsp(input.dsp ?? null);
        const record = freeze({
            licenseId: input.licenseId?.trim() || createId("rights-license", [input.releaseId, dsp ?? territoryMode]),
            licenseKey: recordLicenseKey({
                releaseId: input.releaseId,
                trackId: normalizeOptionalText(input.trackId ?? null),
                territoryMode,
                territories,
                includeTerritories,
                excludeTerritories,
                blacklistTerritories,
                territoryGroup: normalizeOptionalText(input.territoryGroup ?? null),
                dsp,
            }),
            releaseId: input.releaseId,
            trackId: normalizeOptionalText(input.trackId ?? null),
            territoryMode,
            territories,
            includeTerritories,
            excludeTerritories,
            blacklistTerritories,
            territoryGroup: normalizeOptionalText(input.territoryGroup ?? null),
            dsp,
            status: normalizeStatus(input.status),
            licenseWindow: normalizeWindow(input.licenseWindow),
            metadata: freeze({
                ...(input.metadata ?? {}),
                recordKind: "license",
                territoryMode,
                territories,
                includeTerritories,
                excludeTerritories,
                blacklistTerritories,
                territoryGroup: normalizeOptionalText(input.territoryGroup ?? null),
                dsp,
                status: normalizeStatus(input.status),
            }),
            createdAt: this.now(),
            updatedAt: this.now(),
        });
        await this.dependencies.sql.query(`INSERT INTO public.rights_ownership (
         release_id,
         track_id,
         owner_type,
         owner_name,
         rights_scope,
         territory,
         exclusive,
         status,
         source,
         metadata
       ) VALUES (
         :releaseId,
         :trackId,
         :ownerType,
         :ownerName,
         :rightsScope,
         :territory,
         :exclusive,
         :status,
         :source,
         CAST(:metadata AS jsonb)
       )`, {
            releaseId: input.releaseId,
            trackId: normalizeOptionalText(input.trackId ?? null),
            ownerType: "licensee",
            ownerName: dsp ?? normalizeOptionalText(input.territoryGroup ?? null) ?? territoryMode,
            rightsScope: dsp ? "social_platform" : "streaming",
            territory: territories[0] ?? "WORLD",
            exclusive: false,
            status: record.status,
            source: "system",
            metadata: JSON.stringify(record.metadata),
        });
        await this.dependencies.sql.query(`INSERT INTO public.ownership_history (
         ownership_id,
         release_id,
         track_id,
         action,
         old_value,
         new_value,
         reason,
         actor,
         correlation_id,
         ip_address,
         metadata
       ) VALUES (
         :ownershipId,
         :releaseId,
         :trackId,
         'LICENSE_ASSIGNMENT',
         NULL,
         CAST(:newValue AS jsonb),
         :reason,
         :actor,
         :correlationId,
         CASE WHEN :ipAddress IS NOT NULL AND :ipAddress <> '' THEN :ipAddress::inet ELSE NULL END,
         CAST(:metadata AS jsonb)
       )`, {
            ownershipId: record.licenseId,
            releaseId: record.releaseId,
            trackId: record.trackId,
            newValue: JSON.stringify(record),
            reason,
            actor,
            correlationId,
            ipAddress,
            metadata: JSON.stringify({ licenseKey: record.licenseKey, dsp: record.dsp, territoryMode: record.territoryMode }),
        });
        await this.persistAuditEvent({
            aggregateType: "rights_license",
            aggregateId: record.releaseId,
            action: "LICENSE_ASSIGNED",
            actor,
            reason,
            correlationId,
            oldValue: null,
            newValue: record,
            metadata: { dsp: record.dsp, territoryMode: record.territoryMode },
            ipAddress,
        });
        return this.registry.replaceLicense(record);
    }
    async persistAuditEvent(input) {
        const event = buildAudit(input.aggregateType, input.aggregateId, input.action, input.oldValue, input.newValue, input.actor, input.reason, input.correlationId, input.ipAddress, input.metadata);
        this.registry.recordAudit(event);
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: input.aggregateType,
            aggregateId: input.aggregateId,
            action: input.action,
            actor: input.actor,
            reason: input.reason,
            correlationId: input.correlationId,
            oldValue: input.oldValue,
            newValue: input.newValue,
            metadata: input.metadata,
            ipAddress: input.ipAddress,
        });
    }
    async persistValidationResult(releaseId, validation) {
        await this.dependencies.sql.query(`INSERT INTO public.catalog_validation_results (
         release_id,
         validation_type,
         severity,
         status,
         message,
         details
       ) VALUES (
         :releaseId,
         'rights',
         :severity,
         :status,
         :message,
         CAST(:details AS jsonb)
       )`, {
            releaseId,
            severity: validation.valid ? "info" : validation.errors.length ? "blocker" : "warning",
            status: validation.valid ? "passed" : "failed",
            message: validation.valid ? "Rights verification passed" : "Rights verification detected conflicts",
            details: JSON.stringify(validation.metadata),
        });
    }
    async sql(table, record, actor, correlationId, ipAddress) {
        const tableName = table === "withdrawal_queue" ? "withdrawal_queue" : "takedown_queue";
        await this.dependencies.sql.query(`INSERT INTO public.${tableName} (
         release_id,
         track_id,
         status,
         reason,
         metadata
       ) VALUES (
         :releaseId,
         :trackId,
         :status,
         :reason,
         CAST(:metadata AS jsonb)
       )`, {
            releaseId: record.releaseId,
            trackId: record.trackId,
            status: record.status,
            reason: record.reason,
            metadata: JSON.stringify({
                ...record.metadata,
                actor,
                correlationId,
                ipAddress,
                withdrawalId: record.withdrawalId,
                withdrawalKey: record.withdrawalKey,
            }),
        });
    }
    async refreshExpirations(releaseId) {
        const referenceTime = this.now();
        for (const license of this.registry.listLicenses(releaseId)) {
            const endTime = parseIso(license.licenseWindow.end);
            if (endTime != null && endTime < Date.parse(referenceTime) && license.status !== "expired") {
                const expired = freeze({ ...license, status: "expired", updatedAt: referenceTime, metadata: freeze({ ...license.metadata, expiredAt: referenceTime }) });
                this.registry.replaceLicense(expired);
                await this.persistAuditEvent({
                    aggregateType: "rights_license",
                    aggregateId: expired.releaseId,
                    action: "LICENSE_EXPIRED",
                    actor: "system",
                    reason: null,
                    correlationId: null,
                    oldValue: license,
                    newValue: expired,
                    metadata: { licenseId: expired.licenseId },
                    ipAddress: null,
                });
            }
        }
    }
    detectConflicts(release, tracks, ownerships, licenses) {
        const conflicts = [];
        const ownershipGroups = new Map();
        for (const ownership of ownerships) {
            const key = [ownership.releaseId, ownership.trackId ?? "", ownership.rightsScope, ownership.territories.join(",")].join("|");
            const group = ownershipGroups.get(key) ?? [];
            group.push(ownership);
            ownershipGroups.set(key, group);
        }
        for (const [key, group] of ownershipGroups) {
            const owners = new Set(group.map((entry) => entry.ownerName.toLowerCase()));
            if (owners.size > 1) {
                conflicts.push(makeConflict(group[0]?.releaseId ?? release?.id ?? "", group[0]?.trackId ?? null, "duplicate_ownership", "blocker", "Duplicate ownership records exist for the same rights scope and territory.", group.map((entry) => entry.rightsId), { key, owners: [...owners] }));
            }
            const percentageTotal = group.reduce((sum, entry) => sum + (entry.percentage ?? 0), 0);
            if (group.some((entry) => entry.percentage != null) && Math.abs(percentageTotal - 100) > 0.001) {
                conflicts.push(makeConflict(group[0]?.releaseId ?? release?.id ?? "", group[0]?.trackId ?? null, "invalid_split", "blocker", "Rights split percentages must total 100%.", group.map((entry) => entry.rightsId), { key, percentageTotal }));
            }
            if (group.some((entry) => entry.status === "withdrawn" || entry.status === "expired")) {
                conflicts.push(makeConflict(group[0]?.releaseId ?? release?.id ?? "", group[0]?.trackId ?? null, "license_violation", "warning", "One or more ownership records are withdrawn or expired.", group.map((entry) => entry.rightsId), { key }));
            }
        }
        for (let left = 0; left < ownerships.length; left += 1) {
            for (let right = left + 1; right < ownerships.length; right += 1) {
                const a = ownerships[left];
                const b = ownerships[right];
                if (a.releaseId !== b.releaseId || a.trackId !== b.trackId || a.rightsScope !== b.rightsScope)
                    continue;
                if (a.ownerName === b.ownerName)
                    continue;
                if (!territoriesOverlap(a.territories, b.territories))
                    continue;
                conflicts.push(makeConflict(a.releaseId, a.trackId, "overlapping_territory", "blocker", "Ownership territories overlap across different owners.", [a.rightsId, b.rightsId], { rightsScope: a.rightsScope }));
            }
        }
        for (const license of licenses) {
            if (!licenseActive(license, this.now())) {
                conflicts.push(makeConflict(license.releaseId, license.trackId, "expired_license", "warning", "A territory or DSP license has expired or is inactive.", [license.licenseId], { dsp: license.dsp, territoryMode: license.territoryMode }));
            }
            if (license.blacklistTerritories.some((territory) => license.territories.includes(territory))) {
                conflicts.push(makeConflict(license.releaseId, license.trackId, "blocked_territory", "blocker", "A blocked territory is included in the license matrix.", [license.licenseId], { blacklistTerritories: license.blacklistTerritories }));
            }
            if (license.dsp && license.status === "blocked") {
                conflicts.push(makeConflict(license.releaseId, license.trackId, "license_violation", "blocker", "A DSP license is blocked.", [license.licenseId], { dsp: license.dsp }));
            }
        }
        const releaseMetadata = release?.metadata ?? {};
        const identifiers = [
            release?.upc ?? null,
            ...tracks.map((track) => track.isrc ?? null),
        ].filter((value) => typeof value === "string" && value.trim().length > 0);
        for (const identifier of identifiers) {
            if (identifier.startsWith("BAD") || identifier.length < 5) {
                conflicts.push(makeConflict(release?.id ?? ownerships[0]?.releaseId ?? "", null, identifier.length > 10 ? "invalid_iswc" : "invalid_isrc", "warning", "An identifier did not pass validation.", [identifier], { identifier }));
            }
        }
        if (releaseMetadata.fraudIndicator ?? false) {
            conflicts.push(makeConflict(release?.id ?? ownerships[0]?.releaseId ?? "", null, "fraud_indicator", "blocker", "Fraud indicators were detected in release metadata.", [String(release?.id ?? ownerships[0]?.releaseId ?? "")], { releaseMetadata }));
        }
        return freezeList(this.dedupeConflicts(conflicts));
    }
    async syncConflicts(conflicts) {
        const activeKeys = new Set(conflicts.map((entry) => entry.conflictKey));
        for (const existing of this.registry.listConflicts()) {
            if (!activeKeys.has(existing.conflictKey) && !existing.resolved) {
                await this.resolveConflict(existing.conflictKey, "system");
            }
        }
        for (const conflict of conflicts) {
            await this.persistConflict(conflict);
        }
    }
    async persistConflict(conflict) {
        this.registry.replaceConflict(conflict);
        const existingRows = await this.dependencies.sql.query(`SELECT id
       FROM public.ownership_conflicts
       WHERE CAST(details ->> 'conflictKey' AS text) = :conflictKey
       LIMIT 1`, { conflictKey: conflict.conflictKey });
        if (existingRows.length > 0) {
            await this.dependencies.sql.query(`UPDATE public.ownership_conflicts
         SET conflict_type = :conflictType,
             severity = :severity,
             resolved = :resolved,
             resolved_at = CASE WHEN :resolved THEN now() ELSE NULL END,
             resolved_by = CASE WHEN :resolved THEN COALESCE(resolved_by, 'system') ELSE NULL END,
             details = CAST(:details AS jsonb)
         WHERE CAST(details ->> 'conflictKey' AS text) = :conflictKey`, {
                conflictKey: conflict.conflictKey,
                conflictType: conflict.conflictType,
                severity: conflict.severity,
                resolved: conflict.resolved,
                details: JSON.stringify({ ...conflict.details, conflictKey: conflict.conflictKey, references: conflict.references, message: conflict.message }),
            });
            return;
        }
        await this.dependencies.sql.query(`INSERT INTO public.ownership_conflicts (
         release_id,
         track_id,
         conflict_type,
         severity,
         resolved,
         details
       ) VALUES (
         :releaseId,
         :trackId,
         :conflictType,
         :severity,
         :resolved,
         CAST(:details AS jsonb)
       )`, {
            releaseId: conflict.releaseId,
            trackId: conflict.trackId,
            conflictType: conflict.conflictType,
            severity: conflict.severity,
            resolved: conflict.resolved,
            details: JSON.stringify({ ...conflict.details, conflictKey: conflict.conflictKey, references: conflict.references, message: conflict.message }),
        });
    }
    async resolveConflict(conflictKey, resolvedBy) {
        const resolved = this.registry.resolveConflict(conflictKey, resolvedBy);
        if (!resolved)
            return;
        await this.dependencies.sql.query(`UPDATE public.ownership_conflicts
       SET resolved = TRUE,
           resolved_at = now(),
           resolved_by = :resolvedBy
       WHERE CAST(details ->> 'conflictKey' AS text) = :conflictKey`, { conflictKey, resolvedBy });
    }
    dedupeConflicts(conflicts) {
        const seen = new Set();
        const output = [];
        for (const conflict of conflicts) {
            if (seen.has(conflict.conflictKey))
                continue;
            seen.add(conflict.conflictKey);
            output.push(conflict);
        }
        return output;
    }
    buildLicenseMatrix(licenses) {
        const matrix = new Map();
        for (const license of licenses) {
            const key = [license.dsp ?? license.territoryMode, license.status].join("|");
            const current = matrix.get(key);
            const releaseIds = new Set(current?.releaseIds ?? []);
            releaseIds.add(license.releaseId);
            const trackIds = new Set(current?.trackIds ?? []);
            if (license.trackId)
                trackIds.add(license.trackId);
            matrix.set(key, freeze({
                dsp: license.dsp,
                status: license.status,
                territories: freezeList([...new Set([...(current?.territories ?? []), ...license.territories, ...license.includeTerritories])]),
                territoryMode: license.territoryMode,
                licenseWindow: license.licenseWindow,
                releaseIds: freezeList([...releaseIds]),
                trackIds: freezeList([...trackIds]),
            }));
        }
        return freezeList([...matrix.values()]);
    }
    countByScope(ownerships) {
        const result = {};
        for (const ownership of ownerships)
            result[ownership.rightsScope] = (result[ownership.rightsScope] ?? 0) + 1;
        return result;
    }
    countByTerritory(ownerships) {
        const result = {};
        for (const ownership of ownerships) {
            for (const territory of ownership.territories) {
                result[territory] = (result[territory] ?? 0) + 1;
            }
        }
        return result;
    }
    toIssue(conflict, severity) {
        return freeze({
            code: conflict.conflictType,
            path: conflict.trackId ? `tracks.${conflict.trackId}` : "release",
            message: conflict.message,
            severity,
            value: freeze({ references: conflict.references, details: conflict.details }),
        });
    }
    now() {
        return this.dependencies.now?.() ?? nowIso();
    }
}
export class RightsValidationWorker {
    dependencies;
    name = "rights-validation";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const result = await this.dependencies.service.verifyRights(job.data.releaseId);
        this.dependencies.logger.info("Rights validation worker processed", { releaseId: job.data.releaseId, valid: result.valid });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: result.valid,
            message: result.valid ? "rights verified" : "rights conflicts detected",
            metadata: freeze({ validations: result.conflicts.length, worker: this.name }),
        });
    }
}
export class TerritorySyncWorker {
    dependencies;
    name = "rights-territory-sync";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const record = await this.dependencies.service.assignTerritories({
            releaseId: job.data.releaseId,
            trackId: job.data.trackId ?? null,
            territoryMode: job.data.territories?.length ? "custom_group" : "worldwide",
            territories: job.data.territories ?? ["WORLD"],
            dsp: job.data.dsp ?? null,
            status: "enabled",
            metadata: job.data.metadata ?? {},
            actor: job.data.actor ?? null,
            reason: job.data.reason ?? null,
            correlationId: job.data.correlationId ?? null,
            ipAddress: job.data.ipAddress ?? null,
        });
        this.dependencies.logger.info("Rights territory sync worker processed", { releaseId: job.data.releaseId, licenseId: record.licenseId });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: record.status === "enabled",
            message: "territories synchronized",
            metadata: freeze({ licenseId: record.licenseId, territoryMode: record.territoryMode }),
        });
    }
}
export class ConflictDetectionWorker {
    dependencies;
    name = "rights-conflict-detection";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const report = await this.dependencies.service.generateConflictReport(job.data.releaseId);
        this.dependencies.logger.warn("Rights conflict worker processed", { releaseId: job.data.releaseId, conflicts: report.conflicts.length });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: report.blockerCount === 0,
            message: report.blockerCount === 0 ? "no blocking conflicts" : "blocking conflicts detected",
            metadata: freeze({ blockers: report.blockerCount, warnings: report.warningCount, info: report.infoCount }),
        });
    }
}
export class WithdrawalWorker {
    dependencies;
    name = "rights-withdrawal";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const withdrawal = await this.dependencies.service.withdrawRights({
            releaseId: job.data.releaseId,
            trackId: job.data.trackId ?? null,
            kind: job.data.territories?.length ? "country" : "catalog",
            dsp: job.data.dsp ?? null,
            territory: job.data.territories?.[0] ?? null,
            reason: job.data.reason ?? "scheduled withdrawal",
            metadata: job.data.metadata ?? {},
            actor: job.data.actor ?? null,
            correlationId: job.data.correlationId ?? null,
            ipAddress: job.data.ipAddress ?? null,
        });
        this.dependencies.logger.warn("Rights withdrawal worker processed", { releaseId: job.data.releaseId, withdrawalId: withdrawal.withdrawalId });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: withdrawal.status === "withdrawn",
            message: "rights withdrawn",
            metadata: freeze({ withdrawalId: withdrawal.withdrawalId, kind: withdrawal.kind }),
        });
    }
}
export class LicenseExpirationWorker {
    dependencies;
    name = "rights-license-expiration";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const report = await this.dependencies.service.verifyRights(job.data.releaseId);
        this.dependencies.logger.warn("Rights license expiration worker processed", { releaseId: job.data.releaseId, conflicts: report.conflicts.length });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: report.conflicts.every((entry) => entry.conflictType !== "expired_license"),
            message: "license expiration sweep complete",
            metadata: freeze({ conflictCount: report.conflicts.length }),
        });
    }
}
export class RightsAuditWorker {
    dependencies;
    name = "rights-audit";
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const report = await this.dependencies.service.generateRightsReport(job.data.releaseId);
        this.dependencies.logger.info("Rights audit worker processed", { releaseId: job.data.releaseId, ownerships: report.ownerships.length });
        return freeze({
            releaseId: job.data.releaseId,
            processed: true,
            valid: report.ownershipVerified,
            message: "rights audit completed",
            metadata: freeze({ ownerships: report.ownerships.length, licenses: report.licenses.length, conflicts: report.conflicts.length }),
        });
    }
}
export function createEnterpriseRightsRuntime(dependencies) {
    const registry = new RightsRegistry();
    const service = new EnterpriseRightsService(dependencies, registry);
    const workerDependencies = { service, logger: dependencies.logger };
    return freeze({
        registry,
        service,
        validationWorker: new RightsValidationWorker(workerDependencies),
        territorySyncWorker: new TerritorySyncWorker(workerDependencies),
        conflictDetectionWorker: new ConflictDetectionWorker(workerDependencies),
        withdrawalWorker: new WithdrawalWorker(workerDependencies),
        licenseExpirationWorker: new LicenseExpirationWorker(workerDependencies),
        rightsAuditWorker: new RightsAuditWorker(workerDependencies),
    });
}
export function registerRightsValidationQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsValidation, async (job) => new RightsValidationWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function registerRightsTerritorySyncQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsTerritorySync, async (job) => new TerritorySyncWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function registerRightsConflictQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsConflictDetection, async (job) => new ConflictDetectionWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function registerRightsWithdrawalQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsWithdrawal, async (job) => new WithdrawalWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function registerRightsLicenseExpirationQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsLicenseExpiration, async (job) => new LicenseExpirationWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function registerRightsAuditQueueWorker(service, logger, options = {}) {
    return createWorker(queueNames.rightsAudit, async (job) => new RightsAuditWorker({ service, logger }).process(job), { concurrency: options.concurrency });
}
export function generateRightsFingerprint(input) {
    return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}
