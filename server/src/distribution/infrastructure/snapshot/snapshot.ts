import type { DocumentStore } from "../shared/documentStore";

export class SnapshotSerializer {
  serialize<T>(snapshot: T): string {
    return `${JSON.stringify(snapshot)}\n`;
  }

  deserialize<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }
}

export class SnapshotStore {
  constructor(private readonly store: DocumentStore, private readonly serializer: SnapshotSerializer) {}

  async save<T>(key: string, snapshot: T): Promise<void> {
    const serialized = this.serializer.serialize(snapshot);
    await this.store.write(key, this.serializer.deserialize<T>(serialized));
  }

  async load<T>(key: string): Promise<T | null> {
    return await this.store.read<T>(key);
  }
}

export class SnapshotLoader {
  constructor(private readonly store: SnapshotStore) {}

  async load<T>(key: string): Promise<T | null> {
    return await this.store.load<T>(key);
  }
}

export class SnapshotComparer {
  compare<T>(before: T, after: T): boolean {
    return JSON.stringify(before) === JSON.stringify(after);
  }
}
