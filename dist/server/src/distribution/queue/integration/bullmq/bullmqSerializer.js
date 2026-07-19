export class BullMQQueueSerializer {
    serialize(value) {
        return JSON.stringify(value);
    }
    serializeEnvelope(envelope) {
        return JSON.stringify(envelope);
    }
}
