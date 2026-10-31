import {ResearchGovernanceEvidence} from "./ResearchGovernanceEvidence";
import {ScientificChecks,ScientificResult} from "./ScientificChecks";
import {reviewsForAttempt,sciencePALThreadUrl} from "./research-model";
import {ResearchConstraints} from "./ResearchConstraints";
import {ResultContract} from "./ResultContract";
import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import {ScientificEvidence} from "./ScientificEvidence";
import {replayArtifactUrl,type ReplayContext} from "./research-replay";
import {CodexTaskControl} from "./CodexTaskControl";
import type {LocalResearch} from "./ResearchTopBar";
import { useState } from "react";
import { ArrowRight, Check, Copy, FileDown, FileJson, History, ShieldCheck, X } from "lucide-react";
import { usedRunCount, projectNextActions, type SPNextAction, type SPProject, type SPTask, type SPRun } from "@vibe-git/protocol";
import { Markdown } from "../Markdown";
import { Avatar } from "../canvas/TopologyCanvas";
import { ResearchCommand, commandNames, type SendResearchCommand } from "./ResearchCommand";
import { connectionSummary, actionTarget, currentMemberRuns, jobLabels, memberForAgent, platformName, researchHandoffs, runLabels, taskActionText, taskDisplay, type ResearchTarget, type TeamState } from "./research-model";

export const artifactUrl=(p:SPProject,id:string,replay?:ReplayContext)=>replay?replayArtifactUrl(replay,id):`/api/sciencepal-team/projects/${encodeURIComponent(p.id)}/artifacts/${encodeURIComponent(id)}`;
export const evidenceUrl=(p:SPProject,replay?:ReplayContext)=>replay?replay.evidenceUrl:`/api/sciencepal-team/projects/${encodeURIComponent(p.id)}/evidence?revision=${p.revision}`;
function CopySteps({text,disabled=false}:{text:string;disabled?:boolean}){
  const [copied,setCopied]=useState(false),[error,setError]=useState("");
  return <><button className="rt-primary" disabled={disabled} onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setError("");}catch{setError("无法复制，请展开下方步骤手动复制。");}}}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"步骤已复制":"复制处理步骤"}</button>{error&&<p role="alert" className="rt-note">{error}</p>}<details><summary>查看本机处理步骤</summary><pre className="rt-code">{text}</pre></details></>;
}
function StartOwnConnector({local,projectId,disabled,onManage}:{local:LocalResearch;projectId:string;disabled:boolean;onManage:()=>void}){
 const [pending,setPending]=useState(false),[error,setError]=useState('');const canStart=local.info&&['stopped','error'].includes(local.info.runner.state);
 return <>{canStart?<button className="rt-primary" disabled={disabled||pending} onClick={async()=>{setPending(true);setError('');try{await local.call('start',{projectId});}catch(e){setError(e instanceof Error?e.message:'启动失败');}finally{setPending(false);}}}>{pending?'正在启动…':'启动本人连接器并领取'}</button>:<button disabled={disabled} onClick={onManage}>管理本人连接器</button>}{error&&<p role="alert">{error}</p>}<small>仅启动本人在本项目的 SciencePAL 任务，会使用本人账号额度；状态自动更新。</small></>;
}
export function SciencePALThreadEntry({run}:{run:SPRun|undefined}) {
 const url=sciencePALThreadUrl(run);
 return <><a href={url??"https://sciencepal.ai/dashboard"} target="_blank" rel="noreferrer">{url?"打开本次 SciencePAL 原线程 ↗":"打开 SciencePAL 查找原线程 ↗"}</a>
 <p>在原对话中补充信息，保持本人连接器运行；回答后会接回原任务，不要重新领取或新建项目。</p>
 {!url&&<p className="rt-note">尚未取得原线程地址。先在 SciencePAL 按任务内容找到原对话；连接器取得已核对的地址后，这里会自动变为直达入口。</p>}
 {run?.threadId&&<details><summary>查看原线程编号</summary><code>{run.threadId}</code></details>}</>;
}
export function CompletedDeliverables({p,open,replay}:{p:SPProject;open:(t:ResearchTarget)=>void;replay?:ReplayContext|undefined}) {
 if(p.phase!=='COMPLETED')return null;
 return <section className="rt-detail-section" aria-label="本轮交付"><h3>本轮交付 · R{p.revision}</h3><p>这里只列当前任务的获批文件。请结合成果正文与原协议核对研究问题、单位和适用限制。</p>
 {p.tasks.map(t=>{const execution=p.runs.find(r=>r.id===t.executionId),file=execution?.output;
  const available=t.status==='APPROVED'&&file?.id===t.artifactId;
  const review=execution?reviewsForAttempt(p,execution).find(r=>r.id===t.reviewId):undefined;
  return <div className="rt-attempt" key={t.key}><b>{t.title}</b>
   {available?<a href={artifactUrl(p,file!.id,replay)}>下载 {file!.filename} ↗</a>:<p className="rt-note">成果与批准记录未对应，请先核对证据清单。</p>}
   <small>{execution?.scientificValidation?.status==='PASSED'?'已通过所配置的数值检查':execution?.scientificValidation?.status==='FAILED'?'数值检查未通过，请核对记录':'未记录可执行数值检查，不代表数值已核验'}{t.carriedFrom?` · 沿用 R${t.carriedFrom.revision} 获批成果`:''}</small>
   {available&&review?.status==='COLLECTED'&&review.output&&<a href={artifactUrl(p,review.output.id,replay)}>查看绑定此成果的评审文件 ↗</a>}
   <button className="rt-text-button" onClick={()=>open({type:'task',id:t.key})}>查看结果、单位与限制</button>
  </div>;
 })}
 <details><summary>运行次数与费用说明</summary><p>本项目累计 {p.runs.length} 项作业、{usedRunCount(p)-p.runs.length} 次原线程续接，共占用 {usedRunCount(p)} / {p.maxRuns} 个运行名额，包含旧版、失败与已排队作业。</p><p>费用未获取；这些次数不能证明比手工交接更便宜或更快。</p></details>
 <small>这里只提供逐份下载，不含完整交付包。输入和代码是否齐全，请核对原任务产物及下方证据清单。</small></section>;
}
function ActionCard({action,p,open,stale,state,busy,send,onConnect,local}:{action:SPNextAction;p:SPProject;open:(t:ResearchTarget)=>void;stale:boolean;state:TeamState;busy:boolean;send:SendResearchCommand;onConnect:()=>void;local:LocalResearch}){
  const steps=taskActionText(p,action),run=p.runs.find(r=>r.id===action.runId);
  return <article className={`rt-action ${action.kind==="completed"?"complete":action.isMine?"mine":""}`}>
    <div className="rt-action-owner"><span>{action.kind==="completed"?"本轮已完成":action.isMine?"轮到我":`等待 ${action.ownerLabel}`}</span><small>{action.platform??"项目决策"}</small></div>
    <h3>{action.title}</h3><p>{action.operation==="reply"&&action.platform==="sciencepal"?"本任务正在等你的补充信息。答复后继续原线程；已有成果和任务记录保留。":action.detail}</p>{action.ownerNodeId&&action.platform&&<p className="research-blocker">{connectionSummary(state,p,action.ownerNodeId).label} · {connectionSummary(state,p,action.ownerNodeId).blocker}</p>}
    <button className="rt-text-button" onClick={()=>open(actionTarget(p,action))}>查看相关任务与成员 <ArrowRight size={13}/></button>
    {!state.replay&&action.isMine&&action.operation&&<div className="rt-action-steps">{state.browserCommands&&commandNames[action.operation]?<ResearchCommand p={p} state={state} operation={action.operation} body={action.body??{}} busy={busy} disabled={stale} send={send}/>:action.operation==="evidence"?<a className="rt-download" href={evidenceUrl(p,state.replay)} target="_blank" rel="noreferrer">打开本轮证据清单 ↗</a>:isLocalResearchPlatform(action.platform)&&action.runId&&state.localResearch&&["take","submit"].includes(action.operation)?<CodexTaskControl p={p} runId={action.runId} local={local} disabled={stale||busy}/>:action.operation==="work"&&state.localResearch?<><StartOwnConnector local={local} projectId={p.id} disabled={stale||busy} onManage={onConnect}/></>:action.operation==="reply"&&state.localResearch?<SciencePALThreadEntry run={run}/>:<><CopySteps text={steps} disabled={stale||busy}/><small>Agent 运行由本人连接器处理。保持连接器运行，界面会自动更新。</small></>}</div>}
  </article>;
}
function ContinuationEvidence({run}:{run:SPRun}){
 if(!run.continuations?.length)return null;
 return <details className="rt-continuation"><summary>原线程接续 {run.continuations.length} 次 · 查看前后运行</summary>{run.continuations.map(c=><div key={c.runId}><p>保留原线程；等待输入后新建一次运行。{new Date(c.at).toLocaleString('zh-CN',{hour12:false})}</p><code>Thread: {c.threadId}</code><code>原 Run: {c.previousRunId}</code><code>接续 Run: {c.runId}</code><small>来源：{c.source==='member-reply'?'本人连接器回复':'SciencePAL 原线程网页回复'}</small></div>)}</details>;
}
function TaskReview({task,p}:{task:SPTask;p:SPProject}){
  const reviewer=memberForAgent(p,task.reviewerAgentId);
  return <section className="rt-detail-section"><h3><ShieldCheck size={15}/> 独立评审 <span>{reviewer?.label??"待分配"}</span></h3>
    {task.review?<><div className={`rt-review-verdict ${task.status==="APPROVED"?"approved":"attention"}`}>{task.status==="APPROVED"?"通过 · 可以进入下游":task.status==="REVIEWING"?"复审进行中 · 以下保留上一轮意见":task.review.verdict==="approve"?"评审同意 · 仍须通过全部交接检查":"要求修改 · 下游暂不放行"}</div><p>{task.review.summary}</p>
      <ul className="rt-checks">{task.review.checks.map(c=><li key={c.criterion}><span className={c.passed?"approved":"attention"}>{c.passed?"✓":"!"}</span><div>{c.criterion}<small>{c.evidence}</small></div></li>)}</ul>
      {!!task.review.requiredChanges.length&&<div className="rt-required"><strong>需要修正</strong><ol>{task.review.requiredChanges.map(c=><li key={c}>{c}</li>)}</ol></div>}</>:<p className="rt-note">{task.reviewId?"已派发独立评审，等待评审成员交回结论。":"执行成果提交后，由另一位成员按原验收标准评审。"}</p>}
  </section>;
}
export function ResearchInspector({state,p,target,open,close,archived,stale,busy,send,onConnect,local}:{state:TeamState;p:SPProject;target:ResearchTarget;open:(t:ResearchTarget)=>void;close:()=>void;archived:boolean;stale:boolean;busy:boolean;send:SendResearchCommand;onConnect:()=>void;local:LocalResearch}){
  const next=projectNextActions(p,state.viewer.id),member=target.type==="member"?p.team?.members.find(m=>m.nodeId===target.id):undefined;
  const task=(target.type==="task"||target.type==="review")?p.tasks.find(t=>t.key===target.id):undefined;
  const handoff=target.type==="handoff"?researchHandoffs(p).find(h=>h.id===target.id):undefined;
  const title=target.type==="next"?"现在轮到谁":target.type==="protocol"?"冻结研究协议":target.type==="history"?"执行与返工记录":member?member.label:handoff?"文件交接":target.type==="review"?"评审与返工":task?.title??"详情已变化";
  return <aside className="inspector rt-inspector" aria-label="研究详情"><header className="inspector-heading"><div><small>R{p.revision} · {state.replay?"真实记录 · 只读":archived?"归档只读":"当前研究"}</small><h2>{title}</h2></div><button onClick={close} aria-label="收起详情"><X size={17}/></button></header>
    <nav className="inspector-tabs rt-inspector-nav" aria-label="详情视图"><button aria-pressed={target.type==="next"} onClick={()=>open({type:"next"})}>待办</button><button aria-pressed={target.type==="protocol"} onClick={()=>open({type:"protocol"})}>协议</button><button aria-pressed={target.type==="history"} onClick={()=>open({type:"history"})}>记录</button></nav>
    <div className="inspector-body rt-inspector-content">
      {stale&&<p className="rt-stale">连接未更新，以下为上次快照。刷新成功后再处理待办。</p>}
      {target.type==="next"&&(archived?<p className="rt-note">这是归档版本。切回当前版本查看待办，不会从旧版发起操作。</p>:<><CompletedDeliverables p={p} open={open} replay={state.replay}/>{next.actions.map((a,i)=><ActionCard key={`${p.id}:${p.revision}:${a.runId??a.operation}:${i}`} action={a} p={p} open={open} stale={stale} state={state} busy={busy} send={send} onConnect={onConnect} local={local}/>)}{state.browserCommands&&<section className="rt-detail-section"><h3>项目操作</h3>{state.viewer.id===p.team?.captainNodeId&&state.viewer.role==="captain"&&!p.paused&&p.phase!=="COMPLETED"&&<ResearchCommand p={p} state={state} operation="pause" disabled={stale} busy={busy} send={send}/>}{!p.paused&&["READY","COMPLETED","CHANGES_REQUESTED"].includes(p.phase)&&<ResearchCommand p={p} state={state} operation="change" disabled={stale} busy={busy} send={send}/>}</section>}<section className="rt-detail-section"><h3>交接原则</h3><p className="rt-note">成果通过已配置的数值检查和另一成员评审，带齐批准依据后才交给下游。未配置的检查不等于已核验，任务完成也不保证科学结论成立。</p></section></>)}
      {member&&<>
        <div className="rt-profile"><Avatar id={member.nodeId} captain={member.nodeId===p.team?.captainNodeId}/><div><strong>{member.label}</strong><span>{platformName(member.agent)} · {member.nodeId===state.viewer.id?"本人":"团队成员"}</span></div></div>
        <section className="rt-detail-section"><h3>连接与阻塞</h3><p>{connectionSummary(state,p,member.nodeId).blocker}</p>{!state.replay&&(isLocalResearchPlatform(member.agent.platform)?["panel"]:["panel","connector"]).map(channel=>{const c=connectionSummary(state,p,member.nodeId).presence?.[channel as "panel"|"connector"];return <div className="research-presence-row" key={channel}><strong>{channel==="panel"?"本人本机入口":"本项目连接器"}</strong><span className={c?.state==="online"?"success":"muted"}>{c?.state==="online"?"在线":c?.state==="offline"?"已停止 / 心跳超时":"未连接"}</span><small>{c?.reason??"尚无心跳记录"}{c?.lastSeen?` · 最近 ${new Date(c.lastSeen).toLocaleTimeString()}`:""}</small></div>;})}{!state.replay&&member.nodeId===state.viewer.id&&<button onClick={onConnect}>管理本人算力网与连接器</button>}<small>{state.replay?"回放未采集实时心跳，不将历史成员标成当前在线。":"打开浏览器不计作连接器在线；Codex 入口在线也不代表模型正在执行。"}</small></section>
        <section className="rt-detail-section"><h3>本人任务</h3>{p.tasks.filter(t=>t.assigneeAgentId===member.agent.id).map(t=><button className="rt-detail-link" key={t.key} onClick={()=>open({type:"task",id:t.key})}><span>{t.title}<small>{taskDisplay(p,t).label}</small></span><ArrowRight size={14}/></button>)}</section>
        <section className="rt-detail-section"><h3>负责评审</h3>{p.tasks.filter(t=>t.reviewerAgentId===member.agent.id).map(t=><button className="rt-detail-link" key={t.key} onClick={()=>open({type:"review",id:t.key})}><span>{t.title}<small>{t.review? t.review.verdict==="approve"?"已批准":"要求修改":"等待评审"}</small></span><ArrowRight size={14}/></button>)}</section>
        {!archived&&currentMemberRuns(p,member.nodeId).map(r=><div key={r.id} className="rt-mini-run"><b>{jobLabels[r.kind]}</b><span>{runLabels[r.status]}</span>{r.status==="NEEDS_INPUT"&&<p>本人在 SciencePAL 原线程回答，连接器随后接回。</p>}</div>)}
        <section className="rt-detail-section"><h3>冻结提案</h3>{p.proposals.filter(v=>v.ownerNodeId===member.nodeId).map(v=><details key={v.id}><summary>提案 r{v.documentRevision} · 查看原文</summary><Markdown>{v.content}</Markdown><code>{v.sha256}</code></details>)}</section>
      </>}
      {task&&<>
        <div className="rt-detail-status"><span className={`rt-pill tone-${taskDisplay(p,task).tone}`}>{taskDisplay(p,task).label}</span><small>{task.attempt?`第 ${task.attempt} 次执行`:"尚未开始"}</small></div>
        {task.carriedFrom&&<p className="rt-note">沿用 R{task.carriedFrom.revision} 的已批准成果。本次变更确认任务未受影响；原文件与独立评审仍需通过指纹校验。</p>}
        <p className="rt-people-line">{memberForAgent(p,task.assigneeAgentId)?.label} 执行 <ArrowRight size={12}/> {memberForAgent(p,task.reviewerAgentId)?.label} 评审</p>
        <ScientificResult report={p.runs.find(r=>r.id===task.executionId)?.scientificValidation}/>{target.type==="review"&&<TaskReview task={task} p={p}/>}<ScientificEvidence key={`${p.id}:${p.revision}:${task.key}:${task.artifactId}`} p={p} task={task} {...(state.replay?{replay:state.replay}:{})}/>
        <ResultContract schema={task.resultSchema} validation={p.runs.find(r=>r.id===task.executionId)?.resultValidation}/><section className="rt-detail-section"><h3>研究目标</h3><p>{task.goal}</p><details><summary>范围与验收标准</summary><p>{task.boundary}</p><ul>{task.acceptance.map(c=><li key={c}>{c}</li>)}</ul></details></section>
        <section className="rt-detail-section"><h3><FileJson size={15}/> 本轮成果</h3>{task.artifactId?<><a className="rt-download" href={artifactUrl(p,task.artifactId,state.replay)}><FileDown size={15}/>{task.outputFilename}</a>{task.status!=="APPROVED"&&<p className="rt-note">可查看成果；尚未通过评审，不代表已向下游放行。</p>}</>:<p className="rt-note">{p.runs.find(r=>r.id===task.executionId)?.output?"本轮原文件已保留在下方执行记录；未通过约束，不交给下游。":"尚未生成本轮成果文件。"}</p>}</section>
        {target.type!=="review"&&<TaskReview task={task} p={p}/>}
        <section className="rt-detail-section"><h3>关联交接</h3>{researchHandoffs(p).filter(h=>h.from.key===task.key||h.to.key===task.key).map(h=><button className="rt-detail-link" key={h.id} onClick={()=>open({type:"handoff",id:h.id})}><span>{h.filename}<small>{h.label}</small></span><ArrowRight size={14}/></button>)}</section>
        <section className="rt-detail-section"><h3><History size={15}/> 执行与返工版本</h3>{p.runs.filter(r=>r.revision===(task.carriedFrom?.revision??p.revision)&&r.taskKey===task.key&&r.kind==="TASK").map((r,i)=><div className="rt-attempt" key={r.id}><b>第 {i+1} 次</b><span>{runLabels[r.status]} · {platformName(r.agent)}</span><ContinuationEvidence run={r}/>{!state.replay&&sciencePALThreadUrl(r)&&<a href={sciencePALThreadUrl(r)!} target="_blank" rel="noreferrer">SciencePAL 原记录（需访问权限） ↗</a>}{r.output&&<a href={artifactUrl(p,r.output.id,state.replay)}>查看冻结文件 ↗</a>}{r.output&&reviewsForAttempt(p,r).map(v=><small key={v.id}>评审记录：{runLabels[v.status]}{v.output&&<> · <a href={artifactUrl(p,v.output.id,state.replay)}>查看评审文件</a></>}</small>)}</div>)}</section>
        {!archived&&task.status==="CHANGES_REQUESTED"&&<button className="rt-primary" onClick={()=>open({type:"next"})}>查看返工待办 <ArrowRight size={14}/></button>}
      </>}
      {handoff&&<>
        <div className={`rt-review-verdict ${handoff.tone}`}>{handoff.label}</div><h3 className="rt-file-title"><FileJson size={22}/>{handoff.filename}</h3>
        <p>{handoff.from.title} <ArrowRight size={12}/> {handoff.to.title}</p>
        <ol className="rt-handoff-steps">{[{label:"上游生成成果",passed:!!handoff.artifactId},{label:"独立评审通过",passed:handoff.from.status==="APPROVED"},{label:"下游收到对应文件",passed:handoff.state==="delivered"}].map(s=><li className={s.passed?"done":""} key={s.label}><i>{s.passed?"✓":"·"}</i>{s.label}</li>)}</ol>
        {handoff.state==="blocked"&&<p className="rt-required">上游需要返工。当前文件保留供核查，但不会作为获批成果继续流转。</p>}
        {handoff.artifactId&&<><a className="rt-download" href={artifactUrl(p,handoff.artifactId,state.replay)}><FileDown size={15}/>查看原始文件</a><details><summary>文件指纹与版本</summary><code>{p.runs.find(r=>r.output?.id===handoff.artifactId)?.output?.sha256}</code><p>研究协议 R{p.revision}；以冻结文件 ID 匹配实际下游输入，不按文件名推断交接成功。</p></details></>}
        <button className="rt-detail-link" onClick={()=>open({type:"review",id:handoff.from.key})}>查看上游评审 <ArrowRight size={14}/></button>
      </>}
      {target.type==="protocol"&&<>
<ResearchGovernanceEvidence p={p}/>
<ScientificChecks p={p} state={state} send={send} disabled={stale||busy||archived}/><ResearchConstraints p={p} state={state} send={send} disabled={stale||busy||archived}/>
        <div className="rt-review-verdict neutral">研究协议 R{p.revision} · {archived?"已归档":"当前快照"}</div><Markdown>{p.requirementMarkdown||p.alignment?.alignmentMarkdown||"提案已保存，等待对齐。"}</Markdown>
        {p.source&&<section className="rt-detail-section"><h3>研究数据</h3><p>{p.source.attribution}</p><p>{p.source.artifact.size} 字节 · 已冻结，后续任务复用原始文件</p><details><summary>查看文件校验详情</summary><small className="research-source-digest">SHA256：{p.source.artifact.sha256}</small></details><a className="rt-download" href={artifactUrl(p,p.source.artifact.id,state.replay)}>{p.source.artifact.filename}</a></section>}
        {!!p.alignment?.issues.length&&<section className="rt-detail-section"><h3>待裁决分歧</h3>{p.alignment.issues.map(i=><details key={i.id}><summary>{i.title} · {i.selectedOptionId?"已裁决":"待选择"}</summary>{i.options.map(o=><p key={o.id}><b>{o.label}</b>（{o.id}）<br/>{o.impact}</p>)}</details>)}</section>}
        <section className="rt-detail-section"><h3>原始提案</h3>{p.proposals.map(v=><details key={v.id}><summary>{p.team?.members.find(m=>m.nodeId===v.ownerNodeId)?.label} · r{v.documentRevision}</summary><Markdown>{v.content}</Markdown></details>)}</section>
        <p className="rt-note">发布、裁决和返工由项目队长在待办中确认。平台绑定与结果格式随项目冻结。</p>
      </>}
      {target.type==="history"&&<><p className="rt-note">保留各次执行和评审结果；本地回执与远端运行分别记录。</p>{state.replay&&<a href={state.replay.remoteEvidenceUrl} target="_blank" rel="noreferrer">核对远端运行原始查询记录 ↗</a>}{p.runs.filter(r=>r.revision===p.revision).map(r=><article className="rt-mini-run" key={r.id}><div><b>{jobLabels[r.kind]}{r.taskKey?` · ${r.taskKey}`:""}</b><span>{runLabels[r.status]}</span></div><small>{p.team?.members.find(m=>m.nodeId===r.ownerNodeId)?.label} · {platformName(r.agent)}</small><ContinuationEvidence run={r}/>{!state.replay&&sciencePALThreadUrl(r)&&<a href={sciencePALThreadUrl(r)!} target="_blank" rel="noreferrer">SciencePAL 原记录（需访问权限） ↗</a>}{r.error&&<p className="rt-stale">{r.error}</p>}{r.output&&<a href={artifactUrl(p,r.output.id,state.replay)}>{r.output.filename} ↗</a>}<details><summary>查看执行标识</summary><code>{r.localExecution?`本地执行：${r.localExecution.id}`:`远端线程：${r.threadId??"等待回执"}\n运行：${r.runId??"等待回执"}`}</code></details></article>)}</>}
    </div>
    <footer><a href={evidenceUrl(p,state.replay)} target="_blank" rel="noreferrer"><ShieldCheck size={14}/> 打开 R{p.revision} 证据清单 ↗</a></footer>
  </aside>;
}
