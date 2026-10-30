import { Ajv, type ValidateFunction } from "ajv";
import type { SPResultSchemas, SPResultValidation } from "@vibe-git/protocol";
import { badRequest } from "../domain/errors.js";

const allowed = new Set(["type", "properties", "required", "additionalProperties", "items", "additionalItems", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "enum", "const", "description"]);
const cache = new Map<string, ValidateFunction>();
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function validTaskKey(key: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,29}$/.test(key) && !["context", "result-contracts", "align-result", "review-result", "change_review-result", "constructor", "prototype"].includes(key.toLowerCase()) && !/^(previous-|source-)/i.test(key);
}
function compile(schema: object): ValidateFunction {
  const key = JSON.stringify(schema), hit = cache.get(key);
  if (hit) return hit;
  // Each bounded schema owns its compiler: no remote refs or unbounded Ajv registry.
  const ajv = new Ajv({ strict: true, allErrors: false, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true });
  let validate: ValidateFunction;
  try { validate = ajv.compile(schema); }
  catch { throw badRequest("成果格式定义无效：请检查字段类型、required、数值范围和数组约束"); }
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, validate); return validate;
}
/** Reject unsupported constructs before invoking the standards validator. Never silently drop keywords. */
export function validateResultSchemas(value: unknown): SPResultSchemas {
  let raw: string;
  try { raw = JSON.stringify(value); } catch { throw badRequest("成果格式必须是 JSON"); }
  if (!raw || Buffer.byteLength(raw) > 24 * 1024 || !record(value)) throw badRequest("成果格式必须是最多 24 KiB 的任务键映射");
  const schemas: unknown = JSON.parse(raw);
  if (!record(schemas) || Object.keys(schemas).length < 2 || Object.keys(schemas).length > 6) throw badRequest("成果格式需要覆盖 2–6 个任务");
  let nodes = 0;
  function visit(s: unknown, depth: number) {
    if (++nodes > 256 || depth > 8 || !record(s)) throw badRequest("成果格式超过 256 个节点或 8 层深度，或不是对象");
    for (const key of Object.keys(s)) if (!allowed.has(key)) throw badRequest(`不支持的成果格式关键字：${key}（不支持引用、正则或组合规则）`);
    if (!["object", "array", "string", "number", "integer", "boolean", "null"].includes(String(s.type))) throw badRequest("每个成果格式节点必须有单一有效 type");
    if (s.description !== undefined && (typeof s.description !== "string" || s.description.length > 1000)) throw badRequest("格式说明最多 1000 字符");
    if (s.properties !== undefined) {
      if (!record(s.properties)) throw badRequest("properties 必须为对象");
      for (const [key, child] of Object.entries(s.properties)) {
        if (!key || key.length > 100 || ["__proto__", "constructor", "prototype"].includes(key)) throw badRequest("成果字段名无效");
        visit(child, depth + 1);
      }
    }
    if (s.items !== undefined) {
      if (Array.isArray(s.items)) { if (s.items.length > 16) throw badRequest("元组最多 16 项"); s.items.forEach(child => visit(child, depth + 1)); }
      else visit(s.items, depth + 1);
    }
    const scalar = (v: unknown) => v === null || ["string", "boolean"].includes(typeof v) || (typeof v === "number" && Number.isFinite(v));
    if (Object.hasOwn(s, "const") && !scalar(s.const)) throw badRequest("const 仅支持标量");
    if (s.enum !== undefined && (!Array.isArray(s.enum) || s.enum.length > 30 || !s.enum.every(scalar))) throw badRequest("enum 最多 30 个标量");
  }
  for (const [key, schema] of Object.entries(schemas)) {
    if (!validTaskKey(key)) throw badRequest("成果格式任务键无效或与系统文件名冲突");
    visit(schema, 1);
    if (!record(schema) || schema.type !== "object") throw badRequest("任务 result 的根类型必须为 object");
    compile(schema);
  }
  return schemas as SPResultSchemas;
}
export function checkTaskResult(schemas: SPResultSchemas, taskKey: string, result: unknown, contractSha256: string): SPResultValidation {
  const schema = Object.hasOwn(schemas, taskKey) ? schemas[taskKey]! : undefined;
  if (!schema) throw badRequest(`任务 ${taskKey} 没有冻结的成果格式`);
  const validate = compile(schema), passed = validate(result);
  return { status: passed ? "PASSED" : "FAILED", contractSha256, issues: passed ? [] : (validate.errors ?? []).slice(0, 1).map(e => ({
    path: `/result${e.instancePath}`, message: e.keyword === "const" ? `必须等于冻结值 ${JSON.stringify(e.params.allowedValue)}` : e.keyword === "minimum" ? `不得小于冻结下界 ${e.params.limit}` : e.keyword === "maximum" ? `不得大于冻结上界 ${e.params.limit}` : `${e.message ?? e.keyword} ${JSON.stringify(e.params)}`,
  })) };
}
export function resultValidationError(check: SPResultValidation): string {
  return `成果格式校验失败：${check.issues.map(e => `${e.path} ${e.message}`).join("；")}。原文件已保留；尚未提交独立评审，下游未放行。`;
}
