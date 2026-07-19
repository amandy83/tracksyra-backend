export interface RateLimitProvider {
  getLimit(connectorId: string): Promise<number> | number;
  getRemaining(connectorId: string): Promise<number> | number;
  consume(connectorId: string, amount?: number): Promise<void> | void;
}

