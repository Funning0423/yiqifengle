# A2 鼓励音试听 v1（Voice bot）

- 四档：sfx_cheer_1_good / 2_great / 3_excellent / 4_amazing，对应连击第 2/3/4/5+ 波，配文字飘字。
- 制作：Piper TTS（MIT）+ en_US-ljspeech-high 音色（训练数据 LJSpeech 为公有领域）生成英文念词；
  每档升调并递进，加五度和声、上扬琶音铃声、短混响，单声道 44.1 kHz 48 kbps MP3。
- 原版开心消消乐素材只作风格参考，没有下载，也不进包。
- 每条 1.28 s、7,906 B，四条合计 31,624 B（< 40 KB）。
- 目前放在 audio-preview/，不在 assets/ 里，不进包体，也没接代码。试听通过后再放进 resources/audio_sfx 并接到 GameAudio.onBoardFrame 的连击档位。
- 重新生成：`python make.py`（需要 piper-tts、numpy、scipy 和 ffmpeg）。
