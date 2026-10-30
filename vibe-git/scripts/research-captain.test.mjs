import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
const root=new URL('../',import.meta.url);
async function launch(port='0'){
 const dir=await mkdtemp(join(tmpdir(),'vibe-captain-smoke-'));
 const p=spawn(process.execPath,['scripts/research-captain.mjs','--no-open'],{cwd:root,windowsHide:true,env:{...process.env,PORT:port,VIBE_GIT_DATA_DIR:join(dir,'data'),VIBE_GIT_RESEARCH_PROFILE:join(dir,'profile'),VIBE_GIT_MEMBER_FILE:join(dir,'data/v20/captain.json')},stdio:['ignore','pipe','pipe']});
 let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);
 const ready=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{p.kill();reject(Error('launcher timeout'));},10000);const timer=setInterval(()=>{if(output.includes('/open/')||p.exitCode!==null){clearTimeout(timeout);clearInterval(timer);resolve(output);}},50);p.once('error',reject);});return {p,output:ready};
}
test('single captain entry starts a usable panel without opening browser or a tunnel',async()=>{const {p,output}=await launch();try{const url=output.match(/http:\/\/127\.0\.0\.1:\d+\/open\/[a-f0-9]+/)?.[0];assert.ok(url,'panel ticket must exist');const r=await fetch(url,{redirect:'manual'});assert.equal(r.status,302);assert.match(output,/仅本机/);}finally{p.kill();}});
test('occupied room port fails without stopping its owner',async()=>{const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const port=server.address().port;const {p,output}=await launch(String(port));assert.match(output,/端口已被占用/);assert.equal(p.exitCode,1);assert.ok(server.listening);}finally{server.close();}});
