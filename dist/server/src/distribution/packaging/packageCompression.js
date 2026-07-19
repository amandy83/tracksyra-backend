import { createDeflateRaw } from "node:zlib";
export class StorePackageCompression {
    kind = "store";
    createStream() {
        return null;
    }
}
export class DeflatePackageCompression {
    kind = "deflate";
    createStream() {
        return createDeflateRaw({ level: 6 });
    }
}
export function resolveCompression(kind, compressions) {
    return kind === "deflate" ? compressions.deflate : compressions.store;
}
