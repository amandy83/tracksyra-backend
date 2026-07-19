export type PublishingIdentityKind =
  | "composer"
  | "lyricist"
  | "writer"
  | "publisher"
  | "sub_publisher"
  | "artist"
  | "producer"
  | "label";

export type PublishingRole =
  | "controlled_writer"
  | "composer"
  | "lyricist"
  | "publisher"
  | "sub_publisher"
  | "mechanical"
  | "performance"
  | "neighboring";

export type PublishingTerritoryCode = string;

export type PublishingMetadata = Readonly<Record<string, unknown>>;

export type PublishingIdentityInput = Readonly<{
  identityId?: string | null;
  kind: PublishingIdentityKind;
  name: string;
  ipi?: string | null;
  cae?: string | null;
  isni?: string | null;
  controlled?: boolean;
  territories?: readonly PublishingTerritoryCode[];
  metadata?: PublishingMetadata;
}>;

export type PublishingIdentityRecord = Readonly<{
  identityId: string;
  kind: PublishingIdentityKind;
  name: string;
  normalizedName: string;
  roles: readonly string[];
  ipi: string | null;
  cae: string | null;
  isni: string | null;
  controlled: boolean;
  territories: readonly PublishingTerritoryCode[];
  metadata: PublishingMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingIdentityLike = PublishingIdentityInput | PublishingIdentityRecord;

export type PublishingSplitInput = Readonly<{
  partyId?: string | null;
  partyName: string;
  role: PublishingRole;
  percentage: number;
  territories?: readonly PublishingTerritoryCode[];
  controlled?: boolean;
  metadata?: PublishingMetadata;
}>;

export type PublishingSplitRecord = Readonly<{
  splitId: string;
  workId: string;
  partyId: string;
  partyName: string;
  role: PublishingRole;
  percentage: number;
  territories: readonly PublishingTerritoryCode[];
  controlled: boolean;
  metadata: PublishingMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingRightKind = "mechanical" | "performance" | "neighboring";

export type PublishingRightInput = Readonly<{
  ownerId?: string | null;
  ownerName: string;
  kind: PublishingRightKind;
  percentage: number;
  territories?: readonly PublishingTerritoryCode[];
  exclusive?: boolean;
  metadata?: PublishingMetadata;
}>;

export type PublishingRightRecord = Readonly<{
  rightId: string;
  workId: string;
  ownerId: string;
  ownerName: string;
  kind: PublishingRightKind;
  percentage: number;
  territories: readonly PublishingTerritoryCode[];
  exclusive: boolean;
  metadata: PublishingMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingAgreementKind = "writer" | "publisher" | "sub_publisher" | "artist" | "label";

export type PublishingAgreementInput = Readonly<{
  agreementId?: string | null;
  kind: PublishingAgreementKind;
  partyId: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  exclusive?: boolean;
  territories?: readonly PublishingTerritoryCode[];
  metadata?: PublishingMetadata;
}>;

export type PublishingAgreementRecord = Readonly<{
  agreementId: string;
  kind: PublishingAgreementKind;
  partyId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  exclusive: boolean;
  territories: readonly PublishingTerritoryCode[];
  metadata: PublishingMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingWorkInput = Readonly<{
  workId?: string | null;
  title: string;
  originalTitle?: string | null;
  alternateTitles?: readonly string[];
  arrangementType?: string | null;
  adaptationType?: string | null;
  medley?: boolean;
  samples?: readonly string[];
  composite?: boolean;
  territories?: readonly PublishingTerritoryCode[];
  iswc?: string | null;
  isrcs?: readonly string[];
  chainOfTitle?: readonly string[];
  writers?: readonly PublishingIdentityLike[];
  publishers?: readonly PublishingIdentityLike[];
  subPublishers?: readonly PublishingIdentityLike[];
  agreements?: readonly PublishingAgreementInput[];
  splits?: readonly PublishingSplitInput[];
  mechanicalRights?: readonly PublishingRightInput[];
  performanceRights?: readonly PublishingRightInput[];
  neighbouringRights?: readonly PublishingRightInput[];
  publicDomain?: boolean;
  metadata?: PublishingMetadata;
}>;

export type PublishingWorkRecord = Readonly<{
  workId: string;
  title: string;
  originalTitle: string | null;
  alternateTitles: readonly string[];
  arrangementType: string | null;
  adaptationType: string | null;
  medley: boolean;
  samples: readonly string[];
  composite: boolean;
  territories: readonly PublishingTerritoryCode[];
  iswc: string | null;
  isrcs: readonly string[];
  chainOfTitle: readonly string[];
  publicDomain: boolean;
  writers: readonly PublishingIdentityRecord[];
  publishers: readonly PublishingIdentityRecord[];
  subPublishers: readonly PublishingIdentityRecord[];
  agreements: readonly PublishingAgreementRecord[];
  splits: readonly PublishingSplitRecord[];
  mechanicalRights: readonly PublishingRightRecord[];
  performanceRights: readonly PublishingRightRecord[];
  neighbouringRights: readonly PublishingRightRecord[];
  revision: number;
  deleted: boolean;
  deletedAt: string | null;
  metadata: PublishingMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type PublishingConflictType =
  | "duplicate_iswc"
  | "duplicate_isrc"
  | "duplicate_upc"
  | "duplicate_identity"
  | "missing_split"
  | "negative_split"
  | "split_total"
  | "territory_conflict"
  | "publisher_conflict"
  | "chain_of_title"
  | "public_domain"
  | "identity_resolution";

export type PublishingConflictRecord = Readonly<{
  conflictId: string;
  workId: string;
  type: PublishingConflictType;
  message: string;
  references: readonly string[];
  createdAt: string;
  metadata: PublishingMetadata;
}>;

export type PublishingAuditEvent = Readonly<{
  eventId: string;
  workId: string;
  actor: string;
  action: string;
  occurredAt: string;
  ipAddress: string | null;
  correlationId: string | null;
  reason: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: PublishingMetadata;
}>;

export type PublishingValidationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
  value: unknown;
}>;

export type PublishingValidationResult = Readonly<{
  valid: boolean;
  errors: readonly PublishingValidationIssue[];
  warnings: readonly PublishingValidationIssue[];
  conflicts: readonly PublishingConflictRecord[];
  metadata: PublishingMetadata;
}>;

export type PublishingReport = Readonly<{
  works: number;
  writers: number;
  publishers: number;
  subPublishers: number;
  splits: number;
  rights: number;
  agreements: number;
  conflicts: number;
  auditEvents: number;
  pendingIswcGeneration: number;
  metadata: PublishingMetadata;
}>;

export type PublishingCwrMessageType = "NewWorkRegistration" | "RevisedWorkRegistration" | "WorkDeletion";

export type PublishingCwrRecord = Readonly<{
  type: string;
  fields: readonly string[];
}>;

export type PublishingCwrDocument = Readonly<{
  workId: string;
  messageType: PublishingCwrMessageType;
  schemaVersion: string;
  records: readonly PublishingCwrRecord[];
  text: string;
  compressed: Uint8Array | null;
  signature: string | null;
  createdAt: string;
  metadata: PublishingMetadata;
}>;

export type PublishingWorkerJob = Readonly<{
  workId: string;
  actor?: string | null;
  correlationId?: string | null;
  reason?: string | null;
  metadata?: PublishingMetadata;
}>;

export type PublishingWorkerResult = Readonly<{
  workId: string;
  processed: boolean;
  valid: boolean;
  messageType: PublishingCwrMessageType | null;
  generated: boolean;
  warnings: readonly PublishingValidationIssue[];
  errors: readonly PublishingValidationIssue[];
  metadata: PublishingMetadata;
}>;

export type PublishingLogger = Readonly<{
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}>;
