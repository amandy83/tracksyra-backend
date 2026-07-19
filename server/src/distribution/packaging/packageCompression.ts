import { createDeflateRaw } from "node:zlib";
import type { Readable, Transform } from "node:stream";
import type { PackageCompressionKind } from "./packageTypes";

export interface PackageCompression {
  readonly kind: PackageCompressionKind;
  createStream(): Transform | null;
}

export class StorePackageCompression implements PackageCompression {
  readonly kind: PackageCompressionKind = "store";

  createStream(): null {
    return null;
  }
}

export class DeflatePackageCompression implements PackageCompression {
  readonly kind: PackageCompressionKind = "deflate";

  createStream(): Transform {
    return createDeflateRaw({ level: 6 });
  }
}

export function resolveCompression(
  kind: PackageCompressionKind,
  compressions: Readonly<{ deflate: PackageCompression; store: PackageCompression }>,
): PackageCompression {
  return kind === "deflate" ? compressions.deflate : compressions.store;
}
