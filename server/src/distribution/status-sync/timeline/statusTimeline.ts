import { StatusTransition } from "../types/statusTypes";

export class StatusTimeline {
  readonly releaseId: string;
  readonly events: readonly StatusTransition[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    events?: readonly StatusTransition[];
    createdAt?: string;
    updatedAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.events = Object.freeze([...(input.events ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("StatusTimeline.releaseId must not be empty");
    }
    Object.freeze(this);
  }

  append(event: StatusTransition): StatusTimeline {
    return new StatusTimeline({
      releaseId: this.releaseId,
      events: [...this.events, event],
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      metadata: this.metadata,
    });
  }
}

export interface TimelineUpdater {
  update(timeline: StatusTimeline): Promise<void> | void;
}

