import type { DocumentStore } from "../shared/documentStore";

export class DistributionConfiguration {
  constructor(
    public readonly environment: string,
    public readonly workspaceRoot: string,
    public readonly storageRoot: string,
    public readonly metricsEnabled: boolean = true,
  ) {}
}

export interface ProviderConfigurationStore {
  get(providerReference: string): Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  set(providerReference: string, configuration: Record<string, unknown>): Promise<void> | void;
}

export interface FeatureFlagProvider {
  isEnabled(flag: string): Promise<boolean> | boolean;
}

export class MemoryProviderConfigurationStore implements ProviderConfigurationStore {
  private readonly records = new Map<string, Record<string, unknown>>();

  get(providerReference: string): Record<string, unknown> | null {
    return this.records.get(providerReference) ?? null;
  }

  set(providerReference: string, configuration: Record<string, unknown>): void {
    this.records.set(providerReference, { ...configuration });
  }
}

export class StaticFeatureFlagProvider implements FeatureFlagProvider {
  constructor(private readonly flags: Readonly<Record<string, boolean>>) {}

  isEnabled(flag: string): boolean {
    return this.flags[flag] ?? false;
  }
}

export class FileProviderConfigurationStore implements ProviderConfigurationStore {
  constructor(private readonly store: DocumentStore) {}

  async get(providerReference: string): Promise<Record<string, unknown> | null> {
    return await this.store.read<Record<string, unknown>>(this.keyFor(providerReference));
  }

  async set(providerReference: string, configuration: Record<string, unknown>): Promise<void> {
    await this.store.write(this.keyFor(providerReference), configuration);
  }

  private keyFor(providerReference: string): string {
    return `providers/configuration/${providerReference}.json`;
  }
}
