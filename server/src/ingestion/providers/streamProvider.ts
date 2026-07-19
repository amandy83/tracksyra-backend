import type { StreamEvent, StreamProviderFetchInput, StreamProviderName } from "../streams/models/streamTypes";

export type StreamProviderAdapter = {
  readonly provider: StreamProviderName;
  fetchDailyStreams(input: StreamProviderFetchInput): Promise<StreamEvent[]>;
  fetchRealtimeStreams(input: StreamProviderFetchInput): Promise<StreamEvent[]>;
  validatePayload(payload: unknown): payload is StreamEvent;
};

export function isValidStreamEvent(payload: unknown): payload is StreamEvent {
  const record = payload && typeof payload === "object" ? payload as Partial<StreamEvent> : {};
  return Boolean(
    record
      && typeof record.event_id === "string"
      && typeof record.track_id === "string"
      && typeof record.platform === "string"
      && Number.isInteger(record.stream_count_increment)
      && (record.stream_count_increment ?? 0) >= 0
      && typeof record.listener_country === "string"
      && typeof record.timestamp === "string",
  );
}
