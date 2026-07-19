import type { QueueConfigurationProvider } from "../configuration/queueConfiguration";
import type { QueueAdapterName, QueueConfiguration } from "../types/queueIntegrationTypes";

export class BullMQQueueConfigurationProvider implements QueueConfigurationProvider {
  private readonly configurations = new Map<string, QueueConfiguration>();

  load(adapter: QueueAdapterName, queueName: string): Promise<QueueConfiguration | null> | QueueConfiguration | null {
    return this.configurations.get(this.key(adapter, queueName)) ?? null;
  }

  save(configuration: QueueConfiguration): Promise<void> | void {
    this.configurations.set(this.key(configuration.adapter, configuration.queueName), configuration);
  }

  list(adapter?: QueueAdapterName): Promise<readonly QueueConfiguration[]> | readonly QueueConfiguration[] {
    const values = [...this.configurations.values()];
    return adapter ? values.filter((configuration) => configuration.adapter === adapter) : values;
  }

  private key(adapter: QueueAdapterName, queueName: string): string {
    return `${adapter}:${queueName}`;
  }
}
