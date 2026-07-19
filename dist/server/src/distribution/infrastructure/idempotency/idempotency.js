import { createHash } from "node:crypto";
export class IdempotencyKey {
    value;
    constructor(value) {
        this.value = value.trim();
        if (!this.value)
            throw new Error("IdempotencyKey must not be empty");
    }
}
export class RequestFingerprint {
    value;
    constructor(value) {
        this.value = value.trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(this.value))
            throw new Error("RequestFingerprint must be a SHA-256 hex digest");
    }
    static fromPayload(payload) {
        return new RequestFingerprint(createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
    }
}
export class MemoryIdempotencyService {
    records = new Map();
    has(key) {
        return this.records.has(key.value);
    }
    store(key, fingerprint) {
        this.records.set(key.value, fingerprint);
    }
    resolve(key) {
        return this.records.get(key.value) ?? null;
    }
}
export class DuplicateSubmissionDetector {
    idempotencyService;
    constructor(idempotencyService) {
        this.idempotencyService = idempotencyService;
    }
    async isDuplicate(key, payload) {
        const fingerprint = RequestFingerprint.fromPayload(payload);
        const existing = await Promise.resolve(this.idempotencyService.resolve(key));
        return existing?.value === fingerprint.value;
    }
}
export class FileIdempotencyService {
    documentStore;
    constructor(documentStore) {
        this.documentStore = documentStore;
    }
    async has(key) {
        return await this.documentStore.exists(this.keyFor(key));
    }
    async store(key, fingerprint) {
        await this.documentStore.write(this.keyFor(key), { fingerprint: fingerprint.value });
    }
    async resolve(key) {
        const document = await this.documentStore.read(this.keyFor(key));
        return document ? new RequestFingerprint(document.fingerprint) : null;
    }
    keyFor(key) {
        return `idempotency/${key.value}.json`;
    }
}
