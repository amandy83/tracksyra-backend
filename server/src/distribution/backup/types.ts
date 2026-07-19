export type BackupScope =
  | "postgresql"
  | "object-storage"
  | "ddex-exports"
  | "royalty-statements"
  | "generated-reports"
  | "catalog-metadata"
  | "rights-data"
  | "publishing-data"
  | "audit-logs";

export type BackupMode = "full" | "incremental" | "scheduled" | "manual";

export type BackupStatus = "created" | "verified" | "restored" | "simulation" | "failed";

export type BackupEncryptionMetadata = Readonly<{
  algorithm: string;
  keyId: string | null;
  status: "metadata-only" | "encrypted" | "unavailable";
}>;

export type BackupRetentionPolicy = Readonly<{
  retentionDays: number;
  deleteExpiredBackups: boolean;
  retainLatestSuccessful: number;
}>;

export type BackupSectionSnapshot = Readonly<{
  scope: BackupScope;
  source: string;
  checksum: string;
  recordCount: number;
  status: "captured" | "unchanged" | "changed" | "skipped";
  summary: Readonly<Record<string, unknown>>;
}>;

export type BackupManifest = Readonly<{
  backupId: string;
  mode: BackupMode;
  status: BackupStatus;
  createdAt: string;
  requestedBy: string;
  reason: string | null;
  scheduledFor: string | null;
  previousBackupId: string | null;
  scopes: readonly BackupScope[];
  sections: readonly BackupSectionSnapshot[];
  checksum: string;
  retentionPolicy: BackupRetentionPolicy;
  encryption: BackupEncryptionMetadata;
  simulation: boolean;
  metadata: Readonly<Record<string, unknown>>;
  verification: BackupVerificationResult | null;
  restore: BackupRestoreResult | null;
}>;

export type BackupIndexEntry = Readonly<{
  backupId: string;
  mode: BackupMode;
  status: BackupStatus;
  createdAt: string;
  requestedBy: string;
  scheduledFor: string | null;
  previousBackupId: string | null;
  checksum: string;
  retentionPolicy: BackupRetentionPolicy;
  simulation: boolean;
  sectionCount: number;
  expiresAt: string;
}>;

export type BackupVerificationResult = Readonly<{
  backupId: string;
  verifiedAt: string;
  checksumValid: boolean;
  sectionsValid: boolean;
  missingScopes: readonly BackupScope[];
  notes: readonly string[];
}>;

export type BackupRestoreResult = Readonly<{
  backupId: string;
  requestedAt: string;
  completedAt: string;
  simulated: boolean;
  recoveredScopes: readonly BackupScope[];
  targetPointInTime: string | null;
  steps: readonly string[];
  integrityVerified: boolean;
}>;

export type RecoveryAuditEvent = Readonly<{
  eventId: string;
  eventType:
    | "backup-created"
    | "backup-verified"
    | "restore-simulated"
    | "restore-completed"
    | "recovery-plan-generated"
    | "retention-pruned"
    | "integrity-check";
  backupId: string | null;
  createdAt: string;
  actor: string;
  correlationId: string | null;
  details: Readonly<Record<string, unknown>>;
}>;

export type BackupReportName =
  | "backup-report"
  | "restore-report"
  | "recovery-report"
  | "retention-report"
  | "integrity-verification-report"
  | "delivery-report"
  | "health-report"
  | "capability-report"
  | "metadata-report"
  | "error-report"
  | "rights-report"
  | "claim-report"
  | "asset-report"
  | "monetization-report";

export type BackupDashboardName =
  | "backup-dashboard"
  | "recovery-dashboard"
  | "storage-usage-dashboard"
  | "backup-health-panel"
  | "recovery-timeline";

export type BackupReportResult = Readonly<{
  name: BackupReportName;
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly unknown[];
}>;

export type BackupDashboardResult = Readonly<{
  name: BackupDashboardName;
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly unknown[];
}>;

