import { buildPlatformResult, isMp4Container, isVertical } from "./platformValidator.js";
export function validateYoutubeShorts(metadata) {
    const failures = [];
    if (!isVertical(metadata))
        failures.push({ severity: "fail", penalty: 35, message: "Video is not vertical." });
    if (Number(metadata.durationSeconds || 0) > 60)
        failures.push({ severity: "fail", penalty: 35, message: "Duration exceeds 60 seconds." });
    else if (Number(metadata.durationSeconds || 0) > 54)
        failures.push({ severity: "warning", penalty: 15, message: "Duration is close to the 60 second maximum." });
    if (!isMp4Container(metadata))
        failures.push({ severity: "fail", penalty: 25, message: "Container is not MP4." });
    return buildPlatformResult("youtube_shorts", metadata, failures);
}
