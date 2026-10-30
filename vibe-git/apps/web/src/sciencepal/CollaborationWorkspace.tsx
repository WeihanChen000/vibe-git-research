import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, GitBranch, Pause, Play, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { SciencePALAgent, SciencePALState, SPCreateProject, SPPhase, SPProject, SPRun } from "@vibe-git/protocol";
import { Markdown } from "../Markdown";
import { isLatestSPRun, IRIS_CASE, IRIS_RESULT_SCHEMAS } from "@vibe-git/protocol";
import { ResultContract } from "./ResultContract";
import { SourceFileInput } from "./SourceFileInput";
import { TaskAttemptHistory } from "./TaskAttemptHistory";
import { EvidenceWorkspace } from "./EvidenceWorkspace";
import { sciencepalApi as api } from "./api";
import "./sciencepal.css";
import "./pipeline.css";

const base = "/api/sciencepal";
const phase: Record<SPPhase, string> = { DRAFT: "提案待对齐", ALIGNING: "自动对齐中", NEEDS_DECISION: "等待冲突裁决", READY: "对齐稿待发布", EXECUTING: "任务执行中", REVIEWING: "交叉评审中", CHANGES_REQUESTED: "等待确认返工", COMPLETED: "协作已完成", BLOCKED: "流程受阻", CHANGE_REVIEW: "变更评审中", CHANGE_READY: "变更待确认" };
const runLabel: Record<SPRun["kind"], string> = { ALIGN: "自动对齐", TASK: "任务执行", REVIEW: "独立评审", CHANGE_REVIEW: "变更评审" };
const taskLabel = { WAITING: "等待依赖", RUNNING: "执行中", REVIEWING: "独立评审中", APPROVED: "评审通过", CHANGES_REQUESTED: "需要返工", BLOCKED: "受阻" };
const demo = [
  "目标：建立一个合成实验分析演示。我负责生成数据文件：明确标记 simulated=true，包含 control=[1,2,3,4,5]、treatment=[2,4,6,8,10] 和用 Python secrets.token_hex(16) 生成的 nonce。验收：两组各五个数，数据标记为合成且存在 nonce。不联网，不读取私人资料。",
  "目标：接收数据 Agent 的真实成果后独立计算。我负责分析：用 Python 计算两组样本数、均值、样本标准差、treatment-control 均值差，并把输入 nonce 原样放进结果。验收：样本数均为5，均值分别为3和6，均值差为3，输出两组样本标准差并保留输入nonce。必须依赖数据生成任务，明确这不是科研发现。",
];
export function CollaborationWorkspace() {
  const [projects, setProjects] = useState<SPProject[]>([]), [agents, setAgents] = useState<SciencePALAgent[]>([]);
  const [configured, setConfigured] = useState(false), [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get("project") ?? ""); const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"evidence" | "work">(() => new URLSearchParams(location.search).get("view") === "work" ? "work" : "evidence");
  const [connectionError, setConnectionError] = useState(""), [lastSync, setLastSync] = useState("");
  const [agentStatus, setAgentStatus] = useState("尚未检查远端连接"), [checkingAgents, setCheckingAgents] = useState(false);
  const refreshing = useRef<Promise<void> | null>(null), agentCheck = useRef(false);
  const [form, setForm] = useState<SPCreateProject>({ title: "实验数据协作 · 自动对齐与交叉评审", coordinatorId: "", proposals: demo.map(content => ({ agentId: "", content })) });
  const [schemaText, setSchemaText] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(""); const active = useRef(false);
  const [change, setChange] = useState(""), [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [recoveryThreads, setRecoveryThreads] = useState<Record<string, string>>({});
  const p = projects.find(p => p.id === selected) ?? projects[0];
  function refresh(): Promise<void> {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      try {
        const [s, projects] = await Promise.all([api<SciencePALState>("/state"), api<SPProject[]>("/projects")]);
        setConfigured(s.configured); setProjects(projects); setConnected(true); setConnectionError(""); setLastSync(new Date().toISOString());
      } catch { setConnected(false); setConnectionError("本机服务未连接。当前显示上次保存的快照；新操作已暂停。请启动 npm run sciencepal 后重新连接。"); }
      finally { setLoaded(true); refreshing.current = null; }
    })();
    return refreshing.current;
  }
  async function checkAgents() {
    if (agentCheck.current) return; agentCheck.current = true; setCheckingAgents(true); setAgentStatus("正在检查 SciencePAL…");
    try { const available = await api<SciencePALAgent[]>("/agents"); setAgents(available); setAgentStatus(`SciencePAL 可访问 · ${available.length} 个 Agent · ${new Date().toLocaleTimeString("zh-CN")}`); }
    catch (e) { setAgents([]); setAgentStatus(e instanceof Error ? e.message : "SciencePAL 暂不可访问；已保存证据仍可查看。"); }
    finally { agentCheck.current = false; setCheckingAgents(false); }
  }
  async function work(label: string, fn: () => Promise<unknown>) {
    if (active.current) return; active.current = true; setBusy(label); setError("");
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { active.current = false; setBusy(""); }
  }
  useEffect(() => {
    document.title = "Vibe-Git × SciencePAL · 完整协作流程";
    void refresh();
    const timer = setInterval(() => { if (!active.current && !document.hidden) void refresh(); }, 4000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!p || creating) return;
    const url = new URL(location.href); url.searchParams.set("project", p.id); url.searchParams.set("view", view);
    history.replaceState(null, "", url);
  }, [p?.id, view, creating]);
  const command = (action: string, extra: object = {}) => {
    if (!connected) { setError("本机服务未连接，请重新连接后操作。"); return; }
    return p && work("保存操作", () => api(`/projects/${p.id}/commands/${action}`, { revision: p.revision, ...extra }));
  };
  async function openFile(artifactId: string, title: string) {
    if (!p) return;
    const r = await fetch(`${base}/projects/${p.id}/artifacts/${artifactId}`); if (!r.ok) throw new Error("证据文件读取失败");
    const raw = await r.text(); let text = raw; try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* Show raw invalid evidence. */ }
    setPreview({ title, content: text.slice(0, 120_000) });
  }
  const agentName = (id: string) => p?.agents.find(a => a.id === id)?.name || id;
  const currentRuns = p?.runs.filter(r => r.revision === p.revision) ?? [];
  const pendingChange = p?.changes.find(c => ["REVIEWING", "ACCEPTED", "REJECTED"].includes(c.status));
  const taskCount = p?.tasks.filter(t => t.status === "APPROVED").length ?? 0;
  return <div className="sp-app sp-pipeline">
    <header className="sp-header"><a className="sp-brand" href="/sciencepal"><img src="/vibe-git-logo.png" alt="" />vibe-git <span>×</span> SciencePAL</a><div><a href="/sciencepal/team">多人协作</a><span className="sp-local">单账号验证记录</span><a href="/sciencepal/handoff">快速文件交接 ↗</a></div></header>
    <div className="sp-layout"><aside className="sp-sidebar"><p className="sp-eyebrow">AGENT COLLABORATION</p><h2>科研协作空间</h2><p className="sp-muted">从独立提案到可验证成果，<br />每次交接都经过评审。</p><button className="sp-primary sp-new" disabled={!configured || !connected || !!busy} onClick={() => { setCreating(true); setView("work"); setPreview(null); void checkAgents(); }}><Plus size={16} />新建项目</button><nav aria-label="项目列表">{projects.map(project => <button key={project.id} className={!creating && p?.id === project.id ? "selected" : ""} onClick={() => { setSelected(project.id); setCreating(false); setPreview(null); setChange(""); }}><GitBranch size={17} /><span>{project.title}<small>R{project.revision} · {phase[project.phase]}</small></span></button>)}</nav><footer><span className={`sp-dot ${connected ? "on" : ""}`} />Host 自动编排<small>关闭页面后继续运行<br />本机数据 · 原始证据可追溯</small></footer></aside>
    <main className="sp-main"><div className="sp-page-heading"><div><p className="sp-eyebrow">ALIGN → EXECUTE → REVIEW</p><h1>{creating || !p ? "建立一个完整的协作流程" : p.title}</h1><p>{p && !creating ? `需求 R${p.revision} · ${phase[p.phase]} · ${taskCount}/${p.tasks.length} 个任务通过评审` : "提案冻结、冲突裁决、依赖执行、交叉评审与变更重编排。"}</p></div><button disabled={!!busy} onClick={() => void refresh()}><RefreshCw size={16} />刷新</button></div>
      {error && <div className="sp-error" role="alert">{error}</div>}
      {loaded && <div className={`sp-connection ${connected ? "" : "offline"}`} role="status"><span>{connected ? `本机已连接 · 最近同步 ${new Date(lastSync).toLocaleTimeString("zh-CN")}` : connectionError}</span><button onClick={() => void refresh()}>{connected ? "同步记录" : "重新连接"}</button></div>}
      {!creating && p && <div className="sp-view-switch" aria-label="项目视图"><button aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>真实运行回顾</button><button aria-pressed={view === "work"} onClick={() => setView("work")}>协作工作台</button></div>}
      {!creating && p && view === "evidence" && <EvidenceWorkspace key={`${p.id}:${p.revision}`} project={p} onWork={() => setView("work")} />}
      {connected && !configured && <div className="sp-empty"><h2>先连接 SciencePAL</h2><p>在 Host 配置 SCIENCEPAL_API_KEY 或外部 SCIENCEPAL_AUTH_FILE 后重启。密钥不会发送到浏览器。</p></div>}
      {!loaded && <div className="sp-empty" role="status">正在读取本机协作记录…</div>}
      {configured && loaded && (creating || !p) && <form className="sp-form" onSubmit={e => { e.preventDefault(); void work("创建项目", async () => { let resultSchemas;
          try { resultSchemas = schemaText.trim() ? JSON.parse(schemaText) : undefined; } catch { throw new Error("成果格式不是有效 JSON，请修正后再创建。"); }
          const project = await api<SPProject>("/projects", { ...form, ...(schemaText.trim() ? { resultSchemas } : {}) }); setSelected(project.id); setCreating(false); setView("work"); }); }}>
        <div className="sp-form-intro"><GitBranch size={26} /><div><h2>先把各 Agent 的提案放在一起</h2><p>支持 2–4 个不同 Agent。创建后先自动对齐，经你确认发布后才自动执行和评审。</p></div></div>
        <div className="sp-connection"><span>{agentStatus}</span><button type="button" disabled={checkingAgents || !connected} onClick={() => void checkAgents()}>{checkingAgents ? "检查中…" : "重新检查 SciencePAL"}</button></div><label>项目标题<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <SourceFileInput source={form.source} onChange={source => setForm(f => { const next = { ...f }; if (source) next.source = source; else delete next.source; return next; })} onExample={source => { setSchemaText(JSON.stringify(IRIS_RESULT_SCHEMAS, null, 2)); setForm(f => ({ title: IRIS_CASE.title, source, coordinatorId: f.proposals.slice(0, 2).some(p => p.agentId === f.coordinatorId) ? f.coordinatorId : "", proposals: IRIS_CASE.proposals.map((content, i) => ({ agentId: f.proposals[i]?.agentId ?? "", content })) })); }} /><div className="sp-form-columns">{form.proposals.map((proposal, i) => <section key={i}><h3>提案 {i + 1}</h3><label>参与 Agent<select required value={proposal.agentId} onChange={e => setForm(f => ({ ...f, proposals: f.proposals.map((p, n) => n === i ? { ...p, agentId: e.target.value } : p) }))}><option value="">选择 Agent</option>{agents.map(a => <option key={a.id} value={a.id} disabled={form.proposals.some((p, n) => n !== i && p.agentId === a.id)}>{a.name}</option>)}</select></label><label>目标、分工与验收<textarea required rows={7} maxLength={8000} value={proposal.content} onChange={e => setForm(f => ({ ...f, proposals: f.proposals.map((p, n) => n === i ? { ...p, content: e.target.value } : p) }))} /></label>{form.proposals.length > 2 && <button type="button" onClick={() => setForm(f => ({ ...f, proposals: f.proposals.filter((_, n) => n !== i) }))}>移除此提案</button>}</section>)}</div>
        <button type="button" disabled={form.proposals.length >= 4} onClick={() => setForm(f => ({ ...f, proposals: [...f.proposals, { agentId: "", content: "" }] }))}><Plus size={14} />添加 Agent 提案</button>
        <details className="sp-panel" open={!!schemaText}><summary>成果格式约束（可选）{schemaText ? " · 已填写" : ""}</summary><p>按任务键填写 JSON Schema。创建后冻结，Agent 无权放宽；不符合格式的成果会保留并阻止评审和交接。Iris 模板已提供完整规则。</p><label>任务成果格式 JSON<textarea rows={9} maxLength={24576} value={schemaText} onChange={e => setSchemaText(e.target.value)} placeholder={'{"data":{"type":"object",...},"analysis":{"type":"object",...}}'} /></label><p className="sp-muted">支持对象、数组、固定元组、基本类型、必填字段、枚举及范围；不支持引用、正则和组合规则。格式改变需新建项目。</p></details>
        <label>自动对齐与变更评审负责人<select required value={form.coordinatorId} onChange={e => setForm({ ...form, coordinatorId: e.target.value })}><option value="">从项目参与者选择</option>{agents.filter(a => form.proposals.some(p => p.agentId === a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <p className="sp-muted">每个成果由另一位 Agent 评审，作者不能自审。每项目最多 32 次远端运行，每任务最多 3 次执行；任务调用会使用 SciencePAL 账号额度。</p>
        <div className="sp-form-actions">{p && <button type="button" onClick={() => setCreating(false)}>取消</button>}<button className="sp-primary" disabled={!!busy || !connected || checkingAgents || !agents.length || !form.coordinatorId}>冻结提案并创建项目<ArrowRight size={16} /></button></div>
      </form>}
      {!creating && p && view === "work" && <>
        <div className="sp-flow"><span className="done">01 <b>冻结提案</b></span><ArrowRight size={17} /><span className={p.alignment ? "done" : ""}>02 <b>自动对齐</b></span><ArrowRight size={17} /><span className={p.tasks.length ? "done" : ""}>03 <b>依赖执行</b></span><ArrowRight size={17} /><span className={p.phase === "COMPLETED" ? "done" : ""}>04 <b>交叉评审</b></span></div>
        <div className="sp-control"><span className={`sp-status ${p.phase === "COMPLETED" ? "completed" : "running"}`}>{phase[p.phase]}</span><span>{p.runs.length}/{p.maxRuns} 次运行 · 最多 2 个同时运行</span><button disabled={!!busy} onClick={() => void command(p.paused ? "resume" : "pause")}>{p.paused ? <Play size={14} /> : <Pause size={14} />}{p.paused ? "恢复派发" : "暂停派发"}</button></div>
        {p.paused && <div className="sp-notice">已暂停派发新任务。正在远端运行的任务仍会完成，Host 会继续回收结果。</div>}
        {currentRuns.some(r => r.status === "RUNNING" && r.remoteStatus === "initializing") && <div className="sp-notice">SciencePAL 正在初始化执行环境。原 Run ID 已保存，Host 会继续观察，无需再次提交任务。</div>}
        {p.error && <div className="sp-error" role="alert">{p.error}</div>}
        {currentRuns.filter(r => r.status === "UNKNOWN").map(r => <section className="sp-panel" key={r.id}><h2>接回已有远端运行</h2><p>在 SciencePAL 找到此次提交对应的对话，从地址的 /thread/ 后复制 Thread ID。系统只核对并接回已有运行，不会重发任务；成果仍需通过原始输入校验。</p><form onSubmit={e => { e.preventDefault(); void command("recover", { runId: r.id, threadId: recoveryThreads[r.id] }); }}><label className="sp-change-label">{runLabel[r.kind]} · 远端 Thread ID<input required maxLength={120} value={recoveryThreads[r.id] || ""} onChange={e => setRecoveryThreads(values => ({ ...values, [r.id]: e.target.value }))} /></label><button className="sp-primary" disabled={!!busy || !recoveryThreads[r.id]?.trim()}>核对并接回已有运行</button></form></section>)}
        {p.phase === "COMPLETED" && <section className="sp-verification passed"><CheckCircle2 size={30} /><div><h2>完整协作流程已完成</h2><p>所有任务均已产出真实文件，通过输入哈希与版本校验，并由另一位 Agent 按验收标准批准。</p></div></section>}
        <details className="sp-panel"><summary>冻结的提案与来源（{p.proposals.length} 份）</summary><div className="sp-form-columns">{p.proposals.map(plan => <section key={plan.id}><h3>{agentName(plan.agentId)}</h3><p className="sp-prompt">{plan.content}</p><code className="sp-hash">SHA-256 {plan.sha256}</code></section>)}</div></details>
        {p.resultContracts && <details className="sp-panel"><summary>成果格式已冻结</summary><p>对齐、重试、返工和需求变更沿用同一规则。格式通过不等于科学内容正确。</p><a href={base + "/projects/" + p.id + "/artifacts/" + p.resultContracts.id} download>下载冻结格式</a><code className="sp-hash">SHA-256 {p.resultContracts.sha256}</code></details>}
        {p.phase === "DRAFT" && <section className="sp-verification"><div><h2>开始自动对齐</h2><p>SciencePAL 会识别冲突，拆分任务，并生成目标、边界、验收标准及文件依赖。</p></div><button className="sp-primary" disabled={!!busy} onClick={() => void command("align")}>启动自动对齐<ArrowRight size={16} /></button></section>}
        {p.alignment && <section className="sp-panel"><div className="sp-panel-title"><h2>对齐稿 · R{p.alignment.revision}</h2>{p.phase === "READY" && <button className="sp-primary" disabled={!!busy} onClick={() => void command("publish", { alignmentRunId: p.alignment!.runId })}>确认发布并自动执行<Play size={15} /></button>}</div><div className="sp-markdown"><Markdown>{p.alignment.alignmentMarkdown}</Markdown></div>
          {p.phase === "NEEDS_DECISION" && p.alignment.issues.map(issue => <article className="sp-issue" key={issue.id}><h3>{issue.title}</h3>{issue.evidence.map((e, i) => <blockquote key={i}>{agentName(e.nodeId)}：{e.excerpt}</blockquote>)}<div>{issue.options.map(o => <button key={o.id} disabled={!!busy || !!issue.selectedOptionId} className={issue.selectedOptionId === o.id ? "sp-primary" : ""} onClick={() => void command("decide", { alignmentRunId: p.alignmentRunId, issueId: issue.id, optionId: o.id })}><span>{o.label}{issue.recommendedOptionId === o.id ? "（建议）" : ""}<small>{o.impact}</small></span></button>)}</div></article>)}
          {!p.tasks.length && <div className="sp-draft-list">{p.alignment.tasks.map(t => <div key={t.key}><b>{t.title}</b><span>{agentName(t.assigneeAgentId)} → 评审：{agentName(t.reviewerAgentId)}</span><small>依赖：{t.dependencies.join("、") || "无"} · 输出：{t.outputFilename}</small><p>{t.goal}</p><ul>{t.acceptance.map(c => <li key={c}>{c}</li>)}</ul></div>)}</div>}
        </section>}
        {p.tasks.length > 0 && <section className="sp-task-grid">{p.tasks.map(t => <article className="sp-task" key={t.key}><div className="sp-task-top"><span className="sp-avatar">{t.status === "APPROVED" ? <CheckCircle2 size={22} /> : <GitBranch size={22} />}</span><div><small>{t.key} · 第 {t.attempt} 次执行</small><h3>{t.title}</h3></div><span className={`sp-status ${t.status === "APPROVED" ? "completed" : ""}`}>{taskLabel[t.status]}</span></div><p className="sp-task-goal">{t.goal}</p><dl><div><dt>执行</dt><dd>{agentName(t.assigneeAgentId)}</dd></div><div><dt>独立评审</dt><dd>{agentName(t.reviewerAgentId)}</dd></div><div><dt>硬依赖</dt><dd>{t.dependencies.length ? t.dependencies.map(key => `${key} ${p.tasks.find(d => d.key === key)?.status === "APPROVED" ? "✓" : "待通过"}`).join(" · ") : "无上游依赖"}</dd></div></dl><details><summary>边界与验收标准</summary><p>{t.boundary}</p><ul>{t.acceptance.map(c => <li key={c}>{c}</li>)}</ul></details>
          {t.artifactId && <div className="sp-artifact"><span><ShieldCheck size={16} />真实文件 · {t.outputFilename}</span><div><button onClick={() => void work("读取成果", () => openFile(t.artifactId!, t.outputFilename))}>查看成果</button><a href={`${base}/projects/${p.id}/artifacts/${t.artifactId}`} download>下载</a></div></div>}
          {t.review && <div className={`sp-review-box ${t.review.verdict === "approve" ? "approved" : "rejected"}`}><strong>{t.review.verdict === "approve" ? "独立评审通过" : "评审要求修改"}</strong><p>{t.review.summary}</p><ul>{t.review.checks.map(c => <li key={c.criterion}><b>{c.passed ? "✓" : "×"} {c.criterion}</b><small>{c.evidence}</small></li>)}</ul>{t.review.requiredChanges.map(c => <p key={c}>需修改：{c}</p>)}</div>}
          {t.status === "CHANGES_REQUESTED" && <button className="sp-primary" disabled={!!busy || t.attempt >= 3} onClick={() => void command("rework", { taskKey: t.key })}>按评审意见返工</button>}
          <ResultContract schema={t.resultSchema} validation={p.runs.find(r => r.id === t.executionId)?.resultValidation} /><TaskAttemptHistory key={`${p.id}:${p.revision}:${t.key}`} projectId={p.id} revision={p.revision} taskKey={t.key} runs={p.runs} />
        </article>)}</section>}
        <section className="sp-panel"><div className="sp-panel-title"><h2>需求变更与影响评审</h2><span className="sp-muted">评审建议 → 人工确认 → 新版本重新对齐</span></div>
          {pendingChange ? <div><p className="sp-prompt">{pendingChange.request}</p>{pendingChange.result && <><h3>{pendingChange.result.verdict === "accept" ? "建议接受变更" : "建议拒绝变更"}</h3><p>{pendingChange.result.rationale}</p><p className="sp-muted">受影响任务：{pendingChange.result.affectedTaskKeys.join("、") || "无"}</p>{pendingChange.result.requirementMarkdown && <details><summary>审阅修订后的完整需求</summary><div className="sp-markdown"><Markdown>{pendingChange.result.requirementMarkdown}</Markdown></div></details>}<div className="sp-form-actions"><button disabled={!!busy} onClick={() => void command("dismiss-change", { changeId: pendingChange.id })}>不应用，返回原阶段</button>{pendingChange.status === "ACCEPTED" && <button className="sp-primary" disabled={!!busy} onClick={() => void command("apply-change", { changeId: pendingChange.id })}>确认变更并重新对齐</button>}</div></>}</div> : <form onSubmit={e => { e.preventDefault(); void command("change", { request: change }); }}><label className="sp-change-label">描述要修改的需求<textarea rows={3} maxLength={8000} required value={change} onChange={e => setChange(e.target.value)} placeholder="例如：新增中位数计算，保留已有均值和标准差验收。" /></label><button disabled={!!busy || !["READY", "COMPLETED", "CHANGES_REQUESTED"].includes(p.phase) || !change.trim()}>提交变更评审</button><small className="sp-muted">仅在稳定阶段提交；获批并确认后归档旧阶段，所有新版本任务重新验证。</small></form>}
        </section>
        <details className="sp-panel"><summary>运行与证据（{currentRuns.length} 个当前版本运行）</summary><div className="sp-run-list">{[...currentRuns].reverse().map(r => <article key={r.id}><div><b>{runLabel[r.kind]}{r.taskKey ? ` · ${r.taskKey}` : ""}</b><span>{r.status}</span></div><small>{r.agent.name} · {r.runId || "等待派发"}</small>{r.error && <p className="sp-inline-error">{r.error}</p>}<div className="sp-run-actions">{r.output && <button onClick={() => void work("读取证据", () => openFile(r.output!.id, r.output!.filename))}>查看原始结果</button>}{r.projectId && r.threadId && <a target="_blank" rel="noreferrer" href={`https://sciencepal.ai/projects/${r.projectId}/thread/${r.threadId}`}>远端记录 ↗</a>}{["FAILED", "INVALID"].includes(r.status) && isLatestSPRun(p.runs, r) && p.runs.length < p.maxRuns && (r.kind !== "TASK" || (p.tasks.find(t => t.key === r.taskKey)?.attempt ?? 3) < 3) && <button disabled={!!busy} onClick={() => void command("retry", { runId: r.id })}>重试此失败步骤</button>}</div><details><summary>冻结的输入文件</summary>{r.inputs.map(i => <p key={i.artifactId}><a href={`${base}/projects/${p.id}/artifacts/${i.artifactId}`} download>{i.filename}</a> · {i.size} 字节<code className="sp-hash">{i.sha256}</code></p>)}</details></article>)}</div></details>
        {preview && <section className="sp-preview"><header><h2>{preview.title}</h2><button onClick={() => setPreview(null)}>关闭预览</button></header><pre>{preview.content}</pre><small>原始 JSON 证据，最多显示 120,000 字符。</small></section>}
        {p.history.length > 0 && <details className="sp-panel"><summary>历史版本（{p.history.length}）</summary>{p.history.map(h => <section key={h.revision}><h3>R{h.revision} · 已归档</h3><p>{h.tasks.map(t => `${t.title}：${taskLabel[t.status]}`).join("；")}</p><div className="sp-markdown"><Markdown>{h.requirementMarkdown || h.alignment?.alignmentMarkdown || ""}</Markdown></div>{h.tasks.map(t => <section key={t.key}><h4>{t.title}</h4><TaskAttemptHistory key={`${p.id}:${h.revision}:${t.key}`} projectId={p.id} revision={h.revision} taskKey={t.key} runs={p.runs} /></section>)}{p.runs.filter(r => r.revision === h.revision && r.output).map(r => <p key={r.id}><a href={`${base}/projects/${p.id}/artifacts/${r.output!.id}`} download>{runLabel[r.kind]} / {r.taskKey || r.output!.filename} · 原始证据</a></p>)}</section>)}</details>}
        <section className="sp-events"><h2>协作记录</h2><ol>{p.events.slice(-35).reverse().map((e, i) => <li key={`${e.at}-${i}`}><time>{new Date(e.at).toLocaleTimeString("zh-CN")}</time><span>{e.message}</span></li>)}</ol></section>
      </>}
      <p className="sp-footnote">SciencePAL 单账号协作 · 2–4 个 Agent · 每轮 2–6 个任务 · 严格文件依赖 · AI 评审不替代科研审阅。原版 Codex 工作台仍可独立使用。</p>
    </main></div>{busy && <div className="sp-busy" role="status"><RefreshCw size={14} className="sp-spin" />{busy}</div>}
  </div>;
}
