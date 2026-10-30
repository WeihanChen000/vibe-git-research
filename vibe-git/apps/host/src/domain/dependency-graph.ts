import { badRequest } from "./errors.js";

/** Shared by the original Codex stages and SciencePAL's file-based stages. */
export function validateDependencyGraph(graph: Map<string, string[]>): void {
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (taskId: string): void => {
    if (active.has(taskId)) throw badRequest("任务依赖形成循环");
    if (visited.has(taskId) || !graph.has(taskId)) return;
    active.add(taskId);
    for (const dependency of graph.get(taskId) ?? []) visit(dependency);
    active.delete(taskId); visited.add(taskId);
  };
  for (const taskId of graph.keys()) visit(taskId);
}
