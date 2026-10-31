import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import type {ReplayContext} from "./research-replay";
import { isLatestSPRun, projectNextActions, type SPAgentBinding, type SPProject, type SPRun, type SPTask, type SPMemberPresence } from "@vibe-git/protocol";

export interface TeamState {
  replay?:ReplayContext;
  presence?:Record<string,Record<string,SPMemberPresence>>;
  localResearch?:boolean;
  browserCommands?: boolean;
  csrfToken?: string;
  commandSnapshots?: Record<string,string>;
  viewer: { id: string; label: string; role: string };
  members: { id: string; label: string; role: string; presence?:SPMemberPresence; binding: { agent: SPAgentBinding; updatedAt: string } | null;
    plan: { id: string; revision: number; content: string; sha256: string } | null }[];
  projects: SPProject[];
  /** Only supplied by the isolated, read-only demonstration server. */
  preview?: boolean;
  interactiveSimulation?: boolean;
  simulationDescription?: string;
}
export function connectionSummary(state:TeamState,p:SPProject,nodeId:string){
 const presence=state.presence?.[p.id]?.[nodeId],member=p.team?.members.find(m=>m.nodeId===nodeId),codex=isLocalResearchPlatform(member?.agent.platform);
 const entry=presence?.panel,connector=presence?.connector,online=entry?.state==="online"||connector?.state==="online";
 const runs=currentMemberRuns(p,nodeId),run=runs[0];let blocker="等待分工 / 上游";
 if(runs.some(r=>r.status==="UNKNOWN"))blocker="原运行待本人核对，勿重发";
 else if(runs.some(r=>r.status==="NEEDS_INPUT"))blocker="等待本人在原线程回答";
 else if(p.paused)blocker="项目已暂停，等待队长恢复";
 else if(run&&codex)blocker=run.status==="READY"?`等待本人 ${researchPlatformName(member?.agent.platform)} 领取`:`等待本人 ${researchPlatformName(member?.agent.platform)} 提交`;
 else if(run&&state.replay)blocker=runLabels[run.status]??"历史运行";
 else if(run&&connector?.state!=="online")blocker=connector?.state==="offline"?"连接器心跳超时 / 已停止":"本人尚未启动连接器";
 else if(run)blocker=connector?.status==="error"?connector.reason:runLabels[run.status]??"正在处理任务";
 else {const action=projectNextActions(p,nodeId).actions.find(a=>a.ownerNodeId===nodeId);if(action)blocker=action.title;}
 return {presence,online,blocker,label:state.replay?"历史记录 · 只读":connector?.state==="online"?"连接器在线":entry?.state==="online"?"本机入口在线":presence?"未连接 / 心跳超时":"尚无心跳记录"};
}
export type ResearchTarget = { type: "next" | "protocol" | "history" } | { type: "member" | "task" | "handoff" | "review"; id: string };
export type ResearchTone = "neutral" | "active" | "approved" | "attention" | "blocked";
export const phaseLabels: Record<string, string> = { DRAFT:"提案已冻结", ALIGNING:"协议对齐中", NEEDS_DECISION:"等待裁决", READY:"等待发布", EXECUTING:"研究执行中", REVIEWING:"独立评审中", CHANGES_REQUESTED:"评审退回 · 等待返工", COMPLETED:"本轮已完成", BLOCKED:"需要处理异常", CHANGE_REVIEW:"变更评审中", CHANGE_READY:"等待确认变更" };
export const taskLabels: Record<SPTask["status"], string> = { WAITING:"等待上游", RUNNING:"执行中", REVIEWING:"评审中", APPROVED:"已通过评审", CHANGES_REQUESTED:"需要返工", BLOCKED:"已阻断" };
export const runLabels: Record<string, string> = { READY:"等待领取", STARTING:"等待启动回执", RUNNING:"执行中", NEEDS_INPUT:"等待本人回答", COMPLETED:"等待校验", COLLECTED:"成果已校验", INVALID:"成果校验失败", FAILED:"执行失败", UNKNOWN:"启动结果待核对" };
export const jobLabels: Record<SPRun["kind"], string> = { ALIGN:"协议对齐", TASK:"研究执行", REVIEW:"独立评审", CHANGE_REVIEW:"变更评审" };
export const platformName = (agent?: SPAgentBinding) => !agent ? "尚未绑定" : researchPlatformName(agent.platform ?? "sciencepal");
export function stageProject(project: SPProject, revision: number): SPProject {
  if (revision === project.revision) return project;
  const stage = project.history.find(h => h.revision === revision);
  if (!stage) return project;
  const {governance:_currentGovernance,...original}=project;
  return { ...original, ...stage, runs: project.runs.filter(r => r.revision === revision || stage.tasks.some(t=>t.carriedFrom?.revision===r.revision&&t.key===r.taskKey)) };
}
export const memberForAgent = (p: SPProject, id: string) => p.team?.members.find(m => m.agent.id === id);
export function taskTone(task: SPTask): ResearchTone {
  return task.status === "APPROVED" ? "approved" : task.status === "CHANGES_REQUESTED" ? "attention" : task.status === "BLOCKED" ? "blocked" : ["RUNNING","REVIEWING"].includes(task.status) ? "active" : "neutral";
}
/** A waiting remote run must not look like active computation on the task card. */
export function taskDisplay(p: SPProject, task: SPTask): {label:string;tone:ResearchTone} {
  const id=task.status==="REVIEWING"?task.reviewId:task.status==="RUNNING"?task.executionId:null;
  const run=id?p.runs.find(r=>r.id===id&&r.revision===p.revision&&isLatestSPRun(p.runs,r)):undefined;
  if(run?.status==="NEEDS_INPUT")return {label:task.status==="REVIEWING"?"评审等待回答":"等待本人回答",tone:"attention"};
  if(run?.status==="UNKNOWN")return {label:runLabels.UNKNOWN!,tone:"attention"};
  return {label:taskLabels[task.status],tone:taskTone(task)};
}
export function currentMemberRuns(p: SPProject, nodeId: string) {
  return p.runs.filter(r => r.ownerNodeId === nodeId && r.revision === p.revision && isLatestSPRun(p.runs,r) && ["READY","STARTING","RUNNING","NEEDS_INPUT","UNKNOWN"].includes(r.status));
}
export interface ResearchHandoff {
  id: string; from: SPTask; to: SPTask; filename: string; artifactId: string | null;
  state: "blocked" | "waiting" | "released" | "delivered"; label: string; tone: ResearchTone;
}
/** A matching receipt must belong to this revision or an explicitly carried approved task. */
export function researchHandoffs(p: SPProject): ResearchHandoff[] {
  return p.tasks.flatMap(to => to.dependencies.flatMap(key => {
    const from = p.tasks.find(t => t.key === key); if (!from) return [];
    const consumer = p.runs.find(r => r.id === to.executionId && r.revision === (to.status === "APPROVED" ? to.carriedFrom?.revision ?? p.revision : p.revision));
    const delivered = from.status === "APPROVED" && !!from.artifactId && consumer?.status === "COLLECTED" && !!consumer.inputs.some(i => i.artifactId === from.artifactId);
    const state = delivered ? "delivered" : ["CHANGES_REQUESTED","BLOCKED"].includes(from.status) ? "blocked" : from.status === "APPROVED" && from.artifactId ? "released" : "waiting";
    return [{ id:`${from.key}--${to.key}`, from, to, filename:from.outputFilename, artifactId:from.artifactId, state,
      label:({delivered:to.carriedFrom ? `文件已交接 · 沿用 R${to.carriedFrom.revision}` : "文件已交接",blocked:"交接已阻断",released:consumer&&consumer.status!=="READY"?"已放行 · 等待交接回执":"已放行 · 等待领取",waiting:"等待上游评审"})[state],
      tone:({delivered:"approved",blocked:"attention",released:"active",waiting:"neutral"})[state] as ResearchTone }];
  }));
}
export function actionTarget(p: SPProject, action: ReturnType<typeof projectNextActions>["actions"][number]): ResearchTarget {
  const key = action.taskKey ?? (typeof action.body?.taskKey === "string" ? action.body.taskKey : undefined) ?? p.runs.find(r=>r.id===action.runId)?.taskKey;
  return key ? { type:"task",id:key } : action.ownerNodeId ? { type:"member",id:action.ownerNodeId } : { type:"protocol" };
}
export function taskActionText(project: SPProject, action: ReturnType<typeof projectNextActions>["actions"][number]) {
  const prefix = `npm --silent run sciencepal:member -- `;
  const id = project.id;
  if (action.body && action.operation) {
    const body = { ...action.body, ...(action.operation === "decide" ? { optionId:"请阅读选项后填写" } : {}) };
    return `将以下 JSON 保存为 action.json${action.operation === "decide" ? "（先选择 optionId）" : ""}：\n${JSON.stringify(body,null,2)}\n\n${prefix}command ${id} ${action.operation} action.json`;
  }
  const args: Record<string,string> = { take:`take ${id} "新任务目录"`,submit:`submit ${id} "原任务目录" "结果文件.json"`,reply:`reply ${id} "本人答复.md"`,work:`work ${id}`,evidence:`evidence ${id} "新证据文件.json"` };
  if (action.operation === "recover") return `保留原日志，先核对原线程，不重复启动。\n${prefix}next ${id}`;
  return `${prefix}${args[action.operation ?? ""] ?? `next ${id}`}`;
}

export function reviewsForAttempt(p:SPProject,execution:SPRun):SPRun[]{
 return execution.output?p.runs.filter(r=>r.kind==="REVIEW"&&r.taskKey===execution.taskKey&&r.revision===execution.revision&&r.inputs.some(i=>i.artifactId===execution.output!.id)):[];
}


/** Only a bound SciencePAL project/thread pair can form a direct authenticated link. */
export function sciencePALThreadUrl(run?:SPRun):string|null {
 if(!run||isLocalResearchPlatform(run.agent.platform))return null;
 const valid=(id:unknown):id is string=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,120}$/.test(id);
 return valid(run.projectId)&&valid(run.threadId)?`https://sciencepal.ai/projects/${run.projectId}/thread/${run.threadId}`:null;
}


/** Explain every local blocker; this never substitutes for Host permission checks. */
export function projectCreationIssues(title:string,selected:string[],captainId:string,members:TeamState['members'],sourceReady:boolean,sourceError:string,selection?:{error:string;hasSource:boolean}):string[] {
 const issues:string[]=[];
 if(!title.trim())issues.push('填写项目名称');
 if(selected.length<2||selected.length>4)issues.push('选择 2–4 位成员');
 if(!selected.includes(captainId))issues.push('参与成员必须包含队长本人');
 for(const id of selected){const m=members.find(v=>v.id===id);if(!m?.binding||!m.plan)issues.push(`${m?.label??'已选成员'} 尚未绑定 Agent 或保存提案，请该成员完成后再建项`);}
 if(!sourceReady)issues.push(selection?.error?(selection.hasSource?'文件替换失败：请在上方选择“继续使用原文件”、重选文件或移除。':'文件读取失败：请在上方重选文件，或移除本次选择后不带文件建项。'):'正在读取文件，请等待完成后再建项。');
 if(sourceError)issues.push(sourceError);
 return issues;
}
