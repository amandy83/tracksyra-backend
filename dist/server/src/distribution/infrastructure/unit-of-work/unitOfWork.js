import { randomUUID } from "node:crypto";
function nowIso() {
    return new Date().toISOString();
}
export class DefaultRepositoryScope {
    scopeId;
    lifetime;
    metadata;
    constructor(scopeId = randomUUID(), lifetime = "scoped", metadata = {}) {
        this.scopeId = scopeId;
        this.lifetime = lifetime;
        this.metadata = metadata;
    }
}
export class DefaultAggregateSavepoint {
    name;
    createdAt;
    constructor(name, createdAt = nowIso()) {
        this.name = name;
        this.createdAt = createdAt;
    }
}
export class DefaultAggregateTransaction {
    transactionId;
    scope;
    began = false;
    committed = false;
    rolledBack = false;
    savepoints = new Map();
    constructor(transactionId = randomUUID(), scope = new DefaultRepositoryScope()) {
        this.transactionId = transactionId;
        this.scope = scope;
    }
    begin() {
        this.began = true;
    }
    commit() {
        this.committed = true;
        this.rolledBack = false;
    }
    rollback() {
        this.rolledBack = true;
        this.committed = false;
    }
    savepoint(name) {
        const savepoint = new DefaultAggregateSavepoint(name);
        this.savepoints.set(name, savepoint);
        return savepoint;
    }
}
export class DefaultAggregateConflictResolver {
    resolve(_resource, expectedVersion, actualVersion) {
        return expectedVersion === actualVersion;
    }
}
export class DefaultAggregateVersionTracker {
    versions = new Map();
    current(resource) {
        return this.versions.get(resource) ?? 0;
    }
    next(resource) {
        const next = this.current(resource) + 1;
        this.versions.set(resource, next);
        return next;
    }
    record(resource, version) {
        this.versions.set(resource, version);
    }
}
export class DefaultAggregateLockManager {
    locks = new Map();
    acquire(resource, owner) {
        if (this.locks.has(resource))
            return false;
        this.locks.set(resource, owner);
        return true;
    }
    release(resource, owner) {
        if (this.locks.get(resource) !== owner)
            return false;
        this.locks.delete(resource);
        return true;
    }
    owns(resource, owner) {
        return this.locks.get(resource) === owner;
    }
}
export class DefaultRepositoryLifetimeManager {
    lifetimes = new Map();
    register(name, lifetime) {
        this.lifetimes.set(name, lifetime);
    }
    resolve(name) {
        return this.lifetimes.get(name) ?? null;
    }
}
export class DefaultUnitOfWork {
    unitOfWorkId;
    versionTracker;
    conflictResolver;
    lockManager;
    repositoryProvider;
    repositoryResolver;
    lifetimeManager;
    constructor(unitOfWorkId, versionTracker, conflictResolver, lockManager, repositoryProvider, repositoryResolver, lifetimeManager) {
        this.unitOfWorkId = unitOfWorkId;
        this.versionTracker = versionTracker;
        this.conflictResolver = conflictResolver;
        this.lockManager = lockManager;
        this.repositoryProvider = repositoryProvider;
        this.repositoryResolver = repositoryResolver;
        this.lifetimeManager = lifetimeManager;
    }
    begin(scope) {
        void this.repositoryProvider;
        void this.repositoryResolver;
        void this.lifetimeManager;
        const transaction = new DefaultAggregateTransaction(randomUUID(), scope);
        transaction.begin();
        return transaction;
    }
    commit(transaction) {
        transaction.commit();
        return Object.freeze({ committed: true, committedAt: nowIso() });
    }
    rollback(transaction) {
        transaction.rollback();
        return Object.freeze({ rolledBack: true, rolledBackAt: nowIso() });
    }
}
export class DefaultUnitOfWorkFactory {
    unitOfWork;
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    create(scope) {
        void scope;
        return this.unitOfWork;
    }
}
export class DefaultUnitOfWorkManager {
    factory;
    constructor(factory) {
        this.factory = factory;
    }
    get(scope) {
        return this.factory.create(scope ?? null);
    }
}
