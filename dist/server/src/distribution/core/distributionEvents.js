import { EventEmitter } from "node:events";
export class DistributionEvents extends EventEmitter {
    on(eventName, listener) {
        return super.on(eventName, listener);
    }
    once(eventName, listener) {
        return super.once(eventName, listener);
    }
    emit(eventName, payload) {
        return super.emit(eventName, payload);
    }
}
