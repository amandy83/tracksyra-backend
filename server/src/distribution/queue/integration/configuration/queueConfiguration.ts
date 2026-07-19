import type { QueueAdapterName, QueueConfiguration } from "../types/queueIntegrationTypes";

export interface QueueConfigurationProvider {
  load(adapter: QueueAdapterName, queueName: string): Promise<QueueConfiguration | null> | QueueConfiguration | null;
  save(configuration: QueueConfiguration): Promise<void> | void;
  list(adapter?: QueueAdapterName): Promise<readonly QueueConfiguration[]> | readonly QueueConfiguration[];
}
