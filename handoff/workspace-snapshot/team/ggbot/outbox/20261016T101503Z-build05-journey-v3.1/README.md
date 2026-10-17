# build05-journey-v3.1 (local, NOT pushed)
Stacked on f338e0b. commit f05c6a3ab150802881e7e32d8394843f79bc0332 tree b39664a2213d347acbadb1f3ebf67a4f0f1be10f
patch sha256 7807e1bda12847e06a44d7ee6194eb4faee1c1ba22f65c29b362eb078164174f
Journey-only night sea: tint #7f9fb3 -> #2c4058 by journey weight (0.5 s fade, region-travel). Day unchanged (w=0 returns authored for any j).
White sea at full night: old [127,159,179] -> journey [44,64,88].
Tests: t9 island props T9n-2 block extended (PASS); journey-types, lifecycle, composition PASS. t9 file still fails later at line 299 (balloon check), same on f338e0b (pre-existing).
