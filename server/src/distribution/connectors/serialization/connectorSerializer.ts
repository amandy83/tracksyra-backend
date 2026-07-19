export interface ConnectorSerializer<TInput = unknown, TOutput = string> {
  serialize(value: TInput): TOutput;
  deserialize(payload: TOutput): TInput;
}

