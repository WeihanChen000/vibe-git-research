"""Independent SASA baseline: NumPy only, no BioPython or returned Agent code.

Bounded to the frozen single-chain 1CRN input. A different 5000-point spiral
sampling and phase reduce dependence on the library's sphere discretization.
"""
import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np

source, destination = map(Path, sys.argv[1:3])
raw = source.read_bytes()
rows, pairs = [], []
radii = {'C': 1.70, 'N': 1.55, 'O': 1.52, 'S': 1.80}
for line in raw.decode('ascii').splitlines():
    if line.startswith('ATOM  ') and line[16] in (' ', 'A'):
        if line[21] != 'A' or line[26] != ' ':
            raise ValueError('Input exceeds frozen chain/insertion-code scope')
        element = line[76:78].strip()
        if element == 'H':
            continue
        if element not in radii:
            raise ValueError(f'Unexpected element: {element}')
        rows.append((int(line[22:26]), line[17:20], line[12:16].strip(), element,
                     [float(line[i:i+8]) for i in (30, 38, 46)]))
    if line.startswith('SSBOND'):
        pairs.append(sorted([int(line[17:21]), int(line[31:35])]))
xyz = np.array([r[4] for r in rows], dtype=float)
radius = np.array([radii[r[3]] + 1.4 for r in rows])
n = 5000
k = np.arange(n)
z = 1 - 2 * (k + 0.5) / n
theta = k * math.pi * (3 - math.sqrt(5)) + 0.618
xy = np.sqrt(1-z*z)
unit = np.column_stack((xy*np.cos(theta), xy*np.sin(theta), z))
areas = []
for i, center in enumerate(xyz):
    points = center + radius[i] * unit
    visible = np.ones(n, dtype=bool)
    distances = np.linalg.norm(xyz-center, axis=1)
    neighbors = np.where((distances < radius[i]+radius) & (np.arange(len(rows)) != i))[0]
    for j in neighbors:
        visible &= np.sum((points-xyz[j])**2, axis=1) >= radius[j]**2
    areas.append(float(visible.sum()/n * 4*math.pi*radius[i]**2))
residues = []
for rid in sorted({r[0] for r in rows}):
    inds = [i for i, row in enumerate(rows) if row[0] == rid]
    residues.append({'id': rid, 'name': rows[inds[0]][1], 'sasa_A2': sum(areas[i] for i in inds)})
sg = {row[0]: i for i, row in enumerate(rows) if row[2] == 'SG'}
result = {
    'source_sha256': hashlib.sha256(raw).hexdigest(),
    'method': 'Independent NumPy-only Shrake-Rupley geometry; 5000 spiral points, phase 0.618 radians',
    'numpy_version': np.__version__, 'n_points': n, 'probe_radius_A': 1.4,
    'atomic_radii_A': radii, 'atom_count': len(rows), 'residue_count': len(residues),
    'total_A2': sum(areas), 'residues': residues,
    'cysteine_sg': [{'residue_id': rid, 'sasa_A2': areas[i]} for rid, i in sg.items()],
    'disulfides': [{'residues': [a, b], 'sg_distance_A': float(np.linalg.norm(xyz[sg[a]]-xyz[sg[b]]))} for a, b in pairs]
}
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, indent=2)+'\n', encoding='utf8')
print(json.dumps({k: result[k] for k in ['source_sha256', 'atom_count', 'residue_count', 'total_A2', 'cysteine_sg']}))
