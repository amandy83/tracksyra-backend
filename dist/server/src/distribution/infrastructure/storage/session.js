export class DefaultStorageSession {
    sessionId;
    adapter;
    mode;
    lockMode;
    ownership;
    createdAt;
    metadata;
    constructor(sessionId, adapter, mode, lockMode, ownership = "owned", createdAt = new Date().toISOString(), metadata = {}) {
        this.sessionId = sessionId;
        this.adapter = adapter;
        this.mode = mode;
        this.lockMode = lockMode;
        this.ownership = ownership;
        this.createdAt = createdAt;
        this.metadata = metadata;
        Object.freeze(this.metadata);
        Object.freeze(this);
    }
}
