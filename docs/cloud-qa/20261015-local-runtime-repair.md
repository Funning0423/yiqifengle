# Local Creator runtime repair candidate

The official build02 reaches mainline 08's saved result, then fails to prepare skycity at 72% with `Cannot set properties of null (setting 'wrapMode')`. Its journey rig is inactive when ambient preparation runs. Creator 3.8.8 has loaded the clips but has not executed Animation.onLoad to create their states.

RegionAmbientAnimation now validates resources while inactive and starts all requested loops once after activation. It disables automatic default-clip playback before awaiting assets, keeps pause/resume ownership, and never retains states that onLoad would replace. The test boundary now models getState as a lookup, rather than silently creating a missing state.

The same baseline runtime also emitted seven ineffective Material.overridePipelineStates warnings and supplied no bounds for the seven bridge strips. The bridge now supplies cull state at Material.initialize and computes its actual mesh bounds. Positions, normals, indices, controller routes and model transforms are unchanged.

Offline validation: ambient lifecycle 8 cases, startup gate 10 cases (including expected error paths), robot guards 20 cases, journey core and host 8 cases each, plus bridge rendering contract over 14 strips. The lifecycle regression reproduces the baseline's exact null.wrapMode exception and passes on this candidate. These checks do not substitute for an official build and real browser traversal.

The splash resource's absolute path is rebound to this independent build03 copy. No character GLB, animation metadata, chair, material appearance, camera track, lighting, save schema or region progress is changed. The character and chair remain the original frozen pair. Initial-bridge occlusion, dark character appearance and full visual acceptance remain open pending real rendering checks.


## Build04 follow-up from real build03 tests

Build03 successfully entered skycity09 (4414 RAF frames, no runtime errors); sky ambient and robot idle each advanced 0.9999 seconds across 60 RAFs. 04→05 also completed (3916 RAF frames, no runtime errors). Original character/chair preserved. Visual acceptance remains OPEN.

Real mid-travel bridge bounds exposed an independent Z interpolation defect: bridgePath began at endZ instead of startZ, shifting the bridge by24m and adding an unsupported connector plus reversal. Corrected only that start term. Regression tests exercise both directions and rising paths, endpoints, continuity and mesh/controller alignment.

Cocos allows one UI renderer per node. OriginalToolArt had both Sprite and Graphics; Graphics was rejected, leaving tideAnchor/prismShift fallback art invisible. Moved fallback Graphics into its own local child and reused the fallback for drag ghosts; controller/input behavior is unchanged.

Build04 rebinds the same checked-in splash resource to the new isolated checkout. No imported mesh, character, chair, camera, scene layout or light has been changed. Runtime acceptance is to be recorded in sibling build04-deliverables.


## Build05 ambient color encoding

Build04 04→05 completed across1745 frames with no runtime errors; route length is32.3660402100016m after correcting the displaced bridge. Actual outdoor HDR sky and ground RGB were both0. Official compiled scene also encoded them as zero Vec4s: old Color r/g/b fields had been ignored by AmbientInfo's Vec4 deserializer. Home lighting temporarily overwrote these values, explaining why home was lit.

Corrected only the two authored ambient color objects to cc.Vec4, normalizing their existing RGB bytes to0..1. Original illumination20000, sun intensity/rotation, day/night, all geometry and character/chair remain unchanged. This is an import-format correction, not a lighting preset adjustment. Splash path rebinds to this fresh checkout. Official compiled and runtime outdoor colors must be rechecked.
