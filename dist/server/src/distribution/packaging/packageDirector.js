import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PackageError } from "./packageError.js";
import { deepFreeze } from "./packageUtils.js";
export class PackageDirector {
    validator;
    writer;
    serializer;
    logger;
    metrics;
    constructor(validator, writer, serializer, logger, metrics) {
        this.validator = validator;
        this.writer = writer;
        this.serializer = serializer;
        this.logger = logger;
        this.metrics = metrics;
    }
    async execute(context) {
        await mkdir(context.workspacePath, { recursive: true });
        const statePath = join(context.workspacePath, ".package-state.json");
        const existingState = await this.readState(statePath);
        if (existingState)
            this.metrics.markResumed();
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
    snapshot() {
        return this.metrics.snapshot();
    }
    async readState(statePath) {
        try {
            const payload = await readFile(statePath, "utf8");
            return JSON.parse(payload);
        }
        catch {
            return null;
        }
    }
}
