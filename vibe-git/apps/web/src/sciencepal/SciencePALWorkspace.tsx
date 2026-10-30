import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, Download, FlaskConical, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import type { SciencePALAgent, SciencePALCreateInput, SciencePALState, SciencePALTask, SciencePALWorkflow } from "@vibe-git/protocol";
import "./sciencepal.css";

const BASE = "/api/sciencepal";
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(BASE + path, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json", "X-Vibe-SciencePAL": "1" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || (response.status === 404 ? "此 Host 未启用 SciencePAL。请使用 npm run sciencepal 启动专用模式。" : `请求失败 (${response.status})`));
  }
  return response.json() as Promise<T>;
}
const demo: SciencePALCreateInput = {
  title: "实验数据整理 → 独立复核", producerAgentId: "", consumerAgentId: "", outputFilename: "experiment.json",
  producerPrompt: "使用 Python 生成一份明确标注为 simulated 的实验数据：conditions 为 control、treatment，各 5 个 observations（value 为正数），包含用 secrets.token_hex(16) 新生成的 nonce 和中文实验说明。保存为 UTF-8 JSON。不联网、不读取无关资料，不声称是真实实验。",
  consumerPrompt: "读取 A 提供的模拟实验 JSON。用 Python 分别计算 control 和 treatment 的样本数、均值、样本标准差，以及两组均值之差；在 result 中包含原始 nonce 和各组统计量。说明这是合成数据，只验证流程，不构成科研发现。",
};
const labels: Record<SciencePALTask["status"], string> = { READY: "待执行", STARTING: "正在提交", RUNNING: "运行中", NEEDS_INPUT: "等待补充信息", COMPLETED: "运行完成", FAILED: "运行失败", UNKNOWN: "提交结果未知" };
const artifactUrl = (w: string, a: string) => `${BASE}/workflows/${w}/artifacts/${a}`;
export function SciencePALWorkspace() {
  const [state, setState] = useState<SciencePALState | null>(null);
  const [agents, setAgents] = useState<SciencePALAgent[]>([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState<SciencePALCreateInput>(demo);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const working = useRef(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const current = state?.workflows.find(w => w.id === selected) ?? state?.workflows[0];
  async function refresh() { const data = await request<SciencePALState>("/state"); setState(data); return data; }
  async function work(label: string, action: () => Promise<unknown>, quiet = false) {
    if (working.current) return;
    working.current = true; if (!quiet) { setBusy(label); setError(""); }
    try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { working.current = false; if (!quiet) setBusy(""); }
  }
  useEffect(() => {
    document.title = "Vibe-Git × SciencePAL · 科研协作";
    void work("连接 Host", async () => {
      const data = await refresh();
      if (data.configured) setAgents(await request<SciencePALAgent[]>("/agents"));
    });
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden || working.current || creating) return;
      void work("同步状态", async () => {
        if (current?.tasks.some(t => t.status === "RUNNING")) await request(`/workflows/${current.id}/sync`, {});
      }, true);
    }, 6000);
    return () => clearInterval(timer);
  }, [current?.id, current?.updatedAt, creating]);
  const edit = (key: keyof SciencePALCreateInput, value: string) => setForm(f => ({ ...f, [key]: value }));
  async function act(action: string) {
    if (!current) return;
    await work("处理中", () => request(`/workflows/${current.id}/${action}`, {}));
  }
  async function view(t: SciencePALTask) {
    if (!current || !t.artifact) return;
    const response = await fetch(artifactUrl(current.id, t.artifact.id));
    if (!response.ok) throw new Error("成果读取失败");
    const content = await response.text();
    let formatted = content;
    try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch { /* Plain text is also supported. */ }
    setPreview({ name: t.artifact.filename, content: formatted.slice(0, 100_000) });
  }
  function card(t: SciencePALTask, index: number, w: SciencePALWorkflow) {
    const blocked = index === 1 && !w.tasks[0].artifact;
    return <article className="sp-task" key={t.id}>
      <div className="sp-task-top"><span className={`sp-avatar ${index ? "violet" : ""}`}>{index ? "B" : "A"}</span><div><small>{index ? "复核与分析" : "数据与成果"}</small><h3>{t.agent.name}</h3></div><span className={`sp-status ${t.status.toLowerCase()}`}>{labels[t.status]}</span></div>
      <details><summary>任务说明 <ChevronRight size={14} /></summary><p className="sp-prompt">{t.prompt}</p></details>
      <dl><div><dt>Agent</dt><dd>{t.agent.id}</dd></div><div><dt>Run</dt><dd>{t.runId || "尚未提交"}</dd></div><div><dt>交付文件</dt><dd>{t.outputFilename}</dd></div></dl>
      {t.error && <p className="sp-inline-error">{t.error}</p>}
      {t.status === "NEEDS_INPUT" && <p>Agent 需要补充信息。请前往 SciencePAL 处理，本原型暂不支持对话续跑。</p>}
      {t.artifact ? <div className="sp-artifact"><span><Check size={16} /> 已冻结成果 · {t.artifact.size.toLocaleString()} 字节</span><code title={t.artifact.sha256}>SHA-256 {t.artifact.sha256}</code><div><button onClick={() => void work("读取成果", () => view(t))}>查看内容</button><a href={artifactUrl(w.id, t.artifact.id)} download><Download size={14} /> 下载文件</a></div></div> : <div className="sp-output-empty">{blocked ? "等待 A 的成果文件，完成采集后解锁交接" : "尚未采集成果文件"}</div>}
      <div className="sp-task-actions">
        {t.status === "READY" && <button className="sp-primary" disabled={!!busy || blocked} onClick={() => void act(`${t.role}/start`)}>{index ? "交接文件并启动 B" : "启动 A"}<ArrowRight size={15} /></button>}
        {t.status === "COMPLETED" && !t.artifact && <button className="sp-primary" disabled={!!busy} onClick={() => void act(`${t.role}/collect`)}>采集{index ? "回执与结果" : "成果文件"}</button>}
        {t.threadId && <a href={t.projectId ? `https://sciencepal.ai/projects/${t.projectId}/thread/${t.threadId}` : "https://sciencepal.ai/dashboard"} target="_blank" rel="noreferrer">{t.projectId ? "SciencePAL 运行记录 ↗" : "前往 SciencePAL ↗"}</a>}
      </div>
    </article>;
  }
  return <div className="sp-app">
    <header className="sp-header"><a className="sp-brand" href="/sciencepal"><img src="/vibe-git-logo.png" alt="" />vibe-git <span>×</span> SciencePAL</a><div><span className="sp-local">本机协作原型</span><a href="https://tfboy1.github.io/vibe-git/" target="_blank" rel="noreferrer">原项目介绍 ↗</a></div></header>
    <div className="sp-layout"><aside className="sp-sidebar"><p className="sp-eyebrow">COLLABORATION ROOM</p><h2>科研协作空间</h2><p className="sp-muted">同一任务，两个 Agent，<br />可核验的文件交接。</p><button className="sp-primary sp-new" disabled={!state?.configured || !!busy} onClick={() => { setCreating(true); setPreview(null); }}><Plus size={16} />新建协作</button><nav aria-label="协作任务">{state?.workflows.map(w => <button key={w.id} className={!creating && current?.id === w.id ? "selected" : ""} onClick={() => { setSelected(w.id); setCreating(false); setPreview(null); }}><FlaskConical size={17} /><span>{w.title}<small>{w.verification?.passed ? "交接已验证" : "流程进行中"}</small></span></button>)}</nav><footer><span className={`sp-dot ${state?.configured ? "on" : ""}`} />{state?.configured ? "API Key 已配置" : "尚未连接"}<small>复用 Vibe-Git Host 与房间<br />{state?.roomId.slice(0, 8) || "等待连接"}</small></footer></aside>
    <main className="sp-main">
      <div className="sp-page-heading"><div><p className="sp-eyebrow">SCIENCEPAL WORKSPACE</p><h1>{creating ? "创建一个协作流程" : current?.title || "让 Agent 的成果继续流动"}</h1><p>产出文件、传递依赖、独立复核，在同一个工作台完成。</p></div><button disabled={!!busy} aria-label="刷新状态" onClick={() => void work("同步状态", async () => { if (current) await request(`/workflows/${current.id}/sync`, {}); if (state?.configured && !agents.length) setAgents(await request<SciencePALAgent[]>("/agents")); })}><RefreshCw size={16} className={busy ? "sp-spin" : ""} />刷新</button></div>
      {error && <div className="sp-error" role="alert">{error}</div>}
      {state && !state.configured && <section className="sp-empty"><h2>连接你的 SciencePAL 账号</h2><p>在运行 Host 的终端配置 SCIENCEPAL_API_KEY 或 SCIENCEPAL_AUTH_FILE，然后重启原型。密钥仅保留在服务端。</p><code>npm run build<br />npm run sciencepal</code></section>}
      {state?.configured && (creating || !current) && <form className="sp-form" onSubmit={e => { e.preventDefault(); void work("创建协作", async () => { const w = await request<SciencePALWorkflow>("/workflows", form); setSelected(w.id); setCreating(false); }); }}>
        <div className="sp-form-intro"><FlaskConical size={25} /><div><h2>从两个 Agent 的分工开始</h2><p>已填入合成实验演示，也可以替换成你自己的任务。创建流程不会立即调用 Agent。</p></div></div>
        <label>协作标题<input required maxLength={120} value={form.title} onChange={e => edit("title", e.target.value)} /></label>
        <div className="sp-form-columns">{(["producer", "consumer"] as const).map((role, index) => <section key={role}><h3>{index ? "B · 接收与复核" : "A · 生成成果"}</h3><label>SciencePAL Agent<select required value={index ? form.consumerAgentId : form.producerAgentId} onChange={e => edit(index ? "consumerAgentId" : "producerAgentId", e.target.value)}><option value="">选择 Agent</option>{agents.map(a => <option key={a.id} value={a.id} disabled={a.id === (index ? form.producerAgentId : form.consumerAgentId)}>{a.name} · {a.id.slice(0, 8)}</option>)}</select></label><label>任务说明<textarea required maxLength={12000} rows={7} value={index ? form.consumerPrompt : form.producerPrompt} onChange={e => edit(index ? "consumerPrompt" : "producerPrompt", e.target.value)} /></label></section>)}</div>
        <label>A 的交接文件名<input required pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]*" maxLength={100} value={form.outputFilename} onChange={e => edit("outputFilename", e.target.value)} /><small>保存到 Agent 的 /workspace；单文件上限 5 MiB。B 会输出 receipt.json，包含校验回执与任务结果。</small></label>
        {agents.length < 2 && <p className="sp-inline-error">当前至少需要两个可用 Agent。请先在 SciencePAL 创建，再刷新。</p>}
        <div className="sp-form-actions"><button type="button" onClick={() => setForm({ ...demo, producerAgentId: form.producerAgentId, consumerAgentId: form.consumerAgentId })}>恢复演示任务</button>{current && <button type="button" onClick={() => setCreating(false)}>取消</button>}<button className="sp-primary" disabled={!!busy || agents.length < 2 || !form.producerAgentId || !form.consumerAgentId || form.producerAgentId === form.consumerAgentId}>{busy || "创建协作流程"}<ArrowRight size={16} /></button></div>
      </form>}
      {!creating && current && <>
        <div className="sp-flow"><span className={current.tasks[0].artifact ? "done" : ""}>01 <b>A 生成成果</b></span><ArrowRight size={18} /><span className={current.tasks[1].inputArtifactId ? "done" : ""}>02 <b>文件交接</b></span><ArrowRight size={18} /><span className={current.verification?.passed ? "done" : ""}>03 <b>B 复核与回执</b></span></div>
        <div className="sp-cards">{current.tasks.map((t, i) => card(t, i, current))}</div>
        <section className={`sp-verification ${current.verification?.passed ? "passed" : ""}`}><div><h2>{current.verification?.passed ? "文件交接已验证" : "验证交接闭环"}</h2><p>核对 Agent 身份、独立沙箱、冻结文件、字节数和 B 独立计算的哈希。科研内容仍需人工审阅。</p></div><button className="sp-primary" disabled={!!busy || !current.tasks.every(t => t.artifact)} onClick={() => void act("verify")}>{current.verification ? "重新核验" : "核验文件交接"}</button>{current.verification && <ul>{current.verification.checks.map(c => <li key={c.name} className={c.passed ? "" : "failed"}>{c.passed ? "✓" : "×"} {c.name}</li>)}</ul>}</section>
        {preview && <section className="sp-preview"><header><h2>{preview.name}</h2><button onClick={() => setPreview(null)}>关闭预览</button></header><pre>{preview.content}</pre><small>最多预览 100,000 字符；完整文件可下载。</small></section>}
        <section className="sp-events"><h2>协作记录</h2><ol>{[...current.events].reverse().map((e, i) => <li key={`${e.at}-${i}`}><time>{new Date(e.at).toLocaleTimeString("zh-CN")}</time><span>{e.message}</span></li>)}</ol></section>
      </>}
      <p className="sp-footnote">第一版支持单账号、两 Agent、单文件串行交接。需要人工确认启动与采集；不会自动重发未知提交。</p>
    </main></div>{busy && <div className="sp-busy" role="status"><LoaderCircle size={15} className="sp-spin" />{busy}</div>}
  </div>;
}
