import { joinArchivePath } from "./packageUtils";
import type { PackageLayoutPaths } from "./packageTypes";

export class PackageLayout {
  constructor(public readonly root = "release") {}

  paths(): PackageLayoutPaths {
    const root = this.root;
    return Object.freeze({
      root,
      manifest: joinArchivePath(root, "manifest.json"),
      metadata: joinArchivePath(root, "metadata"),
      release: joinArchivePath(root, "metadata", "release.json"),
      tracks: joinArchivePath(root, "metadata", "tracks.json"),
      contributors: joinArchivePath(root, "metadata", "contributors.json"),
      publishing: joinArchivePath(root, "metadata", "publishing.json"),
      rights: joinArchivePath(root, "metadata", "rights.json"),
      territories: joinArchivePath(root, "metadata", "territories.json"),
      pricing: joinArchivePath(root, "metadata", "pricing.json"),
      artwork: joinArchivePath(root, "artwork"),
      booklet: joinArchivePath(root, "booklet"),
      audio: joinArchivePath(root, "audio"),
      lyrics: joinArchivePath(root, "lyrics"),
      checksums: joinArchivePath(root, "checksums"),
      fingerprint: joinArchivePath(root, "checksums", "fingerprint.json"),
      audit: joinArchivePath(root, "audit"),
      package: joinArchivePath(root, "audit", "package.json"),
    });
  }
}

