export class ValidationRegistryImpl {
    validators = new Map();
    register(validator) {
        this.validators.set(validator.validatorId, validator);
    }
    resolve(validatorId) {
        return this.validators.get(validatorId) ?? null;
    }
    list() {
        return Object.freeze([...this.validators.values()]);
    }
}
