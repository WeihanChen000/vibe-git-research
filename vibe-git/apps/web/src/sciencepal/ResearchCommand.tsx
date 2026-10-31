import { useRef, useState } from "react";
import type { SPProject, SPTaskDraft } from "@vibe-git/protocol";
import type { TeamState } from "./research-model";
import { Markdown } from "../Markdown";
export type SendResearchCommand = (operation:string,body:Record<string,unknown>,snapshot:string)=>Promise<void>;
export const commandNames:Record<string,string>={"set-scientific-checks":"冻结科学检查","set-constraints":"保存科研约束",align:"启动协议对齐",publish:"发布研究任务",rework:"安排返工","supplement-review":"补充证据复审",decide:"确认裁决",retry:"重试失败任务",pause:"暂停派发",resume:"恢复派发",change:"提出研究变更","apply-change":"应用研究变更","dismiss-change":"关闭变更"};
/** Show the actual frozen fields at the point of approval, alongside prose criteria. */
export function PublishTaskChecks({task}:{task:SPTaskDraft}) {
 const fields=Object.entries(task.resultSchema?.properties??{}).filter(([,rule])=>rule.const!==undefined||rule.minimum!==undefined||rule.maximum!==undefined);
 return <>{fields.length>0&&<><p>冻结字段约束（请与方法说明核对）</p><ul>{fields.map(([name,rule])=><li key={name}><code>{name}</code>：{typeof rule.const==='string'&&/^[a-f0-9]{64}$/.test(rule.const)?'绑定上传源文件指纹':rule.const!==undefined?String(rule.const):`${rule.minimum??'不限'} ～ ${rule.maximum??'不限'}`}</li>)}</ul></>}{!!task.scientificChecks?.length&&<><p>冻结数值检查</p><ul>{task.scientificChecks.map(rule=><li key={rule.id}>{rule.kind==='sum'?`${rule.totalPath} = ${rule.rowsPath}.${rule.valueField} 的总和`:rule.kind==='reference'?`${rule.path} 的独立参考值：${rule.expected}`:`${rule.rowsPath} 按 ${rule.keyField} 核对 ${rule.expected.length} 行参考值`}；绝对容差 {rule.absoluteTolerance}{rule.kind!=='sum'&&`，相对容差 ${rule.relativeTolerance}`}</li>)}</ul></>}</>;
}
/** Keep every published criterion available without burying the frozen parameter check. */
export function PublishTaskAcceptance({task}:{task:SPTaskDraft}) {
 const requirements=task.acceptance.filter(a=>a.startsWith("[REQ:"));
 const ordinary=task.acceptance.filter(a=>!a.startsWith("[REQ:"));
 return <details><summary>查看全部验收标准 · {task.acceptance.length} 条{requirements.length>0?`（含原提案覆盖 ${requirements.length} 条）`:""}</summary>
  <ul>{ordinary.map(a=><li key={a}>{a}</li>)}</ul>
  {!!requirements.length&&<details><summary>逐条核对原提案 · {requirements.length} 条</summary><ul>{requirements.map(a=><li key={a}>{a}</li>)}</ul></details>}
 </details>;
}
export function ChangeImpactSummary({p,change}:{p:SPProject;change:SPProject["changes"][number]|undefined}) {
 return <><p>需要更新的任务：{change?.result?.affectedTaskKeys.map(key=>(p.tasks.length?p.tasks:p.alignment?.tasks??[]).find(t=>t.key===key)?.title??key).join("、")||"无"}</p>
 {p.governance&&<ul>{change?.result?.taskImpacts?.map(i=><li key={i.key}>{(p.tasks.length?p.tasks:p.alignment?.tasks??[]).find(t=>t.key===i.key)?.title??i.key}：{change.result!.affectedTaskKeys.includes(i.key)?"需要更新或受上游影响":"保持原分工；获批成果须核验后复用"}<small>{i.rationale}</small></li>)}</ul>}
 <details><summary>查看完整变更评审理由</summary><p>{change?.result?.rationale}</p></details>
 <details><summary>查看完整协议与评审建议</summary><Markdown>{change?.result?.requirementMarkdown??""}</Markdown></details>
 {p.governance?<><p>批准后追加以下真实变更，原协议不被摘要覆盖：</p><Markdown>{change?.request??""}</Markdown>{change?.result?.requirementEdits?.map(e=><details key={e.requirementId}><summary>替换或撤销原要求</summary><p>原文：{p.governance!.requirements.find(r=>r.id===e.requirementId)?.text}</p><p>改为：{e.replacement??"撤销此要求"}</p><p>{e.reason}</p></details>)}<p>确认后进入 R{p.revision+1}，保留原记录；重新对齐并发布后，仅重做受影响任务，未受影响成果须核验原批准后复用。</p></>:<p>确认后进入 R{p.revision+1}，旧版本归档，新版本重新对齐。</p>}</>;
}
export function ResearchCommand({p,state,operation,body={},busy,disabled,send}:{p:SPProject;state:TeamState;operation:string;body?:Record<string,unknown>;busy:boolean;disabled:boolean;send:SendResearchCommand}){
 const [expanded,setExpanded]=useState(false),[snapshot,setSnapshot]=useState(""),[error,setError]=useState("");
 const [note,setNote]=useState(""),[option,setOption]=useState("");const immediate=useRef(false);
 const task=p.tasks.find(t=>t.key===body.taskKey),issue=p.alignment?.issues.find(i=>i.id===body.issueId),change=p.changes.find(c=>c.id===body.changeId);
 const retryRun=p.runs.find(r=>r.id===body.runId),retryTask=p.tasks.find(t=>t.key===retryRun?.taskKey);
 const name=commandNames[operation],stale=expanded&&snapshot!==state.commandSnapshots?.[p.id];
 if(!name||!state.browserCommands||!state.csrfToken)return null;
 const begin=()=>{setSnapshot(state.commandSnapshots?.[p.id]??"");setExpanded(true);setError("");setOption("");setNote(operation==="rework"?task?.review?.requiredChanges.join("\n")??"":"");};
 const submit=async()=>{if(immediate.current)return;immediate.current=true;setError("");try{
  await send(operation,{...body,revision:p.revision,...((operation==="rework"||operation==="supplement-review")?{note}:operation==="change"?{request:note}:operation==="decide"?{optionId:option}:{})},snapshot);setExpanded(false);
 }catch(e){setError(e instanceof Error?e.message:"操作失败，请刷新核对状态。");}finally{immediate.current=false;}};
 return <div className="rt-command">{!expanded?<button className="rt-primary" disabled={disabled||busy} onClick={begin}>{name}</button>:<section className="rt-confirm" aria-label={name+"确认"}>
  <h3>{name} · R{p.revision}</h3><p>以 {state.viewer.label} 的成员身份提交。</p>
  {operation==="publish"&&<><p>请核对分工与冻结参数，并展开每项“查看全部验收标准”。确认后，连接器将开始领取任务。方法、种子和字段范围在“协议 → 科研防漂移”配置；求和与独立参考在“协议 → 可执行科学检查”配置。</p><p>{p.scientificChecks?"已冻结可执行数值规则，发布后不能删除或放宽；检查失败时，评审同意也不能交接。":"本项目尚未配置可执行数值检查。发布后不能补加本轮规则；需要数值核验时，请先取消并配置。"}</p><ul className="rt-publish-tasks">{p.alignment?.tasks.map(t=><li key={t.key}><strong>{t.title}</strong><small>{p.team?.members.find(m=>m.agent.id===t.assigneeAgentId)?.label} 执行 → {p.team?.members.find(m=>m.agent.id===t.reviewerAgentId)?.label} 评审</small><PublishTaskChecks task={t}/><PublishTaskAcceptance task={t}/></li>)}</ul></>}
  {operation==="align"&&<p>根据成员已冻结的研究提案生成协议、分工和验收标准。</p>}
  {operation==="rework"&&<><p>这会重新执行本任务，并由另一成员重新评审；原成果与评审保留。若数值和方法不变、仅缺代码或原执行记录，请先取消，选择“补充证据复审”，避免重复计算。</p><label>返工说明<textarea aria-label="返工说明" maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/></label></>}
  {operation==="supplement-review"&&<><p>只适用于结果不变、补充来源或执行记录。原文件、数值检查与退回意见保留，仍由原独立评审者判断；同一成果仅一次。</p><label>补充证据与来源<textarea aria-label="补充证据与来源" maxLength={16000} value={note} onChange={e=>setNote(e.target.value)} placeholder="写明证据来源、对应原任务或线程；可粘贴原代码与日志，最多 16000 字符。不要填写密钥。"/></label><small>已填写 {note.length} / 16000 字符。没有记录的版本请如实说明，不用其他环境的版本补填。</small></>}
  {operation==="change"&&<label>新的研究目标或约束<textarea aria-label="研究变更说明" maxLength={8000} placeholder="说明要改变什么、为什么改变，以及预期影响。" value={note} onChange={e=>setNote(e.target.value)}/></label>}
  {operation==="decide"&&<label>选择处理方案<select aria-label="裁决方案" value={option} onChange={e=>setOption(e.target.value)}><option value="">请选择方案</option>{issue?.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>{issue?.options.filter(o=>o.id===option).map(o=><p key={o.id}>{o.impact}</p>)}</label>}
  {operation==="apply-change"&&<ChangeImpactSummary p={p} change={change}/>}
  {operation==="dismiss-change"&&<p>{change?.result?.rationale} 关闭后恢复变更前的研究阶段。</p>}
  {operation==="pause"&&<p>暂停新任务派发；已经启动的 Agent 运行仍会完成并被回收。</p>}
  {operation==="resume"&&<p>按当前协议恢复任务派发，继续核对已有运行。</p>}
  {operation==="retry"&&<><p>{retryRun?.kind==="REVIEW"?"只重新提交本次评审，保留原计算成果，不要求执行成员重新计算。新增研究要求应另走变更流程。":retryRun?.kind==="ALIGN"?"请核对下方遗漏项或格式错误；重试会把失败原因交给对齐 Agent，并继续使用原冻结提案。":"按原方法重新执行并重新检查，原失败文件保留。"}</p>{retryRun?.error&&<p className="rt-stale">{retryRun.error}</p>}{retryRun?.kind==="TASK"&&retryTask&&<p>本任务已执行 {retryTask.attempt} / 3 次；重试将使用下一次执行机会。请先核对方法和修复要求。</p>}<small>只允许重试已确定失败的运行；未知启动需先核对原记录。</small></>}
  {stale&&<p className="rt-stale" role="alert">项目已有更新，请取消后检查最新状态，再重新打开确认。</p>}
  {error&&<p className="rt-stale" role="alert">{error}</p>}
  <div className="rt-confirm-buttons"><button disabled={busy} onClick={()=>setExpanded(false)}>取消</button><button className="rt-primary" onClick={()=>void submit()} disabled={disabled||busy||stale||!snapshot||(operation==="decide"&&!option)||(["change","supplement-review"].includes(operation)&&!note.trim())}>{busy?"提交中…":`确认${name}`}</button></div>
 </section>}</div>;
}
