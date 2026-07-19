import type { QueueAdapter } from "../adapters/queueAdapter";
import { QueueConfiguration, QueueExecutionContext, QueueExecutionResult } from "../types/queueIntegrationTypes";
import type { QueueRegistry } from "../registry/queueRegistry";
import { BullMQQueueSerializer } from "./bullmqSerializer";
import { BullMQQueueDeserializer } from "./bullmqDeserializer";
import { BullMQQueueLogger } from "./bullmqLogger";
import { BullMQQueueMetricsCollector } from "./bullmqMetrics";
import { BullMQQueueMiddlewareChain } from "./bullmqMiddleware";
import { BullMQQueueConfigurationProvider } from "./bullmqConfigurationProvider";
import { BullMQQueueHealthChecker } from "./bullmqHealthChecker";
import { BullMQQueueProducer } from "./bullmqProducer";
import { BullMQConsumer } from "./bullmqConsumer";
import { BullMQDispatcher } from "./bullmqDispatcher";
import { BullMQScheduler } from "./bullmqScheduler";
import { BullMQDeadLetterHandler } from "./bullmqDeadLetterHandler";
import { BullMQLeaseManager } from "./bullmqLeaseManager";
import { BullMQHeartbeatManager } from "./bullmqHeartbeatManager";
import { BullMQCheckpointManager } from "./bullmqCheckpointManager";
import { QueueEnvelope, QueueHealthStatus, QueueStatistics } from "../types/queueIntegrationTypes";

export class BullMQQueueAdapter implements QueueAdapter {
  readonly name = "BullMQ" as const;
  readonly serializer: BullMQQueueSerializer;
  readonly deserializer: BullMQQueueDeserializer;
  readonly logger: BullMQQueueLogger;
  readonly metrics: BullMQQueueMetricsCollector;
  readonly configurationProvider: BullMQQueueConfigurationProvider;
  readonly healthChecker: BullMQQueueHealthChecker;
  readonly middleware: BullMQQueueMiddlewareChain;
  readonly producer: BullMQQueueProducer;
  readonly consumer: BullMQConsumer;
  readonly dispatcher: BullMQDispatcher;
  readonly scheduler: BullMQScheduler;
  readonly deadLetterHandler: BullMQDeadLetterHandler;
  readonly leaseManager: BullMQLeaseManager;
  readonly heartbeatManager: BullMQHeartbeatManager;
  readonly checkpointManager: BullMQCheckpointManager;

  constructor(
    readonly configuration: QueueConfiguration,
    readonly registry: QueueRegistry,
    deps: Readonly<{
      serializer: BullMQQueueSerializer;
      deserializer: BullMQQueueDeserializer;
      logger: BullMQQueueLogger;
      metrics: BullMQQueueMetricsCollector;
      configurationProvider: BullMQQueueConfigurationProvider;
      healthChecker: BullMQQueueHealthChecker;
      middleware: BullMQQueueMiddlewareChain;
      producer: BullMQQueueProducer;
      consumer: BullMQConsumer;
      dispatcher: BullMQDispatcher;
      scheduler: BullMQScheduler;
      deadLetterHandler: BullMQDeadLetterHandler;
      leaseManager: BullMQLeaseManager;
      heartbeatManager: BullMQHeartbeatManager;
      checkpointManager: BullMQCheckpointManager;
    }>,
  ) {
    this.serializer = deps.serializer;
    this.deserializer = deps.deserializer;
    this.logger = deps.logger;
    this.metrics = deps.metrics;
    this.configurationProvider = deps.configurationProvider;
    this.configurationProvider.save(configuration);
    this.healthChecker = deps.healthChecker;
    this.producer = deps.producer;
    this.deadLetterHandler = deps.deadLetterHandler;
    this.consumer = deps.consumer;
    this.dispatcher = deps.dispatcher;
    this.middleware = deps.middleware;
    this.scheduler = deps.scheduler;
    this.leaseManager = deps.leaseManager;
    this.heartbeatManager = deps.heartbeatManager;
    this.checkpointManager = deps.checkpointManager;
  }

  async dispatch(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> {
    return this.middleware.handle(envelope, context);
  }

  async health(): Promise<QueueHealthStatus> {
    return this.healthChecker.check(this.configuration);
  }

  async statistics(): Promise<QueueStatistics> {
    return this.metrics.snapshot(this.configuration.queueName, this.configuration.metadata);
  }
}
