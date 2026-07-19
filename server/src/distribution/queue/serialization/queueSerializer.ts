export interface QueueSerializer<TInput = unknown, TOutput = string> {
  serialize(value: TInput): TOutput;
  deserialize(payload: TOutput): TInput;
}

