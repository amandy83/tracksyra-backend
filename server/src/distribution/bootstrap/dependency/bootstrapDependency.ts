import type { DependencyGraph } from "../../composition";

export interface BootstrapDependencyResolver {
  resolve(graph: DependencyGraph): readonly string[];
}
