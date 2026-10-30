import {useEffect,useRef,useState} from 'react';
import type {SPProject} from '@vibe-git/protocol';
import type {LocalResearch} from './ResearchTopBar';
interface TaskInfo {projectId:string;runId:string;directory:string;instructions:string;outputPath:string;exists:boolean;prepared:boolean;outputExists:boolean;status:string}
/** Same right-hand action area; preparing files never launches or impersonates a model. */
export function CodexTaskControl({p,runId,local,disabled}:{p:SPProject;runId:string;local:LocalResearch;disabled:boolean}){
 const [info,setInfo]=useState<TaskInfo|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false);
 const run=p.runs.find(r=>r.id===runId);
 useEffect(()=>{const controller=new AbortController();let pending=false;const read=async()=>{if(pending)return;pending=true;try{const r=await fetch('/api/local/research/codex-task?'+new URLSearchParams({projectId:p.id,runId}),{signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'无法读取本人任务包');if(!controller.signal.aborted){setInfo(d);setReadError('');}}catch(e){if(!controller.signal.aborted)setReadError(e instanceof Error?e.message:'本机入口未连接');}finally{pending=false;}};void read();const timer=setInterval(()=>void read(),3000);return()=>{controller.abort();clearInterval(timer);};},[p.id,runId,run?.status]);
 const work=async(kind:'codex-take'|'codex-submit')=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{const d=await local.call(kind,{projectId:p.id,runId});if(kind==='codex-take'){setInfo(d);setMessage('任务包已准备，请交给本人 Codex 执行。');}else setMessage('成果已校验交回，等待独立评审。');}catch(e){setError(e instanceof Error?e.message:'操作失败，请核对当前状态；不会自动重试');}finally{lock.current=false;setBusy(false);}};
 const otherEntry=!!info&&!info.exists&&run?.status!=='READY';
 const prompt=info?`请读取本人科研任务包 ${info.instructions} 和 inputs/ 中全部冻结文件，完成本次${run?.kind==='REVIEW'?'独立评审':'任务'}。将完整 JSON envelope 保存到 ${info.outputPath}。保留输入与原任务目录，不替其他成员或队长操作。完成后告诉我，我会在 Vibe-Git 的本人待办检查并交回成果。`:'';
 return <section className="rt-command rt-local-task" aria-label="Codex 本人任务包">
  <p>在本人 Codex 完成计算或评审后，回到这里交回。准备任务包不会自动启动模型。</p>
  {otherEntry?<p className="rt-note">任务已从其他入口领取，请继续使用原来的 TASK.md 与目录，通过原入口 submit；不会创建第二份领取。</p>:!info?.prepared?<button className="rt-primary" disabled={disabled||busy||!local.info||!info} onClick={()=>void work('codex-take')}>{busy?'正在准备…':info?.exists?'恢复下载本人任务包':'准备本人任务包'}</button>:<>
   <button disabled={disabled||busy} onClick={()=>void navigator.clipboard.writeText(prompt).then(()=>setMessage('已复制给 Codex 的任务说明。')).catch(()=>setError('复制失败，请展开下方任务说明手动复制。'))}>复制给 Codex 的任务说明</button>
   <details><summary>本次任务文件与保存位置 · R{p.revision}</summary><small>说明文件</small><code>{info.instructions}</code><small>待交回成果</small><code>{info.outputPath}</code></details>
   <details><summary>查看给 Codex 的任务说明</summary><pre className="rt-code">{prompt}</pre></details>
   <p>{info.outputExists?'检测到成果文件，尚需校验并交回。':'等待 Codex 将成果写入上述文件，页面会自动检查。'}</p>
   <button className="rt-primary" disabled={disabled||busy||!info.outputExists} onClick={()=>void work('codex-submit')}>{busy?'正在校验…':'检查并交回成果'}</button>
  </>}
  {(error||readError)&&<p className="rt-stale" role="alert">{error||readError}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
