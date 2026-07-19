import { serializeCanonicalJSON } from "../core/canonicalSerializer";
import type { DspSpecification } from "./specificationTypes";

export class SpecificationSerializer {
  serialize(specification: DspSpecification): string {
    return serializeCanonicalJSON(specification);
  }

  serializeChecksum(specification: DspSpecification): string {
    return this.serialize(specification);
  }

  deserialize(serialized: string): DspSpecification {
    return JSON.parse(serialized) as DspSpecification;
  }
}
