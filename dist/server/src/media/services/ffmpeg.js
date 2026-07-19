import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, dirname, extname, join } from "node:path";
import { loadRuntimeEnv } from "../../config/envLoader.js";
import { logger } from "../../observability/logger.js";
export class FfmpegRunner {
    ffmpegPath;
    ffprobePath;
    constructor(ffmpegPath = resolveBinaryPath("FFMPEG_PATH", "ffmpeg"), ffprobePath = resolveBinaryPath("FFPROBE_PATH", "ffprobe")) {
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }
    runFfmpeg(args, timeoutMs = 10 * 60 * 1000) {
        return run(this.ffmpegPath, ["-hide_banner", "-y", ...args], timeoutMs);
    }
    async probe(inputPath, timeoutMs = 60_000) {
        const result = await run(this.ffprobePath, [
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            inputPath,
        ], timeoutMs);
        return JSON.parse(result.stdout || "{}");
    }
    async analyzeLoudness(inputPath) {
        const result = await this.runFfmpeg(["-i", inputPath, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], 5 * 60 * 1000);
        const json = extractLastJson(result.stderr);
        return {
            lufs: readNumber(json?.input_i),
            peakDb: readNumber(json?.input_tp),
        };
    }
    async ensureParent(path) {
        await mkdir(dirname(path), { recursive: true });
    }
    async read(path) {
        return readFile(path);
    }
    async write(path, data) {
        await this.ensureParent(path);
        await writeFile(path, data);
    }
    async remove(path) {
        await rm(path, { force: true, recursive: true });
    }
    describe() {
        return { ffmpegPath: this.ffmpegPath, ffprobePath: this.ffprobePath };
    }
}
export function resolveFfmpegRuntime() {
    return {
        ffmpegPath: resolveBinaryPath("FFMPEG_PATH", "ffmpeg"),
        ffprobePath: resolveBinaryPath("FFPROBE_PATH", "ffprobe"),
    };
}
export function logFfmpegRuntime(context) {
    const runtime = resolveFfmpegRuntime();
    logger.info("FFmpeg runtime resolved", {
        component: context,
        ffmpegPath: runtime.ffmpegPath,
        ffprobePath: runtime.ffprobePath,
    });
    return runtime;
}
function run(command, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true });
        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code === 0)
                resolve({ stdout, stderr });
            else
                reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`));
        });
    });
}
function extractLastJson(text) {
    const start = text.lastIndexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start)
        return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
function readNumber(value) {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
}
export function resolveBinaryPath(envName, fallback) {
    const configured = readEnv(envName)?.trim();
    const candidate = configured || fallback;
    if (!candidate)
        return fallback;
    if (isAbsolutePath(candidate))
        return candidate;
    const pathValue = readPathEnv();
    const resolved = findOnPath(candidate, pathValue);
    return resolved || candidate;
}
function isAbsolutePath(value) {
    return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\") || value.startsWith("/");
}
function readPathEnv() {
    return readEnv("PATH") || readEnv("Path") || readEnv("path") || "";
}
function findOnPath(command, pathValue) {
    const segments = pathValue.split(delimiter).map((entry) => entry.trim()).filter(Boolean);
    const candidates = buildCandidateNames(command);
    for (const segment of segments) {
        for (const name of candidates) {
            const resolved = join(segment, name);
            if (existsFile(resolved))
                return resolved;
        }
    }
    return null;
}
function buildCandidateNames(command) {
    if (process.platform !== "win32")
        return [command];
    const ext = extname(command);
    if (ext)
        return [command];
    const pathext = (readEnv("PATHEXT") || ".COM;.EXE;.BAT;.CMD")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean);
    return [command, ...pathext.map((suffix) => `${command}${suffix.toLowerCase()}`)];
}
function existsFile(path) {
    try {
        accessSync(path);
        return true;
    }
    catch {
        return false;
    }
}
function readEnv(name) {
    loadRuntimeEnv();
    return process.env[name];
}
