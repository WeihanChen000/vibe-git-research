import { useEffect, useState } from "react";
import type { SPRun, SPTaskAttempt } from "@vibe-git/protocol";

export function TaskAttemptHistory({ projectId, revision, taskKey, runs }: {
  projectId: string; revision: number; taskKey: string; runs: SPRun[];
}) {
  const [open, setOpen] = useState(false), [attempts, setAttempts] = useState<SPTaskAttempt[] | null>(null);
  const [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const relevant = runs.filter(r => r.revision === revision && r.taskKey === taskKey);
  const fingerprint = relevant.map(r => `${r.id}:${r.status}:${r.output?.id ?? ""}`).join("|");
  const count = relevant.filter(r => r.kind === "TASK").length;
  const base = `/api/sciencepal/projects/${encodeURIComponent(projectId)}`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setAttempts(null); setError("");
    void (async () => {
      try {
        const response = await fetch(`${base}/tasks/${encodeURIComponent(taskKey)}/attempts?revision=${revision}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取执行历史失败");
        if (!controller.signal.aborted) setAttempts(data as SPTaskAttempt[]);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "读取执行历史失败"); }
    })();
    return () => controller.abort();
  }, [open, base, taskKey, revision, fingerprint, retry]);
  const artifact = (id: string) => `${base}/artifacts/${encodeURIComponent(id)}`;
  return <details className="sp-attempt-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>执行与评审历史 · {count} 次执行</summary>
    {open && <>
      <p className="sp-muted">R{revision} · 每次评审对应当时的成果文件，旧记录保留。</p>
      {error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>重新读取历史</button></div> : !attempts ? <p role="status">正在核验并读取历史…</p> : !attempts.length ? <p>尚未派发执行。</p> : <ol>
        {attempts.map(attempt => <li key={attempt.execution.id}>
          <div className="sp-attempt-heading"><strong>第 {attempt.number} 次执行</strong><span>{attempt.execution.status === "COLLECTED" ? "文件已采集" : attempt.execution.status}</span></div>
          <p>{attempt.execution.agent.name} · <time dateTime={attempt.execution.createdAt}>{new Date(attempt.execution.createdAt).toLocaleString("zh-CN")}</time></p>
          {attempt.execution.error && <p className="sp-inline-error">{attempt.execution.error}</p>}
          {attempt.feedback && <details><summary>本次收到的返工意见</summary><p className="sp-prompt">{attempt.feedback}</p></details>}
          {attempt.execution.output && <p><a href={artifact(attempt.execution.output.id)} download>下载第 {attempt.number} 次成果</a><code className="sp-hash">SHA-256 {attempt.execution.output.sha256}</code></p>}
          {!attempt.reviews.length && <p className="sp-muted">尚无对应评审。</p>}
          {attempt.reviews.map(({ run, result }) => <section key={run.id} className={`sp-attempt-review ${result?.verdict === "approve" ? "approved" : result?.verdict === "request_changes" ? "rejected" : ""}`}>
            <strong>{result ? result.verdict === "approve" ? "评审通过" : "评审退回" : `评审：${run.status}`}</strong>
            <p>{run.agent.name}</p>
            {run.error && <p className="sp-inline-error">{run.error}</p>}
            {result && <><p>{result.summary}</p><details><summary>逐项验收（{result.checks.filter(c => c.passed).length}/{result.checks.length} 通过）</summary><ul>{result.checks.map(c => <li key={c.criterion}><b>{c.passed ? "✓" : "×"} {c.criterion}</b><p>{c.evidence}</p></li>)}</ul></details>{result.requiredChanges.map(c => <p key={c}>需修改：{c}</p>)}</>}
            <div className="sp-run-actions">{run.output && <a href={artifact(run.output.id)} download>下载原始评审</a>}{run.projectId && run.threadId && <a target="_blank" rel="noreferrer" href={`https://sciencepal.ai/projects/${encodeURIComponent(run.projectId)}/thread/${encodeURIComponent(run.threadId)}`}>远端记录 ↗</a>}</div>
          </section>)}
        </li>)}
      </ol>}
    </>}
  </details>;
}
