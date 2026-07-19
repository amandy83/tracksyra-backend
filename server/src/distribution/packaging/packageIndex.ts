import type { PackageArtifact } from "./packageTypes";

export class PackageIndex {
  private readonly byPath = new Map<string, PackageArtifact>();

  constructor(artifacts: readonly PackageArtifact[] = []) {
    for (const artifact of artifacts) this.add(artifact);
  }

  add(artifact: PackageArtifact): this {
    this.byPath.set(artifact.path, artifact);
    return this;
  }

  get(path: string): PackageArtifact | undefined {
    return this.byPath.get(path);
  }

  values(): readonly PackageArtifact[] {
    return Object.freeze([...this.byPath.values()]);
  }

  has(path: string): boolean {
    return this.byPath.has(path);
  }
}

