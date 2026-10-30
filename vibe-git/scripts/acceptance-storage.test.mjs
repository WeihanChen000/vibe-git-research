import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {atomicJson,acquireAcceptanceLock,connectorAction} from '../apps/host/scripts/acceptance-storage.mjs';
test('A second runner cannot dispatch while the first owns its private project',async()=>{
 const root=await mkdtemp(join(tmpdir(),'vibe-acceptance-lock-'));
 try{const release=await acquireAcceptanceLock(root);await assert.rejects(acquireAcceptanceLock(root),/already has a runner lock/);await release();const again=await acquireAcceptanceLock(root);await again();}
 finally{await rm(root,{recursive:true,force:true});}
});
test('An uncertain old lock is not silently stolen and a foreign lock cannot be removed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'vibe-acceptance-lock-'));
 try{const release=await acquireAcceptanceLock(root);await writeFile(join(root,'acceptance.lock'),JSON.stringify({pid:-1}));await assert.rejects(release(),/ownership changed/);await assert.rejects(acquireAcceptanceLock(root),/already has a runner lock/);}
 finally{await rm(root,{recursive:true,force:true});}
});
test('Journal replacement preserves complete JSON and leaves no temporary files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'vibe-acceptance-journal-'));
 try{const file=join(root,'member','journal.json');await atomicJson(file,{phase:'RUNNING',remote:{threadId:'original'}});await atomicJson(file,{phase:'OUTPUT',remote:{threadId:'original'}});assert.equal(JSON.parse(await readFile(file,'utf8')).remote.threadId,'original');assert.deepEqual(await readdir(join(root,'member')),['journal.json']);}
 finally{await rm(root,{recursive:true,force:true});}
});

test("Interrupted answer resumes each saved stage instead of posting a second answer",()=>{
 for(const stage of ["MESSAGE","START_READY","STARTING","LINK"])assert.equal(connectorAction("NEEDS_INPUT",{followUp:{stage}}),"step");
 assert.equal(connectorAction("NEEDS_INPUT",{}),"reply");assert.equal(connectorAction("RUNNING",{}),"step");
});
