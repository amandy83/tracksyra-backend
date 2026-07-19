export type RightsScope =
  | "master"
  | "publishing"
  | "neighbouring"
  | "mechanical"
  | "performance"
  | "synchronization"
  | "ugc"
  | "ai_training"
  | "podcast"
  | "short_form_video"
  | "social_platform"
  | "streaming"
  | "download"
  | "broadcast"
  | "live_performance";

export type RightsOwnerType =
  | "artist"
  | "label"
  | "publisher"
  | "writer"
  | "composer"
  | "lyricist"
  | "producer"
  | "rightsholder"
  | "administrator"
  | "licensee";

export type RightsTerritoryMode = "worldwide" | "country" | "region" | "state_province" | "dsp_specific" | "custom_group";

export type RightsLicenseStatus = "enabled" | "disabled" | "pending" | "blocked" | "expired" | "withdrawn";

export type RightsConflictSeverity = "info" | "warning" | "blocker";

export type RightsConflictType =
  | "duplicate_ownership"
  | "overlapping_territory"
  | "invalid_split"
  | "expired_license"
  | "conflicting_owner"
  | "invalid_isrc"
  | "invalid_iswc"
  | "duplicate_release"
  | "duplicate_asset"
  | "license_violation"
  | "blocked_territory"
  | "fraud_indicator";

export type RightsWithdrawalKind =
  | "country"
  | "dsp"
  | "catalog"
  | "emergency"
  | "scheduled"
  | "partial"
  | "redelivery";

export type RightsDspName =
  | "Spotify"
  | "Apple Music"
  | "YouTube Music"
  | "Amazon Music"
  | "Deezer"
  | "TIDAL"
  | "Pandora"
  | "TikTok"
  | "Meta"
  | "JioSaavn"
  | "Boomplay"
  | "Anghami"
  | "Audiomack"
  | "SoundCloud"
  | "Custom DSP";

export type RightsLicenseWindow = Readonly<{
  start: string | null;
  end: string | null;
}>;

export type RightsOwnershipInput = Readonly<{
  rightsId?: string | null;
  releaseId: string;
  trackId?: string | null;
  ownerType: RightsOwnerType;
  ownerName: string;
  rightsScopes: readonly RightsScope[];
  territories?: readonly string[];
  percentage?: number | null;
  exclusive?: boolean;
  coExclusive?: boolean;
  transferable?: boolean;
  inherited?: boolean;
  status?: RightsLicenseStatus;
  source?: string | null;
  licenseWindow?: RightsLicenseWindow | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RightsOwnershipRecord = Readonly<{
  rightsId: string;
  ownershipKey: string;
  releaseId: string;
  trackId: string | null;
  ownerType: RightsOwnerType;
  ownerName: string;
  rightsScope: RightsScope;
  territories: readonly string[];
  percentage: number | null;
  exclusive: boolean;
  coExclusive: boolean;
  transferable: boolean;
  inherited: boolean;
  status: RightsLicenseStatus;
  source: string;
  licenseWindow: RightsLicenseWindow;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}>;

export type RightsTerritoryLicenseInput = Readonly<{
  licenseId?: string | null;
  releaseId: string;
  trackId?: string | null;
  territoryMode: RightsTerritoryMode;
  territories?: readonly string[];
  includeTerritories?: readonly string[];
  excludeTerritories?: readonly string[];
  blacklistTerritories?: readonly string[];
  territoryGroup?: string | null;
  dsp?: RightsDspName | null;
  status?: RightsLicenseStatus;
  licenseWindow?: RightsLicenseWindow | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RightsLicenseRecord = Readonly<{
  licenseId: string;
  licenseKey: string;
  releaseId: string;
  trackId: string | null;
  territoryMode: RightsTerritoryMode;
  territories: readonly string[];
  includeTerritories: readonly string[];
  excludeTerritories: readonly string[];
  blacklistTerritories: readonly string[];
  territoryGroup: string | null;
  dsp: RightsDspName | null;
  status: RightsLicenseStatus;
  licenseWindow: RightsLicenseWindow;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}>;

export type RightsConflictRecord = Readonly<{
  conflictId: string;
  conflictKey: string;
  releaseId: string;
  trackId: string | null;
  conflictType: RightsConflictType;
  severity: RightsConflictSeverity;
  message: string;
  references: readonly string[];
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type RightsWithdrawalRecord = Readonly<{
  withdrawalId: string;
  withdrawalKey: string;
  releaseId: string;
  trackId: string | null;
  kind: RightsWithdrawalKind;
  dsp: RightsDspName | null;
  territory: string | null;
  reason: string;
  status: RightsLicenseStatus;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}>;

export type RightsAuditEvent = Readonly<{
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  actor: string;
  reason: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type RightsValidationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
  value: unknown;
}>;

export type RightsValidationResult = Readonly<{
  valid: boolean;
  ownershipVerified: boolean;
  chainOfTitleVerified: boolean;
  territoryVerified: boolean;
  errors: readonly RightsValidationIssue[];
  warnings: readonly RightsValidationIssue[];
  conflicts: readonly RightsConflictRecord[];
  ownerships: readonly RightsOwnershipRecord[];
  licenses: readonly RightsLicenseRecord[];
  withdrawals: readonly RightsWithdrawalRecord[];
  auditEvents: readonly RightsAuditEvent[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type RightsLicenseMatrixEntry = Readonly<{
  dsp: RightsDspName | null;
  status: RightsLicenseStatus;
  territories: readonly string[];
  territoryMode: RightsTerritoryMode;
  licenseWindow: RightsLicenseWindow;
  releaseIds: readonly string[];
  trackIds: readonly string[];
}>;

export type RightsReport = Readonly<{
  generatedAt: string;
  ownerships: readonly RightsOwnershipRecord[];
  licenses: readonly RightsLicenseRecord[];
  conflicts: readonly RightsConflictRecord[];
  withdrawals: readonly RightsWithdrawalRecord[];
  auditEvents: readonly RightsAuditEvent[];
  rightsByScope: Readonly<Record<RightsScope, number>>;
  territoriesByCode: Readonly<Record<string, number>>;
  licenseMatrix: readonly RightsLicenseMatrixEntry[];
  ownershipVerified: boolean;
  chainOfTitleVerified: boolean;
  territoryCoverage: readonly string[];
  summary: Readonly<{
    ownerships: number;
    licenses: number;
    conflicts: number;
    withdrawals: number;
    auditEvents: number;
  }>;
}>;

export type RightsWorkerJob = Readonly<{
  releaseId: string;
  trackId?: string | null;
  actor?: string | null;
  reason?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  territories?: readonly string[];
  dsp?: RightsDspName | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RightsWorkerResult = Readonly<{
  releaseId: string;
  processed: boolean;
  valid: boolean;
  message: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type RightsLogger = Readonly<{
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}>;
