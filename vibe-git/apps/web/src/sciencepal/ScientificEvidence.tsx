import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import {useEffect,useState} from 'react';
import {type SPProject,type SPTask} from '@vibe-git/protocol';
import type {ReplayContext,ReplayScienceReport} from './research-replay';
import {scienceResult,independentEvidence} from './scientific-evidence';
export async function verifiedJson(url:string,sha256:string,size:number,signal:AbortSignal,kind='成果'){
 let res:Response,b:ArrayBuffer;
 try{res=await fetch(url,{signal,credentials:'same-origin'});b=await res.arrayBuffer();}
 catch{throw Error(signal.aborted?kind+'读取超时或已取消，请稍后重新读取。':'暂时无法连接'+kind+'文件，请检查本机入口或连接后重新读取。');}
 if(res.status===404)throw Error('已绑定的'+kind+'文件不存在，请联系队长核对文件位置；当前不能确认其内容。');
 if(!res.ok)throw Error('无法读取'+kind+'文件，请核对当前成员权限及文件是否可用。');
 if(b.byteLength!==size||b.byteLength>5*1024*1024)throw Error('证据字节数与冻结记录不符');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(digest!==sha256)throw Error('证据哈希与冻结记录不符');return JSON.parse(new TextDecoder().decode(b));
}
export async function loadIndependentVerification(url:string,file:{sha256:string;size:number},proof:ReplayScienceReport,signal:AbortSignal){
 await verifiedJson(url,file.sha256,file.size,signal);
 return independentEvidence(await verifiedJson(proof.url,proof.sha256,proof.size,signal,'复核记录'),file.sha256,proof.reviewArtifactId);
}
export function ProofReadStatus({bound,error,onRetry}:{bound:boolean;error:string;onRetry:()=>void}){
 if(!bound)return <p className="rt-note">此处尚未绑定单独的结构化复核报告。请结合下方评审及其原始文件核对复算材料；评审通过本身不等于独立复现。</p>;
 if(!error)return <p role="status">正在读取并核验绑定的复核记录…</p>;
 return <><p role="alert" className="rt-stale">{error} 原成果保留，复核状态暂不能确认。</p><button onClick={onRetry}>重新读取复核记录</button><small>重新校验原成果及绑定记录的哈希，不启动 Agent 或重新计算。文件缺失或校验不符时，请队长核对，不能按复核通过处理。</small></>;
}
export function ScientificEvidence({p,task,replay}:{p:SPProject;task:SPTask;replay?:ReplayContext}){
 const run=p.runs.find(r=>r.id===task.executionId),file=run?.output;
 const applicable=!!run;
 const proof=replay?.scienceReports?.find(r=>r.artifactId===file?.id&&r.candidateSha256===file.sha256);
 const url=file?(replay?replay.files[file.id]?.url:`/api/sciencepal-team/projects/${encodeURIComponent(p.id)}/artifacts/${encodeURIComponent(file.id)}`):undefined;
 const [reload,setReload]=useState(0),[proofReload,setProofReload]=useState(0);
 const [data,setData]=useState<ReturnType<typeof scienceResult>|null>(null),[verification,setVerification]=useState<ReturnType<typeof independentEvidence>|null>(null),[error,setError]=useState(''),[proofError,setProofError]=useState('');
 useEffect(()=>{setData(null);setError('');if(!applicable||!file||!url)return;const c=new AbortController();const signal=AbortSignal.any([c.signal,AbortSignal.timeout(10000)]);
 void verifiedJson(url,file.sha256,file.size,signal).then(raw=>{if(!c.signal.aborted)setData(scienceResult(raw));}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'证据不可用');});return()=>c.abort();
 },[applicable,url,file?.sha256,file?.size,reload]);
 useEffect(()=>{setVerification(null);setProofError('');if(!data||!file||!url||!proof)return;const c=new AbortController();const signal=AbortSignal.any([c.signal,AbortSignal.timeout(10000)]);
 void loadIndependentVerification(url,file,proof,signal).then(checked=>{if(!c.signal.aborted)setVerification(checked);}).catch(e=>{if(!c.signal.aborted)setProofError(e instanceof Error?e.message:'复核记录不可用');});return()=>c.abort();
 },[data,url,file?.sha256,file?.size,proof?.url,proof?.sha256,proof?.size,proof?.reviewArtifactId,proofReload]);
 if(!applicable)return null;
 return <section className="rt-detail-section" aria-label="科研方法与复核证据"><h3>科研方法与复核证据</h3>
 {!file?<p>本阶段尚未交回成果，方法与结果尚未验证。</p>:error?<><p role="alert" className="rt-stale">{error} 原成果未修改，暂时不能显示核验结果。</p><button onClick={()=>setReload(n=>n+1)}>重新读取并核验成果</button><small>仅重新下载并校验原文件，不启动 Agent 或重新计算。</small></>:!data?<p>正在核对原始成果字节…</p>:<>
 <p><b>{run.agent.name} · {researchPlatformName(run.agent.platform??'sciencepal')}</b></p>
 {data.method?<><p>{data.method.tools.map(t=>[t.name,t.version].filter(Boolean).join(' ')).join('；')||'未报告工具'}<br/>{data.method.parameters.slice(0,2).map(v=>`${v.name} ${v.value}${v.unit?' '+v.unit:''}`).join(' · ')}</p>{data.method.measurements.map((m,i)=><p key={i}><b>{m.name}：{Number(m.value.toPrecision(10))} {m.unit}</b></p>)}</> :data.reportedTools.length?<><p>{data.reportedMethod}<br/>{data.reportedTools.map(t=>`${t.name} ${t.version}`).join('；')}</p>{data.reportedValues.map(v=><p key={v.name}><b>{v.name}：{Number(v.value.toPrecision(10))}</b></p>)}<p className="rt-note">以上为产物原字段与自报工具版本；字段名保留原样，单位和含义以冻结协议为准。</p></>:<p className="rt-note">未提供结构化方法记录，请从原始成果与评审核查。不同研究可按协议交付自己的工具、参数和指标。</p>}
 <h4>独立复核证据</h4>{verification?<><p className={verification.passed?'success':'rt-stale'}>{verification.passed?'已有独立重算记录 · 通过冻结容差':'独立重算记录未通过'}</p>{verification.metrics.slice(0,1).map(m=><p key={m.name}>参考 {m.name}：{Number(m.reference.toPrecision(10))} {m.unit}<br/>差异 {m.comparison==='relative'?(m.difference*100).toFixed(5)+'%':Number(m.difference.toPrecision(6))+' '+m.unit} · 容差 {m.comparison==='relative'?m.tolerance*100+'%':m.tolerance+' '+m.unit}</p>)}<details><summary>查看方法与全部复核指标</summary><p>{verification.method}</p>{verification.metrics.map((m,i)=><p key={i}>{m.name}：产物 {Number(m.observed.toPrecision(8))} / 参考 {Number(m.reference.toPrecision(8))} {m.unit}；{m.difference<=m.tolerance?'符合容差':'超出容差'}</p>)}</details><a href={proof!.url}>打开绑定此成果的复核记录 ↗</a></>:<ProofReadStatus bound={!!proof} error={proofError} onRetry={()=>setProofReload(n=>n+1)}/>}
 <details><summary>查看代码、工具日志与参数</summary>{data.method?.parameters.map((v,i)=><p key={i}>{v.name}：{String(v.value)} {v.unit}</p>)}{data.hasCode?<pre className="rt-code">{data.code}</pre>:<p>此产物未提供可展示的代码；是否需要代码由研究协议决定。</p>}{data.method?.tools.map((t,i)=><div key={i}><b>{t.name} {t.version}</b><pre className="rt-code">{t.log||'未提供工具日志'}</pre></div>)}{!data.method&&data.rawLog&&<pre className="rt-code">{data.rawLog}</pre>}{run.threadId&&<code>SciencePAL Thread: {run.threadId}</code>}{run.runId&&<code>Run: {run.runId}</code>}</details>
 <details><summary>证据来源与结论边界</summary><p>已校验成果文件哈希。工具使用由产物报告，独立复算记录另行绑定；不代表当前在线环境或科学认证。不会执行展示的代码。</p>{data.method?.limitations.map((v,i)=><p key={i}>{v}</p>)}<code>{file.sha256}</code></details>
 </>}
 </section>;
}
