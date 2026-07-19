import type { PackageContext } from "./packageContext";
import type { PackageResult } from "./packageResult";
import { PackageStreamWriter } from "./packageStreamWriter";

export interface PackageExporter {
  export(context: PackageContext): Promise<PackageResult>;
}

export class FileSystemPackageExporter implements PackageExporter {
  constructor(private readonly writer: PackageStreamWriter) {}

  export(context: PackageContext): Promise<PackageResult> {
    return this.writer.write(context);
  }
}
