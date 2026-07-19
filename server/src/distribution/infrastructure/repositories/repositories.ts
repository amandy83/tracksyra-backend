import type {
  AggregateRepository,
  ReleaseAggregate,
  ReleaseId,
  RoyaltyBatchAggregate,
  ProviderSubmissionAggregate,
  DistributionJobAggregate,
} from "../../domain";
import { AggregateSerializer } from "../serialization/aggregateSerializer";
import { FileDocumentStore, type DocumentStore } from "../shared/documentStore";

abstract class JsonAggregateRepository<TAggregate, TKey> implements AggregateRepository<TAggregate, TKey> {
  constructor(
    protected readonly store: DocumentStore,
    protected readonly serializer: {
      serialize(aggregate: TAggregate): unknown;
      deserialize(document: unknown): TAggregate;
    },
    private readonly keyOf: (id: TKey) => string,
  ) {}

  async findById(id: TKey): Promise<TAggregate | null> {
    const document = await this.store.read<unknown>(this.keyOf(id));
    return document ? this.serializer.deserialize(document) : null;
  }

  async save(aggregate: TAggregate): Promise<void> {
    await this.store.write(this.keyOf(this.extractId(aggregate)), this.serializer.serialize(aggregate));
  }

  protected abstract extractId(aggregate: TAggregate): TKey;
}

export class ReleaseRepository extends JsonAggregateRepository<ReleaseAggregate, ReleaseId> {
  constructor(store: DocumentStore, serializer: AggregateSerializer) {
    super(store, {
      serialize: (aggregate) => serializer.serializeReleaseAggregate(aggregate),
      deserialize: (document) => serializer.deserializeReleaseAggregate(document as Parameters<AggregateSerializer["deserializeReleaseAggregate"]>[0]),
    }, (id) => `releases/${id.value}.json`);
  }

  protected extractId(aggregate: ReleaseAggregate): ReleaseId {
    return aggregate.release.id;
  }
}

export class DistributionJobRepository extends JsonAggregateRepository<DistributionJobAggregate, string> {
  constructor(store: DocumentStore, serializer: AggregateSerializer) {
    super(store, {
      serialize: (aggregate) => serializer.serializeDistributionJobAggregate(aggregate),
      deserialize: (document) => serializer.deserializeDistributionJobAggregate(document as Parameters<AggregateSerializer["deserializeDistributionJobAggregate"]>[0]),
    }, (id) => `distribution-jobs/${id}.json`);
  }

  protected extractId(aggregate: DistributionJobAggregate): string {
    return aggregate.id.value;
  }
}

export class ProviderSubmissionRepository extends JsonAggregateRepository<ProviderSubmissionAggregate, string> {
  constructor(store: DocumentStore, serializer: AggregateSerializer) {
    super(store, {
      serialize: (aggregate) => serializer.serializeProviderSubmissionAggregate(aggregate),
      deserialize: (document) => serializer.deserializeProviderSubmissionAggregate(document as Parameters<AggregateSerializer["deserializeProviderSubmissionAggregate"]>[0]),
    }, (id) => `provider-submissions/${id}.json`);
  }

  protected extractId(aggregate: ProviderSubmissionAggregate): string {
    return aggregate.releaseId.value;
  }
}

export class RoyaltyRepository extends JsonAggregateRepository<RoyaltyBatchAggregate, string> {
  constructor(store: DocumentStore, serializer: AggregateSerializer) {
    super(store, {
      serialize: (aggregate) => serializer.serializeRoyaltyBatchAggregate(aggregate),
      deserialize: (document) => serializer.deserializeRoyaltyBatchAggregate(document as Parameters<AggregateSerializer["deserializeRoyaltyBatchAggregate"]>[0]),
    }, (id) => `royalties/${id}.json`);
  }

  protected extractId(aggregate: RoyaltyBatchAggregate): string {
    return aggregate.id.value;
  }
}

export interface SnapshotRepository<TSnapshot, TId> {
  findById(id: TId): Promise<TSnapshot | null>;
  save(snapshot: TSnapshot): Promise<void>;
}

export class GenericSnapshotRepository<TSnapshot, TId> implements SnapshotRepository<TSnapshot, TId> {
  constructor(private readonly store: DocumentStore, private readonly keyOf: (id: TId) => string) {}

  async findById(id: TId): Promise<TSnapshot | null> {
    return await this.store.read<TSnapshot>(this.keyOf(id));
  }

  async save(snapshot: TSnapshot & { id?: TId }): Promise<void> {
    const key = snapshot.id;
    if (key == null) throw new Error("Snapshot must include an id");
    await this.store.write(this.keyOf(key), snapshot);
  }
}

export interface VersionRepository<TVersion, TId> {
  findLatest(id: TId): Promise<TVersion | null>;
  save(version: TVersion & { id?: TId }): Promise<void>;
}

export class GenericVersionRepository<TVersion, TId> implements VersionRepository<TVersion, TId> {
  constructor(private readonly store: DocumentStore, private readonly keyOf: (id: TId) => string) {}

  async findLatest(id: TId): Promise<TVersion | null> {
    return await this.store.read<TVersion>(this.keyOf(id));
  }

  async save(version: TVersion & { id?: TId }): Promise<void> {
    const key = version.id;
    if (key == null) throw new Error("Version must include an id");
    await this.store.write(this.keyOf(key), version);
  }
}

export function createInfrastructureDocumentStore(
  basePath: string,
  factory: (resolvedBasePath: string) => DocumentStore,
): DocumentStore {
  return factory(basePath);
}
