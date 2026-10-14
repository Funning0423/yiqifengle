# Task13 ankle envelope repair

Baseline is the full task12 commit 27f92770c9edb6113c9763bff6867b740c4fb0f3. All prior UI, reward, meadow and motion changes remain.

Task12 screenshot 136 shows a skin sliver leaving the upper boot. Covered calf and leather shaft use different foot/shin blend fields: at y=.12 calf shin weight=.8246 versus shaft=.4320. Ankle flexion separates the two layers. This candidate uses the shaft's smooth .074–.176m blend for the covered calf and grades the calf radius into an 8% smaller lining profile. Exposed calf above .176m, boots/sole geometry, rig, animation, morph, cloth, textures, contacts and metadata stay unchanged. No global toe pitch or threshold adjustment.

Reproduce with `python3 tools/offline-character/repair_ankle_task13.py`. It obtains the exact pinned baseline asset from Git and checks its SHA256. `validate_task13.py` checks the preserved contracts, duplicate seams, and dense stand/sit collision samples. Parent workspace has the independent 119-pose ankle crossing check and original contact/timestep gates. CPU results are not visual acceptance.

Rejected cloth and knee trials remain outside this repository in task13/evidence. They did not remove all intersections and are not shipped. Dense leg/dress and early apron/dress intersections, expanded 3m@30Hz contact gate and full character acceptance remain OPEN/FAIL. The earlier all-angle wrist issue remains OPEN pending motion-wide review.

Final game review, package identity and screenshots are documented in task13/FINAL-RESULT.md. Simulator canvas injection is not a phone test.
