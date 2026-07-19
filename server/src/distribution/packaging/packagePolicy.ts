export class PackagePolicy {
  constructor(
    public readonly allowCompression: boolean = true,
    public readonly allowEncryption: boolean = false,
    public readonly requireIntegrityChecks: boolean = true,
    public readonly requireSignatures: boolean = false,
    public readonly allowResume: boolean = true,
    public readonly cleanupTemporaryWorkspace: boolean = true,
    public readonly metadata: Readonly<Record<string, unknown>> = {},
  ) {
    Object.freeze(this);
  }
}
