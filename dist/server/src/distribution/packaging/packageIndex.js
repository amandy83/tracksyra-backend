export class PackageIndex {
    byPath = new Map();
    constructor(artifacts = []) {
        for (const artifact of artifacts)
            this.add(artifact);
    }
    add(artifact) {
        this.byPath.set(artifact.path, artifact);
        return this;
    }
    get(path) {
        return this.byPath.get(path);
    }
    values() {
        return Object.freeze([...this.byPath.values()]);
    }
    has(path) {
        return this.byPath.has(path);
    }
}
