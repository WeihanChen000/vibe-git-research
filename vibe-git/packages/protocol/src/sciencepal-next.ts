import { isLocalResearchPlatform, researchPlatformName, type SPPlatform } from "./sciencepal-platform.js";
import { isLatestSPRun, type SPProject } from "./sciencepal-pipeline.js";

export interface SPNextAction {
  kind: string; title: string; detail: string;
  ownerNodeId: string | null; ownerLabel: string; isMine: boolean;
  runId?: string; taskKey?: string; platform?: SPPlatform;
  operation?: string; body?: Record<string, unknown>;
}
/** Derived from the same frozen state for CLI and UI; never grants permission. */
export function projectNextActions(p: SPProject, viewerId: string) {
  const actions: SPNextAction[] = [], captain = p.team?.captainNodeId ?? null;
  const add = (ownerNodeId: string | null, action: Omit<SPNextAction, "ownerNodeId" | "ownerLabel" | "isMine">) => actions.push({ ...action, ownerNodeId,
    ownerLabel: p.team?.members.find(m => m.nodeId === ownerNodeId)?.label ?? (ownerNodeId === captain ? "队长" : "Host"), isMine: ownerNodeId === viewerId });
  const control = (operation: string, title: string, detail: string, body: Record<string, unknown> = {}) => add(captain, { kind: "decision", operation, body: { revision: p.revision, ...body }, title, detail });
  if (p.paused) control("resume", "等待队长恢复项目", "项目已暂停；已有远端任务可能仍在运行。恢复后继续核对原任务。");
  else if (p.phase === "COMPLETED") add(viewerId, { kind: "completed", title: "本轮科研协作已完成", detail: "导出本轮证据并核对科学结论；新研究问题请提出变更。", operation: "evidence" });
  else if (p.phase === "DRAFT") control("align", "等待队长启动对齐", "提案已冻结，尚未派发对齐任务。");
  else if (p.phase === "READY") control("publish", "等待队长检查并发布", "检查分工、依赖与验收标准后发布。", { alignmentRunId: p.alignmentRunId });
  else if (p.phase === "NEEDS_DECISION") {
    for (const issue of p.alignment?.issues.filter(i => !i.selectedOptionId) ?? []) control("decide", `等待队长裁决：${issue.title}`, "阅读各方原文和选项后选择，不能自动替队长决定。", { alignmentRunId: p.alignmentRunId, issueId: issue.id });
  } else if (p.phase === "CHANGE_READY") {
    const change = p.changes.find(c => c.baseRevision === p.revision && ["ACCEPTED", "REJECTED"].includes(c.status));
    if (change?.status === "REJECTED") control("dismiss-change", "等待队长关闭未通过的变更", change.result?.rationale || "变更评审未通过，关闭后恢复原阶段。", { changeId: change.id });
    else control("apply-change", "等待队长确认研究变更", "确认后生成下一版协议并重新对齐。", { changeId: change?.id });
  } else if (p.phase === "CHANGES_REQUESTED") {
    for (const task of p.tasks.filter(t => t.status === "CHANGES_REQUESTED")) {
      if(task.attempt < 3) control("rework", `等待队长安排返工：${task.title}`, task.review?.requiredChanges.join("；") || task.feedback || "查看评审意见并给出明确修正说明。", { taskKey: task.key });
      if(task.artifactId && task.reviewId && p.runs.length < p.maxRuns && p.runs.filter(r=>r.kind==="REVIEW"&&r.revision===p.revision&&r.taskKey===task.key&&r.inputs.some(f=>f.artifactId===task.artifactId)).length < 2) control("supplement-review", `仅缺证据时补充复审：${task.title}`, "原成果不变，由原独立评审者核查新增来源；每份成果最多一次。若数值或方法有错，应返工。", {taskKey:task.key,reviewId:task.reviewId});
      else if(task.attempt >= 3) control("change", `等待队长处理执行上限：${task.title}`, "已达三次执行上限。保留原记录，说明需要改变的研究范围并提交影响评审。");
    }
  } else {
    for (const run of p.runs.filter(r => r.revision === p.revision && isLatestSPRun(p.runs, r))) {
      const platform = run.agent.platform ?? "sciencepal", local = isLocalResearchPlatform(platform), owner = run.ownerNodeId ?? null;
      const label = `${({ ALIGN: "对齐", TASK: "执行", REVIEW: "评审", CHANGE_REVIEW: "变更评审" })[run.kind]}${run.taskKey ? ` · ${run.taskKey}` : ""}`;
      const base = { runId: run.id, ...(run.taskKey ? { taskKey: run.taskKey } : {}), platform };
      if (run.status === "UNKNOWN") add(owner, { ...base, kind: "recover", title: `等待本人核对未知运行：${label}`, detail: "保留原日志，核对原任务；禁止重新提交或换 ID 绕过。", operation: "recover" });
      else if (["FAILED", "INVALID"].includes(run.status)) control("retry", `等待队长处理失败：${label}`, run.error || "查明原因后只重试已确定失败的任务。", { runId: run.id });
      else if (p.phase !== "BLOCKED" && run.status === "READY") add(owner, { ...base, kind: "execute", title: `等待${local ? ` ${researchPlatformName(platform)} 领取` : " SciencePAL 连接器领取"}：${label}`, detail: local ? "领取任务包，读取冻结输入，在本人工作目录完成任务。" : "保持本人连接器运行；它会领取并启动。", operation: local ? "take" : "work" });
      else if (run.status === "NEEDS_INPUT") add(owner, { ...base, kind: "input", title: `等待本人回答：${label}`, detail: local ? "核对任务问题后继续处理原任务包。" : `在 SciencePAL 原线程 ${run.threadId ?? "（等待回执）"} 回复；或停止 work 后用 reply，再恢复 work。`, operation: local ? "submit" : "reply" });
      else if (["STARTING", "RUNNING", "COMPLETED"].includes(run.status)) add(owner, { ...base, kind: "running", title: `${local ? `等待 ${researchPlatformName(platform)} 交回成果` : "SciencePAL 正在处理"}：${label}`, detail: local ? "按原任务说明完成成果并交回；仍须经过对应的校验、独立评审或队长确认。" : "等待原运行与成果校验，不重复启动。在成员详情查看本项目连接器心跳。", operation: local ? "submit" : "work" });
    }
  }
  if (!actions.length && ["EXECUTING", "REVIEWING"].includes(p.phase)) add(null, { kind: "dispatch", title: "等待 Host 派发下一项工作", detail: "协议已发布；Host 会按依赖和评审结果派发任务。若长时间不变，请确认 Host 正在运行。" });
  if (!actions.length) add(null, { kind: "waiting", title: "等待项目状态更新", detail: p.error || "暂未派发下一项工作，请刷新并核对运行记录。" });
  return { projectId: p.id, revision: p.revision, phase: p.phase, paused: p.paused, actions };
}
