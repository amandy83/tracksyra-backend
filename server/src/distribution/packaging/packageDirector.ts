import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageContext } from "./packageContext";
import { PackageValidator } from "./packageValidator";
import { PackageStreamWriter } from "./packageStreamWriter";
import { PackageError } from "./packageError";
import { PackageMetrics } from "./packageMetrics";
import { PackageSerializer } from "./packageSerializer";
import { deepFreeze } from "./packageUtils";
import type { PackageResult } from "./packageResult";
import type { PackageLogger } from "./packageLogger";
import { ConsolePackageLogger } from "./packageLogger";

export class PackageDirector {
  constructor(
    private readonly validator: PackageValidator,
    private readonly writer: PackageStreamWriter,
    private readonly serializer: PackageSerializer,
    private readonly logger: PackageLogger,
    private readonly metrics: PackageMetrics,
  ) {}

  async execute(context: PackageContext): Promise<PackageResult> {
    await mkdir(context.workspacePath, { recursive: true });
    const statePath = join(context.workspacePath, ".package-state.json");
    const existingState = await this.readState(statePath);
    if (existingState) this.metrics.markResumed();

    const validation = this.validator.validate(context);
    if (!validation.valid) {
      throw new PackageError("Package validation failed", "PACKAGE_VALIDATION_FAILED", { validation });
    }

    await writeFile(statePath, `${JSON.stringify({ stage: "validated", packageId: context.packageId, releaseId: context.release.id }, null, 2)}\n`, "utf8");
    this.logger.info("package validation passed", { packageId: context.packageId, releaseId: context.release.id });

    const result = await this.writer.write(context);
    this.metrics.addFile(result.files.reduce((total, file) => total + file.size, 0));
    this.metrics.finish();

    await writeFile(statePath, `${JSON.stringify({
      stage: "completed",
      packageId: result.packageId,
      releaseId: result.releaseId,
      fingerprint: result.fingerprint,
      checksum: result.checksum,
      createdAt: result.createdAt.toISOString(),
    }, null, 2)}\n`, "utf8").catch(() => undefined);

    if (context.configuration.cleanupTemporaryWorkspace) {
      await rm(context.workspacePath, { recursive: true, force: true }).catch(() => undefined);
    }

    return deepFreeze(result);
  }

  snapshot(): Readonly<Record<string, unknown>> {
    return this.metrics.snapshot();
  }

  private async readState(statePath: string): Promise<Readonly<Record<string, unknown>> | null> {
    try {
      const payload = await readFile(statePath, "utf8");
      return JSON.parse(payload) as Readonly<Record<string, unknown>>;
    } catch {
      return null;
    }
  }
}
