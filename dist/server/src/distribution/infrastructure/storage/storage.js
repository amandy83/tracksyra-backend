import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
class FileStorage {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    async read(path) {
        try {
            return await readFile(this.resolve(path));
        }
        catch {
            return null;
        }
    }
    async write(path, content) {
        const resolved = this.resolve(path);
        await mkdir(dirname(resolved), { recursive: true });
        const tempPath = `${resolved}.tmp`;
        await writeFile(tempPath, content);
        await rename(tempPath, resolved);
    }
    resolve(path) {
        return join(this.basePath, path.replace(/\\/g, "/").replace(/^\/+/, ""));
    }
}
export class FilePackageStorage extends FileStorage {
    async exists(path) {
        try {
            await readFile(this.resolve(path));
            return true;
        }
        catch {
            return false;
        }
    }
    async remove(path) {
        await rm(this.resolve(path), { force: true });
    }
}
export class FileArtifactStorage extends FileStorage {
}
export class FileManifestStorage extends FileStorage {
}
export class FileAuditStorage extends FileStorage {
}
