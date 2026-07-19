import type { StorageMetadata } from "../storage/storageTypes";

export interface RepositoryScope {
  readonly scopeId: string;
  readonly lifetime: "singleton" | "scoped" | "transient" | "transactional";
  readonly metadata: StorageMetadata;
}

export interface RepositoryProvider {
  get<TRepository>(name: string): TRepository | null;
}

export interface RepositoryResolver {
  resolve<TRepository>(name: string): TRepository | null;
}

export interface AggregateTransaction {
  readonly transactionId: string;
  readonly scope: RepositoryScope;
  begin(): void;
  commit(): void;
  rollback(): void;
  savepoint(name: string): AggregateSavepoint;
}

export interface AggregateCommit {
  readonly committed: boolean;
  readonly committedAt: string | null;
}

export interface AggregateRollback {
  readonly rolledBack: boolean;
  readonly rolledBackAt: string | null;
}

export interface AggregateSavepoint {
  readonly name: string;
  readonly createdAt: string;
}

export interface AggregateConflictResolver {
  resolve(resource: string, expectedVersion: number, actualVersion: number): boolean;
}

export interface AggregateVersionTracker {
  current(resource: string): number;
  next(resource: string): number;
  record(resource: string, version: number): void;
}

export interface AggregateLockManager {
  acquire(resource: string, owner: string): boolean;
  release(resource: string, owner: string): boolean;
  owns(resource: string, owner: string): boolean;
}

export interface RepositoryLifetimeManager {
  register(name: string, lifetime: RepositoryScope["lifetime"]): void;
  resolve(name: string): RepositoryScope["lifetime"] | null;
}

export interface UnitOfWork {
  readonly unitOfWorkId: string;
  begin(scope: RepositoryScope): AggregateTransaction;
  commit(transaction: AggregateTransaction): AggregateCommit;
  rollback(transaction: AggregateTransaction): AggregateRollback;
}

export interface UnitOfWorkFactory {
  create(scope?: RepositoryScope | null): UnitOfWork;
}

export interface UnitOfWorkManager {
  get(scope?: RepositoryScope | null): UnitOfWork;
}
