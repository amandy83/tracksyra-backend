export type ProviderFieldRequirement = Readonly<{
  path: string;
  description?: string | null;
  type?: string | null;
  nullable?: boolean;
  required?: boolean;
}>;

export type ProviderRequirementSet = Readonly<{
  required: readonly ProviderFieldRequirement[];
  optional: readonly ProviderFieldRequirement[];
  forbidden: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ProviderMetadataRequirements = ProviderRequirementSet;
export type ProviderAssetRequirements = ProviderRequirementSet & Readonly<{
  requiredKinds: readonly string[];
  allowedKinds: readonly string[];
  minAssets: number;
  maxAssets: number | null;
}>;
export type ProviderPackageRequirements = ProviderRequirementSet & Readonly<{
  packageKinds: readonly string[];
  maxPackageSizeBytes: number | null;
  minPackageSizeBytes: number | null;
}>;
export type ProviderSubmissionRequirements = ProviderRequirementSet & Readonly<{
  requiredOperations: readonly string[];
  supportsPartialSubmission: boolean;
  requiresAuthentication: boolean;
}>;
export type ProviderWebhookRequirements = ProviderRequirementSet & Readonly<{
  secretRequired: boolean;
  requiredHeaders: readonly string[];
  supportedEvents: readonly string[];
  signatureAlgorithms: readonly string[];
}>;

