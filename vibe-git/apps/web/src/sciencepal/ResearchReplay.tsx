import {useCallback,useEffect,useState} from 'react';
import {Pause,Play,ChevronLeft,ChevronRight} from 'lucide-react';
import {parseReplay,replayState,replayCases,replayCaseId,type ReplayCaseId,type ResearchReplay} from './research-replay';
export function useResearchReplay(enabled:boolean){
 const [caseId,setCaseId]=useState<ReplayCaseId>(()=>replayCaseId(new URLSearchParams(location.search).get('case')));
 const [bundle,setBundle]=useState<ResearchReplay|null>(null),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!enabled)return;setBundle(null);setError('');setPlaying(false);const controller=new AbortController();void fetch(`/research-replay/${caseId}/case.json`,{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('未找到真实案例回放文件，请更新接入包并重新构建。');const b=parseReplay(await r.json());if(b.id!==caseId)throw Error('回放案例与请求不匹配');if(controller.signal.aborted)return;setBundle(b);setIndex(Math.max(0,b.steps.findIndex(s=>s.id===new URLSearchParams(location.search).get('step'))));}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'回放读取失败');});return()=>controller.abort();},[enabled,caseId]);
 const switchCase=(id:ReplayCaseId)=>{setPlaying(false);if(id===caseId)return;const u=new URL(location.href);u.searchParams.set('case',id);for(const key of ['step','object','id'])u.searchParams.delete(key);history.pushState(null,'',u);setCaseId(id);};
 useEffect(()=>{const back=()=>{setPlaying(false);setCaseId(replayCaseId(new URLSearchParams(location.search).get('case')));};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
 const select=useCallback((value:number,push=true)=>{if(!bundle)return;const next=Math.max(0,Math.min(bundle.steps.length-1,value));setIndex(next);const url=new URL(location.href);url.searchParams.set('step',bundle.steps[next]!.id);if(push)history.pushState(null,'',url);},[bundle]);
 useEffect(()=>{if(!bundle)return;const back=()=>{setPlaying(false);setIndex(Math.max(0,bundle.steps.findIndex(s=>s.id===new URLSearchParams(location.search).get('step'))));};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[bundle]);
 useEffect(()=>{if(!playing||!bundle)return;if(index>=bundle.steps.length-1){setPlaying(false);return;}const timer=setTimeout(()=>select(index+1),9000);return()=>clearTimeout(timer);},[playing,bundle,index,select]);
 const pause=useCallback(()=>setPlaying(false),[]);
 useEffect(()=>{if(!enabled)return;const hide=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[enabled,pause]);
 return {bundle,index,caseId,switchCase,step:bundle?.steps[index],state:bundle?replayState(bundle,index):null,playing,error,pause,select:(n:number)=>{pause();select(n);},play:()=>{if(bundle&&index===bundle.steps.length-1)select(0);setPlaying(v=>!v);}};
}
export function ResearchReplayControls({replay,onBrief}:{replay:ReturnType<typeof useResearchReplay>;onBrief:()=>void}){
 if(!replay.bundle||!replay.step)return null;const {bundle,index,step}=replay;
 return <section className="rt-replay-controls" aria-label="真实科研案例回放">
  <div className="rt-replay-navigation"><strong>真实案例回放 · 只读</strong><select aria-label="回放案例" value={replay.caseId} onChange={e=>replay.switchCase(e.target.value as ReplayCaseId)}>{Object.entries(replayCases).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</select><button aria-label="上一阶段" disabled={index===0} onClick={()=>replay.select(index-1)}><ChevronLeft size={14}/></button><button onClick={replay.play}>{replay.playing?<Pause size={14}/>:<Play size={14}/>} {replay.playing?'暂停回放':index===bundle.steps.length-1?'从头播放':'自动播放'}</button><button aria-label="下一阶段" disabled={index===bundle.steps.length-1} onClick={()=>replay.select(index+1)}><ChevronRight size={14}/></button><select aria-label="回放阶段" value={index} onChange={e=>replay.select(Number(e.target.value))}>{bundle.steps.map((s,i)=><option key={s.id} value={i}>{i+1} / {bundle.steps.length} · {s.title}</option>)}</select></div>
  <div className="rt-replay-purpose"><span>{replayCases[bundle.id].purpose}</span><button onClick={onBrief}>案例与证据说明</button></div>
  <p aria-live="polite">{step.summary}</p><small>{step.origin==='captured-snapshot'?'原始阶段快照':'依据真实续接回执重建'} · {new Date(step.observedAt).toLocaleString('zh-CN',{hour12:false})} · 单账号跨平台测试；点击节点、打开顶部说明或切换视图会暂停；自动播放每阶段 9 秒。</small>
 </section>;
}
