import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { SqlExecutor } from "../services/distributionStore";
import { distributionPersistenceBasePath } from "../infrastructure/repositories/persistencePaths";
import type {
  BackupDashboardName,
  BackupDashboardResult,
  BackupEncryptionMetadata,
  BackupIndexEntry,
  BackupManifest,
  BackupMode,
  BackupReportName,
  BackupReportResult,
  BackupRetentionPolicy,
  BackupRestoreResult,
  BackupScope,
  BackupSectionSnapshot,
  BackupVerificationResult,
  RecoveryAuditEvent,
} from "./types";
import type { EnterpriseDistributionService } from "../admin/enterpriseDistributionService";

type BackupServiceDependencies = Readonly<{
  sql: SqlExecutor;
  distributionService: Pick<
    EnterpriseDistributionService,
    | "getOverview"
    | "getReport"
    | "getDashboard"
  >;
}>;

type BackupRequest = Readonly<{
  requestedBy: string;
  reason?: string | null;
  scheduledFor?: string | null;
  retentionDays?: number | null;
  scopes?: readonly BackupScope[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

type IncrementalBackupRequest = BackupRequest & Readonly<{
  previousBackupId?: string | null;
}>;

type RestoreRequest = Readonly<{
  backupId: string;
  requestedBy: string;
  reason?: string | null;
  targetPointInTime?: string | null;
  simulate?: boolean;
  scopes?: readonly BackupScope[];
}>;

const DEFAULT_SCOPES: readonly BackupScope[] = [
  "postgresql",
  "object-storage",
  "ddex-exports",
  "royalty-statements",
  "generated-reports",
  "catalog-metadata",
  "rights-data",
  "publishing-data",
  "audit-logs",
];

const BACKUP_ROOT = join(distributionPersistenceBasePath(), "backup");
const MANIFEST_DIR = join(BACKUP_ROOT, "manifests");
const INDEX_PATH = join(BACKUP_ROOT, "index.json");
const AUDIT_PATH = join(BACKUP_ROOT, "recovery-audit.json");

function nowIso(): string {
  return new Date().toISOString();
}

function emptyRecord(): Readonly<Record<string, unknown>> {
  return Object.freeze({});
}

function normalizeRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" ? Object.freeze({ ...(value as Record<string, unknown>) }) : emptyRecord();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current instanceof Date) return current.toISOString();
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return Object.keys(current as Record<string, unknown>).sort().reduce((result, key) => {
        result[key] = (current as Record<string, unknown>)[key];
        return result;
      }, {} as Record<string, unknown>);
    }
    return current;
  });
}

function checksum(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function uniqueScopes(scopes: readonly BackupScope[]): readonly BackupScope[] {
  return Object.freeze([...new Set(scopes)]);
}

export class BackupDisasterRecoveryService {
  constructor(private readonly dependencies: BackupServiceDependencies) {}

  async createFullBackup(request: BackupRequest): Promise<BackupManifest> {
    return this.createBackup("full", request);
  }

  async createScheduledBackup(request: BackupRequest): Promise<BackupManifest> {
    return this.createBackup("scheduled", request);
  }

  async createManualBackup(request: BackupRequest): Promise<BackupManifest> {
    return this.createBackup("manual", request);
  }

  async createIncrementalBackup(request: IncrementalBackupRequest): Promise<BackupManifest> {
    return this.createBackup("incremental", request, request.previousBackupId ?? null);
  }

  async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const manifest = await this.readManifest(backupId);
    if (!manifest) {
      return Object.freeze({
        backupId,
        verifiedAt: nowIso(),
        checksumValid: false,
        sectionsValid: false,
        missingScopes: Object.freeze([] as BackupScope[]),
        notes: Object.freeze(["Backup manifest not found."]),
      });
    }

    const computedChecksum = checksum(this.manifestChecksumPayload(manifest));
    const missingScopes = this.findMissingScopes(manifest);
    const checksumValid = computedChecksum === manifest.checksum;
    const sectionsValid = missingScopes.length === 0 && manifest.sections.length > 0;
    const result = Object.freeze({
      backupId,
      verifiedAt: nowIso(),
      checksumValid,
      sectionsValid,
      missingScopes: Object.freeze(missingScopes),
      notes: Object.freeze([
        checksumValid ? "Checksum verified." : "Checksum mismatch detected.",
        sectionsValid ? "All declared scopes are represented." : "One or more backup scopes are missing.",
      ]),
    });

    await this.persistManifest({ ...manifest, status: result.checksumValid && result.sectionsValid ? "verified" : "failed", verification: result });
    await this.appendAuditEvent({
      eventType: "backup-verified",
      backupId,
      actor: manifest.requestedBy,
      correlationId: this.normalizeMaybeString(manifest.metadata.correlationId),
      details: { checksumValid: result.checksumValid, sectionsValid: result.sectionsValid, missingScopes: result.missingScopes },
    });
    return result;
  }

  async restoreBackup(request: RestoreRequest): Promise<BackupRestoreResult> {
    const manifest = await this.readManifest(request.backupId);
    if (!manifest) {
      const result = Object.freeze({
        backupId: request.backupId,
        requestedAt: nowIso(),
        completedAt: nowIso(),
        simulated: Boolean(request.simulate ?? true),
        recoveredScopes: Object.freeze([] as BackupScope[]),
        targetPointInTime: request.targetPointInTime ?? null,
        steps: Object.freeze(["Backup manifest not found."]),
        integrityVerified: false,
      });
      return result;
    }

    const verification = await this.verifyBackup(manifest.backupId);
    const recoveredScopes = uniqueScopes(request.scopes?.length ? request.scopes : manifest.scopes);
    const simulated = request.simulate ?? true;
    const steps = [
      simulated ? "Simulate restore validation." : "Prepare restore execution.",
      verification.checksumValid ? "Checksum verified before restore." : "Checksum verification requires review.",
      verification.sectionsValid ? "Declared scopes available for restore." : "Restore scope mismatch detected.",
      request.targetPointInTime ? `Apply point-in-time target ${request.targetPointInTime}.` : "Restore from latest verified backup.",
      simulated ? "Generate restore evidence without mutating production state." : "Execute restore workflow against approved target.",
    ];

    const result = Object.freeze({
      backupId: manifest.backupId,
      requestedAt: nowIso(),
      completedAt: nowIso(),
      simulated,
      recoveredScopes: Object.freeze(recoveredScopes),
      targetPointInTime: request.targetPointInTime ?? null,
      steps: Object.freeze(steps),
      integrityVerified: verification.checksumValid && verification.sectionsValid,
    });

    await this.persistManifest({ ...manifest, status: simulated ? "simulation" : "restored", restore: result });
    await this.appendAuditEvent({
      eventType: simulated ? "restore-simulated" : "restore-completed",
      backupId: manifest.backupId,
      actor: request.requestedBy,
      correlationId: this.normalizeMaybeString(manifest.metadata.correlationId),
      details: { targetPointInTime: request.targetPointInTime ?? null, scopes: recoveredScopes, integrityVerified: result.integrityVerified },
    });
    return result;
  }

  async planPointInTimeRecovery(request: RestoreRequest): Promise<BackupRestoreResult> {
    return this.restoreBackup({ ...request, simulate: true });
  }

  async generateBackupReport(limit = 25): Promise<BackupReportResult> {
    const entries = await this.listIndexEntries();
    const items = entries.slice(0, Math.max(1, Math.trunc(limit)));
    return this.buildReport("backup-report", items, {
      totalBackups: entries.length,
      latestBackupId: entries[0]?.backupId ?? null,
      successfulBackups: entries.filter((entry) => entry.status !== "failed").length,
    });
  }

  async generateRestoreReport(limit = 25): Promise<BackupReportResult> {
    const entries = await this.listIndexEntries();
    return this.buildReport("restore-report", entries.filter((entry) => entry.status === "restored" || entry.status === "simulation").slice(0, Math.max(1, Math.trunc(limit))), {
      restoredBackups: entries.filter((entry) => entry.status === "restored").length,
      simulatedRestores: entries.filter((entry) => entry.status === "simulation").length,
    });
  }

  async generateRecoveryReport(limit = 25): Promise<BackupReportResult> {
    const audit = await this.listAuditEvents();
    return this.buildReport("recovery-report", audit.slice(0, Math.max(1, Math.trunc(limit))), {
      recoveryEvents: audit.length,
      simulatedRestores: audit.filter((event) => event.eventType === "restore-simulated").length,
    });
  }

  async generateRetentionReport(limit = 25): Promise<BackupReportResult> {
    const entries = await this.listIndexEntries();
    const now = Date.now();
    const expiring = entries.filter((entry) => Date.parse(entry.expiresAt) - now <= 7 * 24 * 60 * 60 * 1000);
    return this.buildReport("retention-report", expiring.slice(0, Math.max(1, Math.trunc(limit))), {
      expiringSoon: expiring.length,
      retentionDays: entries[0]?.retentionPolicy.retentionDays ?? 30,
      pruneEnabled: entries[0]?.retentionPolicy.deleteExpiredBackups ?? true,
    });
  }

  async generateIntegrityVerificationReport(limit = 25): Promise<BackupReportResult> {
    const entries = await this.listIndexEntries();
    const verifications = await Promise.all(entries.slice(0, Math.max(1, Math.trunc(limit))).map(async (entry) => {
      const manifest = await this.readManifest(entry.backupId);
      return manifest?.verification ?? await this.verifyBackup(entry.backupId);
    }));
    return this.buildReport("integrity-verification-report", verifications, {
      verified: verifications.filter((entry) => entry.checksumValid && entry.sectionsValid).length,
      failed: verifications.filter((entry) => !(entry.checksumValid && entry.sectionsValid)).length,
    });
  }

  async generateDeliveryReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("delivery-report", latest ? latest.sections : [], {
      latestBackupId: latest?.backupId ?? null,
      scopes: latest?.scopes ?? [],
      deliveryTargets: ["postgresql", "object-storage", "ddex-exports"],
    });
  }

  async generateHealthReport(limit = 25): Promise<BackupReportResult> {
    const entries = await this.listIndexEntries();
    const latest = entries[0] ?? null;
    const failures = entries.filter((entry) => entry.status === "failed").length;
    return this.buildReport("health-report", entries.slice(0, Math.max(1, Math.trunc(limit))), {
      latestBackupId: latest?.backupId ?? null,
      latestBackupAgeHours: latest ? Math.max(0, (Date.now() - Date.parse(latest.createdAt)) / (60 * 60 * 1000)) : null,
      failedBackups: failures,
      verifiedBackups: entries.filter((entry) => entry.status === "verified").length,
    });
  }

  async generateCapabilityReport(limit = 25): Promise<BackupReportResult> {
    return this.buildReport("capability-report", this.supportedCapabilities().slice(0, Math.max(1, Math.trunc(limit))), {
      backupModes: ["full", "incremental", "scheduled", "manual"],
      recoveryModes: ["simulation", "point-in-time", "rollback"],
      encryptionMetadata: this.encryptionMetadata(),
    });
  }

  async generateMetadataReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("metadata-report", latest?.sections.filter((section) => section.scope === "catalog-metadata" || section.scope === "generated-reports") ?? [], {
      latestBackupId: latest?.backupId ?? null,
      metadataScopes: ["catalog-metadata", "generated-reports"],
    });
  }

  async generateErrorReport(limit = 25): Promise<BackupReportResult> {
    const audit = await this.listAuditEvents();
    return this.buildReport("error-report", audit.filter((event) => event.eventType === "integrity-check" || event.eventType === "backup-verified").slice(0, Math.max(1, Math.trunc(limit))), {
      errorEvents: audit.filter((event) => event.eventType === "integrity-check").length,
      verificationEvents: audit.filter((event) => event.eventType === "backup-verified").length,
    });
  }

  async generateRightsReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("rights-report", latest?.sections.filter((section) => section.scope === "rights-data") ?? [], {
      rightsScopes: ["rights-data"],
      latestBackupId: latest?.backupId ?? null,
    });
  }

  async generateClaimReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("claim-report", latest?.sections.filter((section) => section.scope === "rights-data" || section.scope === "audit-logs") ?? [], {
      claimsCovered: ["rights-data", "audit-logs"],
      latestBackupId: latest?.backupId ?? null,
    });
  }

  async generateAssetReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("asset-report", latest?.sections.filter((section) => section.scope === "object-storage" || section.scope === "ddex-exports") ?? [], {
      assetScopes: ["object-storage", "ddex-exports"],
      latestBackupId: latest?.backupId ?? null,
    });
  }

  async generateMonetizationReport(limit = 25): Promise<BackupReportResult> {
    const latest = await this.latestManifest();
    return this.buildReport("monetization-report", latest?.sections.filter((section) => section.scope === "royalty-statements" || section.scope === "generated-reports") ?? [], {
      monetizationScopes: ["royalty-statements", "generated-reports"],
      latestBackupId: latest?.backupId ?? null,
    });
  }

  async getDashboard(name: BackupDashboardName, limit = 25): Promise<BackupDashboardResult> {
    switch (name) {
      case "backup-dashboard":
        return this.buildDashboard(name, await this.listIndexEntries(), {
          totalBackups: (await this.listIndexEntries()).length,
          latestBackupId: (await this.listIndexEntries())[0]?.backupId ?? null,
        }, limit);
      case "recovery-dashboard":
        return this.buildDashboard(name, await this.listAuditEvents(), {
          recoveryEvents: (await this.listAuditEvents()).length,
        }, limit);
      case "storage-usage-dashboard":
        return this.buildDashboard(name, await this.collectStorageUsage(), {
          storageRoots: this.storageRoots().length,
        }, limit);
      case "backup-health-panel":
        return this.buildDashboard(name, await this.listIndexEntries(), {
          verifiedBackups: (await this.listIndexEntries()).filter((entry) => entry.status === "verified").length,
        }, limit);
      case "recovery-timeline":
        return this.buildDashboard(name, await this.listAuditEvents(), {
          timelineEvents: (await this.listAuditEvents()).length,
        }, limit);
    }
    throw new Error(`Unsupported backup dashboard: ${name}`);
  }

  async getReport(name: BackupReportName, limit = 25): Promise<BackupReportResult> {
    switch (name) {
      case "backup-report":
        return this.generateBackupReport(limit);
      case "restore-report":
        return this.generateRestoreReport(limit);
      case "recovery-report":
        return this.generateRecoveryReport(limit);
      case "retention-report":
        return this.generateRetentionReport(limit);
      case "integrity-verification-report":
        return this.generateIntegrityVerificationReport(limit);
      case "delivery-report":
        return this.generateDeliveryReport(limit);
      case "health-report":
        return this.generateHealthReport(limit);
      case "capability-report":
        return this.generateCapabilityReport(limit);
      case "metadata-report":
        return this.generateMetadataReport(limit);
      case "error-report":
        return this.generateErrorReport(limit);
      case "rights-report":
        return this.generateRightsReport(limit);
      case "claim-report":
        return this.generateClaimReport(limit);
      case "asset-report":
        return this.generateAssetReport(limit);
      case "monetization-report":
        return this.generateMonetizationReport(limit);
    }
    throw new Error(`Unsupported backup report: ${name}`);
  }

  async recoverPointInTime(request: RestoreRequest): Promise<BackupRestoreResult> {
    return this.restoreBackup(request);
  }

  async rollbackWorkflow(input: { backupId: string; requestedBy: string; reason?: string | null }): Promise<BackupRestoreResult> {
    return this.restoreBackup({
      backupId: input.backupId,
      requestedBy: input.requestedBy,
      reason: input.reason ?? "rollback",
      simulate: true,
    });
  }

  async recordRecoveryAuditEvent(event: Omit<RecoveryAuditEvent, "eventId" | "createdAt"> & Partial<Pick<RecoveryAuditEvent, "eventId" | "createdAt">>): Promise<RecoveryAuditEvent> {
    const auditEvent: RecoveryAuditEvent = Object.freeze({
      eventId: event.eventId ?? randomUUID(),
      eventType: event.eventType,
      backupId: event.backupId ?? null,
      createdAt: event.createdAt ?? nowIso(),
      actor: event.actor,
      correlationId: event.correlationId ?? null,
      details: normalizeRecord(event.details),
    });
    const events = await this.listAuditEvents();
    events.unshift(auditEvent);
    await this.writeJson(AUDIT_PATH, events);
    return auditEvent;
  }

  private async createBackup(mode: BackupMode, request: BackupRequest | IncrementalBackupRequest, previousBackupId: string | null = null): Promise<BackupManifest> {
    const createdAt = nowIso();
    const scopes = uniqueScopes(request.scopes?.length ? request.scopes : DEFAULT_SCOPES);
    const requestedBy = request.requestedBy || "system";
    const backupId = `backup-${mode}-${createdAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const currentSections = await this.captureSections(scopes);
    const previousManifest = previousBackupId ? await this.readManifest(previousBackupId) : await this.latestManifest();
    const sections = this.computeSections(mode, currentSections, previousManifest);
    const manifestPayload = {
      backupId,
      mode,
      createdAt,
      requestedBy,
      reason: request.reason ?? null,
      scheduledFor: request.scheduledFor ?? null,
      previousBackupId: previousBackupId ?? previousManifest?.backupId ?? null,
      scopes,
      sections,
      retentionPolicy: this.buildRetentionPolicy(request.retentionDays ?? null),
      encryption: this.encryptionMetadata(),
      simulation: false,
      metadata: Object.freeze({
        ...normalizeRecord(request.metadata ?? emptyRecord()),
        scopeCount: scopes.length,
        sectionCount: sections.length,
      }),
    };

    const manifest: BackupManifest = Object.freeze({
      backupId,
      mode,
      status: "created",
      createdAt,
      requestedBy,
      reason: request.reason ?? null,
      scheduledFor: request.scheduledFor ?? null,
      previousBackupId: previousBackupId ?? previousManifest?.backupId ?? null,
      scopes,
      sections,
      checksum: checksum(manifestPayload),
      retentionPolicy: manifestPayload.retentionPolicy,
      encryption: manifestPayload.encryption,
      simulation: false,
      metadata: manifestPayload.metadata,
      verification: null,
      restore: null,
    });

    await this.persistManifest(manifest);
    await this.appendAuditEvent({
      eventType: "backup-created",
      backupId: manifest.backupId,
      actor: requestedBy,
      correlationId: this.normalizeMaybeString(manifest.metadata.correlationId),
      details: { mode, scopes, checksum: manifest.checksum, scheduledFor: manifest.scheduledFor },
    });
    await this.enforceRetention(manifest.retentionPolicy);
    return manifest;
  }

  private async captureSections(scopes: readonly BackupScope[]): Promise<readonly BackupSectionSnapshot[]> {
    const snapshots = await Promise.all(scopes.map(async (scope) => this.captureScope(scope)));
    return Object.freeze(snapshots);
  }

  private async captureScope(scope: BackupScope): Promise<BackupSectionSnapshot> {
    switch (scope) {
      case "postgresql": {
        const [overview, rightsReport, metadataReport, deliveryReport, royaltyReport] = await Promise.all([
          this.dependencies.distributionService.getOverview(),
          this.dependencies.distributionService.getReport("rights-report", 25),
          this.dependencies.distributionService.getReport("metadata-audit-report", 25),
          this.dependencies.distributionService.getReport("delivery-report", 25),
          this.dependencies.distributionService.getDashboard("royalty-health", 25),
        ]);
        const summary = {
          overview,
          rightsReport,
          metadataReport,
          deliveryReport,
          royaltyReport,
          tables: await this.collectTableSnapshot(),
        };
        return this.sectionSnapshot(scope, "PostgreSQL logical snapshot", summary, "logical-db");
      }
      case "object-storage": {
        const summary = {
          roots: await this.collectStorageUsage(),
          encryption: this.encryptionMetadata(),
        };
        return this.sectionSnapshot(scope, "Object storage inventory", summary, "filesystem");
      }
      case "ddex-exports": {
        const summary = {
          exports: await this.collectExportArtifacts(),
        };
        return this.sectionSnapshot(scope, "DDEX export inventory", summary, "exports");
      }
      case "royalty-statements": {
        const [dashboard, exceptions] = await Promise.all([
          this.dependencies.distributionService.getDashboard("royalty-health", 25),
          this.dependencies.distributionService.getReport("royalty-exceptions", 25),
        ]);
        return this.sectionSnapshot(scope, "Royalty statement snapshot", { dashboard, exceptions }, "royalty");
      }
      case "generated-reports": {
        const reports = await Promise.all([
          this.dependencies.distributionService.getReport("delivery-report", 25),
          this.dependencies.distributionService.getReport("rights-report", 25),
          this.dependencies.distributionService.getReport("publishing-report", 25),
          this.dependencies.distributionService.getReport("audit-reports", 25),
          this.dependencies.distributionService.getReport("metadata-quality-report", 25),
        ]);
        return this.sectionSnapshot(scope, "Generated report snapshot", { reports }, "reports");
      }
      case "catalog-metadata": {
        const [metadata, releaseReadiness, identifiers] = await Promise.all([
          this.dependencies.distributionService.getReport("metadata-audit-report", 25),
          this.dependencies.distributionService.getReport("release-readiness-report", 25),
          this.dependencies.distributionService.getReport("identifier-report", 25),
        ]);
        return this.sectionSnapshot(scope, "Catalog metadata snapshot", { metadata, releaseReadiness, identifiers }, "catalog");
      }
      case "rights-data": {
        const [rights, conflicts] = await Promise.all([
          this.dependencies.distributionService.getReport("rights-report", 25),
          this.dependencies.distributionService.getReport("rights-conflicts", 25),
        ]);
        return this.sectionSnapshot(scope, "Rights data snapshot", { rights, conflicts }, "rights");
      }
      case "publishing-data": {
        const publishing = await this.dependencies.distributionService.getReport("publishing-report", 25);
        return this.sectionSnapshot(scope, "Publishing snapshot", { publishing }, "publishing");
      }
      case "audit-logs": {
        const audit = await this.dependencies.distributionService.getReport("audit-reports", 50);
        const recoveryAudit = await this.listAuditEvents();
        return this.sectionSnapshot(scope, "Audit log snapshot", { audit, recoveryAudit }, "audit");
      }
    }
    throw new Error(`Unsupported backup scope: ${scope}`);
  }

  private computeSections(mode: BackupMode, current: readonly BackupSectionSnapshot[], previous: BackupManifest | null): readonly BackupSectionSnapshot[] {
    if (mode !== "incremental" || !previous) return current;
    const previousChecksums = new Map(previous.sections.map((section) => [section.scope, section.checksum]));
    return Object.freeze(current.map((section) => {
      const previousChecksum = previousChecksums.get(section.scope);
      return Object.freeze({
        ...section,
        status: previousChecksum === section.checksum ? "unchanged" : "changed",
      });
    }) as BackupSectionSnapshot[]);
  }

  private sectionSnapshot(scope: BackupScope, label: string, payload: Readonly<Record<string, unknown>>, source: string): BackupSectionSnapshot {
    const normalized = normalizeRecord(payload);
    return Object.freeze({
      scope,
      source,
      checksum: checksum(normalized),
      recordCount: this.recordCountFromPayload(normalized),
      status: "captured",
      summary: Object.freeze({
        label,
        payload: normalized,
      }),
    });
  }

  private recordCountFromPayload(payload: Readonly<Record<string, unknown>>): number {
    return Object.values(payload).reduce<number>((count, value) => {
      if (Array.isArray(value)) return count + value.length;
      if (value && typeof value === "object") return count + Object.keys(value as Record<string, unknown>).length;
      return count + 1;
    }, 0);
  }

  private manifestChecksumPayload(manifest: BackupManifest) {
    return {
      backupId: manifest.backupId,
      mode: manifest.mode,
      createdAt: manifest.createdAt,
      requestedBy: manifest.requestedBy,
      reason: manifest.reason,
      scheduledFor: manifest.scheduledFor,
      previousBackupId: manifest.previousBackupId,
      scopes: manifest.scopes,
      sections: manifest.sections,
      retentionPolicy: manifest.retentionPolicy,
      encryption: manifest.encryption,
      simulation: manifest.simulation,
      metadata: manifest.metadata,
    };
  }

  private findMissingScopes(manifest: BackupManifest): BackupScope[] {
    const present = new Set(manifest.sections.map((section) => section.scope));
    return manifest.scopes.filter((scope) => !present.has(scope));
  }

  private async persistManifest(manifest: BackupManifest): Promise<void> {
    await this.writeJson(join(MANIFEST_DIR, `${manifest.backupId}.json`), manifest);
    const entries = await this.listIndexEntries();
    const filtered = entries.filter((entry) => entry.backupId !== manifest.backupId);
    filtered.unshift(this.indexEntryFromManifest(manifest));
    await this.writeJson(INDEX_PATH, filtered);
  }

  private indexEntryFromManifest(manifest: BackupManifest): BackupIndexEntry {
    return Object.freeze({
      backupId: manifest.backupId,
      mode: manifest.mode,
      status: manifest.status,
      createdAt: manifest.createdAt,
      requestedBy: manifest.requestedBy,
      scheduledFor: manifest.scheduledFor,
      previousBackupId: manifest.previousBackupId,
      checksum: manifest.checksum,
      retentionPolicy: manifest.retentionPolicy,
      simulation: manifest.simulation,
      sectionCount: manifest.sections.length,
      expiresAt: new Date(Date.parse(manifest.createdAt) + manifest.retentionPolicy.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  private async listIndexEntries(): Promise<BackupIndexEntry[]> {
    const payload = await this.readJson<ReadonlyArray<BackupIndexEntry>>(INDEX_PATH);
    return Array.isArray(payload) ? [...payload] : [];
  }

  private async latestManifest(): Promise<BackupManifest | null> {
    const entries = await this.listIndexEntries();
    return entries[0] ? this.readManifest(entries[0].backupId) : null;
  }

  private async readManifest(backupId: string): Promise<BackupManifest | null> {
    return this.readJson<BackupManifest>(join(MANIFEST_DIR, `${backupId}.json`));
  }

  private async listAuditEvents(): Promise<RecoveryAuditEvent[]> {
    const payload = await this.readJson<ReadonlyArray<RecoveryAuditEvent>>(AUDIT_PATH);
    return Array.isArray(payload) ? [...payload] : [];
  }

  private async enforceRetention(policy: BackupRetentionPolicy): Promise<void> {
    if (!policy.deleteExpiredBackups) return;
    const entries = await this.listIndexEntries();
    const now = Date.now();
    const retained = entries.filter((entry) => Date.parse(entry.expiresAt) > now || entries.indexOf(entry) < policy.retainLatestSuccessful);
    const expired = entries.filter((entry) => !retained.includes(entry));
    for (const expiredEntry of expired) {
      await rm(join(MANIFEST_DIR, `${expiredEntry.backupId}.json`), { force: true });
    }
    if (expired.length > 0) {
      await this.writeJson(INDEX_PATH, retained);
      await this.appendAuditEvent({
        eventType: "retention-pruned",
        backupId: expired[0]?.backupId ?? null,
        actor: "system",
        correlationId: null,
        details: { pruned: expired.map((entry) => entry.backupId), retentionDays: policy.retentionDays },
      });
    }
  }

  private buildRetentionPolicy(retentionDays: number | null): BackupRetentionPolicy {
    return Object.freeze({
      retentionDays: Math.max(1, Math.trunc(retentionDays ?? 30)),
      deleteExpiredBackups: true,
      retainLatestSuccessful: 5,
    });
  }

  private encryptionMetadata(): BackupEncryptionMetadata {
    return Object.freeze({
      algorithm: "AES-256-GCM",
      keyId: null,
      status: "metadata-only",
    });
  }

  private async collectTableSnapshot() {
    const tables = [
      "public.releases",
      "public.tracks",
      "public.review_queue",
      "public.delivery_queue",
      "public.rights_ownership",
      "public.ownership_history",
      "public.ownership_conflicts",
      "public.royalty_periods",
      "public.royalty_statements",
      "public.royalty_statement_versions",
      "public.catalog_health",
      "public.metadata_audit",
      "public.delivery_audit",
      "public.royalty_audit",
      "public.audit_logs",
      "public.publishing_records",
      "public.backup_manifests",
      "public.backup_audit_logs",
    ] as const;
    const snapshots = await Promise.all(tables.map(async (tableName) => {
      const existsRows = await this.dependencies.sql.query<{ exists: boolean }>(`SELECT to_regclass(:tableName) IS NOT NULL AS exists`, { tableName });
      const exists = Boolean(existsRows[0]?.exists);
      if (!exists) {
        return { tableName, exists, recordCount: 0 };
      }
      const countRows = await this.dependencies.sql.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
      return { tableName, exists, recordCount: Number(countRows[0]?.count ?? 0) };
    }));
    return Object.freeze(snapshots);
  }

  private storageRoots() {
    return [
      { name: "backup-root", path: BACKUP_ROOT },
      { name: "manifest-dir", path: MANIFEST_DIR },
      { name: "reports-dir", path: join(distributionPersistenceBasePath(), "reports") },
      { name: "state-root", path: distributionPersistenceBasePath() },
    ] as const;
  }

  private async collectStorageUsage() {
    const roots = await Promise.all(this.storageRoots().map(async (root) => {
      const exists = await this.pathExists(root.path);
      if (!exists) return { ...root, exists, fileCount: 0, totalBytes: 0 };
      const stats = await this.collectPathStats(root.path);
      return { ...root, exists, ...stats };
    }));
    return Object.freeze(roots);
  }

  private async collectExportArtifacts() {
    const roots = [join(process.cwd(), "reports"), join(process.cwd(), "Sample DDEX.xml"), MANIFEST_DIR];
    const items = await Promise.all(roots.map(async (path) => {
      const exists = await this.pathExists(path);
      if (!exists) return { path, exists, fileCount: 0, totalBytes: 0 };
      const stats = await this.collectPathStats(path);
      return { path, exists, ...stats };
    }));
    return Object.freeze(items);
  }

  private async collectPathStats(path: string): Promise<{ fileCount: number; totalBytes: number }> {
    const stats = await stat(path);
    if (stats.isFile()) return { fileCount: 1, totalBytes: stats.size };
    const entries = await readdir(path, { withFileTypes: true });
    let fileCount = 0;
    let totalBytes = 0;
    for (const entry of entries) {
      const childPath = join(path, entry.name);
      if (entry.isDirectory()) {
        const childStats = await this.collectPathStats(childPath);
        fileCount += childStats.fileCount;
        totalBytes += childStats.totalBytes;
      } else {
        const childStat = await stat(childPath);
        fileCount += 1;
        totalBytes += childStat.size;
      }
    }
    return { fileCount, totalBytes };
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      const payload = await readFile(path, "utf8");
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rm(path, { force: true });
    await rename(tempPath, path);
  }

  private async appendAuditEvent(event: Omit<RecoveryAuditEvent, "eventId" | "createdAt"> & Partial<Pick<RecoveryAuditEvent, "eventId" | "createdAt">>): Promise<RecoveryAuditEvent> {
    return this.recordRecoveryAuditEvent(event);
  }

  private supportedCapabilities(): readonly BackupSectionSnapshot[] {
    return Object.freeze(DEFAULT_SCOPES.map((scope) => Object.freeze({
      scope,
      source: "capability",
      checksum: checksum({ scope, supported: true }),
      recordCount: 1,
      status: "captured" as const,
      summary: Object.freeze({
        supported: true,
        description: this.describeScope(scope),
      }),
    })));
  }

  private describeScope(scope: BackupScope): string {
    switch (scope) {
      case "postgresql":
        return "Logical PostgreSQL state, schema metadata, and audit references.";
      case "object-storage":
        return "Object storage inventory, file usage, and retention metadata.";
      case "ddex-exports":
        return "DDEX export artifacts and packaged XML outputs.";
      case "royalty-statements":
        return "Royalty statements and payout evidence snapshots.";
      case "generated-reports":
        return "Generated operational reports and reporting exports.";
      case "catalog-metadata":
        return "Catalog metadata and identifier readiness snapshots.";
      case "rights-data":
        return "Rights ownership, territory, and conflict evidence.";
      case "publishing-data":
        return "Publishing and writer metadata snapshots.";
      case "audit-logs":
        return "Immutable audit and recovery trail entries.";
    }
  }

  private buildReport(name: BackupReportName, items: readonly unknown[], summary: Readonly<Record<string, unknown>>): BackupReportResult {
    return Object.freeze({
      name,
      generatedAt: nowIso(),
      summary: Object.freeze(summary),
      items: Object.freeze([...items]),
    });
  }

  private async buildDashboard(name: BackupDashboardName, items: readonly unknown[], summary: Readonly<Record<string, unknown>>, limit: number): Promise<BackupDashboardResult> {
    return Object.freeze({
      name,
      generatedAt: nowIso(),
      summary: Object.freeze({
        ...summary,
        limit: Math.max(1, Math.trunc(limit)),
      }),
      items: Object.freeze([...items].slice(0, Math.max(1, Math.trunc(limit)))),
    });
  }

  private normalizeMaybeString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
  }
}
