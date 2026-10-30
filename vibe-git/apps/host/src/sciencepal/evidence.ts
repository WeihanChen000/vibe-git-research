import {validateScientificChecks,checkScientificResult,scientificError} from "./scientific-checks.js";
import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import type { SPProject, SPProjectEvidence, SPRun, SPTaskAttempt, SciencePALArtifact } from "@vibe-git/protocol";
import { badRequest, invalidState, notFound } from "../domain/errors.js";
import { envelope } from "./pipeline-contract.js";
import { checkTaskResult, resultValidationError, validateResultSchemas } from "./result-contract.js";

const executionScope = (r: SPRun) => isLocalResearchPlatform(r.agent.platform) ? (r.localExecution?.id ? `${r.agent.platform}:${r.localExecution.id}` : null) : (r.sandboxId ? `sciencepal:${r.sandboxId}` : null);

/** Recompute evidence from local frozen bytes. This path must never call SciencePAL. */
export function projectEvidence(p: SPProject, revision: number,
  attempts: (key: string) => SPTaskAttempt[],
  read: (id: string) => SciencePALArtifact & { bytes: Uint8Array }): SPProjectEvidence {
  if (!Number.isSafeInteger(revision) || revision < 1) throw badRequest("需求版本必须为正整数");
  const stage = p.revision === revision ? p : p.history.find(h => h.revision === revision);
  if (!stage) throw notFound("需求版本不存在");
  const runs = p.runs.filter(r => r.revision === revision);
  const files = new Map<string, SciencePALArtifact>(), results = new Map<string, unknown>();
  const verify = (id: string, sha256: string, size: number) => {
    const { bytes, ...meta } = read(id);
    if (meta.sha256 !== sha256 || meta.size !== size || bytes.length !== size) throw invalidState("证据与运行冻结清单不符");
    files.set(id, meta); return bytes;
  };
  const contracts = p.resultContracts ? validateResultSchemas(JSON.parse(Buffer.from(verify(p.resultContracts.id, p.resultContracts.sha256, p.resultContracts.size)).toString("utf8"))) : undefined;
  const science = p.scientificChecks ? validateScientificChecks(JSON.parse(Buffer.from(verify(p.scientificChecks.id,p.scientificChecks.sha256,p.scientificChecks.size)).toString("utf8")),p.source?.artifact.sha256) : undefined;
  for (const run of runs) {
    const transitions = run.continuations ?? [];
    for (let i = 0; i < transitions.length; i++) {
      const c = transitions[i]!;
      if (c.threadId !== run.threadId || c.previousRunId === c.runId || (i > 0 && transitions[i - 1]!.runId !== c.previousRunId) || !Number.isFinite(Date.parse(c.at))) throw invalidState("续接历史不连续或改变了原线程");
    }
    if (transitions.length && (transitions.at(-1)!.runId !== run.runId || new Set([transitions[0]!.previousRunId, ...transitions.map(c => c.runId)]).size !== transitions.length + 1)) throw invalidState("续接历史复用了旧运行或与当前运行不符");
    for (const input of run.inputs) verify(input.artifactId, input.sha256, input.size);
    if (run.output) verify(run.output.id, run.output.sha256, run.output.size);
    if (run.status !== "COLLECTED") continue;
    if (!run.output || !executionScope(run)) throw invalidState("已采集运行缺少执行身份或成果");
    if (isLocalResearchPlatform(run.agent.platform)) {
      if (!run.ownerNodeId || !run.claimId || run.localExecution?.platform !== run.agent.platform || run.threadId || run.runId || run.sandboxId || transitions.length) throw invalidState("本地执行身份与远端身份混淆");
    } else if (!run.runId || !run.threadId) throw invalidState("已采集运行缺少远端身份");
    let raw: unknown;
    try { raw = JSON.parse(Buffer.from(read(run.output.id).bytes).toString("utf8")); }
    catch { throw invalidState("冻结成果不是有效 JSON"); }
    const result = envelope(raw, run);
    if (contracts && run.kind === "TASK") {
      const check = checkTaskResult(contracts, run.taskKey!, result, p.resultContracts!.sha256);
      if (check.status === "FAILED") throw invalidState(resultValidationError(check));
    }
    if(science&&run.kind==="TASK"){const report=checkScientificResult(science,run.taskKey!,result,p.scientificChecks!.sha256,run.output.sha256,p.source?.artifact.sha256);if(report?.status==="FAILED")throw invalidState(scientificError(report));if(report)run.scientificValidation=report;}
    results.set(run.id, result);
  }
  if (p.source) verify(p.source.artifact.id, p.source.artifact.sha256, p.source.artifact.size);
  const tasks = stage.tasks.map(task => ({ task, attempts: attempts(task.key).map(a => ({ ...a, result: results.get(a.execution.id) ?? null })) }));
  for (const task of tasks) for (const attempt of task.attempts) for (const review of attempt.reviews) {
    if (review.result && (review.run.agent.id === attempt.execution.agent.id || (p.team && review.run.ownerNodeId === attempt.execution.ownerNodeId) || !executionScope(review.run) || !executionScope(attempt.execution) || executionScope(review.run) === executionScope(attempt.execution))) throw invalidState("评审独立性证据不成立");
  }
  const handoffs: SPProjectEvidence["handoffs"] = [];
  for (const { task, attempts: downstream } of tasks) for (const attempt of downstream) for (const dependency of task.dependencies) {
    const upstream = tasks.find(t => t.task.key === dependency);
    const source = upstream?.attempts.find(a => a.execution.output && attempt.execution.inputs.some(i => i.artifactId === a.execution.output!.id));
    const review = source?.reviews.find(r => r.result?.verdict === "approve" && Date.parse(r.run.updatedAt) <= Date.parse(attempt.execution.createdAt));
    handoffs.push({ from: dependency, to: task.key, executionId: attempt.execution.id,
      artifactId: source?.execution.output?.id ?? null, reviewId: review?.run.id ?? null,
      checks: [
        { label: "交接文件与该轮上游成果完全一致", passed: !!source && source.execution.status === "COLLECTED" },
        { label: "上游获批后才派发下游", passed: !!review },
        { label: "评审由另一成员/Agent 的不同执行记录完成（本地回执不证明进程隔离）", passed: !!review && !!source && !!executionScope(source.execution) && !!executionScope(review.run) && source.execution.agent.id !== review.run.agent.id && (!p.team || source.execution.ownerNodeId !== review.run.ownerNodeId) && executionScope(source.execution) !== executionScope(review.run) },
      ],
    });
  }
  return { ...(p.team ? { team: p.team, provenance: "member-connector" as const } : {}), ...(p.resultContracts ? { resultContracts: p.resultContracts } : {}), ...(p.source ? { source: p.source } : {}), ...(p.scientificChecks?{scientificChecks:p.scientificChecks}:{}), projectId: p.id, title: p.title, revision, archived: revision !== p.revision, generatedAt: new Date().toISOString(),
    requirement: stage.requirementMarkdown || stage.alignment?.alignmentMarkdown || "",
    allApproved: tasks.length > 0 && handoffs.every(h => h.checks.every(c => c.passed)) && tasks.every(t => t.task.status === "APPROVED" && t.attempts.some(a => a.execution.id === t.task.executionId && a.reviews.some(r => r.run.id === t.task.reviewId && r.result?.verdict === "approve"))),
    tasks, runs, files: [...files.values()], handoffs };
}
