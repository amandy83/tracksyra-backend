import { createSign, type KeyLike } from "node:crypto";
import type { PackageManifestDocument } from "./packageTypes";
import { stableStringify } from "./packageUtils";

export type PackageSignature = Readonly<{
  algorithm: string;
  value: string;
  keyId: string | null;
}>;

export interface PackageSigning {
  sign(manifest: PackageManifestDocument): PackageSignature;
}

export class NodePackageSigning implements PackageSigning {
  constructor(
    private readonly privateKey: KeyLike | string,
    private readonly algorithm = "RSA-SHA256",
    private readonly keyId: string | null = null,
  ) {}

  sign(manifest: PackageManifestDocument): PackageSignature {
    const signer = createSign(this.algorithm);
    signer.update(stableStringify(manifest));
    signer.end();
    return {
      algorithm: this.algorithm,
      value: signer.sign(this.privateKey, "base64"),
      keyId: this.keyId,
    };
  }
}

