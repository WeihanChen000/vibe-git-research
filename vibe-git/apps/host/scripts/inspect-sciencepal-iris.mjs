import { readFile, writeFile, mkdir } from "node:fs/promises";
const { projectId } = JSON.parse(await readFile("data/sciencepal/evidence/iris-project.json", "utf8"));
const projects = await (await fetch("http://127.0.0.1:8788/api/sciencepal/projects")).json();
const p = projects.find(p => p.id === projectId);
if (p.phase === "CHANGES_REQUESTED") {
  const dir = `data/sciencepal/evidence/${p.id}`; await mkdir(dir, { recursive: true });
  let before; try { before = JSON.parse(await readFile(`${dir}/iris-rejected-before.json`, "utf8")); } catch {}
  const snapshot = { observedAt: new Date().toISOString(), project: p };
  if (!before) await writeFile(`${dir}/iris-rejected-before.json`, JSON.stringify(snapshot, null, 2));
  else if (Date.now() - Date.parse(before.observedAt) >= 15000) await writeFile(`${dir}/iris-rejected-after.json`, JSON.stringify(snapshot, null, 2));
}
console.log(JSON.stringify({ id: p.id, phase: p.phase, error: p.error, issues: p.alignment?.issues,
  tasks: p.tasks.map(t => ({ key: t.key, status: t.status, attempt: t.attempt, review: t.review })),
  runs: p.runs.map(r => ({ kind: r.kind, task: r.taskKey, status: r.status, runId: r.runId, remoteStatus: r.remoteStatus, error: r.error })) }, null, 2));
