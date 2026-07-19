import type { QueueAdapter } from "../adapters/queueAdapter";
import { QueueRegistryEntry, type QueueRegistry } from "../registry/queueRegistry";
import type { QueueConfiguration, QueueMetadata } from "../types/queueIntegrationTypes";

export class BullMQQueueRegistry implements QueueRegistry {
  private readonly entries = new Map<string, QueueRegistryEntry>();

  register(entry: QueueRegistryEntry): void {
    this.entries.set(entry.name, entry);
  }

  resolve(name: string): QueueAdapter | null {
    return this.entries.get(name)?.adapter ?? null;
  }

  get(name: string): QueueRegistryEntry | null {
    return this.entries.get(name) ?? null;
  }

  list(): readonly QueueRegistryEntry[] {
    return Object.freeze([...this.entries.values()]);
  }

  registerAdapter<TMetadata extends QueueMetadata = QueueMetadata>(input: {
    name: string;
    adapterName: string;
    configuration: QueueConfiguration<TMetadata>;
    adapter: QueueAdapter;
    metadata?: TMetadata;
  }): QueueRegistryEntry<TMetadata> {
    const entry = new QueueRegistryEntry({
      name: input.name,
      adapterName: input.adapterName,
      configuration: input.configuration,
      adapter: input.adapter,
      metadata: input.metadata,
    });
    this.register(entry);
    return entry;
  }
}
