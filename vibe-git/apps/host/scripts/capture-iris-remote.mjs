/** Read-only evidence capture; filenames must first be observed in the real Agent UI/output. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {SciencePALClient} from '../dist/sciencepal/client.js';
const [projectDir,localRunId,...filenames]=process.argv.slice(2);
if(!projectDir||!localRunId||filenames.some(n=>!/^[-a-zA-Z0-9_.]+$/.test(n)))throw Error('Usage: capture-iris-remote.mjs <exported project directory> <local run id> [observed files]');
const p=JSON.parse(await readFile(join(projectDir,'project.json'),'utf8')),r=p.runs.find(r=>r.id===localRunId);
if(!r?.runId||!r.threadId)throw Error('Real remote run required');
const authFile=process.env.SCIENCEPAL_AUTH_FILE;
if(!authFile)throw Error('SCIENCEPAL_AUTH_FILE required');
const key=JSON.parse(await readFile(authFile,'utf8')).apiKey,client=new SciencePALClient(key);
const [status,sandbox]=await Promise.all([client.run(r.runId),client.sandbox(r.threadId)]);
if(sandbox.agentId!==r.agent.runtimeAgentId)throw Error('Remote identity mismatch');
const dest=resolve(projectDir,'remote-proof',r.id);await mkdir(dest,{recursive:true});
const files=[];
for(const name of filenames){const bytes=await client.download(sandbox.sandboxId,name);await writeFile(join(dest,name),bytes);files.push({name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const proof={observedAt:new Date().toISOString(),threadId:r.threadId,runId:r.runId,projectId:sandbox.projectId,agentId:sandbox.agentId,status,files};
await writeFile(join(dest,'provenance.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
