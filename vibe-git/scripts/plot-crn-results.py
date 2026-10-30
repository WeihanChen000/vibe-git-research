"""Plot saved real SciencePAL outputs, without calling a model or editing source evidence."""
from pathlib import Path
import json, hashlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parents[2]
file=root/"vibe-git/fixtures/integrated-live/d66660eb-1ad0-4bb2-8730-ecb834277164.json"
raw=file.read_bytes(); result=json.loads(raw)["result"]
rows=sorted(result["residues"],key=lambda r:r["residue_number"])
ref=json.loads((root/"docs/research/evidence/independent-reference.json").read_text())
assert len(rows)==46 and len({r["residue_number"] for r in rows})==46
assert abs(sum(r["area_A2"] for r in rows)-result["total_A2"])<0.001
rank=sorted(rows,key=lambda r:r["area_A2"],reverse=True)
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":12,"text.color":"#edf5fd","axes.labelcolor":"#edf5fd","xtick.color":"#b7c8dc","ytick.color":"#b7c8dc"})
fig,ax=plt.subplots(figsize=(16,5.5),facecolor="#0a111b",layout="constrained");ax.set_facecolor("#0a111b")
x=[r["residue_number"] for r in rows]
ax.bar(x,[r["area_A2"] for r in rows],color="#88c5ff",width=.72,label="SciencePAL / Biopython: 1,000 points")
ax.scatter(x,[r["area_A2_n5000"] for r in rows],marker="_",s=80,color="#ffd080",linewidth=2,label="SciencePAL: 5,000 points",zorder=3)
ax.scatter(x,[r["sasa_A2"] for r in ref["residues"]],s=12,color="#6ee1c5",label="Independent NumPy reference",zorder=4)
for r in rank[:3]:
 ax.annotate(f'{r["residue_name"]} {r["residue_number"]}\n{r["area_A2"]:.1f}',(r["residue_number"],r["area_A2"]),xytext=(0,13),textcoords="offset points",ha="center",fontsize=12,color="#edf5fd")
ax.set(xlim=(0,47),ylim=(0,max(r["area_A2"] for r in rows)*1.37),xlabel="Residue number (chain A)",ylabel="Absolute solvent-accessible area (Å²)")
ax.set_xticks([1,5,10,15,20,25,30,35,40,46]);ax.spines[['top','right']].set_visible(False)
ax.grid(axis="y",color="#304156",alpha=.5);ax.set_axisbelow(True);ax.legend(loc="upper left",frameon=False,labelcolor="#edf5fd",fontsize=10)
fig.suptitle("1CRN: which residues have more absolute exposed surface?",fontsize=18,color="#edf5fd")
folder=root/"docs/submission";fig.savefig(folder/"crn-residue-results.png",dpi=120);plt.close(fig)
lines=["# 1CRN：哪些残基有较大的绝对溶剂可及面积？","", "以下使用已有真实 SciencePAL Biology 计算结果，不是新远端运行。固定 1CRN 单结构、chain A 重原子与 1.4 Å 探针；这是一项几何复核，不是生物功能或药效发现。","", "![逐残基绝对溶剂可及面积](crn-residue-results.png)","", "| 残基 | 1000 点面积 / Å² | 5000 点面积 / Å² |","|---|---:|---:|"]
for r in rank[:5]:lines.append(f'| {r["residue_name"]} {r["residue_number"]} | {r["area_A2"]:.3f} | {r["area_A2_n5000"]:.3f} |')
lines += ["", "这些残基在该固定结构中的绝对可及面积较大。不同残基大小不同，因此这不是按最大可能面积归一化的相对暴露率，不能据此断言最活跃或最重要的功能位点。CYS 3 和 CYS 4 在两档采样中报告面积为零；这是此结构及采样下的几何结果，不代表所有动态构象中都完全不可接近。", "", "1000 点总量为 2967.6165 Å²，5000 点为 2970.9267 Å²，两者相差约 0.1114%。独立 NumPy 5000 点、不同相位参考为 2973.1628 Å²。总量一致不能代替逐残基复核；本次新增门禁同时检查求和、唯一残基和逐项参考差异。", "", "参考比较使用预先定义的数值容差；不是置信区间，不证明误差绝对为零。独立参考在本次重新运行验证，其总量与保存的参考一致。", "", f"原始 SciencePAL 文件 SHA256：`{hashlib.sha256(raw).hexdigest()}`。", "", "[原始计算附件](../../vibe-git/fixtures/integrated-live/d66660eb-1ad0-4bb2-8730-ecb834277164.json) · [独立参考](../research/evidence/independent-reference.json) · [可执行检查报告](../research/evidence/scientific-gates.json)", "", "重绘：`python scripts/plot-crn-results.py`（在 vibe-git 目录，需要 Matplotlib）；数据直接读取冻结原件。"]
(folder/"CRN-RESULTS.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
print(json.dumps({"top3":[{"id":r["residue_number"],"name":r["residue_name"],"area":r["area_A2"]} for r in rank[:3]]}))
