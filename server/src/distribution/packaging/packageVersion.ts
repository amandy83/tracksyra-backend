import type { PackageVersion } from "./packageTypes";

export const CURRENT_PACKAGE_VERSION: PackageVersion = "1.0";

export class PackageVersionInfo {
  constructor(public readonly value: PackageVersion = CURRENT_PACKAGE_VERSION) {}

  toString(): string {
    return this.value;
  }
}

