import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,scenario} from './fixture.mjs';

// The real local-panel ALIGN packet omits platform for the default SciencePAL agent.
const context=platform=>({revision:1,agents:[
 {id:'captain',platform:'codex',runtimeAgentId:'codex-local'},
 {id:'scientist',...(platform?{platform}:{}),runtimeAgentId:'simulated-research-expert'},
],proposals:[{id:'p-captain',agentId:'captain'},{id:'p-scientist',agentId:'scientist'}],
governance:{version:1,requirements:[{id:'r-captain',sourceId:'p-captain'},{id:'r-scientist',sourceId:'p-scientist'}]},previousTasks:[]});
const align=c=>JSON.parse(scenario(cases[0]).calculate('ALIGN',[{filename:'context.json',bytes:Buffer.from(JSON.stringify(c))}]));
for(const platform of [undefined,'sciencepal']) test(`ALIGN accepts ${platform??'implicit SciencePAL'} and preserves member requirements`,()=>{
 const e=align(context(platform));assert.deepEqual(e.result.tasks.map(t=>[t.key,t.assigneeAgentId,t.requirementIds]),[
  ['sasa','scientist',['r-scientist']],['report','captain',['r-captain']],
 ]);assert.deepEqual(e.result.tasks[1].dependencies,['sasa']);
});
test('Missing member or proposal has an actionable simulator error',()=>{
 const noMember=context();noMember.agents.pop();assert.throws(()=>align(noMember),/请先完成接入/);
 const noProposal=context();noProposal.proposals.pop();assert.throws(()=>align(noProposal),/保存提案/);
});

// Validate generated reviews against the same Host contract, including requirement-bound fixes.
import {reviewResult} from '../../../vibe-git/apps/host/dist/sciencepal/pipeline-contract.js';
for(const [key,feedback,expected] of [
 ['sasa','','request_changes'],
 ['sasa','Captain-supplied supplemental evidence (a claim to evaluate, not an override): original source and log','approve'],
 ['report','','approve'],
]) test(`REVIEW ${key} ${expected} satisfies the unmodified Host gate`,()=>{
 const acceptance=['输入、方法与数值符合固定协议','交付原代码、工具版本与执行日志','[REQ:r-1234567890123456] 核对原提案要求：交付原代码'];
 const c={revision:1,task:{key,outputFilename:`${key}.json`,acceptance},feedback};
 const bytes=scenario(cases[0]).calculate('REVIEW',[{filename:'context.json',bytes:Buffer.from(JSON.stringify(c))}]);
 const result=JSON.parse(bytes).result;
 assert.equal(reviewResult(result,acceptance,c.task.outputFilename,true).verdict,expected);
});
