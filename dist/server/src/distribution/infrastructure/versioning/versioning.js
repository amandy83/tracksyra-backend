export class VersionHistory {
    versions = [];
    append(version) {
        this.versions.push(version);
    }
    latest() {
        return this.versions.at(-1) ?? null;
    }
    values() {
        return Object.freeze([...this.versions]);
    }
}
export class VersionResolver {
    history;
    constructor(history) {
        this.history = history;
    }
    resolveNext(current) {
        if (!current)
            return "1.0.0";
        const parts = current.split(".").map((part) => Number.parseInt(part, 10));
        while (parts.length < 3)
            parts.push(0);
        parts[2] += 1;
        return parts.join(".");
    }
}
export class VersionManager {
    history;
    resolver;
    constructor(history, resolver) {
        this.history = history;
        this.resolver = resolver;
    }
    next(current) {
        const next = this.resolver.resolveNext(current ?? this.history.latest());
        this.history.append(next);
        return next;
    }
}
