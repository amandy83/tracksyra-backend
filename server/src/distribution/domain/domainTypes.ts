export type DomainTimestamp = string;

export type DomainEventBase<Name extends string, Payload extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  type: Name;
  aggregateId: string;
  aggregateType: string;
  occurredAt: DomainTimestamp;
  version: number;
  payload: Readonly<Payload>;
}>;

export type DomainMutationResult<TAggregate, TEvent> = Readonly<{
  aggregate: TAggregate;
  event: TEvent;
}>;

export type AggregateVersion = number;

