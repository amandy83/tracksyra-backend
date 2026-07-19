import type { CompositionConfiguration, DependencyGraph } from "../types/compositionTypes";

export interface CompositionModuleBuilder {
  build(configuration: CompositionConfiguration): DependencyGraph;
}
