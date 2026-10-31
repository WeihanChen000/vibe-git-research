import type {SPProject} from "@vibe-git/protocol";
/** Read-only evidence inside the existing protocol inspector; no new navigation or styling. */
export function ResearchGovernanceEvidence({p}:{p:SPProject}) {
  if(!p.governance)return <p className="rt-note">历史协议：未记录逐条原文覆盖。保留原验收与证据，不将旧记录标为已通过新版防偏移检查。</p>;
  const tasks=p.tasks.length?p.tasks:p.alignment?.tasks??[],active=p.governance.requirements.filter(r=>!r.retiredBy);
  const covered=active.filter(r=>tasks.some(t=>t.requirementIds?.includes(r.id)));
  return <section className="rt-detail-section"><h3>原提案与任务对齐</h3><p>原文覆盖 {covered.length} / {active.length} 条。遗漏条目不能发布；逐条关联不等于已经证明科研结论正确。</p><details><summary>核对原文、分工与变更</summary>{p.governance.requirements.map(r=><div key={r.id}><p>{r.text}</p><small>{r.retiredBy?"已由队长批准修订，原文保留":tasks.filter(t=>t.requirementIds?.includes(r.id)).map(t=>t.title).join("、")||"等待对齐到任务"}</small></div>)}</details>{!!p.governance.decisions.length&&<details><summary>队长已确认的裁决</summary>{p.governance.decisions.map(d=><p key={`${d.runId}/${d.issue.id}`}>{d.issue.title}：{d.issue.options.find(o=>o.id===d.issue.selectedOptionId)?.label}</p>)}</details>}<p className="rt-note">评审只能按已发布验收要求返工。新增要求应提出研究变更，由队长确认。</p></section>;
}
