export class DefaultStorageTransaction {
    repository;
    metadata;
    active = true;
    constructor(repository, metadata = {}) {
        this.repository = repository;
        this.metadata = metadata;
        Object.freeze(this.metadata);
    }
    commit() {
        this.active = false;
    }
    rollback() {
        this.active = false;
    }
}
