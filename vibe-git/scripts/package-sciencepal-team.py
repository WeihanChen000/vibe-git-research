"""Build a source-only teammate kit. Explicit allowlist; never package local state."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'data/team-onboarding'
output.mkdir(parents=True, exist_ok=True)
files = {}
def add(path, destination=None):
    if path.is_symlink():
        raise ValueError(f'Unexpected symlink: {path}')
    name = destination or path.relative_to(root).as_posix()
    if any(part in {'node_modules', '.git', '.env', 'data', 'dist'} for part in Path(name).parts):
        raise ValueError(f'Forbidden package path: {name}')
    files['vibe-git/' + name] = path.read_bytes()

for name in ['package.json', 'package-lock.json', 'tsconfig.base.json', '.gitignore', '.gitattributes',
             'README.md', 'SCIENCEPAL-COMPARISON-PROTOCOL.md', 'SCIENCEPAL-CRN-COMPARISON.md', 'open-replay.cmd', 'open-captain.cmd', 'SCIENCEPAL-QUICKSTART.md', 'SCIENCEPAL-TEAM-START.md', 'SCIENCEPAL-CASE-BRIEF.md', 'SCIENCEPAL-IRIS-UI-EXPERIMENT.md', 'SCIENCEPAL-IRIS-LIVE-RESULT.md', 'SCIENCEPAL-IRIS-REPLAY-BRIEF.md', 'SCIENCEPAL-IRIS-REPLAY-REVIEW.md', 'SCIENCEPAL-REPLAY.md', 'open-research.cmd', 'SCIENCEPAL-FIRST-RUN.md', 'SCIENCEPAL-FIRST-USE-REVIEW.md', 'SCIENCEPAL-MIXED-FLOW-REVIEW.md', 'SCIENCEPAL-TEAM-QUICKSTART.md', 'SCIENCEPAL-TEAM-ACCEPTANCE.md', 'SCIENCEPAL-STABILITY-RESULT.md',
             'SCIENCEPAL-MIXED-TEAM.md', 'SCIENCEPAL-CODEX-ENTRY.md', 'SCIENCEPAL-USABILITY-REVIEW.md']:
    add(root / name)
for folder in ['apps', 'packages']:
    for workspace in sorted((root / folder).iterdir()):
        if not workspace.is_dir() or workspace.is_symlink():
            continue
        for path in sorted(workspace.iterdir()):
            if path.is_file() and (path.name in {'package.json', 'index.html'} or 'config' in path.name) and path.suffix in {'.json', '.js', '.ts', '.html'}:
                add(path)
        for part in ['src', 'test', 'scripts', 'public']:
            parent = workspace / part
            if parent.exists():
                for path in sorted(parent.rglob('*')):
                    if path.is_file() and not any(p in {'node_modules', '.git', 'data', 'dist', '__pycache__'} for p in path.relative_to(parent).parts):
                        add(path)
for name in ['sciencepal-member-env.ps1', 'package-sciencepal-team.py', 'open-research.mjs', 'research-captain.mjs', 'research-captain.test.mjs', 'open-replay.mjs', 'research-setup.mjs', 'research-setup.test.mjs']:
    add(root / 'scripts' / name)
for path in sorted((root / 'fixtures/team-research').iterdir()):
    if path.is_file(): add(path)
add(root / 'fixtures/expert-case/1CRN.pdb')
add(root / 'fixtures/expert-case/reference.py')
for name in ['README.md', 'bezdekIris.data', 'iris.names', 'calculate-experiment.py']:
    add(root / 'fixtures/iris' / name)
for path in sorted((root / 'fixtures/iris-live-case').iterdir()):
    if path.is_file() and path.suffix in {'.md', '.py', '.mjs'}: add(path)
for path in sorted((root / 'fixtures/mixed-live-case').iterdir()):
    if path.is_file() and path.suffix in {'.md', '.py', '.mjs'}: add(path)
skill = root.parent / '.agents/skills/vibe-git/skills/vibe-git'
if not skill.exists():
    skill = root / 'research-skill'
for path in [skill / 'SKILL.md', *sorted((skill / 'references').glob('*.md'))]:
    add(path, 'research-skill/' + path.relative_to(skill).as_posix())

manifest = {'scope': 'Team-only source kit. Includes curated read-only real-case replay from public research data. No credentials, invitations, private member journals or databases. Requires Node.js 24+ and npm ci/build.',
            'files': [{'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(files.items())]}
files['vibe-git/KIT-MANIFEST.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
archive = output / 'vibe-git-sciencepal-team-kit.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(name, (2026, 10, 30, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / (archive.name + '.sha256')).write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
print(json.dumps({'archive': str(archive), 'files': len(files), 'bytes': archive.stat().st_size, 'sha256': digest}))
