import {useRef,useState} from "react";
import type {SPProject} from "@vibe-git/protocol";
import type {TeamState} from "./research-model";
import type {SendResearchCommand} from "./ResearchCommand";
export function ResearchConstraints({p,state,send,disabled}:{p:SPProject;state:TeamState;send:SendResearchCommand;disabled:boolean}){
 const [task,setTask]=useState(p.alignment?.tasks[0]?.key??""),[field,setField]=useState("method"),[kind,setKind]=useState("text"),[value,setValue]=useState(""),[min,setMin]=useState(""),[max,setMax]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);const lock=useRef(false);
 const allowed=!state.replay&&state.browserCommands&&p.phase==="READY"&&p.revision===1&&state.viewer.id===p.team?.captainNodeId&&state.viewer.role==="captain";
 const save=async()=>{if(lock.current)return;lock.current=true;setSaving(true);setError("");try{
  if(kind==="number"&&!value.trim()||kind==="range"&&(!min.trim()||!max.trim()))throw Error("请填写数值，不能留空");
  const constraint={taskKey:task,field,kind,...(kind==="text"?{value}:kind==="number"?{value:Number(value)}:kind==="range"?{min:Number(min),max:Number(max)}:{})};
  await send("set-constraints",{revision:p.revision,constraints:[constraint]},state.commandSnapshots?.[p.id]??"");setValue("");setField("");
 }catch(e){setError(e instanceof Error?e.message:"保存失败");}finally{lock.current=false;setSaving(false);}};
 return <section className="rt-detail-section"><h3>科研防漂移</h3><p>把关键方法、参数、源文件哈希或合理范围写进冻结规则。不符合规则的成果将保留原文件并阻止评审、下游交接。</p>
 {p.resultContracts?<p>已配置冻结约束。发布后持续生效，研究变更也不能偷偷放宽。</p>:<p className="rt-note">尚未配置方法与参数字段约束；数值检查的配置状态见上方。</p>}
 {(p.tasks.length?p.tasks:p.alignment?.tasks??[]).map(t=>{const rules=Object.entries(t.resultSchema?.properties??{}).filter(([,v])=>v.const!==undefined||v.minimum!==undefined||v.maximum!==undefined);return rules.length>0?<div key={t.key}><strong>{t.title}</strong><ul>{rules.map(([field,rule])=><li key={field}><code>{field}</code>：{rule.const!==undefined?String(rule.const):`${rule.minimum??"不限"} ～ ${rule.maximum??"不限"}`}</li>)}</ul></div>:null;})}
 <p className="rt-note">数值范围需由研究者给出依据；字段符合规则不证明方法真正执行，仍需独立复核。</p>
 {allowed&&<details><summary>发布前添加约束</summary><label>科研任务<select aria-label="约束任务" value={task} onChange={e=>setTask(e.target.value)}>{p.alignment?.tasks.map(t=><option key={t.key} value={t.key}>{t.title}</option>)}</select></label>
 <label>成果字段<input aria-label="约束字段" placeholder="例如 method、seed、source_sha256" value={field} onChange={e=>setField(e.target.value)}/></label>
 <label>检查方式<select aria-label="检查方式" value={kind} onChange={e=>setKind(e.target.value)}><option value="text">固定文本（方法、单位）</option><option value="number">固定数值（参数、随机种子）</option><option value="range">允许数值范围</option><option value="source-sha" disabled={!p.source}>与上传源文件 SHA-256 一致</option></select></label>
 {kind==="range"?<><label>下界<input aria-label="范围下界" type="number" value={min} onChange={e=>setMin(e.target.value)}/></label><label>上界<input aria-label="范围上界" type="number" value={max} onChange={e=>setMax(e.target.value)}/></label></>:kind!=="source-sha"?<label>必须使用的值<input aria-label="约束值" type={kind==="number"?"number":"text"} value={value} onChange={e=>setValue(e.target.value)}/></label>:<p>自动使用本项目上传源文件的真实 SHA-256，无需复制哈希。</p>}
 <button disabled={disabled||saving||!field||!task} onClick={()=>void save()}>{saving?"保存中…":"冻结这条约束"}</button>{error&&<p role="alert" className="rt-stale">{error}</p>}</details>}
 </section>;
}
