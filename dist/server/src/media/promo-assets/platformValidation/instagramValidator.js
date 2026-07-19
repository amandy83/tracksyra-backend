import { buildPlatformResult, isMp4Container, isVertical } from "./platformValidator.js";
export function validateInstagramReels(metadata) {
    const failures = [];
    if (!isVertical(metadata))
        failures.push({ severity: "fail", penalty: 35, message: "Video is not vertical." });
    if (Number(metadata.durationSeconds || 0) > 90)
        failures.push({ severity: "fail", penalty: 35, message: "Duration exceeds 90 seconds." });
    else if (Number(metadata.durationSeconds || 0) > 81)
        failures.push({ severity: "warning", penalty: 15, message: "Duration is close to the 90 second maximum." });
    if (!isMp4Container(metadata))
        failures.push({ severity: "fail", penalty: 25, message: "Container is not MP4." });
    return buildPlatformResult("instagram_reels", metadata, failures);
}
