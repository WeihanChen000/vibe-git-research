import {taskFingerprint} from "../src/sciencepal/research-governance.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SPCreateProject, SPProject, SPRun, SPResultSchemas } from "@vibe-git/protocol";
import { isLatestSPRun } from "@vibe-git/protocol";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/db/database.js";
import { V20Repository } from "../src/v20/repository.js";
import { SciencePALPipeline } from "../src/sciencepal/pipeline.js";
import { SciencePALError, type SciencePALInputFile, type SciencePALRemote } from "../src/sciencepal/client.js";
import { checkTaskResult, validateResultSchemas } from "../src/sciencepal/result-contract.js";
import { reviewResult } from "../src/sciencepal/pipeline-contract.js";
import { IRIS_RESULT_SCHEMAS } from "@vibe-git/protocol";

const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const criteria = ["Actual data exists", "Preserve source evidence"];
const input = { title: "Governed experiment", coordinatorId: "a", proposals: [{ agentId: "a", content: "Generate simulated data with a nonce; use 5 samples." }, { agentId: "b", content: "Analyze the upstream data; use 10 samples." }] };
class Remote implements SciencePALRemote {
  transform: (kind: string, result: any) => any = (_kind, result) => result;
  configured = true; conflict = false; cycle = false; malformed = false; wrongHash = false;
  parallel = false;
  wrongIdentity = false; rejectOnce = false; rejected = false; rejectChange = false; uncertain = false;
  status = "completed";
  calls: { id: string; kind: string; agentId: string; context: any; files: SciencePALInputFile[]; bytes: Uint8Array }[] = [];
  async agents() { return [{ id: "a", name: "Data" }, { id: "b", name: "Analyst" }]; }
  async start(agentId: string, prompt: string, file?: SciencePALInputFile, additionalFiles: SciencePALInputFile[] = []) {
    const files = [...(file ? [file] : []), ...additionalFiles], context = JSON.parse(Buffer.from(files[0]!.bytes).toString());
    const kind = prompt.match(/SciencePAL (\w+) job/)![1]!, id = `run-${this.calls.length + 1}`;
    let result: any;
    if (kind === "ALIGN") result = {
      alignmentMarkdown: context.publishedRequirement || "# Frozen requirement\nGenerate data then analyze it.",
      issues: this.conflict && !context.decisions.length ? [{ title: "Sample count", evidence: [{ nodeId: "a", excerpt: "use 5 samples" }, { nodeId: "b", excerpt: "use 10 samples" }], options: [{ id: "five", label: "5", impact: "smaller" }, { id: "ten", label: "10", impact: "larger" }], recommendedOptionId: "five" }] : [],
      tasks: [
        { key: "data", title: "Produce", goal: "Generate data", boundary: "Synthetic only", acceptance: criteria, dependencies: this.cycle ? ["analysis"] : [], assigneeAgentId: "a" },
        { key: "analysis", title: "Analyze", goal: "Read data", boundary: "Only supplied data", acceptance: criteria, dependencies: this.parallel ? [] : ["data"], assigneeAgentId: "b" },
      ],
    };
    else if (kind === "TASK") result = { simulated: true, nonce: "unpredictable-test-nonce", values: [1, 2, 3] };
    else if (kind === "REVIEW") {
      const reject = this.rejectOnce && !this.rejected && context.task.key === "data"; if (reject) this.rejected = true;
      result = { verdict: reject ? "request_changes" : "approve", summary: reject ? "Repair missing data" : "Checked actual data", checks: context.task.acceptance.map((criterion: string) => ({ criterion, passed: !reject, evidence: `${context.task.outputFilename}: inspected content with Python` })), requiredChanges: reject ? ["Include missing measurements"] : [] };
    } else result = { verdict: this.rejectChange ? "reject" : "accept", rationale: "Checked requirement impact", affectedTaskKeys: context.tasks.map((t: any) => t.key), requirementMarkdown: this.rejectChange ? "" : "# Revised requirement\nGenerate data, analyze it, and calculate median." };
    const output = { revision: context.revision, inputReceipts: files.map(f => ({ filename: f.filename, sha256: this.wrongHash ? "bad" : hash(f.bytes), size: f.bytes.length })), result: this.transform(kind, result) };
    const bytes = Buffer.from(this.malformed ? "not JSON" : JSON.stringify(output));
    this.calls.push({ id, kind, agentId, context, files, bytes });
    if (this.uncertain) throw new SciencePALError("Submission unknown", true);
    return { threadId: id, runId: id };
  }
  async run() { return this.status; }
  async threadRuns(threadId: string) { return this.calls.filter(c => c.id === threadId).map(c => ({ id: c.id, threadId, agentId: this.wrongIdentity ? "other" : c.agentId, startedAt: new Date().toISOString() })); }
  async sandbox(threadId: string) { return { sandboxId: threadId, projectId: `project-${threadId}`, agentId: this.wrongIdentity ? "other" : this.calls.find(c => c.id === threadId)!.agentId }; }
  async download(id: string) { return this.calls.find(c => c.id === id)!.bytes; }
}
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
async function setup(createInput: SPCreateProject = input) {
  const db = openDatabase(":memory:"); cleanup.push(() => db.close());
  const repo = new V20Repository(db); repo.putRoom({ id: "original-room", createdAt: new Date().toISOString() });
  const remote = new Remote(), pipeline = new SciencePALPipeline(repo, remote), p = await pipeline.create(createInput);
  const command = (action: string, extra: object = {}) => pipeline.command(p.id, action, { revision: pipeline.get(p.id).revision, ...extra });
  return { db, repo, remote, pipeline, id: p.id, command };
}
async function until(pipeline: SciencePALPipeline, id: string, predicate: (p: SPProject) => boolean) {
  for (let i = 0; i < 35; i++) { const p = pipeline.get(id); if (predicate(p)) return p; await pipeline.tick(); }
  throw new Error(`Did not settle: ${JSON.stringify(pipeline.get(id))}`);
}
async function publish(s: Awaited<ReturnType<typeof setup>>) {
  await s.command("align"); const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
  await s.command("publish", { alignmentRunId: ready.alignment!.runId });
}

const strictSchema = { type: "object", properties: { simulated: { type: "boolean" }, nonce: { type: "string", minLength: 1 }, values: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 } }, required: ["simulated", "nonce", "values"], additionalProperties: false } as const;
const resultSchemas: SPResultSchemas = JSON.parse(JSON.stringify({ data: strictSchema, analysis: strictSchema }));
describe("SciencePAL frozen result contracts", () => {
  it.each([
    { simulated: true, nonce: "ok", values: ["1", 2, 3] },
    { simulated: true, values: [1, 2, 3] },
    { simulated: true, nonce: "ok", values: { first: 1, second: 2, third: 3 } },
    { simulated: true, nonce: "ok", values: [1, 2, 3], extra: true },
  ])("rejects malformed results unchanged before any reviewer/downstream call: %j", async malformed => {
    const s = await setup({ ...input, resultSchemas });
    s.remote.transform = (kind, result) => kind === "TASK" ? malformed : result;
    await publish(s);
    const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED"), run = p.runs.find(r => r.kind === "TASK")!;
    expect(run.status).toBe("INVALID"); expect(run.resultValidation?.status).toBe("FAILED");
    expect(run.error).toContain("/result"); expect(p.tasks[0]!.artifactId).toBeNull();
    expect(s.remote.calls.map(c => c.kind)).toEqual(["ALIGN", "TASK"]);
    expect(JSON.parse(Buffer.from(s.pipeline.file(s.id, run.output!.id).bytes).toString()).result).toEqual(malformed);
    await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(2);
    const repairPipeline = new SciencePALPipeline(s.repo, s.remote);
    s.remote.transform = (_kind, result) => result;
    await repairPipeline.command(s.id, "retry", { revision: 1, runId: run.id });
    const done = await until(repairPipeline, s.id, p => p.phase === "COMPLETED");
    expect(done.runs.filter(r => r.kind === "TASK").map(r => r.resultValidation?.status)).toEqual(["FAILED", "PASSED", "PASSED"]);
    expect(s.remote.calls[2]!.context.resultSchemas).toEqual(resultSchemas);
    expect(s.remote.calls[3]!.files.some(f => hash(f.bytes) === run.output!.sha256)).toBe(false);
    const evidence = repairPipeline.evidence(s.id);
    expect(evidence.allApproved).toBe(true); expect(evidence.resultContracts?.id).toBe(done.resultContracts!.id);
  });
  it("does not let alignment override frozen schemas and preserves them across rework/revision", async () => {
    const s = await setup({ ...input, resultSchemas }); s.remote.rejectOnce = true;
    s.remote.transform = (kind, result) => kind === "ALIGN" ? { ...result, tasks: result.tasks.map((t: any) => ({ ...t, resultSchema: { type: "string" } })) } : result;
    await publish(s); const rejected = await until(s.pipeline, s.id, p => p.phase === "CHANGES_REQUESTED");
    expect(rejected.tasks[0]!.resultSchema).toEqual(strictSchema);
    await s.command("rework", { taskKey: "data" }); await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    await s.command("change", { request: "Explain median without changing result types" });
    const changed = await until(s.pipeline, s.id, p => p.phase === "CHANGE_READY");
    await s.command("apply-change", { changeId: changed.changes[0]!.id });
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(ready.resultContracts).toEqual(rejected.resultContracts);
    expect(ready.alignment!.tasks[0]!.resultSchema).toEqual(strictSchema);
    expect(s.pipeline.evidence(s.id, 1).allApproved).toBe(true);
    expect(s.remote.calls.every(c => JSON.stringify(c.context.resultSchemas) === JSON.stringify(resultSchemas))).toBe(true);
  });
  it("blocks alignment when it renames/removes a contracted task", async () => {
    const s = await setup({ ...input, resultSchemas });
    s.remote.transform = (kind, result) => { if (kind === "ALIGN") result.tasks[1].key = "renamed"; return result; };
    await s.command("align"); const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    expect(p.error).toContain("完整匹配"); expect(p.tasks).toHaveLength(0);
  });
  it("rejects a tampered contract before dispatch", async () => {
    const s = await setup({ ...input, resultSchemas }), file = s.pipeline.get(s.id).resultContracts!;
    await s.command("align");
    s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=? WHERE id=?").run(Buffer.from("{}"), file.id);
    await s.pipeline.tick(); expect(s.pipeline.get(s.id).phase).toBe("BLOCKED"); expect(s.remote.calls).toHaveLength(0);
    expect(() => s.pipeline.evidence(s.id)).toThrow("哈希");
  });
  it.each([ { $ref: "https://example.com/schema" }, { pattern: "(a+)+" }, { default: 3 }, { anyOf: [] }, { properties: { constructor: { type: "string" } } } ])("rejects unsupported schema constructs %j", async extra => {
    await expect(setup({ ...input, resultSchemas: { data: { ...strictSchema, ...extra } as any, analysis: resultSchemas.analysis! } })).rejects.toThrow();
  });
  it("accepts the pinned Iris tuple schema but refuses historical object rows and non-boolean overlap", () => {
    const schemas = validateResultSchemas(IRIS_RESULT_SCHEMAS);
    const audit = { synthetic: false, source_sha256: "0".repeat(64), measurement_unit: "cm", record_count: 150, limitations: ["Historical"], dataset: "UCI Iris",
      species_counts: { "Iris-setosa": 50, "Iris-versicolor": 50, "Iris-virginica": 50 }, rows: Array.from({length:150}, () => [1, 2, 3, 4, "Iris-setosa"]) };
    expect(checkTaskResult(schemas, "data_audit", audit, "hash").status).toBe("PASSED");
    expect(checkTaskResult(schemas, "data_audit", { ...audit, rows: audit.rows.map(() => ({ sepal_length: "1" })) }, "hash").status).toBe("FAILED");
    // This is a format test: repeated species values still need independent content review.
    expect(checkTaskResult({ data: { type: "object", properties: { overlap: { type: "boolean" } }, required: ["overlap"] } }, "data", { overlap: { overlap: true } }, "hash").status).toBe("FAILED");
  });
});

describe("SciencePAL governed collaboration", () => {
  it("aligns proposals, waits for publication, hands real bytes to independent reviewers, then releases downstream", async () => {
    const s = await setup(); await s.command("align");
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(ready.roomId).toBe("original-room"); await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(1);
    await s.command("publish", { alignmentRunId: ready.alignment!.runId });
    const done = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    expect(s.remote.calls.map(c => c.kind)).toEqual(["ALIGN", "TASK", "REVIEW", "TASK", "REVIEW"]);
    expect(done.tasks.every(t => t.status === "APPROVED" && t.assigneeAgentId !== t.reviewerAgentId)).toBe(true);
    const upstream = s.remote.calls[1]!.bytes;
    expect(s.remote.calls[2]!.files.find(f => f.filename === "data.json")!.bytes).toEqual(new Uint8Array(upstream));
    expect(s.remote.calls[3]!.files.find(f => f.filename === "data.json")!.bytes).toEqual(new Uint8Array(upstream));
    expect(done.runs.every(r => r.status === "COLLECTED")).toBe(true);
  });
  it("requires human conflict decisions and re-aligns the frozen evidence", async () => {
    const s = await setup(); s.remote.conflict = true; await s.command("align");
    const conflict = await until(s.pipeline, s.id, p => p.phase === "NEEDS_DECISION");
    await expect(s.command("publish", { alignmentRunId: conflict.alignmentRunId })).rejects.toThrow();
    await s.command("decide", { alignmentRunId: conflict.alignmentRunId, issueId: "issue-1", optionId: "five" });
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(ready.alignment!.issues).toEqual([]); expect(s.remote.calls[1]!.context.decisions[0].selectedOptionId).toBe("five");
    expect(ready.proposals.map(p => p.content)).toEqual(input.proposals.map(p => p.content));
  });
  it("blocks downstream after rejection, preserves the old attempt and only reruns on explicit rework", async () => {
    const s = await setup(); s.remote.rejectOnce = true; await publish(s);
    const rejected = await until(s.pipeline, s.id, p => p.phase === "CHANGES_REQUESTED");
    expect(s.remote.calls.filter(c => c.kind === "TASK")).toHaveLength(1);
    expect(rejected.tasks[1]!.status).toBe("WAITING"); const old = rejected.tasks[0]!.artifactId!;
    await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(3);
    await s.command("rework", { taskKey: "data" });
    const done = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    expect(done.tasks[0]!.attempt).toBe(2); expect(done.tasks[0]!.artifactId).not.toBe(old);
    expect(s.pipeline.file(s.id, old).bytes.length).toBeGreaterThan(0);
    const repair = s.remote.calls.find(c => c.kind === "TASK" && c.context.feedback)!;
    expect(repair.context.feedback).toContain("Include missing measurements");
    expect(repair.files.some(f => f.filename === "previous-data.json")).toBe(true);
    const before = JSON.stringify(s.pipeline.get(s.id)), calls = s.remote.calls.length;
    const attempts = s.pipeline.attempts(s.id, "data");
    expect(attempts.map(a => a.reviews.map(r => r.result?.verdict))).toEqual([["request_changes"], ["approve"]]);
    expect(attempts.map(a => a.execution.output!.id)).toEqual([old, done.tasks[0]!.artifactId]);
    expect(attempts[0]!.feedback).toBe("");
    expect(attempts[1]!.feedback).toContain("Include missing measurements");
    expect(JSON.stringify(s.pipeline.get(s.id))).toBe(before);
    expect(s.remote.calls).toHaveLength(calls);
  });
  it.each(["prefilled", "custom", "appended"])("keeps one copy of prefilled rework feedback and preserves captain additions: %s", async mode => {
    const s = await setup(); s.remote.rejectOnce = true;
    s.remote.transform = (kind, result) => kind === "REVIEW" && result.verdict === "request_changes" ? { ...result, requiredChanges: ["Include missing measurements", "Preserve original units"] } : result;
    await publish(s); await until(s.pipeline, s.id, p => p.phase === "CHANGES_REQUESTED");
    const custom = mode !== "prefilled", base = "Include missing measurements\nPreserve original units", extra = "Document the independent calculation method";
    const note = mode === "appended" ? base + "\n" + extra : custom ? extra : base;
    await s.command("rework", { taskKey: "data", note });
    await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    const repair = s.remote.calls.find(c => c.kind === "TASK" && c.context.feedback)!;
    expect(repair.context.feedback).toBe("Repair missing data\nInclude missing measurements\nPreserve original units" + (custom ? "\n" + extra : ""));
    const attempts = s.pipeline.attempts(s.id, "data");
    expect(attempts[0]!.reviews[0]!.result!.requiredChanges).toEqual(["Include missing measurements", "Preserve original units"]);
  });
  it("reviews a requirement change, requires confirmation, archives old results and realigns at R2", async () => {
    const s = await setup(); await publish(s); const done = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    await s.command("change", { request: "Add median" });
    const reviewed = await until(s.pipeline, s.id, p => p.phase === "CHANGE_READY");
    expect(reviewed.revision).toBe(1); expect(reviewed.requirementMarkdown).toBe(done.requirementMarkdown);
    await s.command("apply-change", { changeId: reviewed.changes[0]!.id });
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(ready.revision).toBe(2); expect(ready.history[0]!.tasks.every(t => t.status === "APPROVED")).toBe(true);
    expect(ready.tasks).toHaveLength(0); expect(ready.requirementMarkdown).toContain("median");
    await expect(s.pipeline.command(s.id, "publish", { revision: 1, alignmentRunId: done.alignmentRunId })).rejects.toThrow("版本");
    await s.command("publish", { alignmentRunId: ready.alignmentRunId });
    const final = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    expect(final.runs.filter(r => r.revision === 2 && r.kind === "TASK")).toHaveLength(2);
    expect(final.tasks[0]!.artifactId).not.toBe(done.tasks[0]!.artifactId);
    expect(s.pipeline.attempts(s.id, "data", 1)[0]!.execution.output!.id).toBe(done.tasks[0]!.artifactId);
    expect(s.pipeline.attempts(s.id, "data")[0]!.execution.output!.id).toBe(final.tasks[0]!.artifactId);
    expect(s.pipeline.attempts(s.id, "data", 1).flatMap(a => a.reviews).every(r => r.run.revision === 1)).toBe(true);
  });
  it("cannot apply rejected changes and resumes the prior stage on dismissal", async () => {
    const s = await setup(); s.remote.rejectChange = true; await publish(s); await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    await s.command("change", { request: "Remove all validation" }); const p = await until(s.pipeline, s.id, p => p.phase === "CHANGE_READY");
    await expect(s.command("apply-change", { changeId: p.changes[0]!.id })).rejects.toThrow();
    expect((await s.command("dismiss-change", { changeId: p.changes[0]!.id })).phase).toBe("COMPLETED");
    expect(s.pipeline.get(s.id).revision).toBe(1);
  });
  it("reviews changes to draft tasks before publication without executing them", async () => {
    const s = await setup(); await s.command("align");
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    await s.command("change", { request: "Add median before publication" });
    const reviewed = await until(s.pipeline, s.id, p => p.phase === "CHANGE_READY");
    expect(reviewed.changes[0]!.result!.affectedTaskKeys).toEqual(["data", "analysis"]);
    expect(s.remote.calls[1]!.context.requirement).toBe(ready.alignment!.alignmentMarkdown);
    expect(s.remote.calls[1]!.context.tasks).toHaveLength(2);
    expect(s.remote.calls.some(c => c.kind === "TASK")).toBe(false);
    await s.command("apply-change", { changeId: reviewed.changes[0]!.id });
    const revised = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(revised.revision).toBe(2); expect(revised.tasks).toHaveLength(0);
    expect(revised.alignment!.alignmentMarkdown).toContain("median");
  });
  it("recovers an unknown submission through an existing verified thread without re-submitting", async () => {
    const s = await setup(); s.remote.uncertain = true; await s.command("align");
    const blocked = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    const run = blocked.runs[0]!; expect(run.status).toBe("UNKNOWN");
    await expect(s.command("recover", { runId: run.id, threadId: "missing" })).rejects.toThrow("恰好");
    s.remote.wrongIdentity = true;
    await expect(s.command("recover", { runId: run.id, threadId: "run-1" })).rejects.toThrow("Agent");
    expect(s.pipeline.get(s.id).runs[0]!.status).toBe("UNKNOWN");
    s.remote.wrongIdentity = false;
    await s.command("recover", { runId: run.id, threadId: "run-1" });
    await expect(s.command("recover", { runId: run.id, threadId: "run-1" })).rejects.toThrow();
    const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    expect(ready.runs[0]!.status).toBe("COLLECTED"); expect(s.remote.calls).toHaveLength(1);
  });
  it("still rejects mismatched frozen inputs after recovery", async () => {
    const s = await setup(); s.remote.uncertain = true; s.remote.wrongHash = true; await s.command("align");
    const blocked = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    await s.command("recover", { runId: blocked.runs[0]!.id, threadId: "run-1" });
    const invalid = await until(s.pipeline, s.id, p => p.runs[0]!.status === "INVALID");
    expect(invalid.phase).toBe("BLOCKED"); expect(invalid.alignment).toBeNull(); expect(s.remote.calls).toHaveLength(1);
  });
  it("rejects cycles and allows one explicit repaired retry without duplicate submissions", async () => {
    const s = await setup(); s.remote.cycle = true; await s.command("align");
    const blocked = await until(s.pipeline, s.id, p => p.phase === "BLOCKED"); const run = blocked.runs[0]!;
    expect(run.status).toBe("INVALID"); expect(run.error).toContain("循环"); expect(run.output).not.toBeNull();
    s.remote.cycle = false; await s.command("retry", { runId: run.id });
    await expect(s.command("retry", { runId: run.id })).rejects.toThrow("替代");
    await until(s.pipeline, s.id, p => p.phase === "READY"); expect(s.remote.calls).toHaveLength(2);
  });
  it.each(["wrongHash", "wrongIdentity", "malformed"] as const)("never promotes unverified %s output", async flag => {
    const s = await setup(); s.remote[flag] = true; await s.command("align");
    const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    expect(p.runs[0]!.status).toBe("INVALID"); expect(p.alignment).toBeNull();
    await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(1);
  });
  it("persists unknown submissions, prevents retries and recovers pending submissions conservatively", async () => {
    const s = await setup(); s.remote.uncertain = true; await s.command("align");
    const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    expect(p.runs[0]!.status).toBe("UNKNOWN");
    const recovered = new SciencePALPipeline(s.repo, s.remote); await recovered.tick();
    await expect(recovered.command(s.id, "retry", { revision: 1, runId: p.runs[0]!.id })).rejects.toThrow("未知");
    p.runs[0]!.status = "STARTING";
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p), p.id);
    expect(new SciencePALPipeline(s.repo, s.remote).get(s.id).runs[0]!.status).toBe("UNKNOWN");
    expect(s.remote.calls).toHaveLength(1);
  });
  it("restores known runs and automation after restart without creating a second alignment", async () => {
    const s = await setup(); await s.command("align"); await s.pipeline.tick();
    const restored = new SciencePALPipeline(s.repo, s.remote);
    await until(restored, s.id, p => p.phase === "READY"); expect(s.remote.calls).toHaveLength(1);
    const ready = restored.get(s.id); await restored.command(s.id, "publish", { revision: 1, alignmentRunId: ready.alignmentRunId });
    await until(restored, s.id, p => p.phase === "COMPLETED"); expect(s.remote.calls).toHaveLength(5);
  });
  it("validates the previously frozen bytes after a crash instead of downloading a mutated remote file", async () => {
    const s = await setup(); await s.command("align"); const p = await until(s.pipeline, s.id, p => p.phase === "READY");
    const artifactId = p.runs[0]!.output!.id;
    p.runs[0]!.status = "COMPLETED"; p.alignment = null; p.phase = "ALIGNING";
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p), p.id);
    s.remote.calls[0]!.bytes = Buffer.from("remote file changed after collection");
    const restored = new SciencePALPipeline(s.repo, s.remote); await restored.tick();
    expect(restored.get(s.id).phase).toBe("READY"); expect(restored.get(s.id).runs[0]!.output!.id).toBe(artifactId);
  });
  it("dispatches independent tasks to different Agents concurrently while keeping review gates", async () => {
    const s = await setup(); s.remote.parallel = true; await publish(s); await s.pipeline.tick();
    const running = s.pipeline.get(s.id).runs.filter(r => r.status === "RUNNING");
    expect(running).toHaveLength(2); expect(new Set(running.map(r => r.agent.id)).size).toBe(2);
    await expect(s.command("change", { request: "change during execution" })).rejects.toThrow("所有已提交运行");
    await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
  });
  it("pauses dispatch, serializes commands and rejects stale publication", async () => {
    const s = await setup();
    const results = await Promise.allSettled([s.command("align"), s.command("align")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await s.command("pause"); await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(0);
    await s.command("resume"); const ready = await until(s.pipeline, s.id, p => p.phase === "READY");
    await expect(s.command("publish", { alignmentRunId: "stale" })).rejects.toThrow("过期");
    await s.command("publish", { alignmentRunId: ready.alignmentRunId });
    await s.command("pause"); await s.pipeline.tick(); expect(s.remote.calls).toHaveLength(1);
  });
  it("does not lose authentication errors or turn an asked run into completion", async () => {
    const s = await setup(); s.remote.status = "asked"; await s.command("align"); await s.pipeline.tick(); await s.pipeline.tick();
    let p = s.pipeline.get(s.id); expect(p.runs[0]!.status).toBe("NEEDS_INPUT"); expect(p.alignment).toBeNull();
    s.remote.run = async () => { throw new SciencePALError("Key expired"); }; await s.pipeline.tick();
    p = s.pipeline.get(s.id); expect(p.runs[0]!.error).toBe("Key expired"); expect(s.remote.calls).toHaveLength(1);
  });
  it("rejects tampered queued input before transmitting it", async () => {
    const s = await setup(); await s.command("align");
    s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=?").run(Buffer.from("changed"));
    await s.pipeline.tick(); expect(s.pipeline.get(s.id).phase).toBe("BLOCKED"); expect(s.remote.calls).toHaveLength(0);
  });
  it("rejects incomplete or contradictory review approvals", async () => {
    const s = await setup(); await publish(s);
    await until(s.pipeline, s.id, p => p.runs.some(r => r.kind === "REVIEW"));
    const call = s.remote.calls.find(c => c.kind === "REVIEW")!;
    const response = JSON.parse(Buffer.from(call.bytes).toString()); response.result.checks[0].passed = false; call.bytes = Buffer.from(JSON.stringify(response));
    const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    expect(p.tasks[0]!.status).toBe("BLOCKED"); expect(p.tasks[1]!.status).toBe("WAITING");
    const invalidReview = p.runs.find(r => r.kind === "REVIEW")!;
    expect(s.pipeline.attempts(s.id, "data")[0]!.reviews[0]!.result).toBeNull();
    expect(isLatestSPRun(p.runs, invalidReview)).toBe(true);
    await s.command("retry", { runId: invalidReview.id });
    const done = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    const attempts = s.pipeline.attempts(s.id, "data");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.reviews.map(r => r.result?.verdict ?? r.run.status)).toEqual(["INVALID", "approve"]);
    expect(isLatestSPRun(done.runs, invalidReview)).toBe(false);
    await expect(s.command("retry", { runId: invalidReview.id })).rejects.toThrow("替代");
  });
  it("rejects unknown history scopes and tampered frozen evidence without mutating the project", async () => {
    const s = await setup(); await publish(s); await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    expect(() => s.pipeline.attempts("missing", "data")).toThrow("项目不存在");
    expect(() => s.pipeline.attempts(s.id, "missing")).toThrow("任务不存在");
    expect(() => s.pipeline.attempts(s.id, "data", 2)).toThrow("任务不存在");
    for (const revision of [0, -1, 1.5, NaN]) expect(() => s.pipeline.attempts(s.id, "data", revision)).toThrow("正整数");
    const p = s.pipeline.get(s.id), review = p.runs.find(r => r.kind === "REVIEW")!;
    s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=? WHERE id=?").run(Buffer.from("changed"), review.output!.id);
    expect(() => s.pipeline.attempts(s.id, "data")).toThrow("哈希");
    expect(s.pipeline.get(s.id)).toEqual(p);
  });
});
describe("frozen research source", () => {
  const bytes = Buffer.from("\ufeffvalue,label\r\n1,公开数据\r\n");
  const source = { filename: "source-data.csv", base64: bytes.toString("base64"), sourceUrl: "https://example.org/dataset", attribution: "Public fixture, CC BY 4.0" };
  it("preserves original bytes for alignment, execution, review and rework without disclosing expected hashes in context", async () => {
    const s = await setup({ ...input, source }); s.remote.rejectOnce = true; await publish(s);
    await until(s.pipeline, s.id, p => p.phase === "CHANGES_REQUESTED");
    await s.command("rework", { taskKey: "data" }); await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    for (const call of s.remote.calls) {
      expect(call.files.find(f => f.filename === source.filename)!.bytes).toEqual(new Uint8Array(bytes));
      expect(call.context.source).toEqual({ filename: source.filename, sourceUrl: source.sourceUrl, attribution: source.attribution });
      expect(JSON.stringify(call.context.source)).not.toContain(hash(bytes));
    }
    const evidence = s.pipeline.evidence(s.id);
    expect(evidence.source!.artifact.sha256).toBe(hash(bytes));
    expect(evidence.files.some(f => f.id === evidence.source!.artifact.id)).toBe(true);
    expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
  });
  it("accepts a research PDB filename while preserving its exact bytes", async () => {
    const s = await setup({ ...input, source: { ...source, filename: "source-structure.pdb" } });
    const p = s.pipeline.get(s.id);
    expect(p.source!.artifact.filename).toBe("source-structure.pdb");
    expect(Buffer.from(s.pipeline.file(p.id, p.source!.artifact.id).bytes)).toEqual(bytes);
  });
  it.each([
    { filename: "../source.csv" }, { filename: "context.json" },
    { base64: "not-base64!" }, { base64: Buffer.from([255, 254]).toString("base64") },
    { base64: Buffer.alloc(256 * 1024 + 1).toString("base64") },
    { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://key:secret@example.org/file" }, { attribution: "" },
  ])("rejects invalid source before creating a project: %j", async invalid => {
    const s = await setup(); const count = s.pipeline.list().length;
    await expect(s.pipeline.create({ ...input, source: { ...source, ...invalid } })).rejects.toThrow();
    expect(s.pipeline.list()).toHaveLength(count); expect(s.remote.calls).toHaveLength(0);
  });
  it("blocks a modified source before sending any remote request", async () => {
    const s = await setup({ ...input, source }); const p = s.pipeline.get(s.id);
    await s.command("align");
    s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=? WHERE id=?").run(Buffer.from("corrupt"), p.source!.artifact.id);
    await s.pipeline.tick(); expect(s.pipeline.get(s.id).phase).toBe("BLOCKED"); expect(s.remote.calls).toHaveLength(0);
    expect(() => s.pipeline.evidence(s.id)).toThrow("哈希");
  });
});
describe("read-only project evidence", () => {
  it("shows the rejected and repaired results, with verified approval before downstream dispatch", async () => {
    const s = await setup(); s.remote.rejectOnce = true; await publish(s);
    await until(s.pipeline, s.id, p => p.phase === "CHANGES_REQUESTED");
    const rejected = s.pipeline.evidence(s.id);
    expect(rejected.allApproved).toBe(false); expect(rejected.handoffs).toEqual([]);
    await s.command("rework", { taskKey: "data" });
    await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    const before = s.pipeline.get(s.id), count = s.remote.calls.length;
    s.remote.configured = false;
    s.remote.agents = async () => { throw new Error("must not call remote"); };
    const report = s.pipeline.evidence(s.id);
    expect(report.allApproved).toBe(true);
    expect(report.tasks[0]!.attempts.map(a => a.reviews[0]!.result!.verdict)).toEqual(["request_changes", "approve"]);
    expect(report.tasks[0]!.attempts[1]!.result).toMatchObject({ simulated: true });
    expect(report.handoffs).toHaveLength(1); expect(report.handoffs[0]!.checks.every(c => c.passed)).toBe(true);
    expect(report.handoffs[0]!.artifactId).toBe(report.tasks[0]!.attempts[1]!.execution.output!.id);
    expect(new Set(report.files.map(f => f.id)).size).toBe(report.files.length);
    expect(s.pipeline.get(s.id)).toEqual(before); expect(s.remote.calls).toHaveLength(count);
  });
  it("isolates archived revisions and never marks an unpublished revision completed", async () => {
    const s = await setup(); expect(s.pipeline.evidence(s.id).allApproved).toBe(false);
    await publish(s); await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    await s.command("change", { request: "Add median" });
    const reviewed = await until(s.pipeline, s.id, p => p.phase === "CHANGE_READY");
    await s.command("apply-change", { changeId: reviewed.changes[0]!.id });
    const archived = s.pipeline.evidence(s.id, 1), current = s.pipeline.evidence(s.id, 2);
    expect(archived.archived).toBe(true); expect(archived.allApproved).toBe(true);
    expect(archived.runs.every(r => r.revision === 1)).toBe(true);
    expect(current.archived).toBe(false); expect(current.allApproved).toBe(false); expect(current.tasks).toEqual([]);
    expect(() => s.pipeline.evidence(s.id, 0)).toThrow("正整数");
    expect(() => s.pipeline.evidence(s.id, 3)).toThrow("版本不存在");
  });
  it("rejects corrupted upstream bytes even when stored task status says approved", async () => {
    const s = await setup(); await publish(s); const p = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=? WHERE id=?").run(Buffer.from("changed"), p.tasks[0]!.artifactId);
    expect(() => s.pipeline.evidence(s.id)).toThrow("哈希");
    expect(s.pipeline.get(s.id).phase).toBe("COMPLETED");
  });
  it("reports a missing handoff gate and rejects self-review evidence", async () => {
    const s = await setup(); await publish(s); const p = await until(s.pipeline, s.id, p => p.phase === "COMPLETED");
    const downstream = p.runs.find(r => r.id === p.tasks[1]!.executionId)!;
    downstream.createdAt = "2000-01-01T00:00:00Z";
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p), p.id);
    expect(s.pipeline.evidence(s.id).handoffs[0]!.checks.some(c => !c.passed)).toBe(true);
    expect(s.pipeline.evidence(s.id).allApproved).toBe(false);
    const review = p.runs.find(r => r.id === p.tasks[0]!.reviewId)!;
    review.agent = p.runs.find(r => r.id === p.tasks[0]!.executionId)!.agent;
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p), p.id);
    expect(() => s.pipeline.evidence(s.id)).toThrow("独立性");
  });
});
describe("integrated Host routes", () => {
  it("uses the original Host and protects project commands and evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vg-sp-pipeline-")); cleanup.push(() => rm(root, { recursive: true, force: true }));
    const app = await buildApp({ dbPath: join(root, "test.db"), dataDir: join(root, "v20"), backupDatabase: false, staticDir: false, sciencepal: { remote: new Remote(), worker: false } });
    cleanup.push(() => app.close());
    const headers = { "x-vibe-sciencepal": "1" };
    expect((await app.inject({ method: "POST", url: "/api/sciencepal/projects", payload: input })).statusCode).toBe(403);
    expect((await app.inject({ url: "/api/sciencepal/projects", headers: { host: "evil.example" } })).statusCode).toBe(403);
    const created = await app.inject({ method: "POST", url: "/api/sciencepal/projects", payload: input, headers }); expect(created.statusCode).toBe(200);
    const p = created.json() as SPProject;
    const align = await app.inject({ method: "POST", url: `/api/sciencepal/projects/${p.id}/commands/align`, payload: { revision: 1 }, headers }); expect(align.statusCode).toBe(200);
    const pipeline = (app as unknown as { sciencepalPipeline: SciencePALPipeline }).sciencepalPipeline;
    const ready = await until(pipeline, p.id, p => p.phase === "READY");
    const artifact = ready.runs[0]!.output!;
    const download = await app.inject({ url: `/api/sciencepal/projects/${p.id}/artifacts/${artifact.id}` });
    expect(download.headers["content-disposition"]).toContain("attachment"); expect(download.headers["x-artifact-sha256"]).toBe(artifact.sha256);
    const other = await pipeline.create({ ...input, title: "other" });
    expect((await app.inject({ url: `/api/sciencepal/projects/${other.id}/artifacts/${artifact.id}` })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/sciencepal/state" })).json().workflows).toEqual([]);
    await pipeline.command(p.id, "publish", { revision: 1, alignmentRunId: ready.alignmentRunId });
    await until(pipeline, p.id, p => p.phase === "COMPLETED");
    const historyUrl = `/api/sciencepal/projects/${p.id}/tasks/data/attempts`;
    const history = await app.inject({ url: historyUrl });
    expect(history.statusCode).toBe(200); expect(history.headers["cache-control"]).toBe("no-store");
    expect(history.json()[0].reviews[0].result.verdict).toBe("approve");
    expect((await app.inject({ url: `${historyUrl}?revision=bad` })).statusCode).toBe(400);
    expect((await app.inject({ url: `${historyUrl}?revision=2` })).statusCode).toBe(404);
    expect((await app.inject({ url: historyUrl, headers: { origin: "https://evil.example" } })).statusCode).toBe(403);
    expect((await app.inject({ url: `/api/sciencepal/projects/${other.id}/tasks/data/attempts` })).statusCode).toBe(404);
    const evidenceUrl = `/api/sciencepal/projects/${p.id}/evidence`;
    const evidence = await app.inject({ url: `${evidenceUrl}?download=1` });
    expect(evidence.statusCode).toBe(200); expect(evidence.json().allApproved).toBe(true);
    expect(evidence.headers["content-disposition"]).toContain("attachment");
    expect(evidence.headers["cache-control"]).toBe("no-store");
    expect((await app.inject({ url: `${evidenceUrl}?revision=bad` })).statusCode).toBe(400);
    expect((await app.inject({ url: `${evidenceUrl}?revision=9` })).statusCode).toBe(404);
    expect((await app.inject({ url: evidenceUrl, headers: { origin: "https://evil.example" } })).statusCode).toBe(403);
  });
});

// Regression from the real Biology review: filename was in criterion, but not evidence.
it("identifies the exact malformed review check without accepting a plausible approval", () => {
 const acceptance = ["Match source", "Distances in geometry.json are correct"];
 const review = {verdict:"approve",summary:"geometry.json passes",checks:[
  {criterion:acceptance[0],passed:true,evidence:"geometry.json source hash matches"},
  {criterion:acceptance[1],passed:true,evidence:"Independent distance is 2.004107 A"}
 ],requiredChanges:[]};
 expect(()=>reviewResult(review,acceptance,"geometry.json")).toThrow(/checks\[1\]\.evidence.*geometry\.json/);
 review.checks[1]!.evidence="geometry.json distance 2.004107 A agrees with independent coordinate calculation";
 expect(reviewResult(review,acceptance,"geometry.json").verdict).toBe("approve");
 review.checks[1]!.passed=false;
 expect(()=>reviewResult(review,acceptance,"geometry.json")).toThrow("未通过所有验收项时不能批准");
});

import {CRN_CASE,CRN_RESULT_SCHEMAS} from '@vibe-git/protocol';
import {readFileSync} from 'node:fs';
describe('1CRN professional template',()=>{
 it('matches the unchanged source and validates actual saved professional results',()=>{
  const data=readFileSync(new URL('../../web/public/sciencepal-examples/1CRN.pdb',import.meta.url));expect(hash(data)).toBe(CRN_CASE.sha256);
  const bundle=JSON.parse(readFileSync(new URL('../../web/public/research-replay/1crn/case.json',import.meta.url),'utf8'));
  const schemas=validateResultSchemas(CRN_RESULT_SCHEMAS);
  for(const key of ['geometry','sasa']){
   const p=bundle.steps.at(-1).state.projects[0],t=p.tasks.find((v:any)=>v.key===key),f=bundle.files[t.artifactId];
   const output=JSON.parse(readFileSync(new URL('../../web/public'+f.url,import.meta.url),'utf8'));
   expect(checkTaskResult(schemas,key,output.result,'test').status).toBe('PASSED');
   delete output.result.pythonCode;expect(checkTaskResult(schemas,key,output.result,'test').status).toBe('FAILED');
  }
 });
});


describe("operator research drift constraints",()=>{
 it.each([
  [{taskKey:"data",field:"method",kind:"text",value:"fixed"},{method:"changed"}],
  [{taskKey:"data",field:"seed",kind:"number",value:42},{seed:"42"}],
  [{taskKey:"data",field:"score",kind:"range",min:0.9,max:1},{score:0.1}],
 ])("blocks drift before review and keeps raw evidence: %j",async(rule,result)=>{
  const s=await setup();await s.command("align");await until(s.pipeline,s.id,p=>p.phase==="READY");
  const frozen=await s.command("set-constraints",{constraints:[rule]});
  s.remote.transform=(kind,r)=>kind==="TASK"?{...r,...result}:r;
  await s.command("publish",{alignmentRunId:frozen.alignmentRunId});
  const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED"),run=blocked.runs.find(r=>r.kind==="TASK")!;
  expect(run.resultValidation?.status).toBe("FAILED");expect(run.output).not.toBeNull();
  expect(s.remote.calls.filter(c=>c.kind==="REVIEW")).toHaveLength(0);
  expect(s.remote.calls.filter(c=>c.kind==="TASK")).toHaveLength(1);
  await expect(s.command("set-constraints",{constraints:[rule]})).rejects.toThrow("首次发布前");
 });
 it("repairs a blocked result, then goes through rejection, rework, review and handoff",async()=>{
  const s=await setup();await s.command("align");await until(s.pipeline,s.id,p=>p.phase==="READY");
  const frozen=await s.command("set-constraints",{constraints:[{taskKey:"data",field:"seed",kind:"number",value:42}]});
  s.remote.transform=(kind,r)=>kind==="TASK"?{...r,seed:41}:r;
  await s.command("publish",{alignmentRunId:frozen.alignmentRunId});
  const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED"),bad=blocked.runs.find(r=>r.kind==="TASK")!;
  s.remote.transform=(kind,r)=>kind==="TASK"?{...r,seed:42}:r;s.remote.rejectOnce=true;
  await s.command("retry",{runId:bad.id});await until(s.pipeline,s.id,p=>p.phase==="CHANGES_REQUESTED");
  await s.command("rework",{taskKey:"data",note:"repair evidence"});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
  expect(done.resultContracts?.sha256).toBe(frozen.resultContracts?.sha256);
  expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
  expect(done.runs.find(r=>r.id===bad.id)?.resultValidation?.status).toBe("FAILED");
 });
});

it('keeps bounded review checks while allowing complete reproducibility material in the frozen raw result',()=>{
 const base={verdict:'request_changes',summary:'Method refinement needed',checks:[{criterion:'check',passed:false,evidence:'sasa.json: 100 point pilot; convergence not yet measured'}],requiredChanges:['Run convergence comparison'],reproduction:{code:'print(1)\n'.repeat(1000),toolVersions:{Python:'3.12'},results:{points:100}}};
 expect(reviewResult(base,['check'],'sasa.json').verdict).toBe('request_changes');
 expect(()=>reviewResult({...base,checks:[{...base.checks[0],evidence:'sasa.json '+base.reproduction.code}]},['check'],'sasa.json')).toThrow('3000');
});


describe("downstream approval proof",()=>{
 it("carries original approved review bytes bound to the exact upstream artifact",async()=>{
  const s=await setup();await publish(s);const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
  const task=done.tasks[0]!,review=done.runs.find(r=>r.id===task.reviewId)!;
  const upstream=s.pipeline.file(s.id,task.artifactId!);
  for(const call of s.remote.calls.filter(c=>c.context.task?.key==="analysis")){
   const proof=call.context.upstream[0].approval;expect(proof).toBeDefined();
   expect(proof.verdict).toBe("approve");expect(proof.reviewerAgentId).toBe(task.reviewerAgentId);
   expect(proof.reviewedArtifact).toMatchObject({id:upstream.id,sha256:upstream.sha256,size:upstream.size});
   const raw=Buffer.from(proof.reviewFileUtf8,"utf8");expect(hash(raw)).toBe(review.output!.sha256);
   expect(raw.length).toBe(review.output!.size);expect(JSON.parse(raw.toString()).result.verdict).toBe("approve");
  }
 });
 it.each(["corrupt-review","wrong-byte-binding","self-review"])("blocks %s approval proof before a new downstream dispatch",async fault=>{
  const s=await setup();await publish(s);const p=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
  const upstream=p.tasks[0]!,review=p.runs.find(r=>r.id===upstream.reviewId)!;
  if(fault==="corrupt-review")s.db.prepare("UPDATE sciencepal_pipeline_files SET bytes=? WHERE id=?").run(Buffer.from("changed"),review.output!.id);
  if(fault==="wrong-byte-binding")review.inputs.find(i=>i.artifactId===upstream.artifactId)!.sha256="0".repeat(64);
  if(fault==="self-review")review.agent=p.runs.find(r=>r.id===upstream.executionId)!.agent;
  p.tasks[1]!.status="WAITING";p.phase="EXECUTING";
  s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p),p.id);
  const count=p.runs.length;await s.pipeline.tick();const after=s.pipeline.get(p.id);
  expect(after.phase).toBe("BLOCKED");expect(after.runs).toHaveLength(count);
 });
});


describe("Host executable scientific gates",()=>{
 const scientificChecks={version:1 as const,tasks:{data:[{id:"sum",kind:"sum" as const,totalPath:"total",rowsPath:"rows",valueField:"value",absoluteTolerance:0.001}]}};
 it("rejects wrong numbers before review despite an always-approving reviewer, then repairs without deleting evidence",async()=>{
  const s=await setup({...input,scientificChecks});s.remote.transform=(kind,result)=>kind==="TASK"?{total:99,rows:[{value:1},{value:2}]}:result;
  await publish(s);const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");const failed=blocked.runs.find(r=>r.kind==="TASK")!;
  expect(failed.scientificValidation?.status).toBe("FAILED");expect(s.remote.calls.map(c=>c.kind)).toEqual(["ALIGN","TASK"]);
  expect(blocked.tasks[1]!.status).toBe("WAITING");expect(failed.output).not.toBeNull();
  s.remote.transform=(kind,result)=>kind==="TASK"?{total:3,rows:[{value:1},{value:2}]}:result;
  await s.command("retry",{runId:failed.id});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
  expect(done.runs.find(r=>r.id===failed.id)?.scientificValidation?.status).toBe("FAILED");
  const task=done.tasks[0]!,report=done.runs.find(r=>r.id===task.executionId)!.scientificValidation!;
  expect(report.status).toBe("PASSED");expect(report.artifactSha256).toBe(s.pipeline.file(s.id,task.artifactId!).sha256);
  const downstream=s.remote.calls.find(c=>c.kind==="TASK"&&c.context.task.key==="analysis")!;
  expect(downstream.context.upstream[0].approval.scientificValidation.status).toBe("PASSED");
  expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
 });
 it("rechecks exact candidate at approval, refusing a forged passing report",async()=>{
  const s=await setup({...input,scientificChecks});s.remote.transform=(kind,result)=>kind==="TASK"?{total:3,rows:[{value:1},{value:2}]}:result;await publish(s);
  const reviewing=await until(s.pipeline,s.id,p=>p.runs.some(r=>r.kind==="REVIEW"&&r.status==="RUNNING"));
  const task=reviewing.tasks[0]!,r=reviewing.runs.find(r=>r.id===task.executionId)!;
  const f=s.pipeline.file(s.id,r.output!.id),raw=JSON.parse(Buffer.from(f.bytes).toString());raw.result.total=99;
  const bytes=Buffer.from(JSON.stringify(raw)),meta={...r.output!,sha256:hash(bytes),size:bytes.length};r.output=meta;
  s.db.prepare("UPDATE sciencepal_pipeline_files SET metadata=?,bytes=? WHERE id=?").run(JSON.stringify(meta),bytes,meta.id);
  s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(reviewing),s.id);
  const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");expect(blocked.error).toContain("科学计算检查");
  expect(blocked.tasks[0]!.status).not.toBe("APPROVED");expect(s.remote.calls.some(c=>c.kind==="TASK"&&c.context.task.key==="analysis")).toBe(false);
 });
 it("checks again at downstream release instead of trusting approved state or cached report",async()=>{
  const s=await setup({...input,scientificChecks});s.remote.transform=(kind,result)=>kind==="TASK"?{total:3,rows:[{value:1},{value:2}]}:result;await publish(s);
  const reviewing=await until(s.pipeline,s.id,p=>p.runs.some(r=>r.kind==="REVIEW"&&r.status==="RUNNING"));
  const t=reviewing.tasks[0]!,r=reviewing.runs.find(r=>r.id===t.executionId)!;const raw=JSON.parse(Buffer.from(s.pipeline.file(s.id,r.output!.id).bytes).toString());raw.result.total=99;
  const bytes=Buffer.from(JSON.stringify(raw));r.output={...r.output!,sha256:hash(bytes),size:bytes.length};t.status="APPROVED";reviewing.runs.find(r=>r.id===t.reviewId)!.status="COLLECTED";
  s.db.prepare("UPDATE sciencepal_pipeline_files SET metadata=?,bytes=? WHERE id=?").run(JSON.stringify(r.output),bytes,r.output.id);
  s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(reviewing),s.id);
  const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");expect(blocked.error).toContain("科学计算检查");expect(blocked.tasks[1]!.executionId).toBeNull();
 });
 it("freezes rules against post-publication changes and rejects missing checked task",async()=>{
  const s=await setup({...input,scientificChecks});await publish(s);await expect(s.command("set-scientific-checks",{checks:scientificChecks})).rejects.toThrow("首次发布");
  const missing=await setup({...input,scientificChecks:{version:1,tasks:{missing:scientificChecks.tasks.data}}});await missing.command("align");const ready=await until(missing.pipeline,missing.id,p=>p.phase==="READY");await expect(missing.command("publish",{alignmentRunId:ready.alignment!.runId})).rejects.toThrow("遗漏");
 });
});


describe("shared project run budget", () => {
  it.each([31, 32, 33])("retry counts queued jobs and continuations together at %i used units", async used => {
    const s = await setup(); s.remote.malformed = true;
    await s.command("align");
    const p = await until(s.pipeline, s.id, p => p.phase === "BLOCKED");
    const failed = p.runs[0]!;
    // Simulate persisted earlier attempts: no run exceeds six continuations.
    // Keep one continuation on the latest failed attempt, which retry must retain in history.
    let remaining = used - 6 - 1;
    const continued = (id: string, count: number) => Array.from({length:count}, (_, i) => ({
      threadId:id,previousRunId:`${id}-${i}`,runId:`${id}-${i+1}`,source:"sciencepal-web" as const,at:p.createdAt,
    }));
    p.runs = [...Array.from({length:5}, (_, i) => {
      const n = Math.min(6, remaining); remaining -= n;
      return {...structuredClone(failed),id:`history-${i}`,continuations:continued(`history-${i}`,n)};
    }), {...failed,continuations:continued(failed.id,1)}];
    expect(remaining).toBe(0);
    const count = (p: SPProject) => p.runs.reduce((n,r)=>n+1+(r.continuations?.length??0),0);
    expect(count(p)).toBe(used); expect(p.maxRuns).toBe(32);
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p),p.id);
    const before = JSON.stringify(s.pipeline.get(p.id)), calls = s.remote.calls.length;
    if (used >= 32) {
      await expect(s.command("retry", {runId:failed.id})).rejects.toThrow("上限");
      expect(JSON.stringify(s.pipeline.get(p.id))).toBe(before);
    } else {
      await s.command("retry", {runId:failed.id});
      const after = s.pipeline.get(p.id);
      expect(count(after)).toBe(32);
      expect(after.runs.at(-1)!.continuations).toBeUndefined();
      expect(after.runs.find(r=>r.id===failed.id)!.continuations).toHaveLength(1);
    }
    expect(s.remote.calls.length).toBe(calls); // Commands reserve slots; they do not call a model.
  });
});


describe("strong new acceptance profile through Host dispatch",()=>{
 it.each(["scale","redistribute"])("blocks %s before review and downstream, then accepts a corrected retry",async mode=>{
  const replay=new URL("../../../apps/web/public/research-replay/isolated/",import.meta.url);
  const bundle=JSON.parse(readFileSync(new URL("case.json",replay),"utf8"));
  const historical=bundle.steps.at(-1).state.projects[0];
  const artifactId=historical.tasks.find((t:any)=>t.key==="sasa").artifactId;
  const f=bundle.files[artifactId];
  const good=JSON.parse(readFileSync(new URL(`files/${artifactId}/${f.filename}`,replay),"utf8")).result;
  const rules=JSON.parse(readFileSync(new URL("../../../fixtures/acceptance-scientific-v2/checks.json",import.meta.url),"utf8"));
  const bytes=readFileSync(new URL("../../../fixtures/expert-case/1CRN.pdb",import.meta.url));
  const s=await setup({...input,source:{filename:"source-1CRN.pdb",base64:bytes.toString("base64"),sourceUrl:"https://files.rcsb.org/download/1CRN.pdb",attribution:"Frozen public coordinates"},scientificChecks:{...rules,tasks:{data:rules.tasks.sasa}}});
  const wrong=structuredClone(good);
  if(mode==="scale"){wrong.total_A2*=1.2;wrong.residues.forEach((r:any)=>r.area_A2*=1.2);}
  else{wrong.residues[0].area_A2+=20;wrong.residues[6].area_A2-=20;}
  s.remote.transform=(kind,result)=>kind==="TASK"?wrong:result;await publish(s);
  const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED"),bad=blocked.runs.find(r=>r.kind==="TASK")!;
  expect(bad.scientificValidation?.status).toBe("FAILED");expect(bad.output).not.toBeNull();
  expect(s.remote.calls.map(c=>c.kind)).toEqual(["ALIGN","TASK"]);
  expect(blocked.tasks[1]!.executionId).toBeNull();
  s.remote.transform=(kind,result)=>kind==="TASK"?structuredClone(good):result;
  await s.command("retry",{runId:bad.id});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
  expect(done.scientificChecks).toEqual(blocked.scientificChecks);
  expect(done.runs.find(r=>r.id===bad.id)!.scientificValidation?.status).toBe("FAILED");
  expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
 });
});


// Controlled counterexamples; these do not impersonate new provider/model runs.
const governedInput:SPCreateProject={...input,governanceVersion:1,proposals:[
  {agentId:"a",content:"Compute SASA using Shrake-Rupley.\nReport residue count."},
  {agentId:"b",content:"Independently review residue results and summarize limitations."}
]};
async function governedSetup(extra:Partial<SPCreateProject>={}) {
  const s=await setup({...governedInput,...extra});
  const base=(kind:string,result:any)=>{
    const p=s.pipeline.get(s.id);
    if(kind==="ALIGN")result.tasks=result.tasks.map((t:any)=>({...t,requirementIds:p.governance!.requirements.filter(r=>!r.retiredBy&&(t.key==="data"?r.sourceId===p.proposals[0]!.id:r.sourceId!==p.proposals[0]!.id)).map(r=>r.id)}));
    if(kind==="CHANGE_REVIEW") {
      result.affectedTaskKeys=["analysis"];
      result.taskImpacts=p.tasks.map(t=>({key:t.key,affected:t.key==="analysis",rationale:t.key==="analysis"?"Only the summary changes":"Data input and method stay frozen",fingerprint:taskFingerprint(p,t)}));
      result.requirementEdits=[];
    }
    if(kind==="REVIEW"&&result.verdict==="request_changes")result.requiredChangeCriteria=result.requiredChanges.map(()=>result.checks.find((c:any)=>!c.passed).criterion);
    return result;
  };
  s.remote.transform=base;return {...s,base};
}
describe("Research anti-drift governance v1",()=>{
  it("blocks an omitted source requirement before publication, then recovers without dropping original text",async()=>{
    const s=await governedSetup();let omit=true;
    s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="ALIGN"&&omit)result.tasks[0].requirementIds.pop();return result;};
    await s.command("align");const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");
    expect(blocked.error).toContain("遗漏冻结需求");expect(blocked.error).toContain("Report residue count.");expect(s.remote.calls.map(c=>c.kind)).toEqual(["ALIGN"]);
    omit=false;await s.command("retry",{runId:blocked.alignmentRunId});const ready=await until(s.pipeline,s.id,p=>p.phase==="READY");
    const mapped=ready.alignment!.tasks.flatMap(t=>t.requirementIds!);
    expect(new Set(mapped)).toEqual(new Set(ready.governance!.requirements.map(r=>r.id)));
    expect(ready.alignment!.tasks[0]!.acceptance.join("\n")).toContain("Report residue count.");
    await s.command("publish",{alignmentRunId:ready.alignmentRunId});
    const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");expect(done.requirementMarkdown).toContain(governedInput.proposals[0]!.content);
  });
  it("blocks an unauthorized method before review and handoff, then accepts an explicit repair",async()=>{
    const schema:SPResultSchemas[string]={type:"object",properties:{method:{type:"string",const:"Shrake-Rupley"}},required:["method"]};
    const s=await governedSetup({resultSchemas:{data:schema,analysis:schema}});let wrong=true;
    s.remote.transform=(kind,result)=>{result=s.base(kind,result);return kind==="TASK"?{...result,method:wrong?"Lee-Richards":"Shrake-Rupley"}:result;};
    await publish(s);const p=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");
    expect(p.runs.find(r=>r.kind==="TASK")!.resultValidation?.status).toBe("FAILED");expect(s.remote.calls.some(c=>c.kind==="REVIEW")).toBe(false);
    wrong=false;await s.command("retry",{runId:p.tasks[0]!.executionId});
    await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
  });
  it.each(["all-pass-rejection","extra-criterion","unbound-rework"])("rejects reviewer scope drift (%s) without forcing the author to recompute",async mode=>{
    const s=await governedSetup();let drift=true;
    s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="REVIEW"&&drift){result.verdict="request_changes";result.requiredChanges=["Run an unrelated extra experiment"];
      if(mode==="extra-criterion")result.checks.push({criterion:"New unpublished requirement",passed:false,evidence:"data.json: extra request"});
      if(mode==="unbound-rework"){result.checks[0].passed=false;result.requiredChangeCriteria=["New unpublished requirement"];}
    }return result;};
    await publish(s);const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");
    expect(blocked.tasks[0]!.attempt).toBe(1);expect(blocked.runs.find(r=>r.id===blocked.tasks[0]!.reviewId)!.status).toBe("INVALID");
    expect(s.remote.calls.filter(c=>c.kind==="TASK")).toHaveLength(1);
    drift=false;await s.command("retry",{runId:blocked.tasks[0]!.reviewId});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    expect(done.tasks[0]!.attempt).toBe(1);expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
  });
  it("retains legitimate criterion-bound rejection and rework",async()=>{
    const s=await governedSetup();s.remote.rejectOnce=true;await publish(s);
    const rejected=await until(s.pipeline,s.id,p=>p.phase==="CHANGES_REQUESTED");const acceptance=[...rejected.tasks[0]!.acceptance];
    await s.command("rework",{taskKey:"data"});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    expect(done.tasks[0]!.attempt).toBe(2);expect(done.tasks[0]!.acceptance).toEqual(acceptance);
  });
  it("keeps untouched requirements and approvals across revisions, rerunning only the affected downstream task",async()=>{
    const s=await governedSetup();await publish(s);const first=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    for(const request of ["Explain uncertainty in the summary.","State the limitations more explicitly."]) {
      await s.command("change",{request});const reviewed=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");
      const change=reviewed.changes.at(-1)!;expect(change.result!.taskImpacts!.map(i=>i.key)).toEqual(["data","analysis"]);
      await s.command("apply-change",{changeId:change.id});const ready=await until(s.pipeline,s.id,p=>p.phase==="READY");
      expect(ready.requirementMarkdown).toContain(first.requirementMarkdown);expect(ready.requirementMarkdown).toContain(request);
      await s.command("publish",{alignmentRunId:ready.alignmentRunId});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
      expect(done.tasks[0]!.artifactId).toBe(first.tasks[0]!.artifactId);expect(done.tasks[0]!.carriedFrom?.revision).toBe(1);
      expect(done.runs.filter(r=>r.kind==="TASK"&&r.taskKey==="data")).toHaveLength(1);
      expect(s.pipeline.evidence(s.id).allApproved).toBe(true);expect(s.pipeline.evidence(s.id,1).allApproved).toBe(true);
    }
    const final=s.pipeline.get(s.id);expect(final.tasks[1]!.carriedFrom).toBeUndefined();
    const handoff=s.remote.calls.filter(c=>c.kind==="TASK"&&c.context.task.key==="analysis").at(-1)!;
    expect(handoff.context.upstream[0].approval.carriedFrom.revision).toBe(1);
  });
  it.each(["missing-impact","stale-fingerprint","missing-downstream"])("rejects incomplete change evidence (%s)",async mode=>{
    const s=await governedSetup();await publish(s);await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="CHANGE_REVIEW") {
      if(mode==="missing-impact")result.taskImpacts.pop();
      if(mode==="stale-fingerprint")result.taskImpacts[0].fingerprint="old";
      if(mode==="missing-downstream"){result.taskImpacts[0].affected=true;result.taskImpacts[1].affected=false;result.affectedTaskKeys=["data"];}
    }return result;};
    await s.command("change",{request:"Check the change"});const p=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");
    expect(p.revision).toBe(1);expect(p.changes[0]!.status).toBe("REVIEWING");
  });
  it("invalidates a no-impact conclusion if the task snapshot changes before captain approval",async()=>{
    const s=await governedSetup();await publish(s);await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    await s.command("change",{request:"Improve summary"});const p=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");
    p.tasks[0]!.boundary="Tampered method boundary";s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p),s.id);
    await expect(s.command("apply-change",{changeId:p.changes[0]!.id})).rejects.toThrow("旧影响证据失效");
    expect(s.pipeline.get(s.id).revision).toBe(1);
  });
  it("rejects realignment that silently changes an unaffected task",async()=>{
    const s=await governedSetup();await publish(s);await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
    await s.command("change",{request:"Improve summary"});const p=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");
    s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="ALIGN")result.tasks[0].goal="Switch the scientific method";return result;};
    await s.command("apply-change",{changeId:p.changes[0]!.id});const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");
    expect(blocked.error).toContain("未受影响任务");expect(s.remote.calls.filter(c=>c.kind==="TASK"&&c.context.task.key==="data")).toHaveLength(1);
  });
  it("invalidates old task/review proof when the frozen method or boundary drifts",async()=>{
    const s=await governedSetup();await publish(s);await s.pipeline.tick();
    const p=s.pipeline.get(s.id);p.tasks[0]!.boundary="Changed after dispatch";
    s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p),s.id);
    const blocked=await until(s.pipeline,s.id,p=>p.phase==="BLOCKED");expect(blocked.error).toContain("旧执行与评审证据失效");
    expect(s.remote.calls.some(c=>c.kind==="REVIEW")).toBe(false);
  });
});

it("keeps captain conflict decisions as authoritative source-linked criteria across realignment",async()=>{
 const s=await governedSetup({...input,governanceVersion:1});s.remote.conflict=true;
 await s.command("align");const p=await until(s.pipeline,s.id,p=>p.phase==="NEEDS_DECISION");
 await s.command("decide",{alignmentRunId:p.alignmentRunId,issueId:"issue-1",optionId:"five"});
 const ready=await until(s.pipeline,s.id,p=>p.phase==="READY");
 expect(ready.governance!.decisions[0]!.issue.selectedOptionId).toBe("five");
 expect(ready.alignment!.tasks.flatMap(t=>t.acceptance).filter(c=>c.startsWith("[REQ:")).every(c=>c.includes("裁决"))).toBe(true);
 await s.command("publish",{alignmentRunId:ready.alignmentRunId});await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
});
it("retains full source text when a change is applied before first publication",async()=>{
 const s=await governedSetup();await s.command("align");await until(s.pipeline,s.id,p=>p.phase==="READY");
 s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="CHANGE_REVIEW"){
   const p=s.pipeline.get(s.id);result.taskImpacts=p.alignment!.tasks.map(t=>({key:t.key,affected:t.key==="analysis",fingerprint:taskFingerprint(p,t),rationale:"Summary only"}));
 }return result;};
 await s.command("change",{request:"Clarify limitations"});const p=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");
 await s.command("apply-change",{changeId:p.changes[0]!.id});const ready=await until(s.pipeline,s.id,p=>p.phase==="READY");
 expect(ready.requirementMarkdown).toContain(governedInput.proposals[0]!.content);expect(ready.requirementMarkdown).toContain("Clarify limitations");
 const actualContext=s.remote.calls.filter(c=>c.kind==="ALIGN").at(-1)!.context;
 expect(actualContext.previousTasks).toEqual(p.alignment!.tasks);
});
it("rejects a forged carried approval instead of granting a newer task the old proof",async()=>{
 const s=await governedSetup();await publish(s);await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
 await s.command("change",{request:"Improve summary"});let p=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");await s.command("apply-change",{changeId:p.changes[0]!.id});
 p=await until(s.pipeline,s.id,p=>p.phase==="READY");await s.command("publish",{alignmentRunId:p.alignmentRunId});p=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
 expect(s.pipeline.evidence(s.id).allApproved).toBe(true);p.tasks[0]!.carriedFrom!.fingerprint="forged";
 s.db.prepare("UPDATE sciencepal_projects SET data=? WHERE id=?").run(JSON.stringify(p),p.id);
 expect(()=>s.pipeline.evidence(p.id)).toThrow("复用成果");
});

it("keeps legacy all-pass rejection records readable while governance v1 rejects new ones",()=>{
 const result={verdict:"request_changes",summary:"Historical record",checks:[{criterion:"criterion",passed:true,evidence:"data.json: original evidence"}],requiredChanges:["Historical extra request"],requiredChangeCriteria:["criterion"]};
 expect(reviewResult(result,["criterion"],"data.json").verdict).toBe("request_changes");
 expect(()=>reviewResult(result,["criterion"],"data.json",true)).toThrow("全部通过");
});
it("reuses approvals through consecutive unpublished revisions instead of recomputing unchanged data",async()=>{
 const s=await governedSetup();await publish(s);const original=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
 for(const request of ["Explain uncertainty","Clarify limitations"]) {
   s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="CHANGE_REVIEW"){
     const p=s.pipeline.get(s.id);result.taskImpacts=(p.tasks.length?p.tasks:p.alignment!.tasks).map(t=>({key:t.key,affected:t.key==="analysis",fingerprint:taskFingerprint(p,t),rationale:"Summary only"}));
   }return result;};
   await s.command("change",{request});const p=await until(s.pipeline,s.id,p=>p.phase==="CHANGE_READY");await s.command("apply-change",{changeId:p.changes.at(-1)!.id});await until(s.pipeline,s.id,p=>p.phase==="READY");
 }
 const ready=s.pipeline.get(s.id);await s.command("publish",{alignmentRunId:ready.alignmentRunId});const done=await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
 expect(done.tasks[0]!.artifactId).toBe(original.tasks[0]!.artifactId);expect(done.runs.filter(r=>r.kind==="TASK"&&r.taskKey==="data")).toHaveLength(1);expect(s.pipeline.evidence(s.id).allApproved).toBe(true);
});
it("keeps optional reviewer suggestions out of a governed repair instruction",async()=>{
 const s=await governedSetup();s.remote.rejectOnce=true;
 s.remote.transform=(kind,result)=>{result=s.base(kind,result);if(kind==="REVIEW")result.summary+=" OPTIONAL: collect a new unrelated cohort";return result;};
 await publish(s);await until(s.pipeline,s.id,p=>p.phase==="CHANGES_REQUESTED");await s.command("rework",{taskKey:"data"});await until(s.pipeline,s.id,p=>p.phase==="COMPLETED");
 const repaired=s.remote.calls.find(c=>c.kind==="TASK"&&c.context.feedback)!;
 expect(repaired.context.feedback).not.toContain("unrelated cohort");expect(repaired.context.feedback).toContain("Repair only failed frozen criteria");
});

// Real SciencePAL review preserved all requirement bodies but retyped a generated label colon.
describe('Generated requirement label compatibility',()=>{
 const original='[REQ:r-0123456789abcdef] 核对原提案要求：Use probe: 1.4; keep source.';
 const ascii=original.replace('要求：','要求:');
 const payload=(criterion:string)=>({verdict:'approve',summary:'Checked original output.',checks:[{criterion,passed:true,evidence:'data.json preserves the frozen probe and source.'}],requiredChanges:[]});
 it('accepts only the generated header colon variant and preserves raw evidence',()=>{
  const raw=payload(ascii);expect(reviewResult(raw,[original],'data.json',true).checks[0]!.criterion).toBe(original);
  expect(raw.checks[0]!.criterion).toBe(ascii);
  expect(()=>reviewResult(raw,[original],'data.json',false)).toThrow();
 });
 it('still rejects edited bodies, changed IDs and duplicate coverage',()=>{
  for(const text of [ascii.replace('1.4','1.5'),ascii.replace('probe:','probe：'),ascii.replace('0123456789abcdef','1123456789abcdef')])expect(()=>reviewResult(payload(text),[original],'data.json',true)).toThrow();
  const duplicate=payload(ascii);duplicate.checks.push({...duplicate.checks[0]!,criterion:original});
  expect(()=>reviewResult(duplicate,[original],'data.json',true)).toThrow();
 });
 it('keeps rejection reasons bound to the original failed requirement',()=>{
  const raw={...payload(ascii),verdict:'request_changes',checks:[{criterion:ascii,passed:false,evidence:'data.json lacks the original source proof.'}],requiredChanges:['Supply original source proof.'],requiredChangeCriteria:[ascii]};
  expect(reviewResult(raw,[original],'data.json',true).verdict).toBe('request_changes');
  expect(()=>reviewResult({...raw,requiredChangeCriteria:[ascii.replace('1.4','1.5')]},[original],'data.json',true)).toThrow();
 });
});
