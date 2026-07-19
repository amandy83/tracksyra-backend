import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PackageManifest } from "./packageManifest";
import { PackageSerializer } from "./packageSerializer";

export class PackageReader {
  constructor(private readonly serializer: PackageSerializer) {}

  async readManifest(workspacePath: string): Promise<PackageManifest> {
    const payload = await readFile(join(workspacePath, "release", "manifest.json"), "utf8");
    return this.serializer.deserializeManifest(payload);
  }
}
