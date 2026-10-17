#!/bin/bash
set -e
B=/tmp/wt-handoff/handoff/bots; mkdir -p $B; cd /workspace/wechat-game
cp team/ggbot/HANDOFF.md $B/ggbot-HANDOFF.md
cp team/cinematic/HANDOFF.md $B/cinematic-yunjingbot-HANDOFF.md
cp team/cinematic/HANDOFF-CINEMATIC-v1.md $B/cinematic-yunjingbot-HANDOFF-v1.md
cp team/voice-bot/HANDOFF.md $B/voice-bot-HANDOFF.md
cp team/voice-bot/outbox/20261017T043229Z-lakeside-playable/HANDOFF_yunjingbot.md $B/voice-bot-lakeside-playable-HANDOFF_yunjingbot.md
cp product/team/scene/HANDOFF.md $B/scene-design-HANDOFF.md
cp ui-design/HANDOFF.md $B/ui-design-HANDOFF.md
cp ui-audit/HANDOFF.md $B/ui-audit-HANDOFF.md
cp team/oi/e2fix-0001b/evidence/wechat-e2fix/HANDOFF.md $B/oi-e2fix-0001b-HANDOFF.md
cp team/oi/oi0004/evidence/character-interim/HANDOFF.md $B/oi-oi0004-character-interim-HANDOFF.md
cp inbox-from-oi/20261016-build05-journey/handoff.md $B/oi-20261016-build05-journey-handoff.md
cp team/cinematic/work/m1v2-clipfix/PROBLEM_BRIEF.md $B/m1v2-cloth-PROBLEM_BRIEF.md
perl -pi -e 's#/Users/[^/<]+\b#/Users/<mac-user>#g' $B/*.md
