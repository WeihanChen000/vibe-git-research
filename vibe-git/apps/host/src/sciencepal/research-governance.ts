import {createHash} from "node:crypto";
import type {SPChange, SPGovernance, SPProject, SPRequirement, SPTask, SPTaskDraft} from "@vibe-git/protocol";
import {badRequest, invalidState} from "../domain/errors.js";

const digest = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const textHash = (text:string) => createHash("sha256").update(text).digest("hex");
const active = (p:SPProject) => p.governance?.requirements.filter(r=>!r.retiredBy) ?? [];

/** Source lines are coverage units, not an automatic interpretation of scientific meaning. */
export function sourceRequirements(text:string, sourceId:string, revision:number):SPRequirement[] {
  const sha = textHash(text);
  const result = text.split(/\r?\n/).flatMap((line,index) => {
    if(!line.trim()) return [];
    if(line.trim().length>1500) throw badRequest("需求原文单行超过 1500 字符，请在提案中分行；不会截断需求");
    return [{id:`r-${digest([sourceId,sha,index]).slice(0,16)}`,text:line.trim(),sourceId,sourceSha256:sha,introducedRevision:revision}];
  });
  if(result.length>64) throw badRequest("需求覆盖最多 64 条原文，请合并过细的提案行");
  return result;
}
export function createGovernance(p:SPProject):SPGovernance {
  const requirements=p.proposals.flatMap(plan=>sourceRequirements(plan.content,plan.id,p.revision));
  if(requirements.length>64) throw badRequest("冻结提案共超过 64 条需求原文，请合并后建项");
  return {version:1,requirements,decisions:[]};
}
export function requirementCriterion(p:SPProject,r:SPRequirement):string {
  const plan=p.proposals.find(plan=>plan.id===r.sourceId);
  const decisions=p.governance!.decisions.filter(d=>d.issue.evidence.some(e=>e.nodeId===plan?.agentId&&(r.text.includes(e.excerpt)||e.excerpt.includes(r.text))));
  const resolution=decisions.map(d=>`裁决 ${d.runId}/${d.issue.id}: ${d.issue.options.find(o=>o.id===d.issue.selectedOptionId)!.label}`).join("; ");
  const text=`[REQ:${r.id}] ${resolution?`按队长已确认的 ${resolution} 核对（原文保留供追溯）：`:"核对原提案要求："}${r.text}`;
  if(text.length>2000) throw badRequest("裁决后的需求条目超过验收长度，请缩短裁决选项说明");
  return text;
}
export function bindRequirements(p:SPProject,tasks:SPTaskDraft[], rawTasks:Record<string,unknown>[], unresolved:boolean) {
  if(!p.governance||unresolved)return;
  const requirements=active(p),used=new Set<string>();
  for(let i=0;i<tasks.length;i++) {
    const refs=rawTasks[i]!.requirementIds;
    if(!Array.isArray(refs)||!refs.length||refs.some(id=>typeof id!=="string"||!requirements.some(r=>r.id===id))||new Set(refs).size!==refs.length)
      throw badRequest("每个任务必须关联有效且不重复的冻结 requirementIds，不能新增无来源任务");
    const task=tasks[i]!;task.requirementIds=[...refs].sort();
    const original=task.acceptance.filter(c=>!c.startsWith("[REQ:"));
    if(original.length>8)throw badRequest("每个任务普通验收项最多 8 条；原文覆盖项由 Host 单独追加");
    task.acceptance=[...original,...task.requirementIds.map(id=>requirementCriterion(p,requirements.find(r=>r.id===id)!))];
    refs.forEach(id=>used.add(id));
  }
  const missing=requirements.filter(r=>!used.has(r.id));
  if(missing.length)throw badRequest(`对齐遗漏冻结需求：${missing.map(r=>r.id).join(", ")}；不能发布`);
}
export function assertUnaffectedAlignment(p:SPProject,tasks:SPTaskDraft[]) {
  if(!p.governance)return;
  const change=p.changes.find(c=>c.status==="APPLIED"&&c.baseRevision===p.revision-1);
  const prior=p.history.find(h=>h.revision===p.revision-1);
  if(change?.result&&prior)for(const old of prior.tasks.length?prior.tasks:prior.alignment?.tasks??[]) {
    if(change.result.affectedTaskKeys.includes(old.key))continue;
    const next=tasks.find(t=>t.key===old.key);
    if(!next||taskFingerprint(p,next)!==taskFingerprint(p,old))throw badRequest(`未受影响任务 ${old.key} 被对齐稿删除或擅改；必须重新提交变更影响评审`);
  }
}
export function taskFingerprint(p:SPProject,t:SPTaskDraft):string {
  return digest({key:t.key,title:t.title,goal:t.goal,boundary:t.boundary,acceptance:t.acceptance,
    dependencies:[...t.dependencies].sort(),assignee:t.assigneeAgentId,reviewer:t.reviewerAgentId,
    output:t.outputFilename,requirements:[...(t.requirementIds??[])].sort(),schema:t.resultSchema??null,
    checks:t.scientificChecks??null,source:p.source?.artifact.sha256??null,contracts:p.resultContracts?.sha256??null,scientificChecks:p.scientificChecks?.sha256??null});
}
export function changeSnapshot(p:SPProject):string {
  return digest({revision:p.revision,requirement:p.requirementMarkdown,governance:p.governance,
    tasks:(p.tasks.length?p.tasks:p.alignment?.tasks??[]).map(t=>({fingerprint:taskFingerprint(p,t),
      ...("status" in t?{status:t.status,executionId:(t as SPTask).executionId,reviewId:(t as SPTask).reviewId,artifactId:(t as SPTask).artifactId}:{})}))});
}
export function impactedClosure(tasks:SPTaskDraft[],keys:string[]):string[] {
  const affected=new Set(keys);let changed=true;
  while(changed){changed=false;for(const t of tasks)if(!affected.has(t.key)&&t.dependencies.some(k=>affected.has(k))){affected.add(t.key);changed=true;}}
  return [...affected];
}
export function assertChangeSnapshot(p:SPProject,c:SPChange) {
  if(p.governance&&c.snapshotSha256!==changeSnapshot(p))throw invalidState("变更评审后的协议、任务或成果指纹已变化；旧影响证据失效");
}
export function validateGovernedChange(p:SPProject,data:Record<string,unknown>,result:NonNullable<SPChange["result"]>) {
  if(!p.governance)return result;
  const tasks=p.tasks.length?p.tasks:p.alignment?.tasks??[];
  if(!Array.isArray(data.taskImpacts)||data.taskImpacts.length!==tasks.length)throw badRequest("变更必须逐项覆盖全部任务的影响证据，包括无影响任务");
  const seen=new Set<string>();
  const taskImpacts=data.taskImpacts.map((v:any)=>{
    const task=tasks.find(t=>t.key===v?.key);
    if(!task||seen.has(v.key)||typeof v.affected!=="boolean"||typeof v.rationale!=="string"||!v.rationale.trim()||v.rationale.length>2000||v.fingerprint!==taskFingerprint(p,task))throw badRequest("任务影响证据缺失、重复或指纹过期");
    seen.add(v.key);return {key:v.key as string,affected:v.affected as boolean,rationale:v.rationale as string,fingerprint:v.fingerprint as string};
  });
  if(!Array.isArray(data.requirementEdits)||data.requirementEdits.length>64)throw badRequest("requirementEdits 必须明确给出；没有替换原要求时使用空数组");
  const edited=new Set<string>();
  const requirementEdits=data.requirementEdits.map((v:any)=>{
    if(!v||!active(p).some(r=>r.id===v.requirementId)||edited.has(v.requirementId)||!(v.replacement===null||typeof v.replacement==="string"&&v.replacement.trim()&&v.replacement.length<=1500)||typeof v.reason!=="string"||!v.reason.trim()||v.reason.length>2000)throw badRequest("需求修订必须引用现行原文并给出明确替换和理由");
    edited.add(v.requirementId);return {requirementId:v.requirementId as string,replacement:v.replacement===null?null:v.replacement.trim() as string,reason:v.reason as string};
  });
  const directly=taskImpacts.filter(i=>i.affected).map(i=>i.key);
  for(const task of tasks)if(task.requirementIds?.some(id=>edited.has(id))&&!directly.includes(task.key))throw badRequest(`修改原需求却声称任务 ${task.key} 不受影响`);
  const affected=impactedClosure(tasks,directly);
  if(result.affectedTaskKeys.length!==affected.length||affected.some(k=>!result.affectedTaskKeys.includes(k)))throw badRequest("受影响集合必须覆盖直接影响及全部下游依赖，不能遗漏或凭空扩展");
  return {...result,taskImpacts,requirementEdits};
}
export function applyRequirementDelta(p:SPProject,c:SPChange):string {
  const g=p.governance!;
  for(const edit of c.result!.requirementEdits!) {
    const old=g.requirements.find(r=>r.id===edit.requirementId&&!r.retiredBy)!;
    old.retiredBy=c.id;
    if(edit.replacement)g.requirements.push(...sourceRequirements(edit.replacement,`${c.id}:${old.id}`,p.revision+1));
  }
  // The operator's actual request is mandatory input, even if the reviewer omits it from its summary.
  g.requirements.push(...sourceRequirements(c.request,c.id,p.revision+1));
  if(active(p).length>64)throw badRequest("修订后现行需求超过 64 条；请明确替换已过时条目");
  const edits=c.result!.requirementEdits!.map(e=>`- ${e.requirementId}: ${e.replacement??"撤销"}（${e.reason}）`).join("\n");
  const baseline=p.requirementMarkdown||p.proposals.map(plan=>`## 原始提案 ${plan.agentId}\n${plan.content}`).join("\n\n")+"\n\n## 对齐说明\n"+(p.alignment?.alignmentMarkdown||"");
  const markdown=`${baseline}\n\n## 已批准变更 R${p.revision+1}\n${c.request}\n\n${edits||"原有要求全部保留。"}`;
  if(markdown.length>64000)throw badRequest("增量协议超过 64000 字符，不能以摘要覆盖原文");
  return markdown;
}
export function assertTaskInput(p:SPProject,t:SPTaskDraft,context:any) {
  if(p.governance&&(context.taskFingerprint!==taskFingerprint(p,t)||!context.task||taskFingerprint(p,context.task)!==taskFingerprint(p,t)))throw invalidState("任务方法、边界或验收已偏离冻结运行；旧执行与评审证据失效");
}
export function evidenceRevision(p:SPProject,t:SPTask,revision=p.revision):number {
  if(!t.carriedFrom)return revision;
  const from=t.carriedFrom,c=p.changes.find(c=>c.id===from.changeId&&c.status==="APPLIED");
  const prior=p.history.find(h=>h.revision===from.revision)?.tasks.find(old=>old.key===t.key);
  if(!p.governance||!c?.result||c.baseRevision!==revision-1||from.revision>=revision||c.result.affectedTaskKeys.includes(t.key)||!prior||prior.status!=="APPROVED"||
    from.fingerprint!==taskFingerprint(p,t)||taskFingerprint(p,prior)!==from.fingerprint||prior.executionId!==t.executionId||prior.reviewId!==t.reviewId||prior.artifactId!==t.artifactId)
    throw invalidState("复用成果缺少未受影响确认或原始任务/批准指纹不符");
  for(let version=from.revision;version<revision;version++) {
    const link=p.changes.find(c=>c.baseRevision===version&&c.status==="APPLIED");
    const stage=p.history.find(h=>h.revision===version),draft=(stage?.tasks.length?stage.tasks:stage?.alignment?.tasks??[]).find(t=>t.key===prior.key);
    if(!link?.result||link.result.affectedTaskKeys.includes(t.key)||!draft||taskFingerprint(p,draft)!==from.fingerprint)throw invalidState("跨版本复用链包含受影响或缺失的任务，旧批准不可复用");
  }
  return from.revision;
}

/** Walk through unpublished revisions too; each intervening change must exempt the task. */
export function reusableTask(p:SPProject,t:SPTaskDraft):SPTask|undefined {
 if(!p.governance)return;
 const fingerprint=taskFingerprint(p,t),latest=p.changes.find(c=>c.baseRevision===p.revision-1&&c.status==="APPLIED");
 if(!latest)return;
 for(let version=p.revision-1;version>=1;version--) {
   const change=p.changes.find(c=>c.baseRevision===version&&c.status==="APPLIED"),stage=p.history.find(h=>h.revision===version);
   const draft=(stage?.tasks.length?stage.tasks:stage?.alignment?.tasks??[]).find(candidate=>candidate.key===t.key);
   if(!change?.result||change.result.affectedTaskKeys.includes(t.key)||!draft||taskFingerprint(p,draft)!==fingerprint)return;
   const old=stage!.tasks.find(old=>old.key===t.key&&old.status==="APPROVED");
   if(old)return {...structuredClone(old),carriedFrom:{revision:old.carriedFrom?.revision??version,changeId:latest.id,fingerprint}};
 }
}
