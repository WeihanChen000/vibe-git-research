import { createHash, randomUUID } from "node:crypto";
import type { SciencePALCreateInput, SciencePALTask, SciencePALWorkflow } from "@vibe-git/protocol";
import { badRequest, invalidState, notFound } from "../domain/errors.js";
import type { V20Repository } from "../v20/repository.js";
import { MAX_ARTIFACT_BYTES, SciencePALError, type SciencePALRemote } from "./client.js";

const now = () => new Date().toISOString();
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const text = (s: unknown, label: string, max = 12_000): string => {
  if (typeof s !== "string" || !s.trim() || s.length > max) throw badRequest(`${label}不能为空，且不超过 ${max} 字符`);
  return s.trim();
};
export class SciencePALService {
  private readonly locks = new Set<string>();
  constructor(private readonly repo: V20Repository, readonly remote: SciencePALRemote) {
    repo.db.exec(`CREATE TABLE IF NOT EXISTS sciencepal_workflows (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sciencepal_artifacts (id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, bytes BLOB NOT NULL);`);
    // A crash may happen after a POST was accepted but before its response was saved.
    for (const workflow of this.list()) {
      let changed = false;
      for (const task of workflow.tasks) if (task.status === "STARTING") {
        task.status = "UNKNOWN"; task.error = "Host 在提交期间重启，远端结果未知。请到 SciencePAL 核对，不可自动重发。"; changed = true;
      }
      if (changed) this.save(workflow, "恢复了未确认的提交；已阻止重复启动");
    }
  }
  roomId() { return this.repo.room()?.id ?? "local"; }
  list(): SciencePALWorkflow[] {
    return (this.repo.db.prepare("SELECT data FROM sciencepal_workflows ORDER BY rowid DESC").all() as { data: string }[]).map(r => JSON.parse(r.data));
  }
  get(id: string): SciencePALWorkflow {
    const row = this.repo.db.prepare("SELECT data FROM sciencepal_workflows WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) throw notFound("SciencePAL 协作任务不存在");
    return JSON.parse(row.data);
  }
  private save(w: SciencePALWorkflow, message?: string) {
    w.updatedAt = now();
    if (message) w.events.push({ at: w.updatedAt, message });
    this.repo.db.prepare("INSERT INTO sciencepal_workflows(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(w.id, JSON.stringify(w));
  }
  async create(input: SciencePALCreateInput) {
    const title = text(input?.title, "标题", 120);
    const p = text(input?.producerPrompt, "A 任务"), c = text(input?.consumerPrompt, "B 任务");
    const output = text(input?.outputFilename, "输出文件名", 100);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(output) || output === "receipt.json") throw badRequest("A 输出须为普通文件名，不含目录，且不能叫 receipt.json");
    const agents = await this.remote.agents();
    const a = agents.find(a => a.id === input.producerAgentId), b = agents.find(a => a.id === input.consumerAgentId);
    if (!a || !b || a.id === b.id) throw badRequest("请选择当前账号下两个不同的 SciencePAL Agent");
    const task = (role: SciencePALTask["role"], agent: typeof a, prompt: string, outputFilename: string): SciencePALTask => ({
      id: randomUUID(), role, agent, prompt, outputFilename, status: "READY", threadId: null, runId: null, sandboxId: null,
      remoteStatus: null, error: null, artifact: null, inputArtifactId: null, inputSha256: null,
    });
    const w: SciencePALWorkflow = { id: randomUUID(), roomId: this.roomId(), title, createdAt: now(), updatedAt: now(),
      tasks: [task("producer", a, p, output), task("consumer", b, c, "receipt.json")], verification: null, events: [] };
    this.save(w, "已创建 A → 文件成果 → B 协作流程，绑定两个独立 Agent"); return w;
  }
  private async locked(id: string, fn: (w: SciencePALWorkflow) => Promise<void>) {
    if (this.locks.has(id)) throw invalidState("此协作流程正在处理，请稍后刷新");
    this.locks.add(id);
    try { const w = this.get(id); await fn(w); return this.get(id); } finally { this.locks.delete(id); }
  }
  async start(id: string, role: string) {
    return this.locked(id, async w => {
      const t = w.tasks.find(t => t.role === role); if (!t) throw badRequest("未知任务角色");
      if (t.status !== "READY") throw invalidState("该任务已经提交，不能重复启动");
      let file: { filename: string; bytes: Uint8Array } | undefined;
      let prompt = `${t.prompt}\n\nVibe-Git task ${w.id}/${t.role}. Use actual sandbox tools. Do not ask clarification. Do not access unrelated personal files.\n`;
      if (role === "consumer") {
        const a = w.tasks[0]; if (!a.artifact) throw invalidState("必须先采集 A 的真实成果文件");
        file = { filename: a.artifact.filename, bytes: this.artifact(w.id, a.artifact.id).bytes };
        if (sha(file.bytes) !== a.artifact.sha256) throw invalidState("已保存成果的哈希不一致，停止交接");
        t.inputArtifactId = a.artifact.id; t.inputSha256 = a.artifact.sha256;
        // B must independently read the attachment; do not provide the expected hash.
        prompt += `Read the attached ${file.filename} as bytes using Python. Execute the user task above using this input. Write /workspace/receipt.json as UTF-8 JSON with fields input_filename, input_sha256 (computed by hashlib.sha256 of actual file bytes), input_size_bytes, read_method='python_file_bytes', and result (your task results, including calculations or analysis). Never guess the hash. Stop after saving the file.\n`;
      } else prompt += `Save your actual output to /workspace/${t.outputFilename}. Do not change it after completion. Stop after the file exists.\n`;
      t.status = "STARTING"; t.error = null;
      this.save(w, `${role === "producer" ? "A" : "B"} 开始提交；已持久化防重状态`);
      try {
        const result = await this.remote.start(t.agent.id, prompt, file);
        t.threadId = result.threadId; t.runId = result.runId; t.status = "RUNNING";
        this.save(w, `${role === "producer" ? "A" : "B"} 已获得真实运行 ID${file ? "，已附加 A 的原始文件字节" : ""}`);
      } catch (error) {
        t.status = error instanceof SciencePALError && !error.uncertain ? "FAILED" : "UNKNOWN";
        t.error = error instanceof SciencePALError ? error.message : "提交结果未知，请到 SciencePAL 核对，系统不会重发";
        this.save(w, t.error);
      }
    });
  }
  async sync(id: string) {
    return this.locked(id, async w => {
      for (const t of w.tasks) {
        if (!t.runId || !["RUNNING", "NEEDS_INPUT"].includes(t.status)) continue;
        try {
          const status = await this.remote.run(t.runId);
          const before = t.remoteStatus; t.remoteStatus = status; t.error = null;
          t.status = status === "completed" ? "COMPLETED" : ["failed", "stopped", "cancelled", "error"].includes(status) ? "FAILED"
            : ["asked", "waiting_for_input", "paused"].includes(status) ? "NEEDS_INPUT" : "RUNNING";
          if (t.status === "FAILED") t.error = `远端运行 ${status}，请到 SciencePAL 查看原因`;
          this.save(w, before !== status ? `${t.role === "producer" ? "A" : "B"} 远端状态：${status}` : undefined);
        } catch (error) {
          t.error = error instanceof SciencePALError ? error.message : "状态同步失败，请稍后刷新";
          this.save(w);
        }
      }
    });
  }
  async collect(id: string, role: string) {
    return this.locked(id, async w => {
      const t = w.tasks.find(t => t.role === role); if (!t) throw badRequest("未知任务角色");
      if (t.artifact) return;
      if (t.status !== "COMPLETED" || !t.threadId) throw invalidState("远端运行完成后才能采集成果");
      const info = await this.remote.sandbox(t.threadId);
      if (info.agentId !== t.agent.id) throw invalidState("远端线程 Agent 身份与绑定身份不一致");
      if (role === "consumer" && info.sandboxId === w.tasks[0].sandboxId) throw invalidState("两个 Agent 未使用独立沙箱，无法证明交接");
      const bytes = await this.remote.download(info.sandboxId, t.outputFilename);
      if (!bytes.length || bytes.length > MAX_ARTIFACT_BYTES) throw badRequest("成果文件为空或超过 5 MiB");
      t.sandboxId = info.sandboxId;
      if (info.projectId) t.projectId = info.projectId;
      t.artifact = { id: randomUUID(), filename: t.outputFilename, sha256: sha(bytes), size: bytes.length, collectedAt: now() };
      t.error = null;
      this.repo.tx(() => {
        this.repo.db.prepare("INSERT INTO sciencepal_artifacts(id,workflow_id,bytes) VALUES (?,?,?)").run(t.artifact!.id, w.id, bytes);
        this.save(w, `${role === "producer" ? "A" : "B"} 成果已冻结：${t.outputFilename}，${bytes.length} 字节`);
      });
    });
  }
  artifact(workflowId: string, artifactId: string) {
    const w = this.get(workflowId), meta = w.tasks.map(t => t.artifact).find(a => a?.id === artifactId);
    const row = this.repo.db.prepare("SELECT bytes FROM sciencepal_artifacts WHERE id=? AND workflow_id=?").get(artifactId, workflowId) as { bytes: Uint8Array } | undefined;
    if (!meta || !row) throw notFound("成果文件不存在");
    if (sha(row.bytes) !== meta.sha256) throw invalidState("成果文件校验失败");
    return { ...meta, bytes: row.bytes };
  }
  async verify(id: string) {
    return this.locked(id, async w => {
      const [a, b] = w.tasks;
      if (!a.artifact || !b.artifact) throw invalidState("请先采集两端成果");
      let receipt: any;
      try { receipt = JSON.parse(Buffer.from(this.artifact(w.id, b.artifact.id).bytes).toString("utf8")); }
      catch { throw badRequest("B 回执不是有效 JSON"); }
      if (!receipt || typeof receipt !== "object") throw badRequest("B 回执必须是 JSON 对象");
      const bytes = this.artifact(w.id, a.artifact.id).bytes;
      const checks = [
        { name: "两个不同的 Agent", passed: a.agent.id !== b.agent.id },
        { name: "两个不同的线程与沙箱", passed: !!a.sandboxId && !!b.sandboxId && a.threadId !== b.threadId && a.sandboxId !== b.sandboxId },
        { name: "交接的是已冻结的 A 成果", passed: b.inputArtifactId === a.artifact.id && b.inputSha256 === sha(bytes) },
        { name: "B 回执文件名一致", passed: receipt.input_filename === a.artifact.filename },
        { name: "B 读取的字节数一致", passed: receipt.input_size_bytes === bytes.length },
        { name: "B 独立计算的 SHA-256 一致", passed: receipt.input_sha256 === sha(bytes) },
        { name: "B 声明通过 Python 读取文件", passed: receipt.read_method === "python_file_bytes" },
        { name: "B 返回了任务结果", passed: receipt.result !== undefined && receipt.result !== null && receipt.result !== "" },
      ];
      w.verification = { passed: checks.every(c => c.passed), checks, checkedAt: now() };
      this.save(w, w.verification.passed ? "文件交接验证通过（不等同于科研结论正确性审核）" : "文件交接验证未通过，请检查回执");
    });
  }
}
