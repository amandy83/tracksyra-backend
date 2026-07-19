import type { QueueAdapter } from "../adapters/queueAdapter";
import type { QueueFactory } from "../factory/queueFactory";
import type { QueueConfiguration, QueueAdapterName } from "../types/queueIntegrationTypes";
import { BullMQQueueRegistry } from "./bullmqQueueRegistry";

export class BullMQQueueFactory implements QueueFactory {
  constructor(private readonly registry: BullMQQueueRegistry) {}

  create(configuration: QueueConfiguration): QueueAdapter {
    const existing = this.registry.get(configuration.queueName)?.adapter;
    if (existing) return existing;

    if (!this.supports(configuration.adapter)) {
      throw new Error(`Unsupported queue adapter: ${configuration.adapter}`);
    }

    throw new Error(`Queue adapter not registered: ${configuration.queueName}`);
  }

  resolve(adapter: QueueAdapterName): QueueAdapter | null {
    const entry = this.registry.list().find((candidate) => candidate.adapterName === adapter);
    return entry?.adapter ?? null;
  }

  supports(adapter: QueueAdapterName): boolean {
    return adapter === "BullMQ";
  }

  get queueRegistry(): BullMQQueueRegistry {
    return this.registry;
  }
}
