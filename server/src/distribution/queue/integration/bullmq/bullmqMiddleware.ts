import type { QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "../types/queueIntegrationTypes";
import type { QueueMiddleware, QueueMiddlewareChain, QueueMiddlewareNext } from "../middleware/queueMiddleware";

class BullMQQueueMiddlewareNext implements QueueMiddlewareNext {
  constructor(private readonly handler: (envelope: QueueEnvelope, context: QueueExecutionContext) => Promise<QueueExecutionResult> | QueueExecutionResult) {}

  handle(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> | QueueExecutionResult {
    return this.handler(envelope, context);
  }
}

export class BullMQQueueMiddlewareChain implements QueueMiddlewareChain {
  private readonly middlewares: QueueMiddleware[] = [];
  private readonly terminal: QueueMiddlewareNext;

  constructor(
    terminal: (envelope: QueueEnvelope, context: QueueExecutionContext) => Promise<QueueExecutionResult> | QueueExecutionResult,
  ) {
    this.terminal = new BullMQQueueMiddlewareNext(terminal);
  }

  use(middleware: QueueMiddleware): void {
    this.middlewares.push(middleware);
  }

  list(): readonly QueueMiddleware[] {
    return Object.freeze([...this.middlewares]);
  }

  async handle(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> {
    const invoke = (index: number): QueueMiddlewareNext => ({
      handle: (currentEnvelope, currentContext) => {
        const middleware = this.middlewares[index];
        if (!middleware) {
          return this.terminal.handle(currentEnvelope, currentContext);
        }
        return middleware.handle(currentEnvelope, currentContext, invoke(index + 1));
      },
    });

    return Promise.resolve(invoke(0).handle(envelope, context));
  }
}
