import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { PackageError } from "./packageError.js";
import { PackageArtifactFactory } from "./packageArtifact.js";
import { crc32Update } from "./packageUtils.js";
export class PackageChecksum {
    async file(path) {
        const hash = createHash("sha256");
        const stream = createReadStream(path);
        try {
            for await (const chunk of stream) {
                hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
        }
        catch (error) {
            throw new PackageError(`Failed to hash file: ${path}`, "PACKAGE_CHECKSUM_FAILED", { path, error });
        }
        return hash.digest("hex");
    }
    streamHash() {
        return { hash: createHash("sha256"), crc32: 0 };
    }
    update(state, chunk) {
        state.hash.update(chunk);
        state.crc32 = crc32Update(state.crc32, chunk);
        return state;
    }
    finalize(state) {
        return {
            sha256: state.hash.digest("hex"),
            crc32: state.crc32.toString(16).padStart(8, "0"),
        };
    }
    fromArtifacts(artifacts) {
        return Object.freeze([...artifacts.map((artifact) => (artifact.checksum ? artifact : PackageArtifactFactory.text(artifact.path, artifact.kind, "", artifact.mediaType, artifact.metadata)))]);
    }
}
