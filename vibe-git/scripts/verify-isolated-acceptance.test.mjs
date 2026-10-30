import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const source=resolve('apps/web/public/research-replay/isolated'),verify=resolve('scripts/verify-isolated-acceptance.mjs');
const run=dir=>promisify(execFile)(process.execPath,[verify,dir]);
async function fixture(fn){const parent=await mkdtemp(join(tmpdir(),'vibe-proof-negative-'));const target=join(parent,'isolated');try{await cp(source,target,{recursive:true});await fn(target);}finally{assert.ok(resolve(parent).startsWith(resolve(tmpdir())));await rm(parent,{recursive:true,force:true});}}
async function update(dir,name,edit){const file=join(dir,name),v=JSON.parse(await readFile(file,'utf8'));edit(v);await writeFile(file,JSON.stringify(v));const b=await readFile(file),manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));const m=manifest.files.find(f=>f.name===name);m.sha256=createHash('sha256').update(b).digest('hex');m.size=b.length;await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest));}
test('Modified raw artifact bytes fail independently of a green UI state',async()=>fixture(async dir=>{const b=JSON.parse(await readFile(join(dir,'case.json'),'utf8'));const [id,f]=Object.entries(b.files)[0];await writeFile(join(dir,'files',id,f.filename),'corrupted');await assert.rejects(run(dir));}));
test('Coherently rehashed false permission claim still fails semantic verification',async()=>fixture(async dir=>{await update(dir,'acceptance-report.json',r=>{r.checks.find(c=>c.name==='Member cannot publish').passed=false;});await assert.rejects(run(dir));}));
test('Coherently rehashed wrong same-thread continuation is rejected',async()=>fixture(async dir=>{await update(dir,'case.json',b=>{const r=b.steps.at(-1).state.projects[0].runs.find(r=>r.continuations?.length);r.continuations[0].threadId='wrong-thread';});await assert.rejects(run(dir));}));
