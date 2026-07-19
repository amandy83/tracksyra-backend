import type { QueueConfiguration, QueueExecutionContext, QueueExecutionResult, QueueEnvelope, QueueHealthStatus, QueueStatistics, QueueAdapterName } from "../types/queueIntegrationTypes";
import type { QueueProducer } from "../producer/queueProducer";
import type { QueueConsumer } from "../consumer/queueConsumer";
import type { QueueDispatcher } from "../dispatcher/queueDispatcher";
import type { QueueScheduler } from "../scheduler/queueScheduler";
import type { QueueRegistry } from "../registry/queueRegistry";
import type { QueueSerializer } from "../serializer/queueSerializer";
import type { QueueDeserializer } from "../deserializer/queueDeserializer";
import type { QueueMiddlewareChain } from "../middleware/queueMiddleware";
import type { DeadLetterHandler } from "../deadletter/deadLetter";
import type { LeaseManager } from "../lease/queueLease";
import type { HeartbeatManager } from "../heartbeat/queueHeartbeat";
import type { CheckpointManager } from "../checkpoint/queueCheckpoint";
import type { QueueMetricsCollector } from "../metrics/queueMetrics";
import type { QueueLogger } from "../logging/queueLogger";
import type { QueueHealthChecker } from "../health/queueHealth";
import type { QueueConfigurationProvider } from "../configuration/queueConfiguration";

export interface QueueAdapter {
  readonly name: QueueAdapterName;
  readonly configuration: QueueConfiguration;
  readonly producer: QueueProducer;
  readonly consumer: QueueConsumer;
  readonly dispatcher: QueueDispatcher;
  readonly scheduler: QueueScheduler;
  readonly registry: QueueRegistry;
  readonly serializer: QueueSerializer;
  readonly deserializer: QueueDeserializer;
  readonly middleware: QueueMiddlewareChain;
  readonly deadLetterHandler: DeadLetterHandler;
  readonly leaseManager: LeaseManager;
  readonly heartbeatManager: HeartbeatManager;
  readonly checkpointManager: CheckpointManager;
  readonly metrics: QueueMetricsCollector;
  readonly logger: QueueLogger;
  readonly healthChecker: QueueHealthChecker;
  readonly configurationProvider: QueueConfigurationProvider;
  dispatch(
    envelope: QueueEnvelope,
    context: QueueExecutionContext,
  ): Promise<QueueExecutionResult> | QueueExecutionResult;
  health(): Promise<QueueHealthStatus> | QueueHealthStatus;
  statistics(): Promise<QueueStatistics> | QueueStatistics;
}
