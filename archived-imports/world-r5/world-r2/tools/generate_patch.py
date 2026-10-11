import pathlib,subprocess,difflib,hashlib,json
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path('/workspace/shared/grok-takeover/parallel-development/native-board-r1/COCOS-FIRSTSLICE-COMPAT/creator-build-project/assets/scripts/NativeBoardUI.ts')
original=source.read_text()
modified=subprocess.check_output(['node','-e',"const fs=require('fs'),p=require('./tools/patch_native_ui.cjs');process.stdout.write(p.patchNativeUI(fs.readFileSync(p.SOURCE,'utf8')));"],cwd=root,text=True)
name='creator-build-project/assets/scripts/NativeBoardUI.ts'
patch=''.join(difflib.unified_diff(original.splitlines(True),modified.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
(root/'patches/NativeBoardUI-managed-mode.patch').write_text(patch)
(root/'evidence/native-patch-provenance.json').write_text(json.dumps({'baseCommit':'1d2d0d1e29845a0f42df6eb405d1c2a43afc9c9a','baseNativeUISHA256':hashlib.sha256(original.encode()).hexdigest(),'candidateNativeUISHA256':hashlib.sha256(modified.encode()).hexdigest(),'patchSHA256':hashlib.sha256(patch.encode()).hexdigest(),'originalChanged':False,'portraitBranch':'Not received; rebase this seam, do not replace newer UI with the old full file.'},indent=2)+'\n')
# The generated full source is redundant with the frozen input + exact patch; not a deploy file.
stale=root/'evidence/NativeBoardUI.managed.generated.ts'
if stale.exists():stale.unlink()
print('Generated managed-mode patch; original NativeBoardUI unchanged')
