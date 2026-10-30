/** Verify distributed replay bytes without calling models or reading personal credentials. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,sep} from 'node:path';
const root=resolve('apps/web/public'),hash=b=>createHash('sha256').update(b).digest('hex');
let artifacts=0;
for(const [id,count] of [['1crn',7],['iris',9]]){
 const dir=join(root,'research-replay',id),bundle=JSON.parse(await readFile(join(dir,'case.json'),'utf8'));
 assert.equal(bundle.steps.length,count);
 for(const f of Object.values(bundle.files)){
  const path=resolve(root,'.'+f.url);assert(path.startsWith(dir+sep));
  const bytes=await readFile(path);assert.equal(bytes.length,f.size);assert.equal(hash(bytes),f.sha256);artifacts++;
 }
 for(const f of bundle.scienceReports??[]){
  const path=resolve(root,'.'+f.url);assert(path.startsWith(dir+sep));
  const bytes=await readFile(path);assert.equal(bytes.length,f.size);assert.equal(hash(bytes),f.sha256);
  const report=JSON.parse(bytes);assert.equal(report.candidateSha256,f.candidateSha256);assert.equal(report.reviewArtifactId,f.reviewArtifactId);
 }
}
assert.equal(artifacts,38);
const source=await readFile(join(root,'sciencepal-examples/1CRN.pdb'));
assert.equal(hash(source),'42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811');
console.log(JSON.stringify({passed:true,cases:2,stages:16,artifacts,scope:'Exact distributed replay bytes, bound report identity and optional example source; no models.'}));
