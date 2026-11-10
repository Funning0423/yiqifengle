# Region metas chain + fjord presets (Grok Bot decision 23:1x EST 11-09)
Stack (gh): snowpass <- rail(77) <- cloudsea(78) <- hotspring(82) <- fjord(85) <- oasis(90) <- harbor(91) <- mossgarden(92)
Origin heads at start: rail e799fcbf, cloudsea 31550d1c, hotspring 4afe1faa, fjord 552b51e5, oasis c1a07e10, harbor ace74b1b, moss a6d5c5ac
- 23:20 EST verified: env_rail/cloudsea/hotspring .glb blobs identical on target branches vs 1f753356 (region dirs differ only in .glb.meta), uuids unchanged, no meshCompress/compress keys in metas.
- fjord is NOT up to date with hotspring (missing 4afe1faa); oasis is NOT up to date with fjord (missing 4 fjord commits).
- Disk ~146 MB free: use ONE worktree /workspace/wt-chain-1, switch branches inside it.
- rail: c26424f0 pushed (tests 3/3 files same as base)
- cloudsea: merge 141c18db + meta f4e23f3c pushed (tests same as base)
- hotspring: merge f5411ef8 + meta bf0b9e76 pushed (tests same as base)
- fjord: merged hotspring bf0b9e76 into ab820b58 -> b3eea6e5 (local)
