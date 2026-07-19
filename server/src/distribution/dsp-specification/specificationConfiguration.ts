import type { SpecificationEnvironmentName, SpecificationMetadataMap } from "./specificationTypes";

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

export class SpecificationConfiguration {
  readonly environment: SpecificationEnvironmentName;
  readonly defaultVersion: string;
  readonly signingSecret: string | Buffer | null;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly maxVersions: number;
  readonly metadata: SpecificationMetadataMap;

  constructor(input: {
    environment?: SpecificationEnvironmentName;
    defaultVersion?: string;
    signingSecret?: string | Buffer | null;
    featureFlags?: Readonly<Record<string, boolean>>;
    maxVersions?: number;
    metadata?: SpecificationMetadataMap;
  } = {}) {
    this.environment = input.environment ?? "production";
    this.defaultVersion = ensure(input.defaultVersion ?? "1.0.0", "defaultVersion");
    this.signingSecret = input.signingSecret ?? null;
    this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
    this.maxVersions = Number.isFinite(input.maxVersions ?? 0) && (input.maxVersions ?? 0) > 0 ? Math.floor(input.maxVersions ?? 0) : 20;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}
