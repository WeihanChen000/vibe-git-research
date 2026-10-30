#!/usr/bin/env python3
"""Vibe-Git Research 公开评委复核演示 — 独立核查脚本(judge runtime 实际执行)。

本脚本对 4 份公开附件(source-1CRN.pdb / sasa.json / approved-review.json /
synthesis.json)做独立核查:
  1) 逐一 SHA256 与字节数;
  2) 独立固定列解析 PDB:chain A、非氢 ATOM、altLoc 空或 'A',统计原子/残基/元素;
  3) 核对 sasa.json 的 1000/5000 点逐残基面积求和、收敛比值、方法与 1.4 A 探针
     (纯数值复核,不重跑 SASA 几何采样);
  4) 核对 approved-review.json 原始 envelope 对 sasa.json 的输入回执与 approve 裁决,
     并确认 synthesis.json 引用的正是这份获批文件(哈希链);
  5) 依据实际数表核对综合结论的前五个残基与零采样面积解释,确认无功能/临床推断。

边界声明:这是公开演示的独立核查,不是原始运行的实时重播,不是两个真人账号实证,
不声称 SciencePAL 独占算法或更准确,不替代完整 Vibe-Git 协作平台。
"""
import hashlib
import importlib.metadata
import json
import math
import platform
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone

FILES = ["source-1CRN.pdb", "sasa.json", "approved-review.json", "synthesis.json"]
TOL = 1e-9  # 数值比较容差(浮点)


def sha256_size(path):
    with open(path, "rb") as f:
        raw = f.read()
    return hashlib.sha256(raw).hexdigest(), len(raw)


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- 检查 1:逐一 SHA256 与字节数 ----------
hashes = OrderedDict((f, sha256_size(f)) for f in FILES)
check1 = {
    "description": "逐一计算 4 份附件的实际 SHA256 与字节数(原始字节)",
    "files": [
        {"filename": f, "sha256": h, "size_bytes": s} for f, (h, s) in hashes.items()
    ],
}
check1["passed"] = all(len(h) == 64 and s > 0 for h, s in hashes.values())

# ---------- 检查 2:独立解析 PDB ----------
atoms = []
res_seen = OrderedDict()
altlocs = Counter()
elem = Counter()
model_records = hetatm_records = atom_records_total = 0
nonfinite_coords = 0
with open("source-1CRN.pdb", "r", encoding="utf-8") as f:
    for line in f:
        rec = line[:6].strip()
        if rec == "MODEL":
            model_records += 1
        if rec == "HETATM":
            hetatm_records += 1
        if rec != "ATOM":
            continue
        atom_records_total += 1
        if line[21] != "A":
            continue
        alt = line[16]
        if alt not in (" ", "A"):
            continue
        el = line[76:78].strip() or line[12:14].strip()[0]
        if el in ("H", "D"):
            continue
        altlocs[alt] += 1
        elem[el] += 1
        try:
            xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
        except ValueError:
            xyz = (float("nan"),) * 3
        if not all(math.isfinite(v) for v in xyz):
            nonfinite_coords += 1
        key = (line[21], int(line[22:26]), line[26].strip())
        res_seen.setdefault(key, line[17:20].strip())
        atoms.append({
            "chain": line[21], "resSeq": int(line[22:26]), "icode": line[26].strip(),
            "resName": line[17:20].strip(), "name": line[12:16].strip(),
            "altLoc": alt, "element": el, "xyz": xyz,
        })

sel = {
    "model_records": model_records,
    "atom_records_total_in_file": atom_records_total,
    "hetatm_records_in_file": hetatm_records,
    "selected_atom_count": len(atoms),
    "residue_count": len(res_seen),
    "element_counts": dict(sorted(elem.items())),
    "altloc_values_observed": sorted(altlocs.keys()),
    "hydrogen_or_deuterium_atoms": elem.get("H", 0) + elem.get("D", 0),
    "nonfinite_coordinates": nonfinite_coords,
}
expected_sel = {
    "selected_atom_count": 327, "residue_count": 46,
    "element_counts": {"C": 202, "N": 55, "O": 64, "S": 6},
}
check2 = {
    "description": "独立固定列解析 source-1CRN.pdb:chain A、ATOM、非 H/D、altLoc 空或 A",
    "observed": sel,
    "expected_for_frozen_selection": expected_sel,
    "assertions": {
        "atom_count_is_327": sel["selected_atom_count"] == 327,
        "residue_count_is_46": sel["residue_count"] == 46,
        "element_counts_match_C202_N55_O64_S6": sel["element_counts"] == expected_sel["element_counts"],
        "no_hydrogens_selected": sel["hydrogen_or_deuterium_atoms"] == 0,
        "no_hetatm_records_in_file": hetatm_records == 0,
        "no_model_records_single_implicit_model": model_records == 0,
        "only_blank_altloc_observed": sel["altloc_values_observed"] == [" "],
        "all_coordinates_finite": nonfinite_coords == 0,
    },
}
check2["passed"] = all(check2["assertions"].values())

# ---------- 检查 3:sasa.json 数值核对(不重跑几何) ----------
sasa = load("sasa.json")
sr = sasa["result"]
res1000 = sr["runs"]["n1000"]["residues"]
res5000 = sr["runs"]["n5000"]["residues"]
by1000 = {(r["residue_number"], r["insertion_code"]): r for r in res1000}
by5000 = {(r["residue_number"], r["insertion_code"]): r for r in res5000}
sum1000, fsum1000 = sum(r["area_A2"] for r in res1000), math.fsum(r["area_A2"] for r in res1000)
sum5000, fsum5000 = sum(r["area_A2"] for r in res5000), math.fsum(r["area_A2"] for r in res5000)
tot1000, tot5000 = sr["total_A2"], sr["runs"]["n5000"]["total_A2"]
ratio = abs(tot1000 - tot5000) / tot5000
# 逐残基 diff 字段一致性 + 两套分辨率键集合一致
per_res_absdiff_ok = all(
    abs(r["abs_diff_A2"] - abs(r["area_A2"] - r["area_A2_n5000"])) <= 1e-9
    for r in sr["residues"]
)
keys_match = set(by1000) == set(by5000) == set((k[1], k[2]) for k in res_seen)
areas_finite_ok = all(
    math.isfinite(r["area_A2"]) and r["area_A2"] >= 0
    for r in res1000 + res5000
)
# 主表(result.residues)与 runs.n1000 完全一致
primary_matches_run = len(sr["residues"]) == len(res1000) and all(
    abs(a["area_A2"] - b["area_A2"]) <= TOL
    and a["residue_number"] == b["residue_number"]
    and a["residue_name"] == b["residue_name"]
    for a, b in zip(sr["residues"], res1000)
)
# 最大逐残基差
maxd = max(sr["residues"], key=lambda r: r["abs_diff_A2"])
cv = sr["convergence"]
check3 = {
    "description": "核对 sasa.json 求和/收敛/方法/探针/半径/版本(纯数值复核,未重跑 SASA 几何)",
    "method": sr["method"],
    "probe_radius_A": sr["probe_radius_A"],
    "n_points_primary": sr["n_points"],
    "n_points_comparison": sr["runs"]["n5000"]["n_points"],
    "radii_A": sr["radii_A"],
    "units": sr["units"],
    "n1000": {
        "row_count": len(res1000),
        "independent_sum_A2": sum1000,
        "independent_fsum_A2": fsum1000,
        "reported_total_A2": tot1000,
        "residual_vs_total_A2": sum1000 - tot1000,
    },
    "n5000": {
        "row_count": len(res5000),
        "independent_sum_A2": sum5000,
        "independent_fsum_A2": fsum5000,
        "reported_total_A2": tot5000,
        "residual_vs_total_A2": sum5000 - tot5000,
    },
    "convergence": {
        "abs_difference_A2": abs(tot1000 - tot5000),
        "independent_ratio": ratio,
        "reported_ratio": cv["ratio"],
        "threshold": cv["threshold"],
        "within_threshold": ratio <= cv["threshold"],
        "max_abs_per_residue_A2": maxd["abs_diff_A2"],
        "max_residue": {"resName": maxd["residue_name"], "resSeq": maxd["residue_number"]},
    },
    "source_binding": {
        "sasa_source_sha256": sr["source_sha256"],
        "matches_actual_pdb_sha256": sr["source_sha256"] == hashes["source-1CRN.pdb"][0],
        "sasa_input_receipt_pdb_matches": any(
            r["filename"] == "source-1CRN.pdb"
            and r["sha256"] == hashes["source-1CRN.pdb"][0]
            and r["size"] == hashes["source-1CRN.pdb"][1]
            for r in sasa["inputReceipts"]
        ),
    },
    "selection_claim_matches_independent_parse": (
        sr["selection"]["atom_count"] == sel["selected_atom_count"]
        and sr["selection"]["residue_count"] == sel["residue_count"]
        and sr["selection"]["element_counts"] == sel["element_counts"]
    ),
    "assertions": {
        "method_is_shrake_rupley": sr["method"] == "Shrake-Rupley",
        "probe_radius_is_1_4_A": sr["probe_radius_A"] == 1.4,
        "primary_n_points_is_1000": sr["n_points"] == 1000,
        "comparison_n_points_is_5000": sr["runs"]["n5000"]["n_points"] == 5000,
        "n1000_sum_equals_reported_total": abs(sum1000 - tot1000) <= TOL,
        "n5000_sum_equals_reported_total": abs(sum5000 - tot5000) <= TOL,
        "ratio_recomputes_to_reported_value": abs(ratio - cv["ratio"]) <= 1e-12,
        "ratio_within_0_02": ratio <= 0.02,
        "per_residue_absdiff_fields_consistent": per_res_absdiff_ok,
        "residue_key_sets_match_pdb_and_across_runs": keys_match,
        "all_areas_finite_nonnegative": areas_finite_ok,
        "primary_table_matches_n1000_run": primary_matches_run,
        "source_sha256_binds_actual_pdb": sr["source_sha256"] == hashes["source-1CRN.pdb"][0],
        "envelope_receipt_binds_actual_pdb": any(
            r["filename"] == "source-1CRN.pdb"
            and r["sha256"] == hashes["source-1CRN.pdb"][0]
            and r["size"] == hashes["source-1CRN.pdb"][1]
            for r in sasa["inputReceipts"]
        ),
    },
}
check3["passed"] = all(check3["assertions"].values())

# ---------- 检查 4:approved-review.json 回执与裁决 + synthesis 引用链 ----------
review = load("approved-review.json")
verdict = review["result"]["verdict"]
checks = review["result"]["checks"]
sasa_receipt_ok = any(
    r["filename"] == "sasa.json"
    and r["sha256"] == hashes["sasa.json"][0]
    and r["size"] == hashes["sasa.json"][1]
    for r in review["inputReceipts"]
)
pdb_receipt_ok = any(
    r["filename"] == "source-1CRN.pdb"
    and r["sha256"] == hashes["source-1CRN.pdb"][0]
    and r["size"] == hashes["source-1CRN.pdb"][1]
    for r in review["inputReceipts"]
)

syn = load("synthesis.json")
syr = syn["result"]
gate = syr["approval_gate"]
review_sha_now = hashes["approved-review.json"][0]
syn_sasa_receipt_ok = any(
    r["filename"] == "sasa.json"
    and r["sha256"] == hashes["sasa.json"][0]
    and r["size"] == hashes["sasa.json"][1]
    for r in syn["inputReceipts"]
)
check4 = {
    "description": "核对 approved-review.json 原始 envelope 对 sasa.json 的输入回执、approve 裁决,以及 synthesis.json 的获批文件引用链",
    "review": {
        "revision": review["revision"],
        "verdict": verdict,
        "requiredChanges_empty": review["result"]["requiredChanges"] == [],
        "check_count": len(checks),
        "all_checks_passed_true": all(c.get("passed") is True for c in checks),
        "all_checks_have_evidence": all(isinstance(c.get("evidence"), str) and c["evidence"] for c in checks),
        "reproduction_present": all(k in review["result"]["reproduction"] for k in ("code", "toolVersions", "results")),
        "input_receipt_sasa_json_matches_actual_bytes": sasa_receipt_ok,
        "input_receipt_source_pdb_matches_actual_bytes": pdb_receipt_ok,
        "reviewed_sha256_in_reproduction_matches_actual_sasa": (
            review["result"]["reproduction"]["results"]["reviewed_sha256"] == hashes["sasa.json"][0]
        ),
    },
    "synthesis_linkage": {
        "upstream_sha256_matches_actual_sasa": syr["upstream_sha256"] == hashes["sasa.json"][0],
        "approval_gate_verdict_approve": gate["verdict"] == "approve",
        "approval_gate_reviewedArtifact_matches_actual_sasa": (
            gate["reviewedArtifact"]["sha256"] == hashes["sasa.json"][0]
            and gate["reviewedArtifact"]["size"] == hashes["sasa.json"][1]
        ),
        "approval_gate_reviewArtifact_matches_actual_approved_review": (
            gate["reviewArtifact"]["sha256"] == review_sha_now
            and gate["reviewArtifact"]["size"] == hashes["approved-review.json"][1]
        ),
        "approval_gate_utf8_recomputed_sha256_consistent": (
            gate.get("review_utf8_sha256_recomputed") == review_sha_now
        ),
        "synthesis_envelope_input_receipt_sasa_matches_actual": syn_sasa_receipt_ok,
        "synthesis_status": syr["status"],
    },
}
check4["assertions"] = {
    "verdict_is_approve": verdict == "approve",
    "all_seven_review_checks_passed": all(c.get("passed") is True for c in checks) and len(checks) == 7,
    "sasa_receipt_binds_exact_approved_bytes": sasa_receipt_ok,
    "synthesis_cites_same_approved_sasa": (
        syr["upstream_sha256"] == hashes["sasa.json"][0]
        and gate["reviewedArtifact"]["sha256"] == hashes["sasa.json"][0]
        and syn_sasa_receipt_ok
    ),
    "synthesis_cites_this_approved_review_file": gate["reviewArtifact"]["sha256"] == review_sha_now,
}
check4["passed"] = all(check4["assertions"].values())

# ---------- 检查 5:综合结论的前五残基与零面积解释 ----------
ranked = sorted(res1000, key=lambda r: r["area_A2"], reverse=True)
top5_actual = [
    {"resName": r["residue_name"], "resSeq": r["residue_number"], "area_A2": r["area_A2"],
     "area_A2_n5000": by5000[(r["residue_number"], r["insertion_code"])]["area_A2"]}
    for r in ranked[:5]
]
zero_actual = sorted(
    [(r["residue_number"], r["residue_name"]) for r in res1000
     if r["area_A2"] == 0.0 and by5000[(r["residue_number"], r["insertion_code"])]["area_A2"] == 0.0]
)
ri = syr["residue_interpretation"]
syn_top5 = [(x["residue_name"], x["residue_number"]) for x in ri["top_five"]]
act_top5 = [(x["resName"], x["resSeq"]) for x in top5_actual]
syn_zero = sorted((x["residue_name"], x["residue_number"]) for x in ri["zero_sampled_area_both_resolutions"])
act_zero = sorted((n, m) for m, n in zero_actual)
summary = syr["summary"]
top5_values_ok = all(
    abs(a["area_A2"] - b["area_A2"]) <= TOL
    and abs(a["area_A2_n5000"] - b["area_A2_n5000"]) <= TOL
    for a, b in zip(ri["top_five"], top5_actual)
)
summary_mentions_top5 = all(f"{n} A{q}" in summary for n, q in act_top5)
boundary_ok = (
    "no exposed samples were detected" in summary
    and "not proof of exact zero area" in summary
    and "supports no activity, clinical efficacy" in summary
    and "not a biological functional experiment" in summary
)
ranking_basis_ok = "no normalization or functional inference" in ri["ranking_basis"]
maxdiff_ok = (
    abs(cv["max_abs_per_residue_difference_A2"] - maxd["abs_diff_A2"]) <= 1e-9
    and cv["max_abs_per_residue_difference_residue"]["residue_name"] == maxd["residue_name"]
    and cv["max_abs_per_residue_difference_residue"]["residue_number"] == maxd["residue_number"]
)
check5 = {
    "description": "依据 sasa.json 实际数表核对 synthesis.json 综合结论(前五残基/零面积/边界声明)",
    "computed_top5_by_area": top5_actual,
    "synthesis_top5": [{"resName": x["residue_name"], "resSeq": x["residue_number"],
                        "area_A2": x["area_A2"], "area_A2_n5000": x["area_A2_n5000"]}
                       for x in ri["top_five"]],
    "computed_zero_area_residues_both_resolutions": [{"resName": n, "resSeq": q} for q, n in zero_actual],
    "synthesis_zero_area_list": [{"resName": x["residue_name"], "resSeq": x["residue_number"]}
                                 for x in ri["zero_sampled_area_both_resolutions"]],
    "assertions": {
        "top5_ranking_order_matches_data": syn_top5 == act_top5,
        "top5_values_match_data_exactly": top5_values_ok,
        "zero_area_set_complete_and_matches": syn_zero == act_zero and len(act_zero) == 3,
        "summary_names_all_top5": summary_mentions_top5,
        "zero_area_explained_as_sampling_not_proof": boundary_ok,
        "ranking_basis_forbids_functional_inference": ranking_basis_ok,
        "max_per_residue_change_matches_data": maxdiff_ok,
        "no_functional_or_clinical_claim_in_summary": boundary_ok,
    },
}
check5["passed"] = all(check5["assertions"].values())

# ---------- 汇总 ----------
all_passed = all(c["passed"] for c in (check1, check2, check3, check4, check5))

def ver(pkg):
    try:
        return importlib.metadata.version(pkg)
    except Exception:
        return None

doc = {
    "title": "Vibe-Git Research 公开评委复核演示 — 独立核查结果",
    "generated_utc": datetime.now(timezone.utc).isoformat(),
    "nature": {
        "public_demonstration_independent_check": True,
        "uses_only_attached_public_files_and_local_python": True,
        "is_realtime_replay_of_original_runs": False,
        "is_empirical_proof_of_two_real_accounts": False,
        "sasa_geometry_sampling_recomputed": False,
        "claims_sciencepal_exclusive_algorithm_or_better_accuracy": False,
        "replaces_full_vibe_git_collaboration_platform": False,
        "note": (
            "本次为公开演示的独立核查:重新解析 PDB、重算求和/收敛比值、重验哈希回执链;按演示要求未重跑昂贵的 SASA 几何采样。"
            "文件内部的 member_node 代理 ID 差异属文件内声明,本演示不将其证实为两个真实独立账号。"
        ),
    },
    "files": check1["files"],
    "checks": {
        "1_file_sha256_and_bytes": {"passed": check1["passed"], "description": check1["description"],
                                    "files": check1["files"]},
        "2_pdb_independent_parse": {"passed": check2["passed"], "description": check2["description"],
                                    "observed": check2["observed"], "assertions": check2["assertions"]},
        "3_sasa_sums_convergence_method_probe": {"passed": check3["passed"], "description": check3["description"],
                                                 "method": check3["method"], "probe_radius_A": check3["probe_radius_A"],
                                                 "n_points_primary": check3["n_points_primary"],
                                                 "n_points_comparison": check3["n_points_comparison"],
                                                 "radii_A": check3["radii_A"], "units": check3["units"],
                                                 "n1000": check3["n1000"], "n5000": check3["n5000"],
                                                 "convergence": check3["convergence"],
                                                 "source_binding": check3["source_binding"],
                                                 "selection_claim_matches_independent_parse": check3["selection_claim_matches_independent_parse"],
                                                 "assertions": check3["assertions"]},
        "4_review_envelope_and_approval_linkage": {"passed": check4["passed"], "description": check4["description"],
                                                   "review": check4["review"],
                                                   "synthesis_linkage": check4["synthesis_linkage"],
                                                   "assertions": check4["assertions"]},
        "5_synthesis_conclusions": {"passed": check5["passed"], "description": check5["description"],
                                    "computed_top5_by_area": check5["computed_top5_by_area"],
                                    "synthesis_top5": check5["synthesis_top5"],
                                    "computed_zero_area_residues_both_resolutions": check5["computed_zero_area_residues_both_resolutions"],
                                    "synthesis_zero_area_list": check5["synthesis_zero_area_list"],
                                    "assertions": check5["assertions"]},
    },
    "overall": {
        "all_five_checks_passed": all_passed,
        "summary_counts": {
            "atom_count": sel["selected_atom_count"], "residue_count": sel["residue_count"],
            "total_A2_n1000": tot1000, "total_A2_n5000": tot5000,
            "convergence_ratio": ratio, "threshold": cv["threshold"],
        },
    },
    "tool_versions": {
        "judge_runtime": {
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "numpy": ver("numpy"),
            "biopython": ver("biopython"),
            "biopython_available_but_not_used_for_sasa_recompute": True,
            "hashlib": "stdlib",
        },
        "upstream_author_reported_in_sasa_json": sr["tool_versions"],
        "reviewer_reported_in_approved_review": review["result"]["reproduction"]["toolVersions"],
        "synthesis_reported": syr["tool_versions"],
    },
    "limitations": [
        "本报告是公开演示的独立核查,不是原始运行(sasa 计算、审评、综合)的实时重播;原始执行只通过附件内的嵌入源码、版本与回执链被审计。",
        "按演示要求未重跑 SASA 几何采样(Shrake-Rupley),只独立重算了选择过滤、逐残基求和、fsum、收敛比值与差值字段的一致性;面积数值本身的正确性依赖上游执行与已获批准的独立基线证据。",
        "附件未包含 context.json、previous-sasa.json(100 点 pilot)、previous-synthesis.json,故各 envelope 中指向这些文件的嵌套回执无法在本演示中重新哈希验证;pilot 保留历史依赖文件内声明与上游审评记录。",
        "reviewer 与 assignee 的 member_node ID 差异、reviewRunId 与 artifact UUID 均为文件内声明;本演示不将其证实为两个真实真人账号的实证,也不验证平台主机侧记录。",
        "synthesis.json 自身状态为 completed_pending_independent_Biology_review,即综合结论尚待其声明的独立 Biology 复审;本演示不是该复审的替代。",
        "结论边界与上游一致:面积是几何溶剂可及性度量(固定半径 C1.70/N1.55/O1.52/S1.80 A、1.4 A 探针、单一冷冻构象),不支持任何功能、活性、临床或普适性推断;1000/5000 收敛只约束总量比较,不给出逐残基误差界或解析精确值。",
        "本演示不声称 SciencePAL 或任何平台独占算法、更准确或不可替代;不替代完整 Vibe-Git 协作平台。",
    ],
}

with open(__file__, "r", encoding="utf-8") as f:
    doc["code"] = f.read()
doc["code_sha256"] = hashlib.sha256(doc["code"].encode("utf-8")).hexdigest()

with open("judge-verification.json", "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)

print("WROTE judge-verification.json")
for name, c in doc["checks"].items():
    print(f"  [{ 'PASS' if c['passed'] else 'FAIL' }] {name}")
print("all_five_checks_passed:", all_passed)
print("atom/residue:", sel["selected_atom_count"], "/", sel["residue_count"], "elements:", sel["element_counts"])
print("totals A2: n1000 =", tot1000, " n5000 =", tot5000, " ratio =", ratio, "(<= 0.02:", ratio <= 0.02, ")")
sys.exit(0 if all_passed else 1)
