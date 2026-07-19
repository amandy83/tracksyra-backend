import type { CredentialEnvironmentName, CredentialMetadataMap } from "./credentialTypes";

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

export class CredentialConfiguration {
  readonly environment: CredentialEnvironmentName;
  readonly encryptionSecret: string | Buffer | null;
  readonly defaultVersion: string;
  readonly rotationEnabled: boolean;
  readonly backupEnabled: boolean;
  readonly metadata: CredentialMetadataMap;

  constructor(input: {
    environment?: CredentialEnvironmentName;
    encryptionSecret?: string | Buffer | null;
    defaultVersion?: string;
    rotationEnabled?: boolean;
    backupEnabled?: boolean;
    metadata?: CredentialMetadataMap;
  } = {}) {
    this.environment = input.environment ?? "production";
    this.encryptionSecret = input.encryptionSecret ?? null;
    this.defaultVersion = ensure(input.defaultVersion ?? "1.0.0", "defaultVersion");
    this.rotationEnabled = input.rotationEnabled ?? true;
    this.backupEnabled = input.backupEnabled ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}
