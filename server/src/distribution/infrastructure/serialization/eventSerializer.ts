import type { DistributionDomainEvent } from "../../domain";

export class EventSerializer {
  serialize(event: DistributionDomainEvent): string {
    return `${JSON.stringify(event)}\n`;
  }

  deserialize(payload: string): DistributionDomainEvent {
    return JSON.parse(payload) as DistributionDomainEvent;
  }
}
