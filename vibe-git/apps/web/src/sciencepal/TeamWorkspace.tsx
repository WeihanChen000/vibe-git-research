import {useResearchReplay,ResearchReplayControls} from "./ResearchReplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FlaskConical, GitBranch, List, Network, PanelRightOpen, RefreshCw } from "lucide-react";
import { projectNextActions } from "@vibe-git/protocol";
import { Avatar } from "../canvas/TopologyCanvas";
import { ResearchTopology } from "./ResearchTopology";
import { ResearchInspector } from "./ResearchInspector";
import { memberForAgent, phaseLabels, stageProject, taskLabels, taskTone, type ResearchTarget, type TeamState } from "./research-model";
import "./research-topology.css";
import {ResearchTopBar,useResearchLocal} from "./ResearchTopBar";
import {ResearchRoom} from "./ResearchRoom";
import {ResearchGantt} from "./ResearchGantt";
import { commandNames, type SendResearchCommand } from "./ResearchCommand";
export function TeamWorkspace() {
 const [liveState,setState]=useState<TeamState|null>(null),[liveError,setError]=useState(""),[selected,setSelected]=useState("");
 const [replayMode]=useState(()=>import.meta.env.VITE_PUBLIC_REPLAY==="1"||new URLSearchParams(location.search).get("replay")==="1");const replay=useResearchReplay(replayMode);const state=replayMode?replay.state:liveState,error=replayMode?replay.error:liveError;
 const [revision,setRevision]=useState<number|null>(null),[target,setTarget]=useState<ResearchTarget>({type:"next"}),[panel,setPanel]=useState(true);
 const [view,setViewState]=useState<"graph"|"list">(new URLSearchParams(location.search).get("view")==="gantt"?"list":"graph"),[relations,setRelations]=useState<"all"|"handoffs">("all");
 const [updated,setUpdated]=useState(""),[busy,setBusy]=useState(false),[refreshKey,setRefreshKey]=useState(0);
 const toggle=useRef<HTMLButtonElement>(null);
 const refresh=useCallback(()=>setRefreshKey(k=>k+1),[]);const local=useResearchLocal(refresh,!replayMode);const [topPanel,setTopPanel]=useState("");
 useEffect(()=>{if(topPanel)replay.pause();},[topPanel,replay.pause]);
 const commandLock=useRef(false);const [commandBusy,setCommandBusy]=useState(false),[notice,setNotice]=useState("");
 useEffect(()=>{
  if(replayMode){document.title="Vibe-Git · 真实科研案例回放";return;}
  document.title="Vibe-Git · 多人科研协作";const controller=new AbortController();let pending=false;
  async function refresh(){if(pending)return;pending=true;setBusy(true);try{
   const response=await fetch("/api/sciencepal-team/state",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
   if(!response.ok)throw new Error([401,403].includes(response.status)?"请运行 research:open，打开本人本机工作区。":"团队状态读取失败，请稍后刷新。");
   const data=await response.json();if(controller.signal.aborted)return;setState(data);setError("");setUpdated(new Date().toLocaleTimeString("zh-CN",{hour12:false}));
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"连接失败");}finally{pending=false;if(!controller.signal.aborted)setBusy(false);}}
  void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},5000);return()=>{controller.abort();clearInterval(timer);};
 },[refreshKey,replayMode]);
 const setView=(v:"graph"|"list")=>{replay.pause();setViewState(v);const u=new URL(location.href);u.searchParams.set("view",v==="list"?"gantt":"topology");history.pushState(null,"",u);};
 const open=useCallback((t:ResearchTarget)=>{replay.pause();const u=new URL(location.href);u.searchParams.set("object",t.type);if("id" in t)u.searchParams.set("id",t.id);else u.searchParams.delete("id");history.pushState(null,"",u);setTarget(t);setPanel(true);if(window.innerWidth<=760)requestAnimationFrame(()=>document.querySelector(".rt-inspector")?.scrollIntoView({block:"start"}));},[replay.pause]);
 useEffect(()=>{if(!replay.step)return;setRevision(null);setTarget(replay.step.focus);setPanel(true);const u=new URL(location.href);u.searchParams.set("object",replay.step.focus.type);if("id" in replay.step.focus)u.searchParams.set("id",replay.step.focus.id);else u.searchParams.delete("id");history.replaceState(null,"",u);},[replay.bundle?.id,replay.step?.id]);
 const close=useCallback(()=>{const u=new URL(location.href);u.searchParams.delete("object");u.searchParams.delete("id");history.pushState(null,"",u);setPanel(false);toggle.current?.focus();},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[close]);
 useEffect(()=>{const read=()=>{const q=new URLSearchParams(location.search),type=q.get("object"),id=q.get("id");setViewState(q.get("view")==="gantt"?"list":"graph");if(type&&["next","protocol","history","member","task","review","handoff"].includes(type)){setTarget(id?{type,id} as ResearchTarget:{type} as ResearchTarget);setPanel(true);}else setPanel(false);};const q=new URLSearchParams(location.search);if(q.has("object"))read();window.addEventListener("popstate",read);return()=>window.removeEventListener("popstate",read);},[]);
 const current=state?.projects.find(p=>p.id===selected)??state?.projects[0];
 const p=useMemo(()=>current?stageProject(current,revision??current.revision):undefined,[current,revision]);
 const archived=!!p&&!!current&&p.revision!==current.revision;
 const next=useMemo(()=>p&&state?projectNextActions(p,state.viewer.id):undefined,[p,state]);
 const owners=useMemo(()=>archived?[]:[...new Set(next?.actions.filter(a=>a.kind!=="completed").flatMap(a=>a.ownerNodeId?[a.ownerNodeId]:[])??[])],[next,archived]);
 const send:SendResearchCommand=async(operation,body,snapshot)=>{
  if(commandLock.current)throw new Error("已有操作正在提交，请等待结果。");
  if(replayMode||!state?.csrfToken||!p||archived||error)throw new Error("当前不能操作，请刷新并返回当前版本。");
  commandLock.current=true;setCommandBusy(true);setNotice("");
  try{
   let response:Response;
   try{response=await fetch(`/api/sciencepal-team/projects/${encodeURIComponent(p.id)}/commands/${operation}`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Vibe-CSRF":state.csrfToken},body:JSON.stringify({...body,expectedState:snapshot}),signal:AbortSignal.timeout(15000)});}catch{throw new Error("提交结果尚未确认，请刷新核对状态；不会自动重试。");}
   const data=await response.json();if(!response.ok)throw new Error(data.error||"操作未完成，请刷新后核对。");
   setNotice(`${commandNames[operation]??operation}操作已提交，进度以当前任务状态为准。`);setRevision(null);
  }finally{commandLock.current=false;setCommandBusy(false);setRefreshKey(k=>k+1);}
 };
 const approved=p?.tasks.filter(t=>t.status==="APPROVED").length??0;
 return <div className="rt-shell">
  <ResearchTopBar state={state} {...(p?{p}:{})} view={view} setView={setView} open={open} local={local} panel={topPanel} setPanel={setTopPanel} sync={replayMode?"真实记录回放":local.info&&!local.info.configured?"等待加入":error?"正在重连":state?"已同步":"等待接入"} refresh={refresh}/>
  {replayMode&&<ResearchReplayControls replay={replay} onBrief={()=>setTopPanel("project")}/>}
  {!replayMode&&<div className="rt-replay-entry"><a href="/sciencepal/team?replay=1&case=1crn&step=completed">回放真实科研案例 ↗</a><small>通用科研协作 · 查看 1CRN / Iris 示例</small></div>}
  {state?.interactiveSimulation?<div className="rt-preview">{state.simulationDescription??'可操作模拟 · 真实成员权限与流程，Agent 输出为合成结果，不调用真实模型'}</div>:state?.preview&&<div className="rt-preview">模拟演示 · 使用真实协作状态机，未调用真实 Agent <span><a href="?scene=repair">评审退回</a><a href="?scene=completed">返工后完成</a></span></div>}
  {p&&state?<>
   <section className="rt-projectbar"><div><div className="rt-eyebrow"><FlaskConical size={13}/> TEAM RESEARCH <span> / </span>{p.team?.members.length??0} 位成员 · 各自的 Agent</div>{state.projects.length>1?<select aria-label="切换研究项目" value={current!.id} onChange={e=>{setSelected(e.target.value);setRevision(null);open({type:"next"});}}>{state.projects.map(v=><option value={v.id} key={v.id}>{v.title}</option>)}</select>:<h1>{p.title}</h1>}<p>{archived?"归档快照 · 只读":(phaseLabels[p.phase]??p.phase)+(p.paused?" · 已暂停":"")}</p></div><div className="rt-project-actions"><div className="rt-progress"><span><b>{approved}</b> / {p.tasks.length} 项通过评审</span><progress max={Math.max(1,p.tasks.length)} value={approved}/></div><select aria-label="研究协议版本" value={p.revision} onChange={e=>{setRevision(Number(e.target.value));open({type:"next"});}}>{[current!.revision,...current!.history.map(h=>h.revision)].filter((n,i,a)=>a.indexOf(n)===i).sort((a,b)=>b-a).map(r=><option key={r} value={r}>协议 R{r}{r===current!.revision?" · 当前":" · 归档"}</option>)}</select><button onClick={()=>open({type:"protocol"})}>查看协议 <ArrowRight size={13}/></button></div></section>
   {notice&&p.phase!=="COMPLETED"&&<div className="rt-command-notice" role="status">{notice}</div>}
   {error&&<div role="alert" className="rt-error-banner">{error} 当前显示上次快照。</div>}
   <div className={`rt-workspace ${panel?"with-inspector":""}`}><main className="rt-main"><div className="rt-canvas-toolbar"><div className="rt-segment"><button aria-pressed={relations==="all"} onClick={()=>setRelations("all")}>全部关系</button><button aria-pressed={relations==="handoffs"} onClick={()=>setRelations("handoffs")}>只看文件交接</button></div><button ref={toggle} className="rt-turn-button" onClick={()=>open({type:"next"})}><PanelRightOpen size={14}/>{archived?"归档记录":p.phase==="COMPLETED"?"本轮已完成 · 查看证据":`现在轮到谁 · ${next?.actions.filter(a=>a.kind!=="completed").length??0}`}</button></div><div className="rt-canvas">{view==="graph"?<ResearchTopology key={`${p.id}:${p.revision}`} state={state} project={p} target={target} open={open} owners={owners} relations={relations} archived={archived}/>:<ResearchGantt p={p} viewerId={state.viewer.id} open={open}/>}</div><footer className="rt-canvas-footer"><span><i className="approved"/>已通过 / 已交接</span><span><i className="active"/>执行中</span><span><i className="attention"/>需处理 / 返工</span><small>{replayMode?"历史状态 · 不读取当前账号":`上次更新 ${updated}`}</small></footer></main>{panel&&<ResearchInspector local={local} state={state} p={p} target={target} open={open} close={close} onConnect={()=>setTopPanel("compute")} archived={archived} stale={!!error} busy={commandBusy} send={send}/>}</div>
  </>:replayMode?<main className="rt-empty"><h1>{error?"回放暂不可用":"正在读取真实案例…"}</h1><p role={error?"alert":undefined}>{error||"仅加载已保存的真实记录，不启动模型。"}</p>{error&&<button onClick={()=>location.reload()}>重新读取回放</button>}</main>:state?<ResearchRoom state={state} onPanel={setTopPanel} view={view}/>:local.info&&!local.info.configured?<main className="rt-empty"><FlaskConical size={38}/><h1>加入队友的科研工作区</h1><p>本人入口已就绪。粘贴队长邀请后，在算力网选择自己的 Agent，再提交研究提案。</p><button onClick={()=>setTopPanel("join")}>填写邀请链接</button></main>:<main className="rt-empty"><FlaskConical size={38}/><h1>{error?"连接成员工作区":state?"从每个人的研究提案开始":"正在读取团队项目…"}</h1><p role={error?"alert":undefined}>{error||(state?"成员绑定自己的 Codex 或 SciencePAL，提交提案，由队长创建共同研究项目。":"正在获取成员身份、任务和文件交接记录。")}</p>{(error||state)&&<><pre>npm run research:open</pre><p>在已配置本人身份的接入包目录运行，打开返回的会话地址。</p><button onClick={()=>setTopPanel(local.info?.configured?"project":"join")}>{local.info?.configured?"建立科研项目":"加入协作房间"}</button></>}</main>}
 </div>;
}
