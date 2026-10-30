import type {SPProject,SPResultSchema,SPResultSchemas} from "@vibe-git/protocol";
import {badRequest} from "../domain/errors.js";
import {validateResultSchemas} from "./result-contract.js";
export interface ResearchConstraint {taskKey:string;field:string;kind:"text"|"number"|"range"|"source-sha";value?:string|number;min?:number;max?:number}
/** Only bounded declarative constraints; no user code, dynamic refs or coercion. */
export function constrainResearch(p:SPProject,existing:SPResultSchemas|undefined,raw:unknown):SPResultSchemas {
 if(!Array.isArray(raw)||raw.length<1||raw.length>24)throw badRequest("请选择 1–24 条科研约束");
 const schemas:SPResultSchemas=existing?structuredClone(existing):Object.fromEntries((p.alignment?.tasks??[]).map(t=>[t.key,{type:"object",properties:{},required:[]}]));
 const seen=new Set<string>();
 for(const r of raw){
  if(!r||typeof r!=="object"||!Object.hasOwn(schemas,r.taskKey)||typeof r.field!=="string"||!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(r.field)||["constructor","prototype"].includes(r.field))throw badRequest("请选择协议中的任务；成果字段使用英文字母、数字和下划线");
  if(seen.has(r.taskKey+"/"+r.field))throw badRequest("同一成果字段不能重复设置");seen.add(r.taskKey+"/"+r.field);
  const schema=schemas[r.taskKey]!,old=schema.properties?.[r.field];let rule:SPResultSchema;
  if(r.kind==="text") {if(typeof r.value!=="string"||!r.value.trim()||r.value.length>500)throw badRequest("固定文本需要 1–500 字符");rule={type:"string",const:r.value};}
  else if(r.kind==="number"){if(typeof r.value!=="number"||!Number.isFinite(r.value))throw badRequest("固定数值必须是有限数字");rule={type:"number",const:r.value};}
  else if(r.kind==="range"){if(typeof r.min!=="number"||typeof r.max!=="number"||!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min>r.max)throw badRequest("请填写有效的上下界");rule={type:"number",minimum:r.min,maximum:r.max};}
  else if(r.kind==="source-sha"){if(!p.source)throw badRequest("请先在建项时上传源文件");rule={type:"string",const:p.source.artifact.sha256};}
  else throw badRequest("不支持的科研约束类型");
  // Never silently replace an existing field contract with a weaker one.
  if(old){if(old.type!==rule.type&&!(old.type==="integer"&&rule.type==="number"))throw badRequest("约束字段与原格式类型不一致");
   if(old.type==="integer"&&typeof rule.const==="number"&&!Number.isInteger(rule.const))throw badRequest("整数参数不能使用小数");
   if(typeof rule.const==="string"&&(rule.const.length<(old.minLength??0)||rule.const.length>(old.maxLength??Infinity)))throw badRequest("固定文本不符合原格式长度");
   if(Object.hasOwn(old,"const")||old.enum)throw badRequest("该字段已有固定值/选项，不能从此入口覆盖");
   if(rule.minimum!==undefined)rule.minimum=Math.max(rule.minimum,old.minimum??-Infinity);
   if(rule.maximum!==undefined)rule.maximum=Math.min(rule.maximum,old.maximum??Infinity);
   if(typeof rule.const==="number"&&(rule.const<(old.minimum??-Infinity)||rule.const>(old.maximum??Infinity)))throw badRequest("固定值超出原格式范围");
   if((rule.minimum??-Infinity)>(rule.maximum??Infinity))throw badRequest("新范围与原格式冲突");
   rule={...old,...rule,type:old.type};
  }
  schema.properties={...schema.properties,[r.field]:rule};schema.required=[...new Set([...(schema.required??[]),r.field])];
 }
 return validateResultSchemas(schemas);
}
