class JsonAggregateRepository {
    store;
    serializer;
    keyOf;
    constructor(store, serializer, keyOf) {
        this.store = store;
        this.serializer = serializer;
        this.keyOf = keyOf;
    }
    async findById(id) {
        const document = await this.store.read(this.keyOf(id));
        return document ? this.serializer.deserialize(document) : null;
    }
    async save(aggregate) {
        await this.store.write(this.keyOf(this.extractId(aggregate)), this.serializer.serialize(aggregate));
    }
}
export class ReleaseRepository extends JsonAggregateRepository {
    constructor(store, serializer) {
        super(store, {
            serialize: (aggregate) => serializer.serializeReleaseAggregate(aggregate),
            deserialize: (document) => serializer.deserializeReleaseAggregate(document),
        }, (id) => `releases/${id.value}.json`);
    }
    extractId(aggregate) {
        return aggregate.release.id;
    }
}
export class DistributionJobRepository extends JsonAggregateRepository {
    constructor(store, serializer) {
        super(store, {
            serialize: (aggregate) => serializer.serializeDistributionJobAggregate(aggregate),
            deserialize: (document) => serializer.deserializeDistributionJobAggregate(document),
        }, (id) => `distribution-jobs/${id}.json`);
    }
    extractId(aggregate) {
        return aggregate.id.value;
    }
}
export class ProviderSubmissionRepository extends JsonAggregateRepository {
    constructor(store, serializer) {
        super(store, {
            serialize: (aggregate) => serializer.serializeProviderSubmissionAggregate(aggregate),
            deserialize: (document) => serializer.deserializeProviderSubmissionAggregate(document),
        }, (id) => `provider-submissions/${id}.json`);
    }
    extractId(aggregate) {
        return aggregate.releaseId.value;
    }
}
export class RoyaltyRepository extends JsonAggregateRepository {
    constructor(store, serializer) {
        super(store, {
            serialize: (aggregate) => serializer.serializeRoyaltyBatchAggregate(aggregate),
            deserialize: (document) => serializer.deserializeRoyaltyBatchAggregate(document),
        }, (id) => `royalties/${id}.json`);
    }
    extractId(aggregate) {
        return aggregate.id.value;
    }
}
export class GenericSnapshotRepository {
    store;
    keyOf;
    constructor(store, keyOf) {
        this.store = store;
        this.keyOf = keyOf;
    }
    async findById(id) {
        return await this.store.read(this.keyOf(id));
    }
    async save(snapshot) {
        const key = snapshot.id;
        if (key == null)
            throw new Error("Snapshot must include an id");
        await this.store.write(this.keyOf(key), snapshot);
    }
}
export class GenericVersionRepository {
    store;
    keyOf;
    constructor(store, keyOf) {
        this.store = store;
        this.keyOf = keyOf;
    }
    async findLatest(id) {
        return await this.store.read(this.keyOf(id));
    }
    async save(version) {
        const key = version.id;
        if (key == null)
            throw new Error("Version must include an id");
        await this.store.write(this.keyOf(key), version);
    }
}
export function createInfrastructureDocumentStore(basePath, factory) {
    return factory(basePath);
}
