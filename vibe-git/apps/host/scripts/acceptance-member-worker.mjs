import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicJson} from './acceptance-storage.mjs';
import {SciencePALClient,readSciencePALKey} from '../dist/sciencepal/client.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
// A separate short-lived connector process. Only this process reads the member key.
const [root,origin,action='step']=process.argv.slice(2);
const profile=join(root,'sciencepal'), credential=JSON.parse(await readFile(join(profile,'member.json'),'utf8'));
const journalFile=join(profile,'journal.json');
const journal=JSON.parse(await readFile(journalFile,'utf8'));
const audit=async(event,data={})=>appendFile(join(profile,'transport.jsonl'),JSON.stringify({at:new Date().toISOString(),event,...data})+'\n');
const request=async(path,body,method)=>{const r=await fetch(origin+path,{method:method??(body===undefined?'GET':'POST'),headers:{authorization:'Bearer '+credential.nodeToken,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok)throw Error('Host '+r.status+': '+await r.text());return r.json();};
const remote=new SciencePALClient(readSciencePALKey());
for(const method of ['start','continueRun']) {const original=remote[method].bind(remote);remote[method]=async(...args)=>{await audit(method+'-attempt');const value=await original(...args);await audit(method+'-receipt',value);return value;};}
if(action==='catalog'){console.log(JSON.stringify(await remote.agents()));process.exit(0);}
if(action==='proof'){
 const p=await request('/api/sciencepal-team/projects/'+journal.projectId);const observations=[];
 for(const r of p.runs.filter(r=>r.threadId)){observations.push({localRunId:r.id,threadId:r.threadId,runId:r.runId,status:await remote.run(r.runId),identity:await remote.sandbox(r.threadId),previous:await Promise.all((r.continuations??[]).map(async c=>({runId:c.previousRunId,status:await remote.run(c.previousRunId)})))});}
 await atomicJson(join(profile,'remote-observations.json'),{observedAt:new Date().toISOString(),observations});console.log('Remote observations saved');process.exit(0);
}
const connector=new SciencePALMemberConnector(remote,request,journal,async value=>{
 await atomicJson(journalFile,value);
 if(value.phase==='RUNNING'&&value.remote&&value.packet?.run.kind==='TASK'){
  // Real process exit AFTER durable remote receipt, BEFORE reporting started to Host.
  try {await writeFile(join(profile,'disconnect-once.json'),JSON.stringify({at:new Date().toISOString(),...value.remote,localRunId:value.localRunId}),{flag:'wx',mode:0o600});}
  catch(e){if(e.code==='EEXIST')return;throw e;}
  await audit('injected-process-exit',value.remote);process.exit(75);
 }
});
try {console.log(action==='reply'?await connector.reply(await readFile(join(root,'answer.txt'),'utf8')):await connector.step());}
catch(e){console.error(e.message);process.exitCode=1;}
