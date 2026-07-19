import type { QueueAdapter } from "../adapters/queueAdapter";
import type { QueueConfiguration, QueueAdapterName } from "../types/queueIntegrationTypes";

export interface QueueFactory {
  create(configuration: QueueConfiguration): QueueAdapter;
  resolve(adapter: QueueAdapterName): QueueAdapter | null;
  supports(adapter: QueueAdapterName): boolean;
}
