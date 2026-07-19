export function isValidStreamEvent(payload) {
    const record = payload && typeof payload === "object" ? payload : {};
    return Boolean(record
        && typeof record.event_id === "string"
        && typeof record.track_id === "string"
        && typeof record.platform === "string"
        && Number.isInteger(record.stream_count_increment)
        && (record.stream_count_increment ?? 0) >= 0
        && typeof record.listener_country === "string"
        && typeof record.timestamp === "string");
}
