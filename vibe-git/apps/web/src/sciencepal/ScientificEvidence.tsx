import {useEffect,useState} from 'react';
import {type SPProject,type SPTask} from '@vibe-git/protocol';
import type {ReplayContext} from './research-replay';
import {scienceResult,independentEvidence} from './scientific-evidence';
async function verifiedJson(url:string,sha256:string,size:number,signal:AbortSignal){
 const res=await fetch(url,{signal,credentials:'same-origin'});if(!res.ok)throw Error('无法读取证据文件');
 const b=await res.arrayBuffer();if(b.byteLength!==size||b.byteLength>5*1024*1024)throw Error('证据字节数与冻结记录不符');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(digest!==sha256)throw Error('证据哈希与冻结记录不符');return JSON.parse(new TextDecoder().decode(b));
}
export function ScientificEvidence({p,task,replay}:{p:SPProject;task:SPTask;replay?:ReplayContext}){
 const run=p.runs.find(r=>r.id===task.executionId),file=run?.output;
 const applicable=!!run;
 const proof=replay?.scienceReports?.find(r=>r.artifactId===file?.id&&r.candidateSha256===file.sha256);
 const url=file?(replay?replay.files[file.id]?.url:`/api/sciencepal-team/projects/${encodeURIComponent(p.id)}/artifacts/${encodeURIComponent(file.id)}`):undefined;
 const [data,setData]=useState<ReturnType<typeof scienceResult>|null>(null),[verification,setVerification]=useState<ReturnType<typeof independentEvidence>|null>(null),[error,setError]=useState(''),[proofError,setProofError]=useState('');
 useEffect(()=>{setData(null);setVerification(null);setError('');setProofError('');if(!applicable||!file||!url)return;const c=new AbortController();const signal=AbortSignal.any([c.signal,AbortSignal.timeout(10000)]);
 void verifiedJson(url,file.sha256,file.size,signal).then(async raw=>{if(c.signal.aborted)return;setData(scienceResult(raw));if(proof){try{const checked=independentEvidence(await verifiedJson(proof.url,proof.sha256,proof.size,signal),file.sha256,proof.reviewArtifactId);if(!c.signal.aborted)setVerification(checked);}catch(e){if(!c.signal.aborted)setProofError(e instanceof Error?e.message:'复核记录不可用');}}}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'证据不可用');});return()=>c.abort();
 },[applicable,url,file?.sha256,proof?.sha256]);
 if(!applicable)return null;
 return <section className="rt-detail-section" aria-label="科研方法与复核证据"><h3>科研方法与复核证据</h3>
 {!file?<p>本阶段尚未交回成果，方法与结果尚未验证。</p>:error?<p role="alert" className="rt-stale">{error}</p>:!data?<p>正在核对原始成果字节…</p>:<>
 <p><b>{run.agent.name} · {run.agent.platform==='codex'?'Codex':'SciencePAL'}</b></p>
 {data.method?<><p>{data.method.tools.map(t=>[t.name,t.version].filter(Boolean).join(' ')).join('；')||'未报告工具'}<br/>{data.method.parameters.slice(0,2).map(v=>`${v.name} ${v.value}${v.unit?' '+v.unit:''}`).join(' · ')}</p>{data.method.measurements.map((m,i)=><p key={i}><b>{m.name}：{Number(m.value.toPrecision(10))} {m.unit}</b></p>)}</>:<p className="rt-note">未提供结构化方法记录，请从原始成果与评审核查。不同研究可按协议交付自己的工具、参数和指标。</p>}
 <h4>独立复核证据</h4>{verification?<><p className={verification.passed?'success':'rt-stale'}>{verification.passed?'已有独立重算记录 · 通过冻结容差':'独立重算记录未通过'}</p>{verification.metrics.slice(0,1).map(m=><p key={m.name}>参考 {m.name}：{Number(m.reference.toPrecision(10))} {m.unit}<br/>差异 {m.comparison==='relative'?(m.difference*100).toFixed(5)+'%':Number(m.difference.toPrecision(6))+' '+m.unit} · 容差 {m.comparison==='relative'?m.tolerance*100+'%':m.tolerance+' '+m.unit}</p>)}<details><summary>查看方法与全部复核指标</summary><p>{verification.method}</p>{verification.metrics.map((m,i)=><p key={i}>{m.name}：产物 {Number(m.observed.toPrecision(8))} / 参考 {Number(m.reference.toPrecision(8))} {m.unit}；{m.difference<=m.tolerance?'符合容差':'超出容差'}</p>)}</details><a href={proof!.url}>打开绑定此成果的复核记录 ↗</a></>:<p className="rt-note">{proofError||'本阶段没有可核对的独立数值复算记录。Agent 评审文字通过，不自动等于已复现。'}</p>}
 <details><summary>查看代码、工具日志与参数</summary>{data.method?.parameters.map((v,i)=><p key={i}>{v.name}：{String(v.value)} {v.unit}</p>)}{data.hasCode?<pre className="rt-code">{data.code}</pre>:<p>此产物未提供 pythonCode；是否需要代码由研究协议决定。</p>}{data.method?.tools.map((t,i)=><div key={i}><b>{t.name} {t.version}</b><pre className="rt-code">{t.log||'未提供工具日志'}</pre></div>)}{!data.method&&data.rawLog&&<pre className="rt-code">{data.rawLog}</pre>}{run.threadId&&<code>SciencePAL Thread: {run.threadId}</code>}{run.runId&&<code>Run: {run.runId}</code>}</details>
 <details><summary>证据来源与结论边界</summary><p>已校验成果文件哈希。工具使用由产物报告，独立复算记录另行绑定；不代表当前在线环境或科学认证。不会执行展示的代码。</p>{data.method?.limitations.map((v,i)=><p key={i}>{v}</p>)}<code>{file.sha256}</code></details>
 </>}
 </section>;
}
