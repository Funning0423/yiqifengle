"""Apply the source-equivalent telemetry fix to the reused native test bundle."""
import pathlib,sys
p=pathlib.Path(sys.argv[1])/'subpackages/main/game.js'
s=p.read_text()
old='try{f.localStorage.setItem("dot-runtime-diagnostics-20261010:world-flow",JSON.stringify(n))}'
new='try{"tick"!==e&&f.localStorage.setItem("dot-runtime-diagnostics-20261010:world-flow",JSON.stringify(n))}'
if new in s and old not in s: print('already patched')
else:
 assert s.count(old)==1, 'Unexpected bundle; fail closed'
 p.write_text(s.replace(old,new))
