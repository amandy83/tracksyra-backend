class BullMQQueueMiddlewareNext {
    handler;
    constructor(handler) {
        this.handler = handler;
    }
    handle(envelope, context) {
        return this.handler(envelope, context);
    }
}
export class BullMQQueueMiddlewareChain {
    middlewares = [];
    terminal;
    constructor(terminal) {
        this.terminal = new BullMQQueueMiddlewareNext(terminal);
    }
    use(middleware) {
        this.middlewares.push(middleware);
    }
    list() {
        return Object.freeze([...this.middlewares]);
    }
    async handle(envelope, context) {
        const invoke = (index) => ({
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
