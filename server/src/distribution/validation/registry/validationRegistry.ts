import type { Validator, ValidationRegistry } from "../contracts/validationContracts";

export class ValidationRegistryImpl implements ValidationRegistry {
  private readonly validators = new Map<string, Validator>();

  register(validator: Validator): void {
    this.validators.set(validator.validatorId, validator);
  }

  resolve(validatorId: string): Validator | null {
    return this.validators.get(validatorId) ?? null;
  }

  list(): readonly Validator[] {
    return Object.freeze([...this.validators.values()]);
  }
}

