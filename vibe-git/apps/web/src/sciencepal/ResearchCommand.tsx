import { useRef, useState } from "react";
import type { SPProject } from "@vibe-git/protocol";
import type { TeamState } from "./research-model";
import { Markdown } from "../Markdown";
export type SendResearchCommand = (operation:string,body:Record<string,unknown>,snapshot:string)=>Promise<void>;
export const commandNames:Record<string,string>={align:"启动协议对齐",publish:"发布研究任务",rework:"安排返工",decide:"确认裁决",retry:"重试失败任务",pause:"暂停派发",resume:"恢复派发",change:"提出研究变更","apply-change":"应用研究变更","dismiss-change":"关闭变更"};
export function ResearchCommand({p,state,operation,body={},busy,disabled,send}:{p:SPProject;state:TeamState;operation:string;body?:Record<string,unknown>;busy:boolean;disabled:boolean;send:SendResearchCommand}){
 const [expanded,setExpanded]=useState(false),[snapshot,setSnapshot]=useState(""),[error,setError]=useState("");
 const [note,setNote]=useState(""),[option,setOption]=useState("");const immediate=useRef(false);
 const task=p.tasks.find(t=>t.key===body.taskKey),issue=p.alignment?.issues.find(i=>i.id===body.issueId),change=p.changes.find(c=>c.id===body.changeId);
 const name=commandNames[operation],stale=expanded&&snapshot!==state.commandSnapshots?.[p.id];
 if(!name||!state.browserCommands||!state.csrfToken)return null;
 const begin=()=>{setSnapshot(state.commandSnapshots?.[p.id]??"");setExpanded(true);setError("");setOption("");setNote(operation==="rework"?task?.review?.requiredChanges.join("\n")??"":"");};
 const submit=async()=>{if(immediate.current)return;immediate.current=true;setError("");try{
  await send(operation,{...body,revision:p.revision,...(operation==="rework"?{note}:operation==="change"?{request:note}:operation==="decide"?{optionId:option}:{})},snapshot);setExpanded(false);
 }catch(e){setError(e instanceof Error?e.message:"操作失败，请刷新核对状态。");}finally{immediate.current=false;}};
 return <div className="rt-command">{!expanded?<button className="rt-primary" disabled={disabled||busy} onClick={begin}>{name}</button>:<section className="rt-confirm" aria-label={name+"确认"}>
  <h3>{name} · R{p.revision}</h3><p>以 {state.viewer.label} 的成员身份提交。</p>
  {operation==="publish"&&<><p>确认以下分工与验收后，连接器将开始领取任务。</p><ul className="rt-publish-tasks">{p.alignment?.tasks.map(t=><li key={t.key}><strong>{t.title}</strong><small>{p.team?.members.find(m=>m.agent.id===t.assigneeAgentId)?.label} 执行 → {p.team?.members.find(m=>m.agent.id===t.reviewerAgentId)?.label} 评审</small><ul>{t.acceptance.map(a=><li key={a}>{a}</li>)}</ul></li>)}</ul></>}
  {operation==="align"&&<p>根据成员已冻结的研究提案生成协议、分工和验收标准。</p>}
  {operation==="rework"&&<><p>原成果与评审保留。任务返工后仍须由另一成员重新评审。</p><label>返工说明<textarea aria-label="返工说明" maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/></label></>}
  {operation==="change"&&<label>新的研究目标或约束<textarea aria-label="研究变更说明" maxLength={8000} placeholder="说明要改变什么、为什么改变，以及预期影响。" value={note} onChange={e=>setNote(e.target.value)}/></label>}
  {operation==="decide"&&<label>选择处理方案<select aria-label="裁决方案" value={option} onChange={e=>setOption(e.target.value)}><option value="">请选择方案</option>{issue?.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>{issue?.options.filter(o=>o.id===option).map(o=><p key={o.id}>{o.impact}</p>)}</label>}
  {operation==="apply-change"&&<><p>{change?.result?.rationale}</p><p>影响任务：{change?.result?.affectedTaskKeys.join("、")}</p><details><summary>查看评审后的新研究要求</summary><Markdown>{change?.result?.requirementMarkdown??""}</Markdown></details><p>确认后进入 R{p.revision+1}，旧版本归档，新版本重新对齐。</p></>}
  {operation==="dismiss-change"&&<p>{change?.result?.rationale} 关闭后恢复变更前的研究阶段。</p>}
  {operation==="pause"&&<p>暂停新任务派发；已经启动的 Agent 运行仍会完成并被回收。</p>}
  {operation==="resume"&&<p>按当前协议恢复任务派发，继续核对已有运行。</p>}
  {operation==="retry"&&<p>仅重试已确定失败的任务；保留原记录，未知启动不能通过此操作重发。</p>}
  {stale&&<p className="rt-stale" role="alert">项目已有更新，请取消后检查最新状态，再重新打开确认。</p>}
  {error&&<p className="rt-stale" role="alert">{error}</p>}
  <div className="rt-confirm-buttons"><button disabled={busy} onClick={()=>setExpanded(false)}>取消</button><button className="rt-primary" onClick={()=>void submit()} disabled={disabled||busy||stale||!snapshot||(operation==="decide"&&!option)||(operation==="change"&&!note.trim())}>{busy?"提交中…":`确认${name}`}</button></div>
 </section>}</div>;
}
