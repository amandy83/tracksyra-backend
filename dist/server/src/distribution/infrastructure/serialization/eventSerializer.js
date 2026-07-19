export class EventSerializer {
    serialize(event) {
        return `${JSON.stringify(event)}\n`;
    }
    deserialize(payload) {
        return JSON.parse(payload);
    }
}
