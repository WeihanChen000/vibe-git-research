// Read-only verification of the deliberate sum-error live fixture.
// Run verify-sciencepal-live.mjs first to download and verify frozen artifacts.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(projectId || '')) throw new Error('Pass the live rework project UUID');
const dir = resolve('data/sciencepal/evidence', projectId);
const read = async name => JSON.parse(await readFile(resolve(dir, name), 'utf8'));
const project = await read('project.json');
const integrity = await read('verification.json');
const before = await read('rejected-before.json'), after = await read('rejected-after-wait.json');
const producer = project.tasks.find(t => t.key === 'produce_sum');
const consumer = project.tasks.find(t => t.key === 'consume_sum');
if (!producer || !consumer) throw new Error('Expected produce_sum and consume_sum task keys');
const executions = project.runs.filter(r => r.taskKey === producer.key && r.kind === 'TASK' && r.status === 'COLLECTED');
const reviews = project.runs.filter(r => r.taskKey === producer.key && r.kind === 'REVIEW' && r.status === 'COLLECTED');
if (executions.length !== 2 || reviews.length !== 2) throw new Error('Expected exactly two real production attempts and two real reviews');
const [firstRun, repairRun] = executions, [rejectRun, approveRun] = reviews;
const first = (await read(`${firstRun.output.id}.json`)).result;
const repaired = (await read(`${repairRun.output.id}.json`)).result;
const rejected = (await read(`${rejectRun.output.id}.json`)).result;
const approved = (await read(`${approveRun.output.id}.json`)).result;
const feedback = await read(`${repairRun.inputs.find(i => i.filename === 'context.json').artifactId}.json`);
const downstreamRun = project.runs.find(r => r.id === consumer.executionId);
const downstream = (await read(`${consumer.artifactId}.json`)).result;
const previous = repairRun.inputs.find(i => i.filename === 'previous-produce_sum.json');
const checks = [], check = (name, passed) => checks.push({ name, passed: !!passed });
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
check('all-frozen-evidence-verified', integrity.passed && integrity.scopeRevision === null);
check('project-completed', project.phase === 'COMPLETED');
check('actual-rejection', rejected.verdict === 'request_changes' && rejected.checks.some(c => c.passed === false) && rejected.requiredChanges.length > 0);
check('first-artifact-has-intended-error', same(first.values,[1,2,3,4,5]) && first.reported_total === 14 && first.reported_total !== first.values.reduce((a,b)=>a+b,0));
check('reviewer-differs-from-author', firstRun.agent.id !== rejectRun.agent.id && repairRun.agent.id !== approveRun.agent.id);
check('independent-review-sandboxes', firstRun.sandboxId !== rejectRun.sandboxId && repairRun.sandboxId !== approveRun.sandboxId);
check('reviewed-actual-first-artifact', rejectRun.inputs.some(i => i.artifactId === firstRun.output.id));
check('rejection-is-stable', before.phase === 'CHANGES_REQUESTED' && after.phase === 'CHANGES_REQUESTED');
check('observation-window-at-least-15-seconds', Date.parse(after.observedAt)-Date.parse(before.observedAt) >= 15000);
for (const [name, snapshot] of [['before',before],['after',after]]) {
  check(`${name}:downstream-never-dispatched`, !snapshot.runs.some(r => r.kind === 'TASK' && r.taskKey === consumer.key));
  check(`${name}:downstream-waiting`, snapshot.tasks.find(t => t.key === consumer.key)?.status === 'WAITING');
}
check('feedback-contains-required-changes', rejected.requiredChanges.every(change => feedback.feedback.includes(change)));
check('repair-after-rejection', Date.parse(repairRun.createdAt) >= Date.parse(rejectRun.updatedAt));
check('old-artifact-attached-to-repair', previous && previous.sha256 === firstRun.output.sha256 && previous.size === firstRun.output.size);
if (previous) {
  const oldBytes = await readFile(resolve(dir,`${firstRun.output.id}.json`));
  const copyBytes = await readFile(resolve(dir,`${previous.artifactId}.json`));
  check('previous-file-bytes-preserved', oldBytes.equals(copyBytes) && createHash('sha256').update(copyBytes).digest('hex') === previous.sha256);
}
check('fixed-sum-is-correct', repaired.reported_total === 15 && repaired.reported_total === repaired.values.reduce((a,b)=>a+b,0));
check('input-values-preserved', same(first.values,repaired.values));
check('nonce-preserved', typeof first.nonce === 'string' && /^[0-9a-f]{32}$/.test(first.nonce) && first.nonce === repaired.nonce);
check('synthetic-data-declared', first.simulated === true && repaired.simulated === true && downstream.simulated === true);
check('new-artifact-created', firstRun.output.id !== repairRun.output.id && firstRun.output.sha256 !== repairRun.output.sha256);
check('acceptance-not-weakened', same(rejected.checks.map(c=>c.criterion).sort(), approved.checks.map(c=>c.criterion).sort()) && same(approved.checks.map(c=>c.criterion).sort(), [...producer.acceptance].sort()));
check('actual-reapproval', approved.verdict === 'approve' && approved.checks.every(c => c.passed === true) && approved.requiredChanges.length === 0);
check('reviewed-repaired-artifact', approveRun.inputs.some(i => i.artifactId === repairRun.output.id));
check('downstream-after-reapproval', Date.parse(downstreamRun.createdAt) >= Date.parse(approveRun.updatedAt));
check('downstream-uses-repaired-file', downstreamRun.inputs.some(i => i.artifactId === repairRun.output.id) && !downstreamRun.inputs.some(i => i.artifactId === firstRun.output.id));
check('downstream-result-correct', downstream.verified_total === 15 && downstream.mean === 3 && downstream.upstream_total === 15 && downstream.source_nonce === repaired.nonce);
check('all-tasks-approved', project.tasks.every(t => t.status === 'APPROVED' && t.review?.verdict === 'approve'));
const report = { projectId, checkedAt: new Date().toISOString(), passed: checks.every(c=>c.passed), fixture: 'Intentional first-attempt total=14; unchanged acceptance total=15', checks };
await writeFile(resolve(dir,'rework-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({projectId,passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.passed)},null,2));
if (!report.passed) process.exitCode = 1;
