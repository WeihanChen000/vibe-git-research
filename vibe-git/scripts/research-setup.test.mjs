import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {prepareResearch} from './research-setup.mjs';

test('Fresh kit, repeat open, replaced source, dependency update and failed build recovery',()=>{
 const root=mkdtempSync(join(tmpdir(),'vibe-setup-test-')),calls=[];
 const put=(p,v='{}')=>{mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),v);};
 const outputs=['apps/host/dist/sciencepal/local-panel-main.js','apps/web/dist/index.html','apps/web/dist/research-replay/1crn/case.json'];
 const runNpm=args=>{calls.push(args.join(' '));if(args[0]==='ci')put('node_modules/typescript/package.json');else outputs.forEach(p=>put(p));};
 const prepare=(extra={})=>prepareResearch(root,{runNpm,log:()=>{},...extra});
 try{
  for(const p of ['package.json','package-lock.json','tsconfig.base.json','SCIENCEPAL-TEAM-START.md','SCIENCEPAL-CASE-BRIEF.md','apps/web/package.json','apps/web/src/app.ts','packages/protocol/package.json'])put(p);
  assert.deepEqual(prepare(),{installed:true,built:true});assert.deepEqual(calls,['ci','run build']);calls.length=0;
  put('apps/web/tsconfig.tsbuildinfo','generated compilation cache');
  assert.deepEqual(prepare(),{installed:false,built:false});assert.deepEqual(calls,[]);
  put('apps/web/src/app.ts','new code');assert.deepEqual(prepare(),{installed:false,built:true});assert.deepEqual(calls,['run build']);calls.length=0;
  put('package-lock.json','new lock');assert.deepEqual(prepare(),{installed:true,built:true});assert.deepEqual(calls,['ci','run build']);calls.length=0;
  put('SCIENCEPAL-TEAM-START.md','new guide');const before=readFileSync(join(root,'data/research-setup.json'),'utf8');
  assert.throws(()=>prepare({runNpm:()=>{throw Error('build failed');}}),/build failed/);assert.equal(readFileSync(join(root,'data/research-setup.json'),'utf8'),before);
  assert.deepEqual(prepare(),{installed:false,built:true});calls.length=0;
  rmSync(join(root,outputs[2]));assert.deepEqual(prepare(),{installed:false,built:true});assert.deepEqual(calls,['run build']);
 }finally{assert.ok(root.startsWith(join(tmpdir(),'vibe-setup-test-')));rmSync(root,{recursive:true,force:true});}
});
