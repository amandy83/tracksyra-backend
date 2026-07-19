import type { DomainEventBase } from "./domainTypes";

export interface EventPublisher<TEvent extends DomainEventBase<string> = DomainEventBase<string>> {
  publish(event: TEvent): Promise<void> | void;
}

export interface AggregateRepository<TAggregate, TId> {
  findById(id: TId): Promise<TAggregate | null> | TAggregate | null;
  save(aggregate: TAggregate): Promise<void> | void;
}

export interface SnapshotRepository<TSnapshot, TId> {
  findById(id: TId): Promise<TSnapshot | null> | TSnapshot | null;
  save(snapshot: TSnapshot): Promise<void> | void;
}

export interface VersionRepository<TVersion, TId> {
  findLatest(id: TId): Promise<TVersion | null> | TVersion | null;
  save(version: TVersion): Promise<void> | void;
}

