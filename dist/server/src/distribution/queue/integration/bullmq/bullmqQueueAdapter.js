export class BullMQQueueAdapter {
    configuration;
    registry;
    name = "BullMQ";
    serializer;
    deserializer;
    logger;
    metrics;
    configurationProvider;
    healthChecker;
    middleware;
    producer;
    consumer;
    dispatcher;
    scheduler;
    deadLetterHandler;
    leaseManager;
    heartbeatManager;
    checkpointManager;
    constructor(configuration, registry, deps) {
        this.configuration = configuration;
        this.registry = registry;
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
    async dispatch(envelope, context) {
        return this.middleware.handle(envelope, context);
    }
    async health() {
        return this.healthChecker.check(this.configuration);
    }
    async statistics() {
        return this.metrics.snapshot(this.configuration.queueName, this.configuration.metadata);
    }
}
