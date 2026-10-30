import {legacyResearchEvidence} from './legacy-scientific-evidence';
/** Generic evidence viewer. These are producer-reported methods, not independent verification. */
export interface MethodEvidence {version:1;tools:{name:string;version?:string;log?:string}[];parameters:{name:string;value:string|number|boolean;unit?:string}[];measurements:{name:string;value:number;unit?:string}[];limitations:string[]}
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'&&v.length<=100000;
export function scienceResult(raw:unknown){
 if(!record(raw)||!Object.hasOwn(raw,'result'))throw Error('缺少研究成果');
 const result=record(raw.result)?raw.result:{};
 const supplied=result.researchEvidence??legacyResearchEvidence(result);
 let method:MethodEvidence|null=null;
 if(supplied!==undefined){
  const e=supplied;if(!record(e)||e.version!==1||!['tools','parameters','measurements','limitations'].every(k=>Array.isArray(e[k])&&e[k].length<=30))throw Error('科研证据格式无效，请查看原始产物');
  if(!e.tools.every((t:any)=>record(t)&&text(t.name)&&(!t.version||text(t.version))&&(!t.log||text(t.log)))||!e.parameters.every((p:any)=>record(p)&&text(p.name)&&(['string','boolean'].includes(typeof p.value)||(typeof p.value==='number'&&Number.isFinite(p.value)))&&(!p.unit||text(p.unit)))||!e.measurements.every((m:any)=>record(m)&&text(m.name)&&typeof m.value==='number'&&Number.isFinite(m.value)&&(!m.unit||text(m.unit)))||!e.limitations.every(text))throw Error('科研证据字段无效，请查看原始产物');
  method=e as unknown as MethodEvidence;
 }
 const code=[result.pythonCode,result.code].find(v=>text(v)&&v.trim().length>0);
 const hasCode=typeof code==='string';
 const reportedTools=record(result.tool_versions)?Object.entries(result.tool_versions).filter(([,v])=>typeof v==='string'&&v.length<=200).slice(0,30).map(([name,version])=>({name,version:String(version)})):[];
 const reportedValues=Object.entries(result).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).slice(0,12).map(([name,value])=>({name,value:Number(value)}));
 return {result,method,reportedTools,reportedValues,reportedMethod:typeof result.method==='string'?result.method.slice(0,300):'',hasCode,code:hasCode?code:'',rawLog:typeof result.toolLog==='string'?result.toolLog:'',log:{},total:typeof result.totalSasaA2==='number'?result.totalSasaA2:undefined};
}
export interface VerificationMetric {name:string;observed:number;reference:number;tolerance:number;comparison:'absolute'|'relative';unit:string}
export function independentEvidence(raw:unknown,candidateSha256:string,reviewArtifactId:string){
 const d=raw as Record<string,any>;
 if(!record(d)||d.formatVersion!==1||d.candidateSha256!==candidateSha256||d.reviewArtifactId!==reviewArtifactId||!text(d.method)||!Array.isArray(d.metrics)||!d.metrics.length||d.metrics.length>30||!Array.isArray(d.checks)||!d.checks.length)throw Error('复核记录缺失或不属于当前成果');
 if(!d.metrics.every((m:any)=>record(m)&&text(m.name)&&text(m.unit)&&[m.observed,m.reference,m.tolerance].every(v=>typeof v==='number'&&Number.isFinite(v))&&m.tolerance>=0&&['absolute','relative'].includes(m.comparison)&&(m.comparison!=='relative'||m.reference!==0)))throw Error('复核指标无效');
 const metrics=d.metrics as VerificationMetric[];
 const comparisons=metrics.map(m=>({...m,difference:Math.abs(m.observed-m.reference)/(m.comparison==='relative'?Math.abs(m.reference):1)}));
 return {passed:d.passed===true&&d.checks.every((c:any)=>record(c)&&c.passed===true)&&comparisons.every(m=>m.difference<=m.tolerance),method:d.method as string,metrics:comparisons};
}
