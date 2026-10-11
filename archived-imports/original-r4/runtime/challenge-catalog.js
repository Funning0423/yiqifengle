/* Generated from a validated, witnessed authored catalog. Do not hand-edit. */
'use strict';
const DATA={
  "packId": "c01",
  "perRegion": 12,
  "schemaVersion": 1,
  "releaseState": "candidate-api-only",
  "rules": {
    "bottomTrayBombs": 0,
    "inventoryTools": false,
    "pearls": false,
    "freeRetry": true,
    "fixedVerifiedSeeds": true
  },
  "authoringSHA256": "95fe5423c4dac4991409d8386989738f73f69cf762550acfd2508ec9983a2466",
  "engineSHA256": "e7b7a39dd4a2226efa16b110ffb688b31deb2cafeb1a0a478347c0947f9d2b53",
  "stages": [
    {
      "id": "tide-c01-001",
      "region": "tide",
      "ordinal": 1,
      "kind": "core",
      "coreId": "tide-c01-001",
      "designIntent": "在横向三灯与上下苔带之间分配有限直线奇物。",
      "choiceTradeoff": "横线一波扫过三灯也只点当前一灯；先推进灯路，还是先清苔并保留下一次对位？",
      "difficultyIntent": "warmup",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "潮线三灯",
        "description": "在横向三灯与上下苔带之间分配有限直线奇物。",
        "hint": "亮框只指向当前灯。一波最多点一灯；留意下一盏与剩余奇物的位置。",
        "moves": 12,
        "goals": {
          "beacons": 3,
          "moss": 6,
          "type5": 10
        },
        "moss": [
          15,
          16,
          17,
          31,
          32,
          33
        ],
        "roots": [],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 3,
            "special": "column"
          }
        ],
        "beacons": [
          22,
          24,
          26
        ]
      },
      "theme": "seaBeach",
      "plannedSeeds": [
        1523747019,
        1523749037,
        1523750046
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          8,
          8,
          8
        ],
        "moveMargin": 4,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "4839972ad230744bccfe53190c928517ad5c12442e34854b84eb0128d41893f3",
      "qualified": true,
      "seedBank": [
        1523747019,
        1523749037,
        1523750046
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-002",
      "region": "tide",
      "ordinal": 2,
      "kind": "variant",
      "coreId": "tide-c01-001",
      "designIntent": "把横向顺扫改成纵向三段路线，并在两侧加入可邻消的根。",
      "choiceTradeoff": "纵线可以碰到整条灯路，却只推进一灯；是否用横线先打首灯，把纵线留给中段？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "竖潮转弯",
        "description": "把横向顺扫改成纵向三段路线，并在两侧加入可邻消的根。",
        "hint": "纵线可以碰到整条灯路，却只推进一灯；是否用横线先打首灯，把纵线留给中段？",
        "moves": 10,
        "goals": {
          "beacons": 3,
          "moss": 6,
          "roots": 2
        },
        "moss": [
          9,
          11,
          16,
          18,
          30,
          32
        ],
        "roots": [
          {
            "index": 22,
            "layers": 1
          },
          {
            "index": 26,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 7,
            "special": "row"
          },
          {
            "index": 45,
            "special": "column"
          }
        ],
        "beacons": [
          10,
          24,
          38
        ]
      },
      "theme": "seaLagoon",
      "plannedSeeds": [
        1574072813,
        1574078867,
        1574081894
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          7,
          7,
          7
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "9c2c6c529e4e8b04075955903e96f1d9cebf391594d6d473cd44dea0b3485c24",
      "qualified": true,
      "seedBank": [
        1574072813,
        1574078867,
        1574081894
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-003",
      "region": "tide",
      "ordinal": 3,
      "kind": "core",
      "coreId": "tide-c01-003",
      "designIntent": "上下岸根层数不同，中间苔带适合一波同时邻击两岸。",
      "choiceTradeoff": "先打中带可同时削根；先清下岸可能更快完成局部，却少了上岸第二波的准备。",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "双汊岸根",
        "description": "上下岸根层数不同，中间苔带适合一波同时邻击两岸。",
        "hint": "先打中带可同时削根；先清下岸可能更快完成局部，却少了上岸第二波的准备。",
        "moves": 12,
        "goals": {
          "roots": 6,
          "moss": 5,
          "type2": 12
        },
        "moss": [
          22,
          23,
          24,
          25,
          26
        ],
        "roots": [
          {
            "index": 15,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 31,
            "layers": 1
          },
          {
            "index": 32,
            "layers": 1
          },
          {
            "index": 33,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 40,
            "special": "bomb"
          }
        ]
      },
      "theme": "seaLagoon",
      "plannedSeeds": [
        1557306293,
        1557295194,
        1557296203
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          8,
          7,
          9
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "dfc658fdeb5df409146d455d7f86422161326438cd5916612419e6df2df839e7",
      "qualified": true,
      "seedBank": [
        1557295194,
        1557296203,
        1557306293
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-004",
      "region": "tide",
      "ordinal": 4,
      "kind": "variant",
      "coreId": "tide-c01-001",
      "designIntent": "两灯夹住一条短苔路，降低分散目标压力，给连续挑战留一段短航。",
      "choiceTradeoff": "范围奇物可兼顾后灯与苔路；过早用掉会失去现成范围覆盖，后半段可能需要普通配对或新造奇物。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "贝湾短航",
        "description": "两灯夹住一条短苔路，降低分散目标压力，给连续挑战留一段短航。",
        "hint": "范围奇物可兼顾后灯与苔路；过早用掉会失去现成范围覆盖，后半段可能需要普通配对或新造奇物。",
        "moves": 26,
        "goals": {
          "beacons": 2,
          "moss": 5,
          "type3": 10
        },
        "moss": [
          22,
          23,
          24,
          25,
          26
        ],
        "roots": [],
        "starters": [
          {
            "index": 14,
            "special": "row"
          },
          {
            "index": 30,
            "special": "bomb"
          }
        ],
        "beacons": [
          17,
          31
        ]
      },
      "theme": "seaBeach",
      "plannedSeeds": [
        1473410126,
        1473414162,
        1473417189
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          6,
          6,
          6
        ],
        "moveMargin": 20,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "8a8c7390ed00180c8916b1b2783b6c062cbf4c79db743355432b665bd17ece6b",
      "qualified": true,
      "seedBank": [
        1473410126,
        1473414162,
        1473417189
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-005",
      "region": "tide",
      "ordinal": 5,
      "kind": "variant",
      "coreId": "tide-c01-003",
      "designIntent": "长列双根与短湾单根分离，让直线覆盖和局部范围有不同价值。",
      "choiceTradeoff": "先沿长堤削一层，还是先把短湾与苔角一起收掉？局部清空并不等于处理了最费波数的目标。",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "长堤短湾",
        "description": "长列双根与短湾单根分离，让直线覆盖和局部范围有不同价值。",
        "hint": "先沿长堤削一层，还是先把短湾与苔角一起收掉？局部清空并不等于处理了最费波数的目标。",
        "moves": 13,
        "goals": {
          "roots": 6,
          "moss": 5,
          "type5": 12
        },
        "moss": [
          24,
          25,
          26,
          31,
          32
        ],
        "roots": [
          {
            "index": 9,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 23,
            "layers": 2
          },
          {
            "index": 30,
            "layers": 2
          },
          {
            "index": 33,
            "layers": 1
          },
          {
            "index": 40,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 2,
            "special": "column"
          },
          {
            "index": 25,
            "special": "bomb"
          }
        ]
      },
      "theme": "seaTide",
      "plannedSeeds": [
        1456644615,
        1456633516,
        1456642597
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          10,
          11,
          9
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "bbbbb18c841722e4412b737fa3854a4fde3f038c1a1931aaefa4d1f73ba984cf",
      "qualified": true,
      "seedBank": [
        1456633516,
        1456642597,
        1456644615
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-006",
      "region": "tide",
      "ordinal": 6,
      "kind": "core",
      "coreId": "tide-c01-006",
      "designIntent": "在三块不等苔岛之间，制造两条新的直线奇物。",
      "choiceTradeoff": "开局奇物能迅速整理棋盘，也可能打散四连的准备；什么时候用它换布局？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "借潮成线",
        "description": "在三块不等苔岛之间，制造两条新的直线奇物。",
        "hint": "开局奇物能迅速整理棋盘，也可能打散四连的准备；什么时候用它换布局？",
        "moves": 12,
        "goals": {
          "lines": 2,
          "type1": 12,
          "moss": 6
        },
        "moss": [
          8,
          9,
          10,
          24,
          38,
          39
        ],
        "roots": [],
        "starters": [
          {
            "index": 35,
            "special": "row"
          },
          {
            "index": 16,
            "special": "bomb"
          }
        ]
      },
      "theme": "seaBells",
      "plannedSeeds": [
        1506962337,
        1506963346,
        1506968391
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          9,
          9,
          9
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "40cb19f4a84a45779005fd20b339380f1bbfc10c531aa842ad1252fa2cffe717",
      "qualified": true,
      "seedBank": [
        1506962337,
        1506963346,
        1506968391
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-007",
      "region": "tide",
      "ordinal": 7,
      "kind": "variant",
      "coreId": "tide-c01-003",
      "designIntent": "三组礁根之间既要分配爆破，也要亲手形成一次直线奇物。",
      "choiceTradeoff": "现成范围奇物适合削根，但不能代替自然四连；先爆破可能破坏正在准备的成线机会。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "三礁成线",
        "description": "三组礁根之间既要分配爆破，也要亲手形成一次直线奇物。",
        "hint": "现成范围奇物适合削根，但不能代替自然四连；先爆破可能破坏正在准备的成线机会。",
        "moves": 8,
        "goals": {
          "roots": 6,
          "moss": 5,
          "lines": 1
        },
        "moss": [
          17,
          18,
          24,
          25,
          31
        ],
        "roots": [
          {
            "index": 10,
            "layers": 2
          },
          {
            "index": 11,
            "layers": 2
          },
          {
            "index": 29,
            "layers": 1
          },
          {
            "index": 36,
            "layers": 1
          },
          {
            "index": 32,
            "layers": 1
          },
          {
            "index": 33,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 17,
            "special": "bomb"
          },
          {
            "index": 35,
            "special": "row"
          }
        ]
      },
      "theme": "seaTide",
      "plannedSeeds": [
        1490185727,
        1490188754,
        1490190772
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          3,
          3,
          3
        ],
        "moveMargin": 5,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "pacingRole": "quick-transition",
      "balanceRevisionNotes": "该种子簇约3步完成，改标短过渡，8步预算不冒称压力关。",
      "contentRevision": 1,
      "contentSHA256": "903dec1da0cd60a462cf3f86ebde4ab2665665a997375da755527ef98cbc6943",
      "qualified": true,
      "seedBank": [
        1490185727,
        1490188754,
        1490190772
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-008",
      "region": "tide",
      "ordinal": 8,
      "kind": "variant",
      "coreId": "tide-c01-006",
      "designIntent": "相邻范围与纵线提供立即组合的诱惑，另需自然制造三枚奇物。",
      "choiceTradeoff": "马上组合可邻击多处根，却不会替玩家完成制造目标；也可分开使用，保留更多观察回合。",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "潮洞双响",
        "description": "相邻范围与纵线提供立即组合的诱惑，另需自然制造三枚奇物。",
        "hint": "马上组合可邻击多处根，却不会替玩家完成制造目标；也可分开使用，保留更多观察回合。",
        "moves": 13,
        "goals": {
          "specials": 3,
          "type2": 14,
          "roots": 4
        },
        "moss": [],
        "roots": [
          {
            "index": 15,
            "layers": 1
          },
          {
            "index": 19,
            "layers": 1
          },
          {
            "index": 29,
            "layers": 1
          },
          {
            "index": 33,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 23,
            "special": "bomb"
          },
          {
            "index": 24,
            "special": "column"
          }
        ]
      },
      "theme": "seaBells",
      "plannedSeeds": [
        1406307722,
        1406309740,
        1406300659
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          11,
          11,
          9
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "608625e62b0af1b445e7508ced5a901c85fc24232b21ae8d10f2db4df5a4f854",
      "qualified": true,
      "seedBank": [
        1406300659,
        1406307722,
        1406309740
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-009",
      "region": "tide",
      "ordinal": 9,
      "kind": "variant",
      "coreId": "tide-c01-006",
      "designIntent": "四块近中心苔格与一次自然奇物，给玩家较开阔的布置空间。",
      "choiceTradeoff": "中心范围奇物可清局部目标；留着观察成形机会，也是一种选择。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "贝湾留白",
        "description": "四块近中心苔格与一次自然奇物，给玩家较开阔的布置空间。",
        "hint": "中心范围奇物可清局部目标；留着观察成形机会，也是一种选择。",
        "moves": 26,
        "goals": {
          "specials": 1,
          "type3": 12,
          "moss": 4
        },
        "moss": [
          16,
          18,
          30,
          32
        ],
        "roots": [],
        "starters": [
          {
            "index": 24,
            "special": "bomb"
          }
        ]
      },
      "theme": "seaBeach",
      "plannedSeeds": [
        1389534139,
        1389523040,
        1389525058
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          5,
          7,
          3
        ],
        "moveMargin": 19,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "92ab5f4778b565589de5f61853314e587a0225d936527708f919d8dd0c9b1249",
      "qualified": true,
      "seedBank": [
        1389523040,
        1389525058,
        1389534139
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-010",
      "region": "tide",
      "ordinal": 10,
      "kind": "variant",
      "coreId": "tide-c01-001",
      "designIntent": "走斜向折返灯路，最后回到曾经点亮的位置。",
      "choiceTradeoff": "首灯立即可推进，但回访需要新的清除波；范围奇物用于中段障碍还是为回访留准备？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "回潮再访",
        "description": "走斜向折返灯路，最后回到曾经点亮的位置。",
        "hint": "首灯立即可推进，但回访需要新的清除波；范围奇物用于中段障碍还是为回访留准备？",
        "moves": 8,
        "goals": {
          "beacons": 4,
          "roots": 3,
          "moss": 5
        },
        "moss": [
          17,
          18,
          25,
          31,
          38
        ],
        "roots": [
          {
            "index": 23,
            "layers": 1
          },
          {
            "index": 25,
            "layers": 1
          },
          {
            "index": 31,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 14,
            "special": "row"
          },
          {
            "index": 25,
            "special": "bomb"
          }
        ],
        "beacons": [
          16,
          32,
          24,
          16
        ]
      },
      "theme": "seaFog",
      "plannedSeeds": [
        3587137839,
        3587147929,
        3587149947
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          5,
          5,
          5
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "e2c4ee610d6bc192645dab0479128916befbaeba473b23124697e7274e5df10a",
      "qualified": true,
      "seedBank": [
        3587137839,
        3587147929,
        3587149947
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-011",
      "region": "tide",
      "ordinal": 11,
      "kind": "variant",
      "coreId": "tide-c01-003",
      "designIntent": "两组错位双层根与两个远近灯位同时考验波次分配。",
      "choiceTradeoff": "清根效率高的波未必触及当前灯；要决定何时为灯路换方向。",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "错层回潮",
        "description": "两组错位双层根与两个远近灯位同时考验波次分配。",
        "hint": "清根效率高的波未必触及当前灯；要决定何时为灯路换方向。",
        "moves": 15,
        "goals": {
          "roots": 6,
          "moss": 3,
          "beacons": 2
        },
        "moss": [
          23,
          24,
          25
        ],
        "roots": [
          {
            "index": 9,
            "layers": 2
          },
          {
            "index": 10,
            "layers": 2
          },
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 30,
            "layers": 2
          },
          {
            "index": 37,
            "layers": 2
          },
          {
            "index": 38,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 14,
            "special": "row"
          },
          {
            "index": 8,
            "special": "column"
          }
        ],
        "beacons": [
          18,
          36
        ]
      },
      "theme": "seaFog",
      "plannedSeeds": [
        3603927566,
        3603917476,
        3603928575
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          13,
          11,
          11
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "5b436553024e5d02ce849a7c642d246407aa389beb15ef4fcfc9a431bae8b513",
      "qualified": true,
      "seedBank": [
        3603917476,
        3603927566,
        3603928575
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "tide-c01-012",
      "region": "tide",
      "ordinal": 12,
      "kind": "variant",
      "coreId": "tide-c01-006",
      "designIntent": "三灯斜线、四枚双根与两次成线组成地区收束。",
      "choiceTradeoff": "开局相邻奇物可立即大范围推进，但一波仍只点一灯；分开触发和自然成线都值得保留空间。",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 1,
        "chapterName": "潮汐灯塔",
        "name": "灯后留一线",
        "description": "三灯斜线、四枚双根与两次成线组成地区收束。",
        "hint": "开局相邻奇物可立即大范围推进，但一波仍只点一灯；分开触发和自然成线都值得保留空间。",
        "moves": 22,
        "goals": {
          "lines": 2,
          "beacons": 3,
          "roots": 4
        },
        "moss": [],
        "roots": [
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 23,
            "layers": 2
          },
          {
            "index": 25,
            "layers": 2
          },
          {
            "index": 31,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 12,
            "special": "row"
          },
          {
            "index": 13,
            "special": "bomb"
          }
        ],
        "beacons": [
          12,
          24,
          36
        ]
      },
      "theme": "seaBeacon",
      "plannedSeeds": [
        3553584619,
        3553592691
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          20,
          20
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "19e51fae5a5fe36860b50df3f647500fe5e47b517b274ca1cf650777729ee6bb",
      "qualified": true,
      "seedBank": [
        3553584619,
        3553592691
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 2,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-001",
      "region": "meadow",
      "ordinal": 1,
      "kind": "core",
      "coreId": "meadow-c01-001",
      "designIntent": "两侧花圃与内侧根结形成不同覆盖形状。",
      "choiceTradeoff": "纵线适合贯穿，范围奇物适合局部；先清哪一侧，能为另一侧留下更好的局面？",
      "difficultyIntent": "warmup",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "田埂两边",
        "description": "两侧花圃与内侧根结形成不同覆盖形状。",
        "hint": "纵线适合贯穿，范围奇物适合局部；先清哪一侧，能为另一侧留下更好的局面？",
        "moves": 8,
        "goals": {
          "moss": 8,
          "roots": 2,
          "type0": 10
        },
        "moss": [
          15,
          16,
          17,
          22,
          26,
          31,
          32,
          33
        ],
        "roots": [
          {
            "index": 23,
            "layers": 1
          },
          {
            "index": 25,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 3,
            "special": "column"
          },
          {
            "index": 40,
            "special": "bomb"
          }
        ]
      },
      "theme": "orchard",
      "plannedSeeds": [
        2236563301,
        2236564310,
        2236566328
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          4,
          4,
          4
        ],
        "moveMargin": 4,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "6be5ecdf20461a5063f113c5b2558f81816de631271aa10e2e16436f27e4d857",
      "qualified": true,
      "seedBank": [
        2236563301,
        2236564310,
        2236566328
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-002",
      "region": "meadow",
      "ordinal": 2,
      "kind": "variant",
      "coreId": "meadow-c01-001",
      "designIntent": "长曲径的中央段与末端横弯需要不同的直线覆盖。",
      "choiceTradeoff": "先收尾端一整排，还是先清中央纵段并顺带削根？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "曲径绕圃",
        "description": "长曲径的中央段与末端横弯需要不同的直线覆盖。",
        "hint": "先收尾端一整排，还是先清中央纵段并顺带削根？",
        "moves": 10,
        "goals": {
          "moss": 8,
          "roots": 3,
          "type1": 12
        },
        "moss": [
          9,
          10,
          17,
          24,
          31,
          38,
          39,
          40
        ],
        "roots": [
          {
            "index": 23,
            "layers": 1
          },
          {
            "index": 25,
            "layers": 1
          },
          {
            "index": 32,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 35,
            "special": "row"
          },
          {
            "index": 2,
            "special": "column"
          }
        ]
      },
      "theme": "orchard",
      "plannedSeeds": [
        2186232462,
        2186234480,
        2186235489
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          7,
          7,
          7
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "316f2a929de100dfc2b49255df49faf283c78a73b9a2d8f51a0fdf9e4286597c",
      "qualified": true,
      "seedBank": [
        2186232462,
        2186234480,
        2186235489
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-003",
      "region": "meadow",
      "ordinal": 3,
      "kind": "core",
      "coreId": "meadow-c01-003",
      "designIntent": "上方折角双根与下方单层桥墩需要不同的波次安排。",
      "choiceTradeoff": "下方范围可以迅速完成一组；先给上方双根削层则可能减少结尾拖延。",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "双轮桥墩",
        "description": "上方折角双根与下方单层桥墩需要不同的波次安排。",
        "hint": "下方范围可以迅速完成一组；先给上方双根削层则可能减少结尾拖延。",
        "moves": 12,
        "goals": {
          "roots": 6,
          "moss": 3,
          "type0": 14
        },
        "moss": [
          23,
          24,
          25
        ],
        "roots": [
          {
            "index": 9,
            "layers": 2
          },
          {
            "index": 10,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 32,
            "layers": 1
          },
          {
            "index": 38,
            "layers": 1
          },
          {
            "index": 39,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 2,
            "special": "column"
          },
          {
            "index": 32,
            "special": "bomb"
          }
        ]
      },
      "theme": "orchard",
      "plannedSeeds": [
        2203009072,
        2203014117,
        2203008063
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          9,
          9,
          8
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "abeab852ffd2fc44724af36a117f79a5dbf43415a8b28ae0c09660ffa9a94a80",
      "qualified": true,
      "seedBank": [
        2203008063,
        2203009072,
        2203014117
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-004",
      "region": "meadow",
      "ordinal": 4,
      "kind": "variant",
      "coreId": "meadow-c01-001",
      "designIntent": "三个二格小田取代复杂苔圃，缩短中段压力。",
      "choiceTradeoff": "范围奇物可处理中田；下方横线要现在使用，还是等它能兼顾更多收集？",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "三片小田",
        "description": "三个二格小田取代复杂苔圃，缩短中段压力。",
        "hint": "范围奇物可处理中田；下方横线要现在使用，还是等它能兼顾更多收集？",
        "moves": 26,
        "goals": {
          "moss": 6,
          "type2": 12
        },
        "moss": [
          8,
          9,
          24,
          25,
          38,
          39
        ],
        "roots": [],
        "starters": [
          {
            "index": 17,
            "special": "bomb"
          },
          {
            "index": 42,
            "special": "row"
          }
        ]
      },
      "theme": "harvest",
      "plannedSeeds": [
        2152677224,
        2152678233,
        2152684287
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          5,
          4,
          4
        ],
        "moveMargin": 21,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "1cc81e6249db9f89dfa5b8c3a5fe6ea3c38f7b58297d2fbf6c0e7e2a3e924816",
      "qualified": true,
      "seedBank": [
        2152677224,
        2152678233,
        2152684287
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-005",
      "region": "meadow",
      "ordinal": 5,
      "kind": "variant",
      "coreId": "meadow-c01-003",
      "designIntent": "八枚双根分成上下错位齿轮，集中考验独立波次。",
      "choiceTradeoff": "先完成一轮的两次削层，还是给上下两轮各削一次，等待更好的组合机会？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "交错齿轮",
        "description": "八枚双根分成上下错位齿轮，集中考验独立波次。",
        "hint": "先完成一轮的两次削层，还是给上下两轮各削一次，等待更好的组合机会？",
        "moves": 14,
        "goals": {
          "roots": 8,
          "type1": 14
        },
        "moss": [],
        "roots": [
          {
            "index": 8,
            "layers": 2
          },
          {
            "index": 10,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 18,
            "layers": 2
          },
          {
            "index": 30,
            "layers": 2
          },
          {
            "index": 32,
            "layers": 2
          },
          {
            "index": 38,
            "layers": 2
          },
          {
            "index": 40,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 17,
            "special": "bomb"
          },
          {
            "index": 31,
            "special": "row"
          }
        ]
      },
      "theme": "bells",
      "plannedSeeds": [
        2169466951
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          12
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "ca1efa6e98620c3a0cf622521d2dc55ef2386cb19e51db14c3fe8fc14af3f61a",
      "qualified": true,
      "seedBank": [
        2169466951
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 1,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-006",
      "region": "meadow",
      "ordinal": 6,
      "kind": "core",
      "coreId": "meadow-c01-006",
      "designIntent": "围绕四个中心外尖的苔格，制造两枚自然奇物。",
      "choiceTradeoff": "已有奇物可清局部目标，也可能拆掉即将成形的长连；先处理哪一个机会？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "风铃和弦",
        "description": "围绕四个中心外尖的苔格，制造两枚自然奇物。",
        "hint": "已有奇物可清局部目标，也可能拆掉即将成形的长连；先处理哪一个机会？",
        "moves": 12,
        "goals": {
          "specials": 2,
          "type1": 12,
          "moss": 4
        },
        "moss": [
          17,
          23,
          25,
          31
        ],
        "roots": [],
        "starters": [
          {
            "index": 35,
            "special": "row"
          },
          {
            "index": 12,
            "special": "bomb"
          }
        ]
      },
      "theme": "bells",
      "plannedSeeds": [
        2119119968,
        2119132076,
        2119130058
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          8,
          8,
          9
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "e6fc08d3097f1092f8aae53d1b4a8f7bf90acc450c7e5b3214c3933796b4b8eb",
      "qualified": true,
      "seedBank": [
        2119119968,
        2119130058,
        2119132076
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-007",
      "region": "meadow",
      "ordinal": 7,
      "kind": "variant",
      "coreId": "meadow-c01-003",
      "designIntent": "上半部四根短桥与下半部六格花道争夺清除方向。",
      "choiceTradeoff": "横线能同时削一排根，纵线可穿下方花道；先做同一区域两波还是跨区推进？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "半桥花道",
        "description": "上半部四根短桥与下半部六格花道争夺清除方向。",
        "hint": "横线能同时削一排根，纵线可穿下方花道；先做同一区域两波还是跨区推进？",
        "moves": 12,
        "goals": {
          "roots": 4,
          "moss": 6,
          "type4": 12
        },
        "moss": [
          29,
          30,
          31,
          32,
          33,
          38
        ],
        "roots": [
          {
            "index": 15,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 18,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 40,
            "special": "column"
          }
        ]
      },
      "theme": "harvest",
      "plannedSeeds": [
        2135901623,
        2135906668,
        2135909695
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          9,
          9,
          9
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "300a97784039516643e470dbe8d659d1f11fae8ad372e50ebe6be42b6f6b088a",
      "qualified": true,
      "seedBank": [
        2135901623,
        2135906668,
        2135909695
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-008",
      "region": "meadow",
      "ordinal": 8,
      "kind": "variant",
      "coreId": "meadow-c01-006",
      "designIntent": "直线有利于覆盖角落苔圃，且本关要亲手新造两条直线。",
      "choiceTradeoff": "初始直线可以先清边，但之后还须形成新线；成线位置是否有利于剩余角落？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "田角留线",
        "description": "直线有利于覆盖角落苔圃，且本关要亲手新造两条直线。",
        "hint": "初始直线可以先清边，但之后还须形成新线；成线位置是否有利于剩余角落？",
        "moves": 18,
        "goals": {
          "lines": 2,
          "moss": 8,
          "roots": 2
        },
        "moss": [
          0,
          1,
          7,
          6,
          13,
          41,
          47,
          48
        ],
        "roots": [
          {
            "index": 8,
            "layers": 1
          },
          {
            "index": 40,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 0,
            "special": "column"
          },
          {
            "index": 41,
            "special": "row"
          }
        ]
      },
      "theme": "harvest",
      "plannedSeeds": [
        2354011679,
        2354010670,
        2354013697
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          16,
          15,
          15
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "506a88911b12198c9a89fa3223a27cdbd047e95d227e3b6f17c4de639b1b71f8",
      "qualified": true,
      "seedBank": [
        2354010670,
        2354011679,
        2354013697
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-009",
      "region": "meadow",
      "ordinal": 9,
      "kind": "variant",
      "coreId": "meadow-c01-006",
      "designIntent": "把花圃收回中央短枝，一次自然制造即可。",
      "choiceTradeoff": "可以先清短枝，也可以先完成手边的长连机会；短目标给予调整空间。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "草甸轻唱",
        "description": "把花圃收回中央短枝，一次自然制造即可。",
        "hint": "可以先清短枝，也可以先完成手边的长连机会；短目标给予调整空间。",
        "moves": 25,
        "goals": {
          "specials": 1,
          "type2": 14,
          "moss": 5
        },
        "moss": [
          16,
          17,
          18,
          24,
          31
        ],
        "roots": [],
        "starters": [
          {
            "index": 28,
            "special": "row"
          },
          {
            "index": 11,
            "special": "bomb"
          }
        ]
      },
      "theme": "orchard",
      "plannedSeeds": [
        2370785262,
        2370788289,
        2370798379
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          8,
          8,
          8
        ],
        "moveMargin": 17,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "013d0e62d770e7dd48bdd745f09b41a27977df47c39b74b61b2a963136c4d4c3",
      "qualified": true,
      "seedBank": [
        2370785262,
        2370788289,
        2370798379
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-010",
      "region": "meadow",
      "ordinal": 10,
      "kind": "variant",
      "coreId": "meadow-c01-001",
      "designIntent": "一条长田埂与另一侧折角花圃竞争直线覆盖，并要求新造一条线。",
      "choiceTradeoff": "用现成直线清远端很快，但自然成线和双根的第二波仍需安排。",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "分叉高田",
        "description": "一条长田埂与另一侧折角花圃竞争直线覆盖，并要求新造一条线。",
        "hint": "用现成直线清远端很快，但自然成线和双根的第二波仍需安排。",
        "moves": 10,
        "goals": {
          "moss": 10,
          "roots": 2,
          "lines": 1
        },
        "moss": [
          8,
          15,
          22,
          29,
          36,
          17,
          18,
          19,
          26,
          33
        ],
        "roots": [
          {
            "index": 23,
            "layers": 2
          },
          {
            "index": 25,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 14,
            "special": "row"
          },
          {
            "index": 33,
            "special": "column"
          }
        ]
      },
      "theme": "harvest",
      "plannedSeeds": [
        2320601518,
        2320603536,
        2320613626
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          7,
          7,
          7
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "fe7635318f549153e1c18f2c34b4c314e34cc0d1d3c1e6ebcaf69d672c4340c6",
      "qualified": true,
      "seedBank": [
        2320601518,
        2320603536,
        2320613626
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-011",
      "region": "meadow",
      "ordinal": 11,
      "kind": "variant",
      "coreId": "meadow-c01-003",
      "designIntent": "唯一的三层中心根要求分三波处理，四方单根提供顺带收益。",
      "choiceTradeoff": "一次巨大爆破也只削中心一层；保留多次机会还是先用范围清周边？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "中心慢结",
        "description": "唯一的三层中心根要求分三波处理，四方单根提供顺带收益。",
        "hint": "一次巨大爆破也只削中心一层；保留多次机会还是先用范围清周边？",
        "moves": 18,
        "goals": {
          "roots": 5,
          "moss": 4,
          "specials": 2
        },
        "moss": [
          16,
          18,
          30,
          32
        ],
        "roots": [
          {
            "index": 24,
            "layers": 3
          },
          {
            "index": 10,
            "layers": 1
          },
          {
            "index": 22,
            "layers": 1
          },
          {
            "index": 26,
            "layers": 1
          },
          {
            "index": 38,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 9,
            "special": "bomb"
          },
          {
            "index": 45,
            "special": "column"
          }
        ]
      },
      "theme": "bells",
      "plannedSeeds": [
        2303830962,
        2303834998,
        2303823899
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          14,
          14,
          16
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "577294ed35e4a1f6af87faf0cb207a72d1e7a72439b67c9d7b2e69aa9ee2eec3",
      "qualified": true,
      "seedBank": [
        2303823899,
        2303830962,
        2303834998
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "meadow-c01-012",
      "region": "meadow",
      "ordinal": 12,
      "kind": "variant",
      "coreId": "meadow-c01-006",
      "designIntent": "上下根轮与中央苔枝之间制造三枚奇物，作为草甸收束。",
      "choiceTradeoff": "现成纵线可给多根削一层；是马上推进覆盖，还是先留出自然制造的布局？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 2,
        "chapterName": "风车草甸",
        "name": "两轮一曲",
        "description": "上下根轮与中央苔枝之间制造三枚奇物，作为草甸收束。",
        "hint": "现成纵线可给多根削一层；是马上推进覆盖，还是先留出自然制造的布局？",
        "moves": 17,
        "goals": {
          "specials": 3,
          "roots": 6,
          "moss": 6
        },
        "moss": [
          22,
          23,
          24,
          25,
          26,
          31
        ],
        "roots": [
          {
            "index": 9,
            "layers": 2
          },
          {
            "index": 11,
            "layers": 2
          },
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 18,
            "layers": 2
          },
          {
            "index": 30,
            "layers": 2
          },
          {
            "index": 32,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 3,
            "special": "column"
          },
          {
            "index": 28,
            "special": "row"
          }
        ]
      },
      "theme": "bells",
      "plannedSeeds": [
        2354163819,
        2354166846
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          15,
          15
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "f614a43164f8e446ccff47dbec878de8052b391ff76bbf0839391716d6e18364",
      "qualified": true,
      "seedBank": [
        2354163819,
        2354166846
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 2,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-001",
      "region": "sky",
      "ordinal": 1,
      "kind": "core",
      "coreId": "sky-c01-001",
      "designIntent": "只设一个中央配色星位，练习看当前格的目标图案，同时兼顾两侧根与苔。",
      "choiceTradeoff": "现在引爆可清障碍；若星位图案不对，是否等一次重新对位再覆盖它？",
      "difficultyIntent": "warmup",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "星位辨色",
        "description": "只设一个中央配色星位，练习看当前格的目标图案，同时兼顾两侧根与苔。",
        "hint": "查看亮框中的目标图案。只有在该格真正消除对应棋子才点亮；扫过别的图案不会算。",
        "moves": 8,
        "goals": {
          "beacons": 1,
          "roots": 2,
          "moss": 4
        },
        "moss": [
          16,
          17,
          31,
          32
        ],
        "roots": [
          {
            "index": 23,
            "layers": 1
          },
          {
            "index": 25,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 3,
            "special": "column"
          }
        ],
        "beacons": [
          24
        ],
        "beaconTypes": [
          3
        ]
      },
      "theme": "autumn",
      "plannedSeeds": [
        651554471,
        651557498,
        651567588
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          4,
          4,
          4
        ],
        "moveMargin": 4,
        "typedProgressTurns": [
          2,
          1,
          2
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "baa66091ad14052f0694c260d9c213c4da8edf9a552d2631f726689e01cd15c3",
      "qualified": true,
      "seedBank": [
        651554471,
        651557498,
        651567588
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-002",
      "region": "sky",
      "ordinal": 2,
      "kind": "variant",
      "coreId": "sky-c01-001",
      "designIntent": "星位上移，苔道在下方转折，选择是在上部配色还是顺势清下部。",
      "choiceTradeoff": "纵线能同时经过星位与苔道，却需要星位当前图案正确；等配色与先清障碍各有代价。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "星门偏航",
        "description": "星位上移，苔道在下方转折，选择是在上部配色还是顺势清下部。",
        "hint": "纵线能同时经过星位与苔道，却需要星位当前图案正确；等配色与先清障碍各有代价。",
        "moves": 8,
        "goals": {
          "beacons": 1,
          "moss": 5,
          "roots": 2
        },
        "moss": [
          22,
          23,
          24,
          31,
          38
        ],
        "roots": [
          {
            "index": 16,
            "layers": 1
          },
          {
            "index": 18,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 3,
            "special": "column"
          },
          {
            "index": 28,
            "special": "row"
          }
        ],
        "beacons": [
          17
        ],
        "beaconTypes": [
          2
        ]
      },
      "theme": "autumn",
      "plannedSeeds": [
        668334108,
        668337135,
        668340162
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          3,
          3,
          3
        ],
        "moveMargin": 5,
        "typedProgressTurns": [
          2,
          3,
          2
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "pacingRole": "quick-transition",
      "balanceRevisionNotes": "该种子簇约3步完成，改标短过渡，8步预算不冒称压力关。",
      "contentRevision": 1,
      "contentSHA256": "15523d746b2447616e1f778cfe5aa60e112bea181bbc615e427f84c71519b916",
      "qualified": true,
      "seedBank": [
        668334108,
        668337135,
        668340162
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-003",
      "region": "sky",
      "ordinal": 3,
      "kind": "core",
      "coreId": "sky-c01-003",
      "designIntent": "四步云桥包含回访，按目标顺序在中心和两侧切换。",
      "choiceTradeoff": "范围覆盖未来星位不会提前计数；要不要留住适合回访方向的奇物？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "折返云桥",
        "description": "四步云桥包含回访，按目标顺序在中心和两侧切换。",
        "hint": "范围覆盖未来星位不会提前计数；要不要留住适合回访方向的奇物？",
        "moves": 8,
        "goals": {
          "beacons": 4,
          "moss": 3,
          "roots": 2
        },
        "moss": [
          17,
          24,
          31
        ],
        "roots": [
          {
            "index": 23,
            "layers": 1
          },
          {
            "index": 25,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 14,
            "special": "row"
          },
          {
            "index": 32,
            "special": "column"
          }
        ],
        "beacons": [
          16,
          32,
          24,
          16
        ]
      },
      "theme": "autumn",
      "plannedSeeds": [
        685118790,
        685119799,
        685123835
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          5,
          5,
          5
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "2ea30c13d85f8a1afe9b124998f77d537dcff61ba9ae7cc13f67d65d67fc1632",
      "qualified": true,
      "seedBank": [
        685118790,
        685119799,
        685123835
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-004",
      "region": "sky",
      "ordinal": 4,
      "kind": "variant",
      "coreId": "sky-c01-001",
      "designIntent": "下方单星位与三格短苔围，减少目标冲突作为缓冲。",
      "choiceTradeoff": "缓冲关不再等待特定水果进入单星位；可先点星，也可把范围奇物用于苔藓与收集。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "一颗晚星",
        "description": "下方单星位与三格短苔围，减少目标冲突作为缓冲。",
        "hint": "缓冲关不再等待特定水果进入单星位；可先点星，也可把范围奇物用于苔藓与收集。",
        "moves": 28,
        "goals": {
          "beacons": 1,
          "moss": 3,
          "type5": 10
        },
        "moss": [
          24,
          30,
          32
        ],
        "roots": [],
        "starters": [
          {
            "index": 28,
            "special": "row"
          },
          {
            "index": 38,
            "special": "bomb"
          }
        ],
        "beacons": [
          31
        ]
      },
      "theme": "tropic",
      "balanceRevisionNotes": "从喘息关移除配色等待条件，目标数量与棋盘几何保持。",
      "plannedSeeds": [
        567668394,
        567672430,
        567673439
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          4,
          4,
          4
        ],
        "moveMargin": 24,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "84c6ef39ff4f6a7a6b59bca30d7c82ba791804f5658d2e82724b0fad8730bca5",
      "qualified": true,
      "seedBank": [
        567668394,
        567672430,
        567673439
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "LOOSE_BUDGET_UNDER_SHALLOW_POLICY"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-005",
      "region": "sky",
      "ordinal": 5,
      "kind": "variant",
      "coreId": "sky-c01-003",
      "designIntent": "两段上下云桥交错穿过中轴，双根位于两侧。",
      "choiceTradeoff": "纵线能碰前两站，却只能完成当前一站；是立即削层，还是保留下一方向的命中？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "双桥交错",
        "description": "两段上下云桥交错穿过中轴，双根位于两侧。",
        "hint": "纵线能碰前两站，却只能完成当前一站；是立即削层，还是保留下一方向的命中？",
        "moves": 8,
        "goals": {
          "beacons": 4,
          "roots": 2,
          "moss": 3
        },
        "moss": [
          17,
          24,
          31
        ],
        "roots": [
          {
            "index": 22,
            "layers": 2
          },
          {
            "index": 26,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 3,
            "special": "column"
          },
          {
            "index": 14,
            "special": "row"
          }
        ],
        "beacons": [
          10,
          38,
          18,
          30
        ]
      },
      "theme": "tropic",
      "plannedSeeds": [
        584445004,
        584448031,
        584454085
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          6,
          6,
          6
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "5fe4e76c6cef9ea92cdedd500e9d3a48b44925ca75f3e3ea5ab9565b1f140ed6",
      "qualified": true,
      "seedBank": [
        584445004,
        584448031,
        584454085
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-006",
      "region": "sky",
      "ordinal": 6,
      "kind": "core",
      "coreId": "sky-c01-006",
      "designIntent": "四组偏角双格星庭要求覆盖布局，同时自然造一条直线。",
      "choiceTradeoff": "现成直线先清哪些星庭，才能给新造的直线留下最有用的位置？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "星庭留光",
        "description": "四组偏角双格星庭要求覆盖布局，同时自然造一条直线。",
        "hint": "现成直线先清哪些星庭，才能给新造的直线留下最有用的位置？",
        "moves": 11,
        "goals": {
          "moss": 8,
          "lines": 1,
          "type2": 12
        },
        "moss": [
          8,
          9,
          12,
          19,
          29,
          36,
          39,
          40
        ],
        "roots": [],
        "starters": [
          {
            "index": 1,
            "special": "column"
          },
          {
            "index": 41,
            "special": "row"
          }
        ]
      },
      "theme": "autumn",
      "plannedSeeds": [
        601222623,
        601228677,
        601232713
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          8,
          8,
          8
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "ac9770d26fb75badb6aca69fe9441871d127dfd58638b0c1ebb3cbc3c1c63793",
      "qualified": true,
      "seedBank": [
        601222623,
        601228677,
        601232713
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-007",
      "region": "sky",
      "ordinal": 7,
      "kind": "variant",
      "coreId": "sky-c01-003",
      "designIntent": "中心星位二次访问，四步都在紧凑中庭内，另需自然造一枚奇物。",
      "choiceTradeoff": "中心范围可一次扫很多未来节点，但仍只前进一步；留下多次独立触发更重要吗？",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "中庭往返",
        "description": "中心星位二次访问，四步都在紧凑中庭内，另需自然造一枚奇物。",
        "hint": "中心范围可一次扫很多未来节点，但仍只前进一步；留下多次独立触发更重要吗？",
        "moves": 9,
        "goals": {
          "beacons": 4,
          "moss": 6,
          "specials": 1
        },
        "moss": [
          9,
          18,
          23,
          25,
          30,
          39
        ],
        "roots": [],
        "starters": [
          {
            "index": 24,
            "special": "bomb"
          },
          {
            "index": 35,
            "special": "row"
          }
        ],
        "beacons": [
          24,
          17,
          24,
          31
        ]
      },
      "theme": "tropic",
      "balanceRevisionNotes": "中心开局范围不能一波清完全部苔藓；两格移至外翼，保留覆盖取舍。",
      "plannedSeeds": [
        618003269,
        618012350,
        618014368
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          6,
          6,
          6
        ],
        "moveMargin": 3,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "7673ba3a4ba685e114813e5844ba95e0ec7b9e2fe12de0ff71a771ad118f3656",
      "qualified": true,
      "seedBank": [
        618003269,
        618012350,
        618014368
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-008",
      "region": "sky",
      "ordinal": 8,
      "kind": "variant",
      "coreId": "sky-c01-006",
      "designIntent": "四枚双根围住单配色星位，同时要自然制造两枚奇物。",
      "choiceTradeoff": "形成奇物时保留的中心棋子不算星位已消除；选择成形锚点还是直接移除，要看当前目标。",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "星丝分岔",
        "description": "四枚双根围住单配色星位，同时要自然制造两枚奇物。",
        "hint": "形成奇物时保留的中心棋子不算星位已消除；选择成形锚点还是直接移除，要看当前目标。",
        "moves": 8,
        "goals": {
          "beacons": 1,
          "roots": 4,
          "specials": 2
        },
        "moss": [],
        "roots": [
          {
            "index": 16,
            "layers": 2
          },
          {
            "index": 18,
            "layers": 2
          },
          {
            "index": 30,
            "layers": 2
          },
          {
            "index": 32,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 10,
            "special": "bomb"
          }
        ],
        "beacons": [
          24
        ],
        "beaconTypes": [
          4
        ]
      },
      "theme": "tropic",
      "plannedSeeds": [
        500555900,
        500557918
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          4,
          4
        ],
        "moveMargin": 4,
        "typedProgressTurns": [
          4,
          2
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "pacingRole": "short-technique",
      "balanceRevisionNotes": "已由33步收紧为8步，见证解4步；定位特殊锚点/配色星位短技巧，不冒称高难。",
      "contentRevision": 1,
      "contentSHA256": "35d8fa93b5b73ba8b7f81e2f9da2e818f39f450d522739e30f1d39df35676ee8",
      "qualified": true,
      "seedBank": [
        500555900,
        500557918
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 2,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-009",
      "region": "sky",
      "ordinal": 9,
      "kind": "variant",
      "coreId": "sky-c01-006",
      "designIntent": "上下两个短折角星庭给玩家留出较宽的造奇物空间。",
      "choiceTradeoff": "先完成自然制造或先用已有线清一个折角，都能分阶段减轻目标。",
      "difficultyIntent": "breather",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "云间空拍",
        "description": "上下两个短折角星庭给玩家留出较宽的造奇物空间。",
        "hint": "先完成自然制造或先用已有线清一个折角，都能分阶段减轻目标。",
        "moves": 26,
        "goals": {
          "moss": 6,
          "specials": 1,
          "type3": 10
        },
        "moss": [
          9,
          10,
          17,
          31,
          38,
          39
        ],
        "roots": [],
        "starters": [
          {
            "index": 7,
            "special": "row"
          },
          {
            "index": 5,
            "special": "column"
          }
        ]
      },
      "theme": "autumn",
      "plannedSeeds": [
        517334528,
        517335537,
        517342600
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          6,
          6,
          6
        ],
        "moveMargin": 20,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "bc945e1aed413f395161a2dafdea27c4b56aef1880fbab5211c9ce698bc530c2",
      "qualified": true,
      "seedBank": [
        517334528,
        517335537,
        517342600
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-010",
      "region": "sky",
      "ordinal": 10,
      "kind": "variant",
      "coreId": "sky-c01-001",
      "designIntent": "星位偏右，中轴根分上下两岸，苔格留在左右侧。",
      "choiceTradeoff": "中轴清除利于削根，右侧覆盖利于星位；要选择兼顾当前图案的方向。",
      "difficultyIntent": "strategy",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "星位双岸",
        "description": "星位偏右，中轴根分上下两岸，苔格留在左右侧。",
        "hint": "中轴清除利于削根，右侧覆盖利于星位；要选择兼顾当前图案的方向。",
        "moves": 8,
        "goals": {
          "beacons": 1,
          "roots": 4,
          "moss": 6
        },
        "moss": [
          16,
          18,
          23,
          24,
          30,
          32
        ],
        "roots": [
          {
            "index": 10,
            "layers": 1
          },
          {
            "index": 17,
            "layers": 1
          },
          {
            "index": 31,
            "layers": 1
          },
          {
            "index": 38,
            "layers": 1
          }
        ],
        "starters": [
          {
            "index": 21,
            "special": "row"
          },
          {
            "index": 4,
            "special": "column"
          }
        ],
        "beacons": [
          25
        ],
        "beaconTypes": [
          1
        ]
      },
      "theme": "tropic",
      "plannedSeeds": [
        735594706,
        735601769,
        735604796
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          4,
          4,
          4
        ],
        "moveMargin": 4,
        "typedProgressTurns": [
          2,
          1,
          1
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "a2dbeadddd6c7a5e9b775d28beaca7b05a9e6d1421f1da8890d9ec1d3a3d1965",
      "qualified": true,
      "seedBank": [
        735594706,
        735601769,
        735604796
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-011",
      "region": "sky",
      "ordinal": 11,
      "kind": "variant",
      "coreId": "sky-c01-003",
      "designIntent": "五步星环在远近位置交替，末站返回左上。",
      "choiceTradeoff": "直线可同时覆盖未来两站，仍需安排不同波次；先做双根第二层还是先继续星环？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "远近星环",
        "description": "五步星环在远近位置交替，末站返回左上。",
        "hint": "直线可同时覆盖未来两站，仍需安排不同波次；先做双根第二层还是先继续星环？",
        "moves": 16,
        "goals": {
          "beacons": 5,
          "roots": 2,
          "type0": 12
        },
        "moss": [],
        "roots": [
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 31,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 7,
            "special": "row"
          },
          {
            "index": 4,
            "special": "column"
          }
        ],
        "beacons": [
          9,
          25,
          39,
          23,
          9
        ]
      },
      "theme": "beacon",
      "plannedSeeds": [
        718820114,
        718827177,
        718817087
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          14,
          14,
          12
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          null,
          null,
          null
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "8514e4181ddbf148ad463d2a67c2eade485a2f78d3100a9447156bccc511223e",
      "qualified": true,
      "seedBank": [
        718817087,
        718820114,
        718827177
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    },
    {
      "id": "sky-c01-012",
      "region": "sky",
      "ordinal": 12,
      "kind": "variant",
      "coreId": "sky-c01-006",
      "designIntent": "单配色星位、上下双根与六格苔构成收束，保留两次自然制造的布局选择。",
      "choiceTradeoff": "清障碍、等待星位图案、制造奇物可能争用同一布局；先完成哪个目标能减少后续冲突？",
      "difficultyIntent": "challenge",
      "config": {
        "chapter": 3,
        "chapterName": "天空之城",
        "name": "群星终曲",
        "description": "单配色星位、上下双根与六格苔构成收束，保留两次自然制造的布局选择。",
        "hint": "清障碍、等待星位图案、制造奇物可能争用同一布局；先完成哪个目标能减少后续冲突？",
        "moves": 13,
        "goals": {
          "beacons": 1,
          "roots": 6,
          "moss": 6,
          "specials": 2
        },
        "moss": [
          16,
          18,
          23,
          25,
          30,
          32
        ],
        "roots": [
          {
            "index": 15,
            "layers": 2
          },
          {
            "index": 17,
            "layers": 2
          },
          {
            "index": 19,
            "layers": 2
          },
          {
            "index": 29,
            "layers": 2
          },
          {
            "index": 31,
            "layers": 2
          },
          {
            "index": 33,
            "layers": 2
          }
        ],
        "starters": [
          {
            "index": 3,
            "special": "column"
          },
          {
            "index": 25,
            "special": "bomb"
          }
        ],
        "beacons": [
          24
        ],
        "beaconTypes": [
          0
        ]
      },
      "theme": "beacon",
      "plannedSeeds": [
        702042495,
        702044513,
        702046531
      ],
      "balanceEvidence": {
        "policy": "Zero bottom-tray/inventory tools; ordinary board actions only",
        "actionCounts": [
          9,
          7,
          11
        ],
        "moveMargin": 2,
        "typedProgressTurns": [
          1,
          5,
          1
        ],
        "seedSelection": "Bounded offline 16-seed sample, goal-choice witnesses; selected action-length cluster, not live random retries",
        "humanDifficulty": "unverified"
      },
      "contentRevision": 1,
      "contentSHA256": "8cce8ebe18462818e5f7b419772467554561f3eac9b07f0cc6917eb71518e7d4",
      "qualified": true,
      "seedBank": [
        702042495,
        702044513,
        702046531
      ],
      "qualification": {
        "method": "deterministic legal zero-tool replay plus non-dominating goal choice witness",
        "verifiedSeedCount": 3,
        "reviewFlags": [
          "TYPED_NODE_WAITING_RISK"
        ],
        "humanDifficulty": "unverified",
        "difficultyLabelKind": "authored intention, not measured player difficulty"
      }
    }
  ]
};
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
freeze(DATA);const byId=new Map(DATA.stages.map(s=>[s.id,s]));module.exports=Object.freeze({...DATA,get:id=>byId.get(id)||null});
