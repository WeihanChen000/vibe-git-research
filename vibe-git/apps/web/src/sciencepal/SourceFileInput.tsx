import { useEffect, useRef, useState } from "react";
import { CRN_CASE, IRIS_CASE, type SPSourceInput } from "@vibe-git/protocol";
function encoded(bytes: Uint8Array) { let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte); return btoa(raw); }
export async function readResearchSourceFile(file: Pick<File, 'name'|'size'|'arrayBuffer'>): Promise<SPSourceInput> {
 if(!file.size||file.size>256*1024)throw Error('请选择非空且不超过 256 KiB 的 UTF-8 文本文件。');
 const ext=file.name.split('.').at(-1)?.toLowerCase();if(!ext||!['csv','tsv','txt','json','data','pdb'].includes(ext))throw Error('仅支持 CSV、TSV、TXT、JSON、DATA 或 PDB 文件。');
 const bytes=new Uint8Array(await file.arrayBuffer());try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('文件不是 UTF-8，请先转换编码。');}
 const stem=file.name.slice(0,-(ext.length+1)).replace(/^source-/,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,65)||'data';
 return {filename:`source-${stem}.${ext}`,base64:encoded(bytes),sourceUrl:'',attribution:''};
}
export function sourceInputError(source?: SPSourceInput) {
 if (!source) return '';
 try { const u=new URL(source.sourceUrl); if(u.protocol!=='https:'||u.username||u.password) return '请填写不含账号密码的 HTTPS 来源页或项目说明链接。'; } catch { return '请填写 HTTPS 来源页或项目说明链接。'; }
 return source.attribution.trim() ? '' : '请补充来源署名与使用许可。';
}
export function SourceFileInput({source,onChange,onExample,onReadyChange,selectionError,onSelectionError,disabled=false,onCrnExample,templateHint='使用模板会替换标题、两份提案和成果格式约束。'}:{
 onCrnExample?:(source:SPSourceInput)=>void;source:SPSourceInput|undefined;onChange:(source:SPSourceInput|undefined)=>void;onExample:(source:SPSourceInput)=>void;onReadyChange?:(ready:boolean)=>void;selectionError?:string;onSelectionError?:(error:string)=>void;disabled?:boolean;templateHint?:string;
}) {
 const [localError,setLocalError]=useState(''),[loading,setLoading]=useState(false),[digest,setDigest]=useState('');const sequence=useRef(0);
 const error=selectionError??localError;const setError=(value:string)=>{setLocalError(value);onSelectionError?.(value);};
 useEffect(()=>()=>{sequence.current++;},[]);
 useEffect(()=>{onReadyChange?.(!loading&&!error);},[loading,error,onReadyChange]);
 useEffect(()=>{let cancelled=false;setDigest('');if(source){const bytes=Uint8Array.from(atob(source.base64),c=>c.charCodeAt(0));void crypto.subtle.digest('SHA-256',bytes).then(b=>{if(!cancelled)setDigest([...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join(''));});}return()=>{cancelled=true;};},[source?.base64]);
 const remove=()=>{sequence.current++;setLoading(false);setError('');onChange(undefined);};
 async function upload(file?:File) {
  if(!file)return;const seq=++sequence.current;setError('');setLoading(true);onReadyChange?.(false);
  try {
   const next=await readResearchSourceFile(file);
   if(seq===sequence.current)onChange(next);
  }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'读取文件失败');}finally{if(seq===sequence.current)setLoading(false);}
 }
 async function example(crn=false){const seq=++sequence.current;setError('');setLoading(true);onReadyChange?.(false);try{
  const res=await fetch(crn?'/sciencepal-examples/1CRN.pdb':'/sciencepal-examples/iris.data',{signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error('本机示例文件不存在，请重新构建网页。');
  const bytes=new Uint8Array(await res.arrayBuffer());const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(sha!==(crn?CRN_CASE.sha256:'0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc'))throw Error('示例文件与官方冻结版本不一致。');
  if(seq===sequence.current){if(crn)onCrnExample?.({filename:'source-1crn.txt',base64:encoded(bytes),sourceUrl:CRN_CASE.sourceUrl,attribution:CRN_CASE.attribution});else onExample({filename:'source-iris.csv',base64:encoded(bytes),sourceUrl:IRIS_CASE.sourceUrl,attribution:IRIS_CASE.attribution});}
 }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'示例加载失败');}finally{if(seq===sequence.current)setLoading(false);}}
 return <section className="sp-source-input"><h3>研究输入与来源</h3><p>可选一份公开或已获授权的数据。建项时冻结原始字节，随任务交给参与成员的 Agent。仅上传和建项不调用模型；随后启动协议对齐或执行任务会使用对应账号。</p>

 <p>支持单份 CSV、TSV、TXT、JSON、DATA 或 PDB；UTF-8 编码，非空，最多 256 KiB。更换成功后需重新填写来源，失败不会清除原文件。</p>
 <label>选择数据文件（UTF-8，最多 256 KiB）<input aria-label="科研源文件" type="file" disabled={disabled||loading} accept=".csv,.tsv,.txt,.json,.data,.pdb" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
 <details><summary>使用公开案例（可选）</summary><div>{onCrnExample&&<button type="button" disabled={disabled||loading} onClick={()=>void example(true)}>使用 1CRN 专业复现模板</button>}<button type="button" disabled={disabled||loading} onClick={()=>void example()}>{loading?'正在读取数据…':'使用 Iris 公开数据复核模板'}</button></div><small>真实公开数据，校验来源、单位并独立复算统计。{templateHint}</small></details>
 {error&&<><p role="alert" className="sp-inline-error">{error} {source?'替换未成功，原文件和来源已保留。请重选文件，或确认继续使用原文件。':'尚未选入有效文件。请重选，或移除本次选择后不带文件建项。'}</p>{source&&<button type="button" disabled={disabled||loading} onClick={()=>setError('')}>继续使用原文件</button>}</>}
 {(source||error||loading)&&<button type="button" disabled={disabled} onClick={remove}>移除数据文件</button>}
 {source&&<><p>交接文件名：<code>{source.filename}</code> · {atob(source.base64).length} 字节 · 已读取，尚未发送 · {digest?'指纹已计算':'正在计算指纹'}</p><details><summary>查看文件校验详情</summary><small className="research-source-digest">SHA256：{digest||'计算中…'}</small></details><label>来源页或项目说明（HTTPS）<input aria-label="科研来源网址" type="url" disabled={disabled} maxLength={2000} value={source.sourceUrl} onChange={e=>onChange({...source,sourceUrl:e.target.value})} placeholder="https://…"/></label><label>来源署名与使用许可<textarea aria-label="科研来源署名" rows={3} disabled={disabled} maxLength={2000} value={source.attribution} onChange={e=>onChange({...source,attribution:e.target.value})}/></label>{sourceInputError(source)&&<p role="status">{sourceInputError(source)}</p>}<small>提案需说明读取哪个文件，以及哪些结果必须通过独立评审。更换文件后，请核对提案与成果格式是否仍适用。</small></>}
 </section>;
}
