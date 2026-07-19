export class ExecutionStageDefinition {
    name;
    dependencies;
    constructor(input) {
        this.name = input.name;
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.handler = input.handler;
        Object.freeze(this);
    }
    handler;
    execute(context) {
        return this.handler(context);
    }
}
export class ExecutionStageRegistry {
    stages = new Map();
    register(stage) {
        this.stages.set(stage.name, stage);
    }
    get(stage) {
        return this.stages.get(stage) ?? null;
    }
    has(stage) {
        return this.stages.has(stage);
    }
    list() {
        return Object.freeze([...this.stages.values()]);
    }
}
