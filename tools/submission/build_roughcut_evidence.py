"""Build an editorial evidence viewer from immutable public records; no execution UI."""
from pathlib import Path
import json, hashlib, html
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'docs/research/latest-governance-live'
OUT=ROOT/'docs/submission/rough-cut'; OUT.mkdir(parents=True,exist_ok=True)
p=json.loads((SRC/'project.json').read_text('utf8')); m=json.loads((SRC/'manifest.json').read_text('utf8'))
for a in m['artifacts'].values():
 b=(SRC/a['path']).read_bytes(); assert len(b)==a['size'] and hashlib.sha256(b).hexdigest()==a['sha256'],a['path']
def artifact(id): return json.loads((SRC/m['artifacts'][id]['path']).read_text('utf8'))
def link(id):return '../../research/latest-governance-live/'+m['artifacts'][id]['path']
sasaid='ead0e927-fa96-48eb-a3b2-f62d05e6a311';rejid='b84de99c-29c4-4868-892f-25161380a9c7'
appid='c7f3cf7e-47e7-4955-ba56-7c401ecd9860';reportid='06e7e7be-2d9e-4b78-b05e-07932e4d85c1';changeid='94619586-b946-41aa-a98a-273db9797fdb'
s=artifact(sasaid)['result']; rejected=artifact(rejid); approved=artifact(appid); report=artifact(reportid); change=artifact(changeid)
obs=json.loads((SRC/'tool-observations.json').read_text('utf8')); remote=json.loads((SRC/'remote-sasa-proof.json').read_text('utf8'))
base='../../research/latest-governance-live/'
scenes=[]
def add(id,title,note,rows,source,kind='真实运行记录｜1CRN',hint='摘录原始字段；点击下方链接可查看完整记录。'):
 scenes.append(dict(id=id,title=title,note=note,rows=rows,source=source,kind=kind,hint=hint))
add('protocol','01  先约定什么结果可以交接','研究问题：固定 1CRN 结构的溶剂可及表面积是多少？',[
 ['source-1CRN.pdb','49,491 bytes · 原始输入保持不变'],['method / n_points / probe_radius_A',f'{s["method"]} / {s["n_points"]} / {s["probe_radius_A"]} Å'],['assignee → reviewer','SciencePAL Biology Agent → Codex'],['acceptance','数值对照 ≤ 2%；交付实际代码、运行记录与版本；独立复核']],base+'project.json',hint='编辑摘要，来源为已冻结任务；不是本次重新发布。')
add('tools','02  SciencePAL 实际执行了什么','以下来自原 SciencePAL 工具卡片的人工观察记录。',[
 ['version.stdout',obs['version']['stdout']],['calculation · command','cd /workspace && python run_sasa.py'],['calculation · stdout','atom_count: 327\nresidue_count: 46\ntotal_A2: 2967.616530309649\nWrote sasa.json'],['remote-sasa-proof.json',f"status: {remote['runs'][0]['status']} · 原运行共 1 次"]],base+'tool-observations.json',hint='工具卡片观察记录，不是平台签名遥测；不是 SciencePAL 原生界面录屏。')
add('result','03  读取实际交付文件','打开 sasa.json，查看数值和参数。',[
 ['result',json.dumps({k:s[k] for k in ['method','probe_radius_A','n_points','atom_count','residue_count','total_A2']},ensure_ascii=False,indent=2)],['inputReceipts','原输入 SHA256 与冻结版本一致']],link(sasaid))
add('reference','04  Codex 独立计算参考值','这是已完成复核中的本地 NumPy 计算，未在拍片时重跑。',[
 ['SciencePAL / result.total_A2',f"{s['total_A2']} Å²"],['独立 NumPy 5000 点参考','2973.1627706139175 Å²'],['相对差 / 预设容差','0.18654446600554456% / 2%'],['结果边界','固定结构的几何复现；不代表生物学新发现。']],link(appid),'本地独立复核',hint='数值来自第二次 SASA 评审；第一次参考实现不同，未混用两轮数值。')
add('reject','05  数值通过，仍不能批准交接','本例预设遗漏版本信息，验证证据不足时的恢复。',[
 ['result.verdict',rejected['result']['verdict']],['result.summary · 原文摘录','Final approval is withheld because sasa.json contains neither complete actually executed source/reproduction nor original execution evidence nor tool_versions.'],['需要补什么（中文说明）','原计算代码、原执行日志、工具版本。'],['恢复动作（原评审要求）','do not recalculate solely to restore versions.']],link(rejid),hint='受控恢复测试，非意外科学错误；审批退回不能被描述为数值检查失败。')
add('supplement','06  补回原始证据，保留计算结果','人工从原对话找回材料，再由 Codex 独立复审。',[
 ['project.events','2026-10-31T07:38:06.778Z\n执行 supplement-review'],['补充材料 · 编辑摘要','完整原代码：4065 UTF-8 bytes\n原工具输出：327 原子 / 46 残基 / 2967.616530309649\nBiopython 1.84'],['复审使用的 sasa.json',next(x['sha256'] for x in approved['inputReceipts'] if x['filename']=='sasa.json')],['注意','原文件没有被补写；证据通过约定的补证路径随评审交付。']],link(appid),hint='原 Python 精确补丁版本未记录；没有用复核者版本冒充生产者版本。')
add('approve','07  新评审批准同一份成果','查看两次评审各自绑定的文件。',[
 ['首次评审 → request_changes',next(x['sha256'] for x in rejected['inputReceipts'] if x['filename']=='sasa.json')],['补证复审 → '+approved['result']['verdict'],next(x['sha256'] for x in approved['inputReceipts'] if x['filename']=='sasa.json')],['result.summary · 原文摘录','Author code was inspected, not rerun; the new reviewer baseline fulfills the original independent-review criterion.'],['调用边界','保留原生产者计算；新增复审仍有模型与独立计算成本。']],link(appid))
add('change','08  第二轮只增加报告要求','队长批准变更并重新对齐，影响范围为 report。',[
 ['change.request · 原文摘录','Only change the report presentation: add summary_zh (a concise Chinese answer, at most 150 Chinese characters) and limitations_zh (exactly two concise Chinese limitation items) to report.json.'],['change.result.affectedTaskKeys',json.dumps(change['result']['affectedTaskKeys'])],['仍须保留（中文说明）','原英文内容、数值、单位、输入与上游哈希、原科学边界。'],['change.status',p['changes'][0]['status']]],link(changeid))
r1=next(t for t in p['history'][0]['tasks'] if t['key']=='sasa');r2=next(t for t in p['tasks'] if t['key']=='sasa')
assert r1['artifactId']==r2['artifactId'] and r1['executionId']==r2['executionId'] and r1['reviewId']==r2['reviewId']
add('reuse','09  R2 沿用 R1 成果及批准记录','下面三项逐一相等，不能仅凭文件名判断复用。',[
 ['artifactId · R1 = R2',r2['artifactId']],['executionId · R1 = R2',r2['executionId']],['reviewId · R1 = R2',r2['reviewId']],['carriedFrom',json.dumps(r2['carriedFrom'],ensure_ascii=False,indent=2)]],base+'project.json',hint='对照 project.history[0].tasks 与 project.tasks，未构造历史界面快照。')
add('report','10  最终交付回答了什么','R2 报告新增中文摘要与两条局限，数值来自原批准成果。',[
 ['result.summary_zh',report['result']['summary_zh']],['result.limitations_zh','\n'.join(report['result']['limitations_zh'])],['result.upstream_sha256',report['result']['upstream_sha256']]],link(reportid))
add('limits','11  已证明什么，尚未证明什么','本轮是对已有真实记录的只读讲解。',[
 ['来源与增量','原 Vibe-Git：协作与对齐基础\n队友：通用 Agent 适配器、新工作台\n本次增量：科研证据交接、补证与变更复用'],['真实范围','单人、单机、一个 SciencePAL 账号与 Codex；31 份附件、34 条输入回执。'],['尚未证明','真人跨电脑协作；总体省时或省钱。'],['本次录像限制','1CRN 模拟器在 ALIGN 阶段失败；后续仅展示真实保存记录。']],base+'manifest.json',hint='不同平台分工不等于 SciencePAL 无法替代；其实际贡献是 Biology 工具计算与产物交付。')
handoffid='92ddeff2-0af9-4fe8-b094-ce541878ab24'
handoff=artifact(handoffid)['upstream'][0]['approval']
assert hashlib.sha256(handoff['reviewFileUtf8'].encode('utf8')).hexdigest()==handoff['reviewArtifact']['sha256']
add('handoff','12  交给报告的不只是一份文件','报告任务接收成果、批准依据及数值检查记录。',[
 ['upstream.approval.verdict',handoff['verdict']],['reviewedArtifact.filename / sha256',handoff['reviewedArtifact']['filename']+'\n'+handoff['reviewedArtifact']['sha256']],['reviewRunId',handoff['reviewRunId']],['scientificValidation.status',handoff['scientificValidation']['status']+' · 仅针对已配置规则']],link(handoffid),hint='context.json 包含原评审全文；本次重新核对其 SHA256 与绑定记录一致。')
assert scenes[4]['rows'][1][1] in rejected['result']['summary']
assert scenes[4]['rows'][3][1] in rejected['result']['summary']
assert scenes[6]['rows'][2][1] in approved['result']['summary']
assert scenes[7]['rows'][0][1] in p['changes'][0]['request']
(OUT/'evidence-scenes.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
style='''*{box-sizing:border-box}body{margin:0;background:#fff;color:#172033;font:22px/1.5 "Microsoft YaHei",sans-serif}header{padding:16px 32px;background:#f1f4f8;border-bottom:1px solid #ccd3dc;display:flex;justify-content:space-between;font-size:17px}header b{color:#8a4b00}nav{display:flex;gap:7px;padding:16px 32px;border-bottom:1px solid #ddd}nav button{background:white;border:1px solid #aeb8c5;border-radius:5px;padding:7px 14px;font-size:16px;cursor:pointer}nav button.active{background:#183c65;color:white}main{padding:22px 42px;max-width:1400px}h1{font-size:32px;margin:0 0 8px}p{margin:0 0 18px;color:#45536a}.row{display:grid;grid-template-columns:290px 1fr;padding:13px 0;border-top:1px solid #d8dee7;gap:18px}.key{font-size:18px;color:#4e5d70}.value{font:23px/1.45 Consolas,"Microsoft YaHei",monospace;white-space:pre-wrap;overflow-wrap:anywhere}.hint{font-size:17px;margin-top:15px;color:#624c24}a{font-size:17px;color:#075cba}footer{padding:6px 32px;font-size:14px;color:#607080}'''
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>1CRN 保存记录阅览 · 视频素材</title><style>'''+style+'''</style><header><span>1CRN 保存记录阅览 · 视频素材，非产品操作界面</span><b id="scope"></b></header><nav></nav><main></main><footer>已完成运行：2026-10-31 · 录像素材整理：2026-11-01 · 本页只读，不调用模型</footer><script>
const scenes=DATA;
const nav=document.querySelector('nav');
scenes.forEach((s,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.title=s.title;b.onclick=()=>{location.hash=s.id};nav.append(b)});
function el(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
function render(){const i=Math.max(0,scenes.findIndex(s=>s.id===location.hash.slice(1)));const s=scenes[i];document.querySelector('#scope').textContent=s.kind;nav.querySelectorAll('button').forEach((b,n)=>b.classList.toggle('active',n===i));const main=document.querySelector('main');main.replaceChildren(el('h1',s.title),el('p',s.note));for(const [k,v] of s.rows){const row=el('div','');row.className='row';const key=el('div',k);key.className='key';const value=el('div',v);value.className='value';row.append(key,value);main.append(row)}const hint=el('p',s.hint);hint.className='hint';main.append(hint);const a=el('a','查看原始文件 ↗');a.href=s.source;a.target='_blank';main.append(a);window.scrollTo(0,0)}window.addEventListener('hashchange',render);render();</script></html>'''.replace('DATA',json.dumps(scenes,ensure_ascii=False).replace('</','<\\/'))
(OUT/'evidence.html').write_text(page,encoding='utf8')
print('Verified 31 original artifacts; built',len(scenes),'read-only record scenes.')
