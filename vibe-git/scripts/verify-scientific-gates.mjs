/** Offline checks on saved real bytes plus clearly labeled controlled mutations. No model calls. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {crnScientificChecks} from '../packages/protocol/dist/index.js';
import {checkScientificResult,validateScientificChecks} from '../apps/host/dist/sciencepal/scientific-checks.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=readFileSync(new URL('../fixtures/integrated-live/d66660eb-1ad0-4bb2-8730-ecb834277164.json',import.meta.url));
const source=readFileSync(new URL('../fixtures/integrated-live/source-1crn.pdb',import.meta.url));
const raw=JSON.parse(bytes),config=validateScientificChecks(crnScientificChecks(true),sha(source)),rulesHash=sha(JSON.stringify(config));
const rescale=structuredClone(raw);rescale.result.total_A2*=1.2;rescale.result.residues.forEach(r=>r.area_A2*=1.2);
const redistribute=structuredClone(raw);redistribute.result.residues[0].area_A2+=20;redistribute.result.residues[6].area_A2-=20;
const sum=structuredClone(raw);sum.result.total_A2+=30;
const rows=[['real-original',raw,bytes,false],['sum-mismatch',sum,Buffer.from(JSON.stringify(sum)),true],['all-values-plus-20-percent',rescale,Buffer.from(JSON.stringify(rescale)),true],['same-total-redistributed',redistribute,Buffer.from(JSON.stringify(redistribute)),true]].map(([id,data,original,synthetic])=>({id,syntheticPerturbation:synthetic,report:checkScientificResult(config,'sasa',data.result,rulesHash,sha(original),sha(source))}));
assert.equal(rows[0].report.status,'PASSED');for(const r of rows.slice(1))assert.equal(r.report.status,'FAILED');
const output={scope:'Post-hoc execution of numeric-v1 on saved real SciencePAL output; mutations are synthetic, not new remote runs. Reference binding and checks are also enforced in the live pipeline. Approval-bypass integration tests are separate.',sourceSha256:sha(source),originalArtifactSha256:sha(bytes),rulesHash,checks:config,rows};
const file=resolve(process.argv[2]||'data/scientific-gates/report.json');mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({realPassed:true,controlledWrongResultsRejected:3,totalControlledWrongResults:3}));
