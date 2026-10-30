import type { SPPlatform, SPLocalPlatform } from "./sciencepal-platform.js";
import type { AlignmentIssue } from "./v20.js";
import type { SciencePALAgent, SciencePALArtifact, SciencePALTaskStatus } from "./sciencepal.js";

/** Team id identifies a member binding; runtimeAgentId is the SciencePAL id.
 * Legacy projects omit runtimeAgentId and use id directly. */
export interface SPAgentBinding extends SciencePALAgent { runtimeAgentId?: string; platform?: SPPlatform }

export interface SPProposal { id: string; agentId: string; content: string; sha256: string; ownerNodeId?: string; documentId?: string; documentRevision?: number }
/** Member identity is Vibe-Git's authenticated node; account ownership is not inferred from an Agent ID. */
export interface SPTeam {
  captainNodeId: string;
  members: { nodeId: string; label: string; agent: SPAgentBinding; documentId: string; documentRevision: number }[];
}
export interface SPTeamPacket {
  projectId: string; run: SPRun;
  files: (SPInput & { base64: string })[];
}
export interface SPSourceInput { filename: string; base64: string; sourceUrl: string; attribution: string }
export interface SPSourceFile { artifact: SciencePALArtifact; sourceUrl: string; attribution: string }
/** Bounded JSON Schema draft-07 subset; applied to the envelope's result only. */
export interface SPResultSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  properties?: Record<string, SPResultSchema>; required?: string[]; additionalProperties?: boolean;
  items?: SPResultSchema | SPResultSchema[]; additionalItems?: boolean;
  minItems?: number; maxItems?: number; minLength?: number; maxLength?: number;
  minimum?: number; maximum?: number; enum?: (string | number | boolean | null)[];
  const?: string | number | boolean | null; description?: string;
}
export type SPResultSchemas = Record<string, SPResultSchema>;
export interface SPResultValidation { status: "PASSED" | "FAILED"; contractSha256: string; issues: { path: string; message: string }[] }
export interface SPTaskDraft {
  resultSchema?: SPResultSchema;
  key: string; title: string; goal: string; boundary: string; acceptance: string[];
  dependencies: string[]; assigneeAgentId: string; reviewerAgentId: string; outputFilename: string;
}
export interface SPTask extends SPTaskDraft {
  status: "WAITING" | "RUNNING" | "REVIEWING" | "APPROVED" | "CHANGES_REQUESTED" | "BLOCKED";
  attempt: number; executionId: string | null; reviewId: string | null; artifactId: string | null;
  feedback: string; review: SPReviewResult | null;
}
export interface SPReceipt { filename: string; sha256: string; size: number }
export interface SPInput extends SPReceipt { artifactId: string }
export interface SPReviewResult {
  verdict: "approve" | "request_changes"; summary: string;
  checks: { criterion: string; passed: boolean; evidence: string }[]; requiredChanges: string[];
}
export interface SPAlignment {
  runId: string; revision: number; alignmentMarkdown: string;
  issues: AlignmentIssue[]; tasks: SPTaskDraft[];
}
export interface SPRun {
  /** Local member receipt, not a SciencePAL thread or a proof of model identity. */
  localExecution?: { id: string; platform: SPLocalPlatform };
  continuations?: SPContinuation[];
  claimId?: string;
  ownerNodeId?: string;
  provenance?: "member-connector";
  resultValidation?: SPResultValidation;
  id: string; kind: "ALIGN" | "TASK" | "REVIEW" | "CHANGE_REVIEW";
  revision: number; taskKey: string | null; agent: SPAgentBinding;
  status: SciencePALTaskStatus | "COLLECTED" | "INVALID";
  prompt: string; inputs: SPInput[]; outputFilename: string; output: SciencePALArtifact | null;
  threadId: string | null; runId: string | null; sandboxId: string | null; projectId: string | null;
  createdAt: string; updatedAt: string; error: string | null; remoteStatus: string | null;
}
/** Append-only remote run transitions inside the original member-owned thread. */
export interface SPContinuation {
  threadId: string; previousRunId: string; runId: string;
  source: "sciencepal-web" | "member-reply";
  messageId?: string; replySha256?: string;
  at: string;
}
export type SPPhase = "DRAFT" | "ALIGNING" | "NEEDS_DECISION" | "READY" | "EXECUTING" | "REVIEWING" | "CHANGES_REQUESTED" | "COMPLETED" | "BLOCKED" | "CHANGE_REVIEW" | "CHANGE_READY";
export interface SPChange {
  requestedByNodeId?: string;
  id: string; request: string; baseRevision: number; runId: string;
  previousPhase: SPPhase; status: "REVIEWING" | "ACCEPTED" | "REJECTED" | "APPLIED" | "DISMISSED";
  result: { verdict: "accept" | "reject"; rationale: string; affectedTaskKeys: string[]; requirementMarkdown: string } | null;
}
export interface SPProject {
  team?: SPTeam;
  resultContracts?: SciencePALArtifact;
  source?: SPSourceFile;
  id: string; roomId: string; title: string; revision: number; phase: SPPhase; paused: boolean;
  agents: SPAgentBinding[]; coordinatorId: string; proposals: SPProposal[];
  requirementMarkdown: string; alignment: SPAlignment | null; alignmentRunId: string | null;
  tasks: SPTask[]; runs: SPRun[]; changes: SPChange[];
  history: { revision: number; requirementMarkdown: string; alignment: SPAlignment | null; tasks: SPTask[] }[];
  maxRuns: number; error: string | null; createdAt: string; updatedAt: string;
  events: { at: string; message: string }[];
}
export interface SPCreateProject {
  resultSchemas?: SPResultSchemas;
  title: string; coordinatorId: string; proposals: { agentId: string; content: string }[];
  source?: SPSourceInput;
}

/** Read-only view derived from frozen run inputs and outputs. */
export interface SPTaskAttempt {
  number: number; execution: SPRun; feedback: string;
  reviews: { run: SPRun; result: SPReviewResult | null }[];
}

export interface SPProjectEvidence {
  team?: SPTeam;
  provenance?: "member-connector";
  resultContracts?: SciencePALArtifact;
  source?: SPSourceFile;
  projectId: string; title: string; revision: number; archived: boolean; generatedAt: string;
  requirement: string; allApproved: boolean;
  tasks: { task: SPTask; attempts: (SPTaskAttempt & { result: unknown | null })[] }[];
  runs: SPRun[]; files: SciencePALArtifact[];
  handoffs: { from: string; to: string; executionId: string; artifactId: string | null;
    reviewId: string | null; checks: { label: string; passed: boolean }[] }[];
}

export function isLatestSPRun(runs: SPRun[], run: SPRun): boolean {
  const index = runs.findIndex(candidate => candidate.id === run.id);
  return index >= 0 && !runs.slice(index + 1).some(candidate =>
    candidate.revision === run.revision && candidate.kind === run.kind && candidate.taskKey === run.taskKey);
}
