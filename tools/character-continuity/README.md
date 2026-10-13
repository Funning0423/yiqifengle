# Local continuity candidate generation

Run `python3 tools/character-continuity/repair_boots.py`, then `python3 tools/character-continuity/seat_ik.py`, then `python3 tools/character-continuity/validate.py`. Python needs numpy/scipy. The first script reads the exact integration commit from local Git and checks its original resource SHA, so it never applies the toe correction twice to the current resource. Outputs go to output/character-continuity; none of these scripts installs a resource or builds the project.

Run local Blender in background with `--python tools/character-continuity/make_stool.py` for the independent round stool. Candidate generated binaries were copied to existing Creator paths during this task, then imported/built exactly once. Do not call this a passing candidate: the unchanged 2mm stand contact regression fails at 3.264mm. See docs/CHARACTER-CONTINUITY-LOCAL-20261014.md and task-8/evidence for the actual visual and numerical limitations.
