import type { SPProject } from "@vibe-git/protocol";

/** Queued jobs already reserve a slot. Every recorded same-thread continuation uses another.
 * Failed/superseded jobs remain charged; returning an existing receipt uses no new slot.
 */
export function hasRunCapacity(project: Pick<SPProject, "runs" | "maxRuns">): boolean {
  return project.runs.reduce((used, run) => used + 1 + (run.continuations?.length ?? 0), 0) < project.maxRuns;
}
