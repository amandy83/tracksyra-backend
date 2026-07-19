import type { QueueJob } from "../jobs/queueJob";
import type { QueueMessage } from "../messages/queueMessage";
import type { QueueSerializer } from "../serialization/queueSerializer";
import type { QueueJobType } from "../types/queueTypes";

export interface JobRegistry {
  register(jobType: QueueJobType, definition: QueueJobDefinition): void;
  resolve(jobType: QueueJobType): QueueJobDefinition | null;
  list(): readonly QueueJobDefinition[];
}

export interface MessageRegistry {
  register(messageType: string, definition: QueueMessageDefinition): void;
  resolve(messageType: string): QueueMessageDefinition | null;
  list(): readonly QueueMessageDefinition[];
}

export interface HandlerRegistry {
  register(jobType: QueueJobType, handler: QueueJobHandler): void;
  resolve(jobType: QueueJobType): QueueJobHandler | null;
  list(): readonly QueueJobHandlerRegistration[];
}

export interface SerializerRegistry {
  register(messageType: string, serializer: QueueSerializer): void;
  resolve(messageType: string): QueueSerializer | null;
  list(): readonly QueueSerializerRegistration[];
}

export interface QueueRegistry {
  jobs: JobRegistry;
  messages: MessageRegistry;
  handlers: HandlerRegistry;
  serializers: SerializerRegistry;
}

export interface QueueJobDefinition {
  readonly type: QueueJobType;
}

export interface QueueMessageDefinition {
  readonly type: string;
}

export interface QueueJobHandler {
  handle(job: QueueJob): Promise<void> | void;
}

export interface QueueJobHandlerRegistration {
  readonly type: QueueJobType;
  readonly handler: QueueJobHandler;
}

export interface QueueSerializerRegistration {
  readonly type: string;
  readonly serializer: QueueSerializer;
}

