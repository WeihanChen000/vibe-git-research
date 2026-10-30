import type { SPResultSchema, SPResultValidation } from "@vibe-git/protocol";

export function ResultContract({ schema, validation }: { schema: SPResultSchema | undefined; validation: SPResultValidation | undefined }) {
  if (!schema) return <p className="sp-muted">此任务未配置机器格式约束；不能视为已通过类型校验。</p>;
  return <section className={`ev-gate ${validation?.status === "FAILED" ? "failed" : ""}`} aria-label="成果格式约束">
    <h4>{validation?.status === "PASSED" ? "成果格式校验通过" : validation?.status === "FAILED" ? "成果格式未通过 · 已阻止评审和交接" : "成果格式已冻结 · 等待校验"}</h4>
    <p>必填字段、类型和额外字段按冻结规则检查；通过后仍须接受独立 Agent 的内容评审。</p>
    {validation?.issues.map((issue, i) => <p key={i}><code>{issue.path}</code> · {issue.message}</p>)}
    <details><summary>查看完整格式约束（JSON Schema）</summary><pre className="sp-contract-json">{JSON.stringify(schema, null, 2)}</pre></details>
  </section>;
}
