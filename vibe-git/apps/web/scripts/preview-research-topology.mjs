import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const dist=resolve('apps/web/dist'),base=resolve('data/mixed-team-simulation');
await mkdir(resolve('data/research-topology'),{recursive:true});
const json=async name=>JSON.parse(await readFile(resolve(base,name),'utf8'));
const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET'){res.writeHead(405);res.end('Read-only simulation');return;}
 const url=new URL(req.url,'http://localhost'),path=url.pathname,scene=new URL(req.headers.referer||'http://localhost').searchParams.get('scene')||'repair';
 res.setHeader('Cache-Control','no-store');
 if(path==='/api/sciencepal-team/state'){
  if(scene==='auth'){res.writeHead(401);res.end('{}');return;}
  const s=await json(scene==='completed'?'ui-state-completed.json':'ui-state.json');s.preview=true;
  // Display aliases apply only to this explicitly labelled synthetic preview.
  const labels=new Map(s.members.map((m,i)=>[m.id,i===0?'研究员 A':'研究员 B']));
  s.viewer.label=labels.get(s.viewer.id);s.members.forEach(m=>m.label=labels.get(m.id));
  s.projects.forEach(p=>p.team.members.forEach(m=>m.label=labels.get(m.nodeId)));
  if(scene==='empty')s.projects=[];
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(s));return;
 }
 const match=path.match(/^\/api\/sciencepal-team\/projects\/([^/]+)\/(artifacts\/([^/]+)|evidence)$/);
 if(match){const state=await json('ui-state-completed.json');if(match[1]!==state.projects[0].id)throw Error('Unknown project');
  if(match[3]){const a=(await json('preview-artifacts.json'))[match[3]];if(!a)throw Error('Unknown artifact');res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="${a.filename}"`);res.setHeader('X-Artifact-SHA256',a.sha256);res.end(Buffer.from(a.base64,'base64'));}
  else{res.setHeader('Content-Type','application/json');const e=scene==='completed'?(await json('preview-evidence-completed.json'))[url.searchParams.get('revision')||'2']:await json('preview-evidence-repair.json');res.end(JSON.stringify(e,null,2));}return;
 }
 let file;if(path==='/original')file=resolve('../ui-review/agents-product-plan-mock.html');else if(path==='/'||path==='/sciencepal/team')file=resolve(dist,'index.html');
 else{file=resolve(dist,'.'+decodeURIComponent(path));if(!file.startsWith(dist+sep))throw Error('Forbidden');}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;await writeFile('data/research-topology/preview.json',JSON.stringify({origin,pid:process.pid,scope:'read-only synthetic data'},null,2));console.log(origin);
