/** SciencePAL mode shares the Host room, but does not require local Codex nodes. */
export type SciencePALTaskStatus = "READY" | "STARTING" | "RUNNING" | "NEEDS_INPUT" | "COMPLETED" | "FAILED" | "UNKNOWN";
export interface SciencePALAgent {
  id: string; name: string;
  source?: string; runtimeAgentType?: string; description?: string; toolProfile?: string;
}
export interface SciencePALArtifact { id: string; filename: string; sha256: string; size: number; collectedAt: string }
export interface SciencePALTask {
  id: string; role: "producer" | "consumer"; agent: SciencePALAgent; prompt: string;
  outputFilename: string; status: SciencePALTaskStatus;
  threadId: string | null; runId: string | null; sandboxId: string | null;
  projectId?: string;
  remoteStatus: string | null; error: string | null; artifact: SciencePALArtifact | null;
  inputArtifactId: string | null; inputSha256: string | null;
}
export interface SciencePALWorkflow {
  id: string; roomId: string; title: string; createdAt: string; updatedAt: string;
  tasks: [SciencePALTask, SciencePALTask];
  verification: { passed: boolean; checks: { name: string; passed: boolean }[]; checkedAt: string } | null;
  events: { at: string; message: string }[];
}
export interface SciencePALCreateInput {
  title: string; producerAgentId: string; consumerAgentId: string;
  producerPrompt: string; consumerPrompt: string; outputFilename: string;
}
export interface SciencePALState {
  enabled: boolean; configured: boolean; roomId: string;
  workflows: SciencePALWorkflow[];
}
