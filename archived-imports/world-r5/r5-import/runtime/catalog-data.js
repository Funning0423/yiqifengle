'use strict';
// Generated from authored designs and replay-qualified finite seeds.
module.exports=[
  {
    "id": "r05-tide-01",
    "region": "tide",
    "ordinal": 1,
    "name": "贝壳等一次涨潮",
    "contentRevision": "r5.1",
    "intendedBand": "introduce",
    "designIntent": "退潮破壳，涨潮收珠；先决定本回合该破壳还是整理下回合的线。",
    "config": {
      "moves": 6,
      "goals": {
        "moss": 4
      },
      "moss": [
        21,
        22,
        23,
        24
      ],
      "roots": [],
      "starters": [
        {
          "index": 24,
          "special": "row"
        },
        {
          "index": 10,
          "special": "column"
        }
      ]
    },
    "rules": {
      "phaseCycle": [
        "ebb",
        "flood"
      ],
      "shells": [
        {
          "index": 24,
          "layers": 1
        },
        {
          "index": 38,
          "layers": 1
        }
      ]
    },
    "tool": {
      "kind": "tideAnchor",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      3
    ],
    "calibration": {
      "witnessActions": [
        2,
        4
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-tide-02",
    "region": "tide",
    "ordinal": 2,
    "name": "潮沟的分岔",
    "contentRevision": "r5.1",
    "intendedBand": "combine",
    "designIntent": "两条纵向潮沟不能同时照顾；收珠水柱会帮助另一条目标但可能提前耗掉特殊棋子。",
    "config": {
      "moves": 11,
      "goals": {
        "roots": 3,
        "type2": 10
      },
      "moss": [],
      "roots": [
        {
          "index": 8,
          "layers": 1
        },
        {
          "index": 24,
          "layers": 1
        },
        {
          "index": 40,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 8,
          "special": "column"
        },
        {
          "index": 36,
          "special": "row"
        },
        {
          "index": 40,
          "special": "bomb"
        }
      ]
    },
    "rules": {
      "phaseCycle": [
        "ebb",
        "flood"
      ],
      "shells": [
        {
          "index": 8,
          "layers": 1
        },
        {
          "index": 36,
          "layers": 2
        },
        {
          "index": 40,
          "layers": 1
        }
      ]
    },
    "tool": {
      "kind": "tideAnchor",
      "charges": 1
    },
    "seedBank": [
      2,
      11,
      12
    ],
    "calibration": {
      "witnessActions": [
        6,
        9
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-tide-03",
    "region": "tide",
    "ordinal": 3,
    "name": "双退潮的礁台",
    "contentRevision": "r5.1",
    "intendedBand": "timing",
    "designIntent": "两次退潮窗口与双层壳配合；锚定会推迟收珠，不能见到就用。",
    "config": {
      "moves": 11,
      "goals": {
        "moss": 7,
        "roots": 2
      },
      "moss": [
        7,
        8,
        9,
        17,
        25,
        33,
        34
      ],
      "roots": [
        {
          "index": 17,
          "layers": 1
        },
        {
          "index": 31,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 7,
          "special": "row"
        },
        {
          "index": 31,
          "special": "column"
        },
        {
          "index": 33,
          "special": "bomb"
        }
      ]
    },
    "rules": {
      "phaseCycle": [
        "ebb",
        "ebb",
        "flood"
      ],
      "shells": [
        {
          "index": 9,
          "layers": 2
        },
        {
          "index": 25,
          "layers": 1
        },
        {
          "index": 31,
          "layers": 2
        }
      ]
    },
    "tool": {
      "kind": "tideAnchor",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      3
    ],
    "calibration": {
      "witnessActions": [
        6,
        9
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-tide-04",
    "region": "tide",
    "ordinal": 4,
    "name": "三道回流与灯港",
    "contentRevision": "r5.1",
    "intendedBand": "finale",
    "designIntent": "四贝分两侧，先完成哪侧决定回流水柱；兼顾壳层、潮相和遗留根须。",
    "config": {
      "moves": 14,
      "goals": {
        "roots": 4,
        "moss": 6
      },
      "moss": [
        2,
        9,
        16,
        32,
        39,
        46
      ],
      "roots": [
        {
          "index": 10,
          "layers": 1
        },
        {
          "index": 12,
          "layers": 1
        },
        {
          "index": 36,
          "layers": 1
        },
        {
          "index": 38,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 2,
          "special": "column"
        },
        {
          "index": 36,
          "special": "row"
        },
        {
          "index": 38,
          "special": "bomb"
        },
        {
          "index": 46,
          "special": "row"
        }
      ]
    },
    "rules": {
      "phaseCycle": [
        "ebb",
        "flood",
        "flood"
      ],
      "shells": [
        {
          "index": 9,
          "layers": 2
        },
        {
          "index": 12,
          "layers": 1
        },
        {
          "index": 36,
          "layers": 2
        },
        {
          "index": 39,
          "layers": 1
        }
      ]
    },
    "tool": {
      "kind": "tideAnchor",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      3
    ],
    "calibration": {
      "witnessActions": [
        8,
        12
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-meadow-01",
    "region": "meadow",
    "ordinal": 1,
    "name": "花苞要两种颜色",
    "contentRevision": "r5.1",
    "intendedBand": "introduce",
    "designIntent": "风向决定花苞接收的两侧；按顺序送入两种花粉，不能只刷同一颜色。",
    "config": {
      "moves": 11,
      "goals": {
        "type1": 12
      },
      "moss": [],
      "roots": [],
      "starters": [
        {
          "index": 22,
          "special": "row"
        },
        {
          "index": 38,
          "special": "column"
        }
      ]
    },
    "rules": {
      "windCycle": [
        "horizontal",
        "vertical"
      ],
      "blooms": [
        {
          "index": 23,
          "pollen": [
            1,
            3
          ]
        },
        {
          "index": 38,
          "pollen": [
            3,
            1
          ]
        }
      ]
    },
    "tool": {
      "kind": "sunSeed",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      3
    ],
    "calibration": {
      "witnessActions": [
        5,
        8
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-meadow-02",
    "region": "meadow",
    "ordinal": 2,
    "name": "风车旁的接力花圃",
    "contentRevision": "r5.1",
    "intendedBand": "combine",
    "designIntent": "成熟花沿当前风向吹出一整条线；顺序选择会影响另一朵花的花粉。",
    "config": {
      "moves": 10,
      "goals": {
        "moss": 5
      },
      "moss": [
        15,
        16,
        17,
        18,
        19
      ],
      "roots": [
        {
          "index": 30,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 15,
          "special": "row"
        },
        {
          "index": 31,
          "special": "bomb"
        },
        {
          "index": 40,
          "special": "column"
        }
      ]
    },
    "rules": {
      "windCycle": [
        "horizontal",
        "vertical"
      ],
      "blooms": [
        {
          "index": 16,
          "pollen": [
            0,
            2
          ]
        },
        {
          "index": 18,
          "pollen": [
            2,
            4
          ]
        },
        {
          "index": 31,
          "pollen": [
            4,
            0
          ]
        }
      ]
    },
    "tool": {
      "kind": "sunSeed",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      4
    ],
    "calibration": {
      "witnessActions": [
        5,
        8
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-meadow-03",
    "region": "meadow",
    "ordinal": 3,
    "name": "回旋风与三色花",
    "contentRevision": "r5.1",
    "intendedBand": "timing",
    "designIntent": "三段花粉顺序与重复横风窗口叠加；太阳种子是一次可布置的竖线资源。",
    "config": {
      "moves": 16,
      "goals": {
        "roots": 3,
        "type4": 9
      },
      "moss": [],
      "roots": [
        {
          "index": 9,
          "layers": 1
        },
        {
          "index": 24,
          "layers": 1
        },
        {
          "index": 39,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 8,
          "special": "row"
        },
        {
          "index": 26,
          "special": "column"
        },
        {
          "index": 37,
          "special": "bomb"
        }
      ]
    },
    "rules": {
      "windCycle": [
        "horizontal",
        "horizontal",
        "vertical"
      ],
      "blooms": [
        {
          "index": 9,
          "pollen": [
            1,
            4,
            2
          ]
        },
        {
          "index": 25,
          "pollen": [
            2,
            1
          ]
        },
        {
          "index": 39,
          "pollen": [
            4,
            2,
            1
          ]
        }
      ]
    },
    "tool": {
      "kind": "sunSeed",
      "charges": 1
    },
    "seedBank": [
      7,
      10,
      14
    ],
    "calibration": {
      "witnessActions": [
        9,
        14
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-meadow-04",
    "region": "meadow",
    "ordinal": 4,
    "name": "长风穿过四座花坛",
    "contentRevision": "r5.1",
    "intendedBand": "finale",
    "designIntent": "边角与中央花坛需要不同落点；决定把唯一的太阳种子留给哪一列。",
    "config": {
      "moves": 20,
      "goals": {
        "moss": 8,
        "roots": 2
      },
      "moss": [
        0,
        1,
        7,
        20,
        28,
        41,
        47,
        48
      ],
      "roots": [
        {
          "index": 20,
          "layers": 1
        },
        {
          "index": 28,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 1,
          "special": "row"
        },
        {
          "index": 20,
          "special": "column"
        },
        {
          "index": 28,
          "special": "bomb"
        },
        {
          "index": 47,
          "special": "row"
        }
      ]
    },
    "rules": {
      "windCycle": [
        "vertical",
        "horizontal",
        "vertical"
      ],
      "blooms": [
        {
          "index": 1,
          "pollen": [
            0,
            3
          ]
        },
        {
          "index": 20,
          "pollen": [
            3,
            5,
            0
          ]
        },
        {
          "index": 28,
          "pollen": [
            5,
            0
          ]
        },
        {
          "index": 47,
          "pollen": [
            0,
            5,
            3
          ]
        }
      ]
    },
    "tool": {
      "kind": "sunSeed",
      "charges": 1
    },
    "seedBank": [
      4,
      11,
      14
    ],
    "calibration": {
      "witnessActions": [
        14,
        18
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-sky-01",
    "region": "sky",
    "ordinal": 1,
    "name": "两面星门",
    "contentRevision": "r5.1",
    "intendedBand": "introduce",
    "designIntent": "按顺序击中正确明暗相位的棱镜；星门回声会从对面落点扩散。",
    "config": {
      "moves": 6,
      "goals": {
        "moss": 4
      },
      "moss": [
        10,
        11,
        17,
        18
      ],
      "roots": [],
      "starters": [
        {
          "index": 10,
          "special": "row"
        },
        {
          "index": 38,
          "special": "column"
        }
      ]
    },
    "rules": {
      "polarityCycle": [
        0,
        1
      ],
      "relays": [
        {
          "index": 10,
          "partner": 38,
          "polarity": 0,
          "hits": 1
        },
        {
          "index": 38,
          "partner": 10,
          "polarity": 1,
          "hits": 1
        }
      ]
    },
    "tool": {
      "kind": "prismShift",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      3
    ],
    "calibration": {
      "witnessActions": [
        2,
        4
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-sky-02",
    "region": "sky",
    "ordinal": 2,
    "name": "跨庭院的回声",
    "contentRevision": "r5.1",
    "intendedBand": "combine",
    "designIntent": "匹配颜色、相位与棱镜顺序跨越三处庭院；迁移当前棱镜会改变击中位置和回声方向。",
    "config": {
      "moves": 15,
      "goals": {
        "roots": 3,
        "type5": 8
      },
      "moss": [],
      "roots": [
        {
          "index": 10,
          "layers": 1
        },
        {
          "index": 23,
          "layers": 1
        },
        {
          "index": 39,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 8,
          "special": "bomb"
        },
        {
          "index": 23,
          "special": "column"
        },
        {
          "index": 39,
          "special": "row"
        }
      ]
    },
    "rules": {
      "polarityCycle": [
        0,
        1
      ],
      "relays": [
        {
          "index": 10,
          "partner": 26,
          "polarity": 0,
          "hits": 1,
          "type": 2
        },
        {
          "index": 39,
          "partner": 22,
          "polarity": 1,
          "hits": 1,
          "type": 5
        },
        {
          "index": 23,
          "partner": 3,
          "polarity": 0,
          "hits": 1,
          "type": 3
        }
      ]
    },
    "tool": {
      "kind": "prismShift",
      "charges": 1
    },
    "seedBank": [
      2,
      5,
      7
    ],
    "calibration": {
      "witnessActions": [
        7,
        12
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-sky-03",
    "region": "sky",
    "ordinal": 3,
    "name": "双锁与长夜",
    "contentRevision": "r5.1",
    "intendedBand": "timing",
    "designIntent": "双锁棱镜需要两个颜色与相位均正确的波次；一次大爆炸不能跳过顺序，长夜决定何时保留火力。",
    "config": {
      "moves": 17,
      "goals": {
        "moss": 6
      },
      "moss": [
        3,
        10,
        17,
        31,
        38,
        45
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
          "index": 3,
          "special": "column"
        },
        {
          "index": 22,
          "special": "row"
        },
        {
          "index": 45,
          "special": "bomb"
        }
      ]
    },
    "rules": {
      "polarityCycle": [
        0,
        1,
        1
      ],
      "relays": [
        {
          "index": 17,
          "partner": 31,
          "polarity": 0,
          "hits": 2,
          "type": 1
        },
        {
          "index": 22,
          "partner": 26,
          "polarity": 1,
          "hits": 1,
          "type": 4
        },
        {
          "index": 45,
          "partner": 3,
          "polarity": 1,
          "hits": 2,
          "type": 2
        }
      ]
    },
    "tool": {
      "kind": "prismShift",
      "charges": 1
    },
    "seedBank": [
      1,
      4,
      15
    ],
    "calibration": {
      "witnessActions": [
        10,
        15
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  },
  {
    "id": "r05-sky-04",
    "region": "sky",
    "ordinal": 4,
    "name": "天空城四钟合鸣",
    "contentRevision": "r5.1",
    "intendedBand": "finale",
    "designIntent": "四棱镜明暗交替并含双锁；选择保留跨区特殊组合，或迁移一个困难落点。",
    "config": {
      "moves": 20,
      "goals": {
        "roots": 4,
        "moss": 5
      },
      "moss": [
        4,
        11,
        24,
        37,
        44
      ],
      "roots": [
        {
          "index": 8,
          "layers": 1
        },
        {
          "index": 12,
          "layers": 1
        },
        {
          "index": 36,
          "layers": 1
        },
        {
          "index": 40,
          "layers": 1
        }
      ],
      "starters": [
        {
          "index": 4,
          "special": "column"
        },
        {
          "index": 22,
          "special": "row"
        },
        {
          "index": 26,
          "special": "bomb"
        },
        {
          "index": 44,
          "special": "row"
        }
      ]
    },
    "rules": {
      "polarityCycle": [
        1,
        0,
        0,
        1
      ],
      "relays": [
        {
          "index": 11,
          "partner": 37,
          "polarity": 1,
          "hits": 1,
          "type": 0
        },
        {
          "index": 36,
          "partner": 12,
          "polarity": 0,
          "hits": 2,
          "type": 5
        },
        {
          "index": 12,
          "partner": 36,
          "polarity": 0,
          "hits": 1,
          "type": 2
        },
        {
          "index": 37,
          "partner": 11,
          "polarity": 1,
          "hits": 2,
          "type": 4
        }
      ]
    },
    "tool": {
      "kind": "prismShift",
      "charges": 1
    },
    "seedBank": [
      1,
      2,
      18
    ],
    "calibration": {
      "witnessActions": [
        13,
        18
      ],
      "minRemaining": 2,
      "meaning": "bounded-policy witness length only; human difficulty unverified"
    }
  }
];
