import { createCipheriv, randomBytes } from "node:crypto";
import type { Transform } from "node:stream";
import type { PackageEncryptionKind } from "./packageTypes";

export interface PackageEncryption {
  readonly kind: PackageEncryptionKind;
  createEncryptStream(): Transform | null;
  createDecryptStream(): Transform | null;
}

export class NoopPackageEncryption implements PackageEncryption {
  readonly kind: PackageEncryptionKind = "none";

  createEncryptStream(): null {
    return null;
  }

  createDecryptStream(): null {
    return null;
  }
}

export class Aes256GcmPackageEncryption implements PackageEncryption {
  readonly kind: PackageEncryptionKind = "aes-256-gcm";

  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("AES-256-GCM requires a 32-byte key");
  }

  createEncryptStream(): Transform {
    throw new Error("Streaming AES-256-GCM package encryption requires an external IV/signature envelope");
  }

  createDecryptStream(): Transform {
    throw new Error("Streaming AES-256-GCM package decryption requires an external IV/signature envelope");
  }
}

