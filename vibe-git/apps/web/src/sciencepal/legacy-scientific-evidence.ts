/** Compatibility adapter for earlier saved cases. New projects use researchEvidence; no workflow gate depends on a case. */
import {CRN_CASE} from '@vibe-git/protocol';
export function legacyResearchEvidence(result:Record<string,unknown>){
 if(result.sourceSha256!==CRN_CASE.sha256)return undefined;
 let log:Record<string,unknown>={};try{if(typeof result.toolLog==='string')log=JSON.parse(result.toolLog);}catch{}
 if(typeof result.totalSasaA2!=='number')return undefined;
 return {version:1,tools:[{name:'BioPython PDBParser / ShrakeRupley',version:String(log.biopython_version??'未记录'),log:typeof result.toolLog==='string'?result.toolLog:''}],parameters:[{name:'探针半径',value:result.probeRadiusA,unit:'Å'},{name:'球面采样点',value:result.nPoints},{name:'原子半径 C/N/O/S',value:JSON.stringify(result.atomicRadiiA),unit:'Å'}],measurements:[{name:'总 SASA',value:result.totalSasaA2,unit:'Å²'}],limitations:Array.isArray(result.limitations)?result.limitations:[]};
}
