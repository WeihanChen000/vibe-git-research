import type {SPProject,SPTask} from '@vibe-git/protocol';
/** Bounded task-local provenance, never raw replies, claims, tokens or full prompts. */
export function executionHistory(p:SPProject,t:SPTask){
 return {
  source:'host-member-connector-records',
  limitation:'Host-accepted lifecycle receipts from the assigned member connector. Not an independent provider audit, a full tool transcript, or proof of scientific correctness. Raw reply text is private; its SHA256 is recorded when available.',
  attempts:p.runs.filter(r=>r.revision===p.revision&&r.taskKey===t.key&&r.kind==='TASK').map(r=>({
   executionId:r.id,ownerNodeId:r.ownerNodeId,agentId:r.agent.id,platform:r.agent.platform??'sciencepal',status:r.status,
   createdAt:r.createdAt,updatedAt:r.updatedAt,threadId:r.threadId,runId:r.runId,
   ...(r.localExecution?{localExecution:r.localExecution}:{}),
   ...(r.output?{artifact:{id:r.output.id,filename:r.output.filename,sha256:r.output.sha256,size:r.output.size}}:{}),
   continuations:(r.continuations??[]).map(c=>({threadId:c.threadId,previousRunId:c.previousRunId,runId:c.runId,source:c.source,at:c.at,...(c.replySha256?{replySha256:c.replySha256}:{})})),
  })),
 };
}
