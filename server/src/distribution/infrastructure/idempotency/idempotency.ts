import { createHash } from "node:crypto";
import type { DocumentStore } from "../shared/documentStore";

export class IdempotencyKey {
  readonly value: string;
  constructor(value: string) {
    this.value = value.trim();
    if (!this.value) throw new Error("IdempotencyKey must not be empty");
  }
}

export class RequestFingerprint {
  readonly value: string;
  constructor(value: string) {
    this.value = value.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(this.value)) throw new Error("RequestFingerprint must be a SHA-256 hex digest");
  }

  static fromPayload(payload: unknown): RequestFingerprint {
    return new RequestFingerprint(createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
  }
}

export interface IdempotencyService {
  has(key: IdempotencyKey): Promise<boolean> | boolean;
  store(key: IdempotencyKey, fingerprint: RequestFingerprint): Promise<void> | void;
  resolve(key: IdempotencyKey): Promise<RequestFingerprint | null> | RequestFingerprint | null;
}

export class MemoryIdempotencyService implements IdempotencyService {
  private readonly records = new Map<string, RequestFingerprint>();

  has(key: IdempotencyKey): boolean {
    return this.records.has(key.value);
  }

  store(key: IdempotencyKey, fingerprint: RequestFingerprint): void {
    this.records.set(key.value, fingerprint);
  }

  resolve(key: IdempotencyKey): RequestFingerprint | null {
    return this.records.get(key.value) ?? null;
  }
}

export class DuplicateSubmissionDetector {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async isDuplicate(key: IdempotencyKey, payload: unknown): Promise<boolean> {
    const fingerprint = RequestFingerprint.fromPayload(payload);
    const existing = await Promise.resolve(this.idempotencyService.resolve(key));
    return existing?.value === fingerprint.value;
  }
}

export class FileIdempotencyService implements IdempotencyService {
  constructor(private readonly documentStore: DocumentStore) {}

  async has(key: IdempotencyKey): Promise<boolean> {
    return await this.documentStore.exists(this.keyFor(key));
  }

  async store(key: IdempotencyKey, fingerprint: RequestFingerprint): Promise<void> {
    await this.documentStore.write(this.keyFor(key), { fingerprint: fingerprint.value });
  }

  async resolve(key: IdempotencyKey): Promise<RequestFingerprint | null> {
    const document = await this.documentStore.read<{ fingerprint: string }>(this.keyFor(key));
    return document ? new RequestFingerprint(document.fingerprint) : null;
  }

  private keyFor(key: IdempotencyKey): string {
    return `idempotency/${key.value}.json`;
  }
}
