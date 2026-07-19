import { readFile } from "node:fs/promises";
import { join } from "node:path";
export class PackageReader {
    serializer;
    constructor(serializer) {
        this.serializer = serializer;
    }
    async readManifest(workspacePath) {
        const payload = await readFile(join(workspacePath, "release", "manifest.json"), "utf8");
        return this.serializer.deserializeManifest(payload);
    }
}
