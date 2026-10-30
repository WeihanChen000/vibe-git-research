/** Loopback-only static replay. No Host, credentials, database or model calls. */
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'apps/web/dist');
await Promise.all(['iris','1crn'].map(id=>stat(join(web,`research-replay/${id}/case.json`)))).catch(()=>{throw Error('请先运行 npm ci 和 npm run build，再打开真实案例回放。');});
const server=createServer(async(req,res)=>{
 try{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end('Read-only replay');return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){res.writeHead(404);res.end('No live APIs in replay');return;}
  const file=pathname==='/'||pathname==='/sciencepal/team'?join(web,'index.html'):resolve(web,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(web+sep)){res.writeHead(403);res.end();return;}
  if(!(await stat(file)).isFile())throw Error('Not a file');
  const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'}[extname(file)]||'application/octet-stream'));
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Replay file not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/sciencepal/team?replay=1&case=1crn&step=completed&standalone=1`;
const out=join(root,'data/research-replay');await mkdir(out,{recursive:true});await writeFile(join(out,'preview.json'),JSON.stringify({url,pid:process.pid,scope:'static verified real-case replay; no model calls'},null,2));
console.log('真实科研案例回放（只读，无需账号，不启动模型；保持终端运行）：\n'+url);
if(process.argv.includes('--open')){const c=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});c.on('error',()=>console.log('请使用上方链接打开。'));c.unref();}
process.once('SIGINT',()=>server.close(()=>process.exit(0)));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
