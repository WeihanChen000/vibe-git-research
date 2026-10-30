import type {SPScientificChecks,SPScientificRule,SPScientificValidation} from "@vibe-git/protocol";
import {badRequest} from "../domain/errors.js";
import {validTaskKey} from "./result-contract.js";
const own=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const number=(v:unknown):number=>{if(typeof v!=="number"||!Number.isFinite(v))throw Error("缺少有限数值（不接受字符串或空值）");return v;};
const safe=(s:unknown):s is string=>typeof s==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(s)&&!["__proto__","constructor","prototype"].includes(s);
const path=(s:unknown)=>typeof s==="string"&&s.length<=300&&s.split(".").every(safe);
function read(v:unknown,p:string):unknown{for(const k of p.split(".")){if(!own(v)||!Object.hasOwn(v,k))throw Error(`缺少字段 ${p}`);v=v[k];}return v;}
function rows(v:unknown,p:string):Record<string,unknown>[] {const a=read(v,p);if(!Array.isArray(a)||!a.length||a.length>10000||a.some(x=>!own(x)))throw Error(`字段 ${p} 必须是 1–10000 行对象`);return a;}
export function validateScientificChecks(raw:unknown,sourceSha?:string):SPScientificChecks {
 try {
  if(JSON.stringify(raw).length>65536||!own(raw)||raw.version!==1||!own(raw.tasks)||!Object.keys(raw.tasks).length||Object.keys(raw.tasks).length>6)throw Error("检查配置需要 version=1 和 1–6 个任务");
  if(raw.sourceSha256!==undefined&&(!sourceSha||raw.sourceSha256!==sourceSha))throw Error("科学参考与当前源文件 SHA-256 不符");
  for(const [key,rules] of Object.entries(raw.tasks)){
   if(!validTaskKey(key)||!Array.isArray(rules)||!rules.length||rules.length>24)throw Error("每个任务需要 1–24 项检查");const ids=new Set<string>();
   for(const r of rules){
    if(!own(r)||!safe(r.id)||ids.has(r.id))throw Error("检查 ID 无效或重复");ids.add(r.id);
    if(number(r.absoluteTolerance)<0)throw Error("容差不能为负数");
    if(r.kind==="sum"){if(!path(r.totalPath)||!path(r.rowsPath)||!safe(r.valueField))throw Error("求和字段无效");}
    else if(r.kind==="reference"||r.kind==="reference-table"){
     if(!sourceSha||raw.sourceSha256!==sourceSha)throw Error("独立参考必须绑定源文件");
     if(number(r.relativeTolerance)<0||typeof r.provenance!=="string"||!r.provenance.trim()||r.provenance.length>1000)throw Error("独立参考必须说明来源和非负容差");
     if(r.kind==="reference"){if(!path(r.path))throw Error("参考字段无效");number(r.expected);}
     else {if(!path(r.rowsPath)||!safe(r.keyField)||!safe(r.valueField)||!Array.isArray(r.expected)||!r.expected.length||r.expected.length>1000)throw Error("参考表无效");const keys=new Set<string>();for(const e of r.expected){if(!own(e)||!(typeof e.key==="string"&&e.key.length<=80||typeof e.key==="number"&&Number.isFinite(e.key)))throw Error("参考键无效");const k=JSON.stringify(e.key);if(keys.has(k))throw Error("参考键重复");keys.add(k);number(e.value);}}
    }else throw Error("不支持的科学检查方式");
   }
  }
  return structuredClone(raw) as unknown as SPScientificChecks;
 }catch(e){throw badRequest(`科学检查配置无效：${e instanceof Error?e.message:"格式错误"}`);}
}
export function checkScientificResult(config:SPScientificChecks,taskKey:string,result:unknown,rulesSha256:string,artifactSha256:string,sourceSha256?:string):SPScientificValidation|undefined {
 const rules=config.tasks[taskKey];if(!rules)return undefined;
 const checks=rules.map(r=>{try{
  if(config.sourceSha256&&config.sourceSha256!==sourceSha256)throw Error("源文件与独立参考绑定不符");
  const compare=(actual:number,expected:number,rel:number)=>{const tolerance=Math.max(r.absoluteTolerance,Math.abs(expected)*rel);const difference=Math.abs(actual-expected);if(!Number.isFinite(difference)||difference>tolerance)throw Error(`实际 ${actual}，参考 ${expected}，差异 ${difference} 超过容差 ${tolerance}`);};
  if(r.kind==="sum"){const a=number(read(result,r.totalPath));let total=0;for(const row of rows(result,r.rowsPath)){if(!Object.hasOwn(row,r.valueField))throw Error("缺少求和字段");total+=number(row[r.valueField]);}compare(a,total,0);return {id:r.id,passed:true,detail:`总量 ${a}；逐项求和 ${total}；容差 ${r.absoluteTolerance}`};}
  if(r.kind==="reference"){const a=number(read(result,r.path));compare(a,r.expected,r.relativeTolerance);return {id:r.id,passed:true,detail:`实际 ${a}；独立参考 ${r.expected}`};}
  const a=rows(result,r.rowsPath),map=new Map<string,number>();for(const row of a){if(!Object.hasOwn(row,r.keyField)||!Object.hasOwn(row,r.valueField))throw Error("参考表缺少键或数值");const key=JSON.stringify(row[r.keyField]);if(map.has(key))throw Error("成果表存在重复键");map.set(key,number(row[r.valueField]));}
  if(map.size!==r.expected.length)throw Error("成果与独立参考的行数不同");
  for(const e of r.expected){const value=map.get(JSON.stringify(e.key));if(value===undefined)throw Error(`缺少参考行 ${e.key}`);try{compare(value,e.value,r.relativeTolerance);}catch(err){throw Error(`行 ${e.key}：${(err as Error).message}`);}}
  return {id:r.id,passed:true,detail:`${a.length} 行逐项匹配独立参考（按键匹配，非数组顺序）`};
 }catch(e){return {id:r.id,passed:false,detail:e instanceof Error?e.message:"无法执行检查"};}});
 return {status:checks.every(c=>c.passed)?"PASSED":"FAILED",engineVersion:"numeric-v1",rulesSha256,artifactSha256,sourceSha256:sourceSha256??null,checks};
}
export function scientificError(r:SPScientificValidation){return `科学计算检查未通过：${r.checks.filter(c=>!c.passed).map(c=>`${c.id}：${c.detail}`).join("；")}。原文件保留，评审同意也不能放行下游；请按原待办修正后重试。`;}
