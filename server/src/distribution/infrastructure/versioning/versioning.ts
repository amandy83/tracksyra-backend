export class VersionHistory<TVersion> {
  private readonly versions: TVersion[] = [];

  append(version: TVersion): void {
    this.versions.push(version);
  }

  latest(): TVersion | null {
    return this.versions.at(-1) ?? null;
  }

  values(): readonly TVersion[] {
    return Object.freeze([...this.versions]);
  }
}

export class VersionResolver {
  constructor(private readonly history: VersionHistory<string>) {}

  resolveNext(current?: string | null): string {
    if (!current) return "1.0.0";
    const parts = current.split(".").map((part) => Number.parseInt(part, 10));
    while (parts.length < 3) parts.push(0);
    parts[2] += 1;
    return parts.join(".");
  }
}

export class VersionManager {
  constructor(private readonly history: VersionHistory<string>, private readonly resolver: VersionResolver) {}

  next(current?: string | null): string {
    const next = this.resolver.resolveNext(current ?? this.history.latest());
    this.history.append(next);
    return next;
  }
}

