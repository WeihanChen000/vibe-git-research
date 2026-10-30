import {prepareResearch} from './research-setup.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24+ is required.');process.exit(1);}
const captain=process.argv.includes('--captain');
function npm(args){
 // Only fixed, program-owned command arguments are passed to the Windows shell.
 const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:root,stdio:'inherit',shell:process.platform==='win32',windowsHide:true});
 if(r.error||r.status!==0){console.error(r.error?.message||'Setup failed. Correct the error above and reopen.');process.exit(r.status||1);}
}
try{prepareResearch(root,{runNpm:npm,rebuild:process.argv.includes('--rebuild')});}catch(e){console.error(e.message);process.exit(1);}
if(process.argv.includes('--prepare')){console.log('准备完成。open-research.cmd 进入本人工作区；open-replay.cmd 查看只读演示。');process.exit(0);}
console.log('正在打开本人科研工作区。请保持此终端运行；Ctrl+C 关闭本机入口。');
const run=spawnSync(process.execPath,['--use-env-proxy',...(captain&&process.argv.includes('--room')?['scripts/research-captain.mjs']:['apps/host/dist/sciencepal/local-panel-main.js']),...(captain?['--captain']:[]),...(process.argv.includes('--no-open')?['--no-open']:['--open'])],{stdio:'inherit',windowsHide:true});
if(run.error)console.error(run.error.message);process.exit(run.error||run.signal?1:run.status??1);
