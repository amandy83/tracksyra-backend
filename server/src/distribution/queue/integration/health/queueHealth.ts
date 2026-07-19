import type { QueueConfiguration, QueueHealthStatus } from "../types/queueIntegrationTypes";

export interface QueueHealthChecker {
  check(configuration: QueueConfiguration): Promise<QueueHealthStatus> | QueueHealthStatus;
  probe(queueName: string): Promise<QueueHealthStatus> | QueueHealthStatus;
}
