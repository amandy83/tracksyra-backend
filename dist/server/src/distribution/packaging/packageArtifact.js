export class PackageArtifactFactory {
    static file(path, kind, sourcePath, mediaType = null, metadata = {}) {
        return Object.freeze({
            path,
            kind,
            source: Object.freeze({ type: "file", path: sourcePath }),
            mediaType,
            size: null,
            checksum: null,
            metadata: Object.freeze({ ...metadata }),
        });
    }
    static text(path, kind, text, mediaType = "application/json", metadata = {}) {
        return Object.freeze({
            path,
            kind,
            source: Object.freeze({ type: "text", text }),
            mediaType,
            size: Buffer.byteLength(text),
            checksum: null,
            metadata: Object.freeze({ ...metadata }),
        });
    }
}
