import { randomUUID } from "node:crypto";
import type { AggregateCommit, AggregateConflictResolver, AggregateLockManager, AggregateRollback, AggregateSavepoint, AggregateTransaction, AggregateVersionTracker, RepositoryLifetimeManager, RepositoryProvider, RepositoryResolver, RepositoryScope, UnitOfWork, UnitOfWorkFactory, UnitOfWorkManager } from "./unitOfWorkTypes";

function nowIso(): string {
  return new Date().toISOString();
}

export class DefaultRepositoryScope implements RepositoryScope {
  constructor(
    readonly scopeId: string = randomUUID(),
    readonly lifetime: RepositoryScope["lifetime"] = "scoped",
    readonly metadata: Readonly<Record<string, unknown>> = {},
  ) {}
}

export class DefaultAggregateSavepoint implements AggregateSavepoint {
  constructor(
    readonly name: string,
    readonly createdAt: string = nowIso(),
  ) {}
}

export class DefaultAggregateTransaction implements AggregateTransaction {
  private began = false;
  private committed = false;
  private rolledBack = false;
  private readonly savepoints = new Map<string, AggregateSavepoint>();

  constructor(
    readonly transactionId: string = randomUUID(),
    readonly scope: RepositoryScope = new DefaultRepositoryScope(),
  ) {}

  begin(): void {
    this.began = true;
  }

  commit(): void {
    this.committed = true;
    this.rolledBack = false;
  }

  rollback(): void {
    this.rolledBack = true;
    this.committed = false;
  }

  savepoint(name: string): AggregateSavepoint {
    const savepoint = new DefaultAggregateSavepoint(name);
    this.savepoints.set(name, savepoint);
    return savepoint;
  }
}

export class DefaultAggregateConflictResolver implements AggregateConflictResolver {
  resolve(_resource: string, expectedVersion: number, actualVersion: number): boolean {
    return expectedVersion === actualVersion;
  }
}

export class DefaultAggregateVersionTracker implements AggregateVersionTracker {
  private readonly versions = new Map<string, number>();

  current(resource: string): number {
    return this.versions.get(resource) ?? 0;
  }

  next(resource: string): number {
    const next = this.current(resource) + 1;
    this.versions.set(resource, next);
    return next;
  }

  record(resource: string, version: number): void {
    this.versions.set(resource, version);
  }
}

export class DefaultAggregateLockManager implements AggregateLockManager {
  private readonly locks = new Map<string, string>();

  acquire(resource: string, owner: string): boolean {
    if (this.locks.has(resource)) return false;
    this.locks.set(resource, owner);
    return true;
  }

  release(resource: string, owner: string): boolean {
    if (this.locks.get(resource) !== owner) return false;
    this.locks.delete(resource);
    return true;
  }

  owns(resource: string, owner: string): boolean {
    return this.locks.get(resource) === owner;
  }
}

export class DefaultRepositoryLifetimeManager implements RepositoryLifetimeManager {
  private readonly lifetimes = new Map<string, RepositoryScope["lifetime"]>();

  register(name: string, lifetime: RepositoryScope["lifetime"]): void {
    this.lifetimes.set(name, lifetime);
  }

  resolve(name: string): RepositoryScope["lifetime"] | null {
    return this.lifetimes.get(name) ?? null;
  }
}

export class DefaultUnitOfWork implements UnitOfWork {
  constructor(
    readonly unitOfWorkId: string,
    private readonly versionTracker: AggregateVersionTracker,
    private readonly conflictResolver: AggregateConflictResolver,
    private readonly lockManager: AggregateLockManager,
    private readonly repositoryProvider: RepositoryProvider | null,
    private readonly repositoryResolver: RepositoryResolver | null,
    private readonly lifetimeManager: RepositoryLifetimeManager | null,
  ) {}

  begin(scope: RepositoryScope): AggregateTransaction {
    void this.repositoryProvider;
    void this.repositoryResolver;
    void this.lifetimeManager;
    const transaction = new DefaultAggregateTransaction(randomUUID(), scope);
    transaction.begin();
    return transaction;
  }

  commit(transaction: AggregateTransaction): AggregateCommit {
    transaction.commit();
    return Object.freeze({ committed: true, committedAt: nowIso() });
  }

  rollback(transaction: AggregateTransaction): AggregateRollback {
    transaction.rollback();
    return Object.freeze({ rolledBack: true, rolledBackAt: nowIso() });
  }
}

export class DefaultUnitOfWorkFactory implements UnitOfWorkFactory {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  create(scope?: RepositoryScope | null): UnitOfWork {
    void scope;
    return this.unitOfWork;
  }
}

export class DefaultUnitOfWorkManager implements UnitOfWorkManager {
  constructor(private readonly factory: UnitOfWorkFactory) {}

  get(scope?: RepositoryScope | null): UnitOfWork {
    return this.factory.create(scope ?? null);
  }
}
