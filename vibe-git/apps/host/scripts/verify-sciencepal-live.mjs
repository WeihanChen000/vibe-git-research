// Read-only verification of a real local Host project. Never submits remote jobs.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = `http://127.0.0.1:${process.env.PORT || "8788"}/api/sciencepal`;
const wanted = process.argv[2];
const revision = process.argv[3] === undefined ? null : Number(process.argv[3]);
const response = await fetch(`${base}/projects`);
if (!response.ok) throw new Error(`Host returned ${response.status}`);
const projects = await response.json();
const project = projects.find(p => p.id === wanted);
if (!project || !/^[0-9a-f-]{36}$/.test(project.id)) throw new Error("Pass an existing project UUID as the argument");
const stages = [...project.history, project];
if (revision !== null && (!Number.isInteger(revision) || !stages.some(s => s.revision === revision))) throw new Error("Optional third argument must identify an existing revision");
const scope = revision === null ? stages : stages.filter(s => s.revision === revision);
const dir = resolve("data/sciencepal/evidence", project.id, ...(revision === null ? [] : [`revision-${revision}`]));
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, "project.json"), JSON.stringify(project, null, 2));
const checks = [], files = new Map();
const check = (name, passed) => checks.push({ name, passed: !!passed });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
async function file(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid artifact ID");
  if (files.has(id)) return files.get(id);
  const r = await fetch(`${base}/projects/${project.id}/artifacts/${id}`);
  if (!r.ok) throw new Error(`Artifact download failed: ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  check(`artifact:${id}:download-header-hash`, hash(bytes) === r.headers.get("x-artifact-sha256"));
  files.set(id, bytes); await writeFile(resolve(dir, `${id}.json`), bytes); return bytes;
}
check(revision === null ? "project-completed" : `R${revision}:scope-completed`, revision === null || revision === project.revision ? project.phase === "COMPLETED" : scope.every(s => s.tasks.length && s.tasks.every(t => t.status === "APPROVED")));
check("distinct-participants", new Set(project.agents.map(a => a.id)).size >= 2);
const collected = project.runs.filter(r => r.status === "COLLECTED" && (revision === null || r.revision === revision));
for (const r of collected) {
  const bytes = await file(r.output.id), out = JSON.parse(bytes.toString("utf8"));
  check(`${r.id}:frozen-output`, hash(bytes) === r.output.sha256 && bytes.length === r.output.size);
  check(`${r.id}:revision`, out.revision === r.revision);
  check(`${r.id}:remote-identifiers`, r.runId && r.threadId && r.sandboxId);
  check(`${r.id}:receipt-coverage`, out.inputReceipts.length === r.inputs.length && new Set(out.inputReceipts.map(i => i.filename)).size === r.inputs.length);
  for (const input of r.inputs) {
    const actual = await file(input.artifactId), receipt = out.inputReceipts.find(i => i.filename === input.filename);
    check(`${r.id}:input:${input.filename}`, hash(actual) === input.sha256 && actual.length === input.size && receipt?.sha256 === hash(actual) && receipt?.size === actual.length);
  }
}
for (const stage of scope) {
  for (const task of stage.tasks) {
    const execution = project.runs.find(r => r.id === task.executionId), review = project.runs.find(r => r.id === task.reviewId);
    check(`R${stage.revision}:${task.key}:approved`, task.status === "APPROVED" && task.review?.verdict === "approve");
    check(`R${stage.revision}:${task.key}:independent-review`, execution?.agent.id !== review?.agent.id && execution?.sandboxId !== review?.sandboxId && !!review?.sandboxId);
    check(`R${stage.revision}:${task.key}:reviewed-candidate`, review?.inputs.some(i => i.artifactId === task.artifactId));
    for (const dependency of task.dependencies) {
      const upstream = stage.tasks.find(t => t.key === dependency), upstreamReview = project.runs.find(r => r.id === upstream?.reviewId);
      check(`R${stage.revision}:${task.key}:frozen-dependency:${dependency}`, execution?.inputs.some(i => i.artifactId === upstream?.artifactId));
      check(`R${stage.revision}:${task.key}:review-before-dispatch:${dependency}`, !!upstreamReview && Date.parse(upstreamReview.updatedAt) <= Date.parse(execution?.createdAt));
    }
  }
}
const report = { projectId: project.id, revision: project.revision, scopeRevision: revision, phase: project.phase, checkedAt: new Date().toISOString(),
  collectedRuns: collected.length, artifactCount: files.size, passed: checks.every(c => c.passed), checks };
await writeFile(resolve(dir, "verification.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ projectId: project.id, scopeRevision: revision, currentPhase: project.phase, passed: report.passed, checks: checks.length, failed: checks.filter(c => !c.passed), collectedRuns: collected.length, artifactCount: files.size, evidence: dir }, null, 2));
if (!report.passed) process.exitCode = 1;
