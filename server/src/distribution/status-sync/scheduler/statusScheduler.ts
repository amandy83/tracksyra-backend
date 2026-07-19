import { PollingResult } from "../polling/pollingResult";
import { StatusSnapshot } from "../snapshot/statusSnapshot";

export interface StatusScheduler {
  nextPollAt(snapshot: StatusSnapshot, lastResult?: PollingResult | null): string | null;
  shouldPoll(snapshot: StatusSnapshot, now?: string): boolean;
}

