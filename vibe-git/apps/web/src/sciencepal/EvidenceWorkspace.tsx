import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Check, Download, FileCheck2, GitBranch, ShieldCheck } from "lucide-react";
import type { SPProject, SPProjectEvidence } from "@vibe-git/protocol";
import "./evidence.css";
import { ResearchResultChart } from "./ResearchResultChart";
import { ResultContract } from "./ResultContract";

const value = (v: unknown) => v === undefined ? "—" : JSON.stringify(v);
const fields = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : { result: v };

export function EvidenceWorkspace({ project, onWork }: { project: SPProject; onWork: () => void }) {
  const [revision, setRevision] = useState(project.revision), [report, setReport] = useState<SPProjectEvidence | null>(null);
  const [error, setError] = useState(""), [reload, setReload] = useState(0), [taskKey, setTaskKey] = useState("");
  const [attemptIndex, setAttemptIndex] = useState<number | null>(null);
  const fingerprint = project.runs.filter(r => r.revision === revision).map(r => `${r.id}:${r.status}:${r.output?.id}`).join("|") + project.phase;
  const endpoint = `/api/sciencepal/projects/${project.id}/evidence?revision=${revision}`;
  useEffect(() => {
    const controller = new AbortController(); setError(""); setReport(null);
    void (async () => {
      try {
        const r = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const data = await r.json(); if (!r.ok) throw new Error(data.error || "证据读取失败");
        if (!controller.signal.aborted) setReport(data as SPProjectEvidence);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "读取超时，请确认本机服务仍在运行。"); }
    })();
    return () => controller.abort();
  }, [endpoint, fingerprint, reload]);
  const selected = report?.tasks.find(t => t.task.key === taskKey) ?? report?.tasks[0];
  const attempts = selected?.attempts ?? [];
  const index = Math.min(attemptIndex ?? attempts.length - 1, attempts.length - 1), attempt = attempts[index];
  const review = attempt?.reviews.at(-1), result = attempt?.result;
  const previous = index > 0 ? attempts[index - 1]!.result : null;
  const hasPrevious = index > 0 && previous !== null && result !== null && result !== undefined;
  const keys = [...new Set([...Object.keys(fields(result)), ...(hasPrevious ? Object.keys(fields(previous)) : [])])];
  const changedField = hasPrevious ? keys.find(key => value(fields(previous)[key]) !== value(fields(result)[key]) && (value(fields(previous)[key])?.length ?? 0) < 45 && (value(fields(result)[key])?.length ?? 0) < 45) : undefined;
  const resultTables = Object.entries(fields(result)).filter((entry): entry is [string, Record<string, string | number | boolean | null>[]] => Array.isArray(entry[1]) && entry[1].length > 0 && entry[1].length <= 50 && entry[1].every(row => row && typeof row === "object" && !Array.isArray(row) && Object.values(row).every(v => v === null || ["string", "number", "boolean"].includes(typeof v))));
  const gates = report?.handoffs.filter(h => h.to === selected?.task.key && h.executionId === attempt?.execution.id) ?? [];
  const fileUrl = (id: string) => `/api/sciencepal/projects/${project.id}/artifacts/${id}`;
  const name = (id: string) => project.agents.find(a => a.id === id)?.name ?? id;
  const verdict = (a: typeof attempt) => {
    if (a?.execution.resultValidation?.status === "FAILED") return "格式未通过";
    const r = a?.reviews.at(-1);
    return r?.result ? r.result.verdict === "approve" ? "通过" : "退回" : r ? "评审未通过校验或尚未结束" : "尚未评审";
  };
  return <section className="ev-workspace" aria-label="真实运行回顾">
    <div className="ev-toolbar"><label>需求版本<select aria-label="回顾需求版本" value={revision} onChange={e => { setRevision(Number(e.target.value)); setTaskKey(""); setAttemptIndex(null); }}>
      {[...project.history.map(h => h.revision), project.revision].map(v => <option key={v} value={v}>R{v}{v === project.revision ? " · 当前版本" : " · 已归档"}</option>)}
    </select></label><span>历史回顾 · 不发起新运行</span>{report && <a href={`${endpoint}&download=1`} download><Download size={14} />导出证据报告</a>}</div>
    <div className="ev-intro"><div><p className="ev-kicker">VIBE-GIT × SCIENCEPAL</p><h2>先评审，再交接。</h2><p>让每份成果有责任人，每次放行有依据。</p></div>{changedField ? <div className="ev-delta"><small>本轮真实修订 · {changedField}</small><div><del>{value(fields(previous)[changedField])}</del><ArrowRight size={23} /><strong>{value(fields(result)[changedField])}</strong></div><small>第 {attempt!.number - 1} 次 → 第 {attempt!.number} 次成果</small></div> : <div className="ev-seal"><ShieldCheck size={24} /><span>{report?.allApproved ? "本版本任务均已获批" : "按真实记录逐步验证"}<small>文件校验 + 独立 Agent 评审</small></span></div>}</div>
    {error ? <div className="sp-error" role="alert"><p>未能验证证据：{error}</p><button onClick={() => setReload(n => n + 1)}>重新读取证据</button></div> : !report ? <p role="status" className="ev-loading">正在读取冻结文件并校验来源…</p> : <>
      <div className="ev-facts"><span><b>{report.runs.filter(r => r.runId).length}</b> 次已提交运行</span><span><b>{report.files.length}</b> 份文件已核验</span><span><b>{report.tasks.reduce((n, t) => n + t.attempts.flatMap(a => a.reviews).filter(r => r.result?.verdict === "request_changes").length, 0)}</b> 次评审退回</span><small>本机证据快照 · {new Date(report.generatedAt).toLocaleTimeString("zh-CN")}</small></div>
      {report.resultContracts && <details className="ev-source-provenance"><summary>成果格式已冻结 · {report.runs.filter(r => r.resultValidation?.status === "FAILED").length} 次格式拦截</summary><p>格式校验与独立 Agent 评审分别记录；失败不会计为评审退回。</p><a href={fileUrl(report.resultContracts.id)} download>下载冻结的格式规则</a><code>SHA-256 {report.resultContracts.sha256}</code></details>}
      {report.source && <details className="ev-source-provenance"><summary>研究输入已冻结 · {report.source.artifact.filename} · {report.source.artifact.size.toLocaleString()} 字节</summary><p>{report.source.attribution}</p><div><a href={report.source.sourceUrl} target="_blank" rel="noreferrer">查看来源与授权 ↗</a><a href={fileUrl(report.source.artifact.id)} download>下载冻结的原始数据</a></div><code>SHA-256 {report.source.artifact.sha256}</code></details>}
      {!report.tasks.length ? <div className="ev-loading"><h3>从提案走向共同验收</h3><p>这个版本还没有发布任务。先在工作台审阅对齐稿，发布后这里将显示真实执行与交接证据。</p><button onClick={onWork}>前往协作工作台<ArrowRight size={14} /></button></div> : <div className="ev-layout">
        <nav className="ev-route" aria-label="成果任务"><h3>成果流向</h3><p>选择任务，查看它如何获批。</p>{report.tasks.map(({ task, attempts: list }) => <div key={task.key}>
          {task.dependencies.length > 0 && <div className="ev-dependency"><ArrowDown size={16} />依赖 {task.dependencies.join("、")}</div>}
          <button className={`ev-node ${selected?.task.key === task.key ? "selected" : ""}`} aria-pressed={selected?.task.key === task.key} onClick={() => { setTaskKey(task.key); setAttemptIndex(null); }}>
            <span className="ev-node-icon"><FileCheck2 size={20} /></span><span><small>{task.key}</small><strong>{task.title}</strong><em>{list.length} 次执行 · {task.status === "APPROVED" ? "已获批" : "尚未获批"}</em></span>
          </button><div className="ev-assignment"><span>执行 · {name(task.assigneeAgentId)}</span><span>评审 · {name(task.reviewerAgentId)}</span></div>
        </div>)}<div className="ev-rule"><GitBranch size={18} /><p>上游获批后，下游才接收对应文件。被退回的成果保留，返工生成新版本。</p></div></nav>
        <div className="ev-inspector">
          <header><div><p className="ev-kicker">成果与评审</p><h3>{selected?.task.title}</h3></div><span className="ev-version">R{revision}</span></header>
          <div className="ev-attempt-tabs" aria-label="选择执行轮次">{attempts.map((a, i) => <button key={a.execution.id} aria-pressed={index === i} className={index === i ? "selected" : ""} onClick={() => setAttemptIndex(i)}><span>第 {a.number} 次</span><b className={verdict(a) === "退回" ? "rejected" : ""}>{verdict(a)}</b></button>)}</div>
          {!attempt ? <p className="ev-loading">尚未派发；等待发布、上游批准或恢复派发。</p> : <>
            <div className={`ev-verdict ${review?.result?.verdict === "request_changes" ? "rejected" : review?.result?.verdict === "approve" ? "approved" : "pending"}`}><span>{review?.result?.verdict === "approve" ? <Check size={22} /> : <ShieldCheck size={22} />}</span><div><h4>{review?.result ? review.result.verdict === "approve" ? "独立评审通过" : "独立评审退回" : "等待有效评审"}</h4><p>{review?.result?.summary ?? review?.run.error ?? attempt.execution.error ?? "当前尚无获批依据，下游不能凭执行完成直接放行。"}</p>{review?.result?.requiredChanges.map(c => <p key={c}><b>需修改：</b>{c}</p>)}</div></div>
            <ResultContract schema={selected?.task.resultSchema} validation={attempt.execution.resultValidation} />
            {attempt.execution.error && <p className="sp-inline-error">{attempt.execution.error}</p>}
            {attempt.execution.output && attempt.execution.status !== "COLLECTED" && <a href={fileUrl(attempt.execution.output.id)} download>下载未通过校验的原始成果</a>}
            <ResearchResultChart result={result} />
            {result !== null && <section className="ev-results"><div className="ev-section-title"><h4>{hasPrevious ? "成果修订对照" : "实际成果"}</h4>{attempt.execution.output && <a href={fileUrl(attempt.execution.output.id)} download>下载原始文件 ↗</a>}</div>
              <div className="ev-table-scroll"><table><thead><tr><th>字段</th>{hasPrevious && <th>第 {attempt.number - 1} 次</th>}<th>第 {attempt.number} 次</th></tr></thead><tbody>{keys.slice(0, 12).map(key => <tr key={key} className={hasPrevious && value(fields(previous)[key]) !== value(fields(result)[key]) ? "changed" : ""}><th>{key}</th>{hasPrevious && <td>{value(fields(previous)[key])?.slice(0, 500)}</td>}<td>{value(fields(result)[key])?.slice(0, 500)}</td></tr>)}</tbody></table></div><small>显示前 12 个顶层字段，每格最多 500 字符；完整内容见原始文件。</small>
            </section>}
            {review?.result && <details className="ev-checks"><summary>逐项验收 · {review.result.checks.filter(c => c.passed).length}/{review.result.checks.length} 通过</summary>{review.result.checks.map(c => <div key={c.criterion}><b>{c.passed ? "✓" : "×"} {c.criterion}</b><p>{c.evidence}</p></div>)}</details>}
            {resultTables.map(([field, rows]) => { const columns = [...new Set(rows.flatMap(row => Object.keys(row)))].slice(0, 12); return <section className="ev-results" key={field}><div className="ev-section-title"><h4>{field} · {rows.length} 条记录</h4></div><div className="ev-table-scroll"><table className="ev-record-table"><thead><tr>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map(col => <td key={col}>{String(row[col] ?? "—").slice(0, 500)}</td>)}</tr>)}</tbody></table></div></section>; })}
            {attempt.feedback && <details className="ev-checks"><summary>返工时实际收到的意见</summary><p className="sp-prompt">{attempt.feedback}</p></details>}
            {gates.map(g => <section className={`ev-gate ${g.checks.every(c => c.passed) ? "passed" : "failed"}`} key={`${g.executionId}:${g.from}`}><h4>{g.checks.every(c => c.passed) ? "交接证据完整" : "交接证据有缺口"} · {g.from} → {g.to}</h4>{g.checks.map(c => <p key={c.label}>{c.passed ? "✓" : "×"} {c.label}</p>)}</section>)}
            <footer className="ev-source"><span>执行：{attempt.execution.agent.name}</span><span>评审：{review?.run.agent.name ?? "尚未开始"}</span><time>{new Date(attempt.execution.createdAt).toLocaleString("zh-CN")}</time>{attempt.execution.output && <code>SHA-256 {attempt.execution.output.sha256}</code>}<div>{review?.run.output && <a href={fileUrl(review.run.output.id)} download>原始评审 JSON</a>}{attempt.execution.projectId && attempt.execution.threadId && <a href={`https://sciencepal.ai/projects/${encodeURIComponent(attempt.execution.projectId)}/thread/${encodeURIComponent(attempt.execution.threadId)}`} target="_blank" rel="noreferrer">SciencePAL 运行 ↗</a>}</div></footer>
          </>}
        </div>
      </div>}
      <p className="ev-boundary">此视图读取真实运行的本机冻结证据，不播放模拟进度。文件一致性不等于科学结论正确；Agent 评审仍需科研人员判断。</p>
    </>}
  </section>;
}
