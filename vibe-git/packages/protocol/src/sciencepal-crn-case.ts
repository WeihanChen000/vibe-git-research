import type {SPResultSchemas, SPResultSchema} from "./sciencepal-pipeline.js";
export const CRN_CASE = {
  "title": "1CRN 专业复现 · 结构核验与表面积复核",
  "sourceUrl": "https://www.rcsb.org/structure/1CRN",
  "attribution": "RCSB PDB 1CRN, crambin crystal structure. Public PDB archive data (CC0). 原始结构字节保持不变，仅更名为 source-1crn.txt。描述性复算，不推断功能或药效。",
  "sha256": "42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811",
  "proposals": [
    "1CRN 专业复现，仅两项任务 geometry 和 sasa。我的分工 geometry：读取真实 source-1crn.txt，model 0、chain A、标准 ATOM 重原子，独立计算原子数、残基数与 SSBOND 对应 SG–SG 距离，单位 Å。输出 geometry.json，result 包含 sourceSha256,atomCount,residueCount,disulfides:[{residue1,residue2,distanceA}],pythonCode,toolLog,limitations,faultInjection:false。提供实际完整代码和运行日志，不注入错误。固定验收：源文件哈希与冻结字节相同且327重原子46残基；三对3-40、4-32、16-26距离与原坐标独立重算绝对误差<=0.0001 Å；实际代码、日志及描述性复算边界齐全。sasa必须硬依赖获批geometry，另一成员独立评审。原始数据不能修改，不拆出额外评审任务。",
    "我的分工 sasa，硬依赖获批 geometry.json，同时读取 source-1crn.txt。使用本人 SciencePAL Biology 中实际可用的 BioPython PDBParser 和 ShrakeRupley，model 0 chain A 标准重原子，探针1.4 Å、960球面点、原子半径 C1.70/N1.55/O1.52/S1.80 Å；此参数已确认，不需人为制造追问，确实缺工具或数据时才求助。result 包含 sourceSha256,upstreamSha256,atomCount,residueCount,probeRadiusA,nPoints,atomicRadiiA,totalSasaA2,residues:[{id,name,sasaA2}],pythonCode,toolLog,limitations；toolLog为JSON字符串，含biopython_version和python_version。交付实际执行代码及日志。固定验收：原数据与获批上游哈希正确且327原子46残基；BioPython版本、实际代码与执行日志齐全，固定参数一致；由另一成员用独立NumPy 5000点实现重算，总面积差<=3%，六个CYS整残基差<=max(3 Å²,参考值5%)；46个唯一残基非负面积和总面积差<0.001 Å²，明确单结构描述性复算限制，不推断药效、功能或新发现。没有独立复算证据不能仅凭模型口头同意称已复现。"
  ]
} as const;
const text:SPResultSchema={type:'string',minLength:1};
const number:SPResultSchema={type:'number',minimum:0};
const hash:SPResultSchema={type:'string',minLength:64,maxLength:64};
const obj=(properties:Record<string,SPResultSchema>):SPResultSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const arr=(items:SPResultSchema,count:number):SPResultSchema=>({type:'array',items,minItems:count,maxItems:count});
const common={sourceSha256:{...hash,const:CRN_CASE.sha256},atomCount:{type:'integer',const:327},residueCount:{type:'integer',const:46},pythonCode:text,toolLog:text,limitations:{type:'array',items:text,minItems:1,maxItems:12}} satisfies Record<string,SPResultSchema>;
export const CRN_RESULT_SCHEMAS:SPResultSchemas={
 geometry:obj({...common,disulfides:arr(obj({residue1:{type:'integer',minimum:1,maximum:46},residue2:{type:'integer',minimum:1,maximum:46},distanceA:number}),3),faultInjection:{type:'boolean',const:false}}),
 sasa:obj({...common,upstreamSha256:hash,probeRadiusA:{type:'number',const:1.4},nPoints:{type:'integer',const:960},atomicRadiiA:obj({C:{type:'number',const:1.7},N:{type:'number',const:1.55},O:{type:'number',const:1.52},S:{type:'number',const:1.8}}),totalSasaA2:number,residues:arr(obj({id:{type:'integer',minimum:1,maximum:46},name:text,sasaA2:number}),46)})
};
