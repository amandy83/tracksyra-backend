export class WorkflowNotificationFlow {
    notificationId;
    channels;
    createdAt;
    metadata;
    constructor(input) {
        this.notificationId = input.notificationId.trim();
        this.channels = Object.freeze([...(input.channels ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.notificationId) {
            throw new Error("WorkflowNotificationFlow.notificationId must not be empty");
        }
        Object.freeze(this);
    }
}
