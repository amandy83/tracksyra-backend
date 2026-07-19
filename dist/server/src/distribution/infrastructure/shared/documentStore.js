import { mkdir, readFile, writeFile, rename, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";
export class FileDocumentStore {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    async read(key) {
        const path = this.pathFor(key);
        try {
            const payload = await readFile(path, "utf8");
            return JSON.parse(payload);
        }
        catch {
            return null;
        }
    }
    async write(key, value) {
        const path = this.pathFor(key);
        await mkdir(dirname(path), { recursive: true });
        const tempPath = `${path}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        await rename(tempPath, path);
    }
    async delete(key) {
        await rm(this.pathFor(key), { force: true });
    }
    async exists(key) {
        try {
            await access(this.pathFor(key));
            return true;
        }
        catch {
            return false;
        }
    }
    pathFor(key) {
        const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
        return join(this.basePath, normalized);
    }
}
