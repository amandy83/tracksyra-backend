import type { QueueAdapter } from "../adapters/queueAdapter";
import type { QueueConfiguration, QueueMetadata } from "../types/queueIntegrationTypes";

export class QueueRegistryEntry<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly name: string;
  readonly adapterName: string;
  readonly configuration: QueueConfiguration<TMetadata>;
  readonly adapter: QueueAdapter;
  readonly registeredAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    name: string;
    adapterName: string;
    configuration: QueueConfiguration<TMetadata>;
    adapter: QueueAdapter;
    registeredAt?: string;
    metadata?: TMetadata;
  }) {
    this.name = input.name.trim();
    this.adapterName = input.adapterName.trim();
    this.configuration = input.configuration;
    this.adapter = input.adapter;
    this.registeredAt = input.registeredAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.name || !this.adapterName) {
      throw new Error("QueueRegistryEntry requires non-empty values");
    }
    Object.freeze(this);
  }
}

export interface QueueRegistry {
  register(entry: QueueRegistryEntry): void;
  resolve(name: string): QueueAdapter | null;
  get(name: string): QueueRegistryEntry | null;
  list(): readonly QueueRegistryEntry[];
}
