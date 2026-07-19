import type { DeadLetterMessage } from "../types/queueIntegrationTypes";

export interface DeadLetterHandler {
  handle(message: DeadLetterMessage): Promise<void> | void;
  replay(messageId: string): Promise<boolean> | boolean;
}
