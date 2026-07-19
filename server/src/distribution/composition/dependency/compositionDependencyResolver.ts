import type { DependencyGraph, ModuleDescriptor } from "../types/compositionTypes";

export interface CompositionDependencyResolver {
  resolve(graph: DependencyGraph, overrides?: Readonly<Record<string, unknown>>): readonly ModuleDescriptor[];
}
