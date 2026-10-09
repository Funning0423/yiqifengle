function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/* Forest Match v3: pure rules, no timers, DOM, animation, audio or persistence.
 * Turn: swap(a,b) / activate(index) -> nextWave() -> animate its snapshots ->
 * clearWave(plan) -> fall() -> repeat nextWave until empty -> settleDone().
 * A wave is a pure preview. It never clears tiles before clearWave is called.
 * Obstacles are fixed cell overlays. Roots lose at most one layer per wave.
 * moss goals count cleared cells; roots goals count fully removed root cells.
 * Special creation preserves the anchor's ID and type; color orbs do not join
 * ordinary matches. All other specials retain a matchable base color.
 * nextWave() snapshots include goalsBefore/After, goalsDelta, obstacleHits,
 * removed, created, specialTriggered and effect cells. Commit once; stale plans
 * are rejected. fall() reports tile IDs with source/destination cell indexes;
 * negative source indexes are off-board spawn rows. No obstacle falls.
 * Tap a special with activate(index), using one move. bomb(index) is a separate
 * two-charge 3x3 tool that consumes no move. Both queue nextWave().
 * Swaps: line+line=cross; bomb+line=3 rows+3 columns; bomb+bomb=5x5;
 * color+ordinary=partner color; color+special=that color emits the partner
 * effect; color+color=whole board. Tap color selects the most common color.
 * UI should cap a turn at MAX_CASCADES and shuffle() before finalize().
 */
(function (root, factory) {
  var Engine = factory();
  if ((typeof module === "undefined" ? "undefined" : _typeof(module)) === 'object' && module.exports) module.exports = Engine;
  if (root) root.ForestEngine = Engine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIZE = 7,
    CELLS = 49,
    TYPES = 6;
  function roots(indices, layers) {
    return indices.map(function (index) {
      return {
        index: index,
        layers: layers || 1
      };
    });
  }
  var LEVELS = [{
    chapter: 1,
    chapterName: '潮汐灯塔',
    name: '露珠问候',
    description: '收集草莓，学会相邻交换。',
    moves: 22,
    goals: {
      type0: 15
    },
    moss: [],
    roots: []
  }, {
    chapter: 1,
    chapterName: '潮汐灯塔',
    name: '苔径初开',
    description: '在苔藓所在格消除，扫出一条小径。',
    starters: [{
      "index": 3,
      "special": "column"
    }],
    moves: 25,
    goals: {
      moss: 7,
      type5: 10
    },
    moss: [21, 22, 23, 24, 25, 26, 27],
    roots: []
  }, {
    chapter: 1,
    chapterName: '潮汐灯塔',
    name: '浆果野餐',
    description: '收集蓝莓和橡果，再形成一次四连。',
    starters: [{
      "index": 35,
      "special": "row"
    }],
    moves: 29,
    goals: {
      type2: 12,
      type4: 12,
      lines: 1
    },
    moss: [],
    roots: []
  }, {
    chapter: 1,
    chapterName: '潮汐灯塔',
    name: '灯塔引路',
    description: '按亮框顺序点亮三盏灯，再解开岸边根须。',
    hint: '先轻点竖纹奇物点亮第一盏；每波只点一盏，再按亮框走完灯路。',
    beacons: [8, 24, 40],
    starters: [{
      index: 8,
      special: 'column'
    }, {
      index: 38,
      special: 'bomb'
    }],
    moves: 34,
    goals: {
      beacons: 3,
      roots: 7,
      type4: 12
    },
    moss: [],
    roots: roots([8, 12, 16, 24, 32, 36, 40], 1)
  }, {
    chapter: 2,
    chapterName: '风车草甸',
    name: '溪岸花环',
    description: '清理环形苔藓，收集溪岸蓝莓。',
    starters: [{
      "index": 7,
      "special": "row"
    }],
    moves: 31,
    goals: {
      moss: 12,
      type2: 14
    },
    moss: [9, 10, 11, 15, 19, 22, 26, 29, 33, 37, 38, 39],
    roots: []
  }, {
    chapter: 2,
    chapterName: '风车草甸',
    name: '双层树桥',
    description: '树桥两侧的根须要受到两次消除波的冲击。',
    starters: [{
      "index": 24,
      "special": "column"
    }],
    moves: 31,
    goals: {
      roots: 8,
      type0: 14
    },
    moss: [],
    roots: roots([8, 12, 15, 19, 29, 33, 36, 40], 2)
  }, {
    chapter: 2,
    chapterName: '风车草甸',
    name: '萤火对语',
    description: '收集青叶与花朵，形成两颗特殊果实。',
    starters: [{
      "index": 36,
      "special": "row"
    }],
    moves: 34,
    goals: {
      type1: 14,
      type3: 12,
      specials: 2
    },
    moss: [],
    roots: []
  }, {
    chapter: 2,
    chapterName: '风车草甸',
    name: '溪谷之心',
    description: '解开中心根结，再照亮周围苔藓。',
    starters: [{
      "index": 14,
      "special": "bomb"
    }],
    moves: 34,
    goals: {
      moss: 9,
      roots: 5,
      type1: 12
    },
    moss: [16, 17, 18, 23, 24, 25, 30, 31, 32],
    roots: [{
      index: 10,
      layers: 1
    }, {
      index: 22,
      layers: 2
    }, {
      index: 24,
      layers: 3
    }, {
      index: 26,
      layers: 2
    }, {
      index: 38,
      layers: 1
    }]
  }, {
    chapter: 3,
    chapterName: '天空之城',
    name: '月光阶梯',
    description: '沿着月光阶梯清理苔藓和双层根须。',
    starters: [{
      "index": 42,
      "special": "row"
    }],
    moves: 35,
    goals: {
      moss: 13,
      roots: 6,
      type3: 12
    },
    moss: [0, 1, 8, 9, 16, 17, 24, 25, 32, 33, 40, 41, 48],
    roots: roots([2, 10, 18, 30, 38, 46], 2)
  }, {
    chapter: 3,
    chapterName: '天空之城',
    name: '古树结界',
    description: '三层根须围住古树；范围道具能一同击中它们。',
    starters: [{
      "index": 3,
      "special": "bomb"
    }],
    moves: 36,
    goals: {
      roots: 9,
      type4: 16
    },
    moss: [],
    roots: roots([8, 10, 12, 22, 24, 26, 36, 38, 40], 3)
  }, {
    chapter: 3,
    chapterName: '天空之城',
    name: '星屑花园',
    description: '清理四角花园，收集星屑与花瓣。',
    starters: [{
      "index": 21,
      "special": "row"
    }, {
      "index": 27,
      "special": "column"
    }],
    moves: 38,
    goals: {
      moss: 12,
      roots: 4,
      type2: 16,
      type5: 16
    },
    moss: [0, 1, 7, 5, 6, 13, 35, 42, 43, 41, 47, 48],
    roots: roots([8, 12, 36, 40], 2)
  }, {
    chapter: 3,
    chapterName: '天空之城',
    name: '森林的心愿',
    description: '把整座森林的心愿连在一起。',
    starters: [{
      "index": 7,
      "special": "bomb"
    }, {
      "index": 41,
      "special": "column"
    }],
    moves: 42,
    goals: {
      moss: 13,
      roots: 9,
      type0: 18,
      type3: 18
    },
    moss: [3, 10, 17, 21, 22, 23, 24, 25, 26, 27, 31, 38, 45],
    roots: [{
      index: 8,
      layers: 2
    }, {
      index: 12,
      layers: 2
    }, {
      index: 16,
      layers: 2
    }, {
      index: 18,
      layers: 2
    }, {
      index: 24,
      layers: 3
    }, {
      index: 30,
      layers: 2
    }, {
      index: 32,
      layers: 2
    }, {
      index: 36,
      layers: 2
    }, {
      index: 40,
      layers: 2
    }]
  }];
  function validIndex(i) {
    return typeof i === 'number' && isFinite(i) && Math.floor(i) === i && i >= 0 && i < CELLS;
  }
  function copy(obj) {
    var result = {};
    Object.keys(obj).forEach(function (key) {
      result[key] = obj[key];
    });
    return result;
  }
  function snapshot(tile, index) {
    return {
      index: index,
      id: tile.id,
      type: tile.type,
      special: tile.special || null
    };
  }
  function sorted(set) {
    return Array.from(set).sort(function (a, b) {
      return a - b;
    });
  }
  function neighbors(index) {
    var list = [index];
    if (index % SIZE > 0) list.push(index - 1);
    if (index % SIZE < SIZE - 1) list.push(index + 1);
    if (index >= SIZE) list.push(index - SIZE);
    if (index < CELLS - SIZE) list.push(index + SIZE);
    return list;
  }
  function ForestEngine(level, random, customConfig) {
    if (!(this instanceof ForestEngine)) return new ForestEngine(level, random, customConfig);
    this.level = typeof level === 'number' && isFinite(level) ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(level))) : 0;
    this.config = customConfig || LEVELS[this.level];
    this.moves = this.config.moves;
    this.goals = copy(this.config.goals);
    this.initialGoals = copy(this.goals);
    this.goalOrder = Object.freeze(Object.keys(this.initialGoals).filter(function (key) {
      return this.initialGoals[key] > 0;
    }, this));
    // Ordered fixed-cell beacons are optional; old levels/save identities stay unchanged.
    this.beaconRoute = Array.isArray(this.config.beacons) ? this.config.beacons.filter(validIndex).slice() : [];
    // Optional typed routes use the six logical match IDs, never visual atlas IDs.
    // Reject malformed requirements rather than silently turning them into free lights.
    this.beaconTypes = null;
    if (this.config.beaconTypes !== undefined) {
      if (!Array.isArray(this.config.beaconTypes) || !this.beaconRoute.length || !Array.isArray(this.config.beacons) || this.config.beacons.length !== this.beaconRoute.length || this.config.beaconTypes.length !== this.beaconRoute.length || this.config.goals.beacons !== this.beaconRoute.length || !Array.from(this.config.beaconTypes).every(function (type) {
        return Number.isInteger(type) && type >= 0 && type < TYPES;
      })) throw new RangeError('beaconTypes must match a valid route using logical types 0..5.');
      this.beaconTypes = Object.freeze(this.config.beaconTypes.slice());
    }
    this.beaconCursor = 0;
    this.moss = new Set(this.config.moss);
    this.vines = this.moss; // Legacy view alias only; v3 goals use `moss`.
    this.roots = new Map();
    this.config.roots.forEach(function (root) {
      this.roots.set(root.index, root.layers);
    }, this);
    this.board = new Array(CELLS);
    this.score = 0;
    this.bombs = 2;
    this.status = 'playing';
    this.lastShuffle = null;
    this._random = typeof random === 'function' ? random : Math.random;
    this._nextId = 1;
    this._version = 0;
    this._turnActive = false;
    this._pendingPlan = null;
    this._freshBoard();
    // Chapter-provided opening pieces are finite board resources, never inventory grants.
    if (Array.isArray(this.config.starters)) this.config.starters.slice(0, 4).forEach(function (item) {
      if (item && validIndex(item.index) && ForestEngine.SPECIALS.indexOf(item.special) >= 0) this.board[item.index].special = item.special;
    }, this);
  }
  ForestEngine.SIZE = SIZE;
  ForestEngine.TYPES = TYPES;
  ForestEngine.MAX_CASCADES = 40;
  ForestEngine.levels = LEVELS;
  ForestEngine.SPECIALS = ['row', 'column', 'bomb', 'color'];
  ForestEngine.prototype.beaconTarget = function () {
    if (this.beaconCursor >= this.beaconRoute.length) return null;
    return {
      index: this.beaconRoute[this.beaconCursor],
      type: this.beaconTypes ? this.beaconTypes[this.beaconCursor] : null,
      cursor: this.beaconCursor,
      total: this.beaconRoute.length,
      typed: !!this.beaconTypes
    };
  };
  function typedWaveSignature(plan) {
    return JSON.stringify(plan, function (key, value) {
      if (key === 'version' || key === 'applied' || key === 'rewardKind') return undefined;
      return value instanceof Set ? sorted(value) : value;
    });
  }
  ForestEngine.prototype._rand = function (max) {
    var value = Number(this._random());
    if (!isFinite(value)) value = 0.5;
    return Math.floor(Math.max(0, Math.min(0.9999999999999999, value)) * max);
  };
  ForestEngine.prototype._tile = function (type) {
    return {
      id: this._nextId++,
      type: type == null ? this._rand(TYPES) : type,
      special: null
    };
  };
  ForestEngine.prototype._freshBoard = function () {
    for (var attempt = 0; attempt < 16; attempt++) {
      for (var i = 0; i < CELLS; i++) {
        var choices = [];
        for (var t = 0; t < TYPES; t++) {
          if (i % SIZE >= 2 && this.board[i - 1].type === t && this.board[i - 2].type === t) continue;
          if (i >= 2 * SIZE && this.board[i - SIZE].type === t && this.board[i - 2 * SIZE].type === t) continue;
          choices.push(t);
        }
        this.board[i] = this._tile(choices[this._rand(choices.length)]);
      }
      if (this.possibleMoves(true).length) return;
    }
    this._guaranteedBoard();
  };
  ForestEngine.prototype._guaranteedBoard = function () {
    for (var i = 0; i < CELLS; i++) {
      var type = (Math.floor(i / SIZE) + 2 * (i % SIZE)) % TYPES;
      if (!this.board[i]) this.board[i] = this._tile(type);else this.board[i].type = type;
    }
    // Distinct rows/columns, no matches, and swap [1,8] creates 0,0,0.
    this.board[0].type = 0;
    this.board[1].type = 1;
    this.board[2].type = 0;
    this.board[8].type = 0;
    // A color orb at these cells would not join the guaranteed match. It remains
    // directly activatable, which is itself a legal move, and any special swaps.
  };
  ForestEngine.prototype.isAdjacent = function (a, b) {
    return validIndex(a) && validIndex(b) && Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs(a % SIZE - b % SIZE) === 1;
  };
  ForestEngine.prototype._exchange = function (a, b) {
    var tile = this.board[a];
    this.board[a] = this.board[b];
    this.board[b] = tile;
  };
  ForestEngine.prototype._matchData = function () {
    var runs = [],
      found = new Set(),
      board = this.board;
    for (var axis = 0; axis < 2; axis++) for (var line = 0; line < SIZE; line++) {
      var run = [],
        previous = -1;
      for (var p = 0; p <= SIZE; p++) {
        var i = axis === 0 ? line * SIZE + p : p * SIZE + line;
        var tile = p < SIZE ? board[i] : null;
        var type = tile && tile.special !== 'color' ? tile.type : -1;
        if (type < 0 || type !== previous) {
          if (run.length >= 3) {
            runs.push({
              axis: axis === 0 ? 'row' : 'column',
              indices: run.slice(),
              type: previous
            });
            run.forEach(function (cell) {
              found.add(cell);
            });
          }
          run = [];
        }
        if (type >= 0) run.push(i);
        previous = type;
      }
    }
    // Runs only belong to the same group when they share a tile, not merely
    // because two separate matches happen to be orthogonal neighbors.
    var groups = [];
    runs.forEach(function (run) {
      var indexes = new Set(run.indices),
        merged = {
          indices: indexes,
          runs: [run]
        };
      for (var g = groups.length - 1; g >= 0; g--) {
        if (groups[g].runs.some(function (other) {
          return other.indices.some(function (i) {
            return indexes.has(i);
          });
        })) {
          groups[g].indices.forEach(function (i) {
            indexes.add(i);
          });
          merged.runs = merged.runs.concat(groups[g].runs);
          groups.splice(g, 1);
        }
      }
      groups.push(merged);
    });
    return {
      indices: found,
      runs: runs,
      groups: groups
    };
  };
  ForestEngine.prototype.matches = function () {
    return this._matchData().indices;
  };
  ForestEngine.prototype.findMatches = ForestEngine.prototype.matches;
  ForestEngine.prototype._hasMatchAt = function (i) {
    return this.matches().has(i);
  };
  ForestEngine.prototype._canStart = function () {
    return this.status === 'playing' && this.moves > 0 && !this._turnActive && !this._pendingPlan && this.board.every(function (tile) {
      return !!tile;
    }) && !this.matches().size;
  };
  ForestEngine.prototype._area = function (kind, index) {
    var result = new Set(),
      row = Math.floor(index / SIZE),
      col = index % SIZE;
    for (var i = 0; i < CELLS; i++) {
      var r = Math.floor(i / SIZE),
        c = i % SIZE;
      if (kind === 'all' || kind === 'row' && r === row || kind === 'column' && c === col || kind === 'cross' && (r === row || c === col) || kind === 'bomb' && Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1 || kind === 'bigBomb' && Math.abs(r - row) <= 2 && Math.abs(c - col) <= 2 || kind === 'wideCross' && (Math.abs(r - row) <= 1 || Math.abs(c - col) <= 1)) result.add(i);
    }
    return result;
  };
  ForestEngine.prototype._colorType = function () {
    var counts = [0, 0, 0, 0, 0, 0];
    this.board.forEach(function (tile) {
      if (tile && tile.special !== 'color') counts[tile.type]++;
    });
    var best = 0;
    for (var t = 1; t < TYPES; t++) if (counts[t] > counts[best]) best = t;
    return best;
  };
  ForestEngine.prototype._creationPlans = function (data, preferred) {
    var created = [],
      board = this.board;
    data.groups.forEach(function (group) {
      var longest = group.runs.reduce(function (best, run) {
        return run.indices.length > best.indices.length ? run : best;
      }, group.runs[0]);
      var rows = group.runs.filter(function (r) {
        return r.axis === 'row';
      });
      var cols = group.runs.filter(function (r) {
        return r.axis === 'column';
      });
      var special = longest.indices.length >= 5 ? 'color' : rows.length && cols.length ? 'bomb' : longest.indices.length >= 4 ? longest.axis : null;
      if (!special) return;
      var choices = (preferred || []).concat(special === 'bomb' ? sorted(group.indices).filter(function (i) {
        return rows.some(function (r) {
          return r.indices.indexOf(i) !== -1;
        }) && cols.some(function (r) {
          return r.indices.indexOf(i) !== -1;
        });
      }) : [longest.indices[Math.floor(longest.indices.length / 2)]]).concat(sorted(group.indices));
      var anchor = choices.find(function (i) {
        return group.indices.has(i) && board[i] && !board[i].special;
      });
      if (anchor === undefined) return;
      var item = snapshot(board[anchor], anchor);
      item.special = special;
      item.fromSpecial = null;
      created.push(item);
    });
    return created;
  };
  ForestEngine.prototype._buildPlan = function (seed, created, effects, preTriggered, kind, colorTypes) {
    var self = this,
      indexes = new Set(),
      protectedCells = new Set((created || []).map(function (item) {
        return item.index;
      }));
    seed.forEach(function (i) {
      if (validIndex(i)) indexes.add(i);
    });
    effects = (effects || []).slice();
    var triggered = [],
      triggeredCells = new Set();
    (preTriggered || []).forEach(function (i) {
      if (self.board[i] && self.board[i].special && !triggeredCells.has(i)) {
        triggeredCells.add(i);
        triggered.push(snapshot(self.board[i], i));
      }
    });
    // Set iteration observes new entries, allowing deterministic finite chains.
    indexes.forEach(function (i) {
      var tile = self.board[i];
      if (!tile || !tile.special || protectedCells.has(i) || triggeredCells.has(i)) return;
      triggeredCells.add(i);
      triggered.push(snapshot(tile, i));
      var cells;
      if (tile.special === 'color') {
        var target = colorTypes && colorTypes[i] !== undefined ? colorTypes[i] : self._colorType();
        cells = new Set([i]);
        self.board.forEach(function (other, j) {
          if (other && other.type === target) cells.add(j);
        });
        effects.push({
          kind: 'color',
          index: i,
          type: target,
          cells: sorted(cells)
        });
      } else {
        cells = self._area(tile.special, i);
        effects.push({
          kind: tile.special,
          index: i,
          cells: sorted(cells)
        });
      }
      cells.forEach(function (j) {
        indexes.add(j);
      });
    });
    var removed = [];
    sorted(indexes).forEach(function (i) {
      if (self.board[i] && !protectedCells.has(i)) removed.push(snapshot(self.board[i], i));
    });
    var goalsAfter = copy(this.goals),
      obstacleHits = [],
      touchedRoots = new Set(),
      mossRemoved = [],
      rootsRemoved = [];
    function decrement(key, amount) {
      if (Object.prototype.hasOwnProperty.call(goalsAfter, key)) goalsAfter[key] = Math.max(0, goalsAfter[key] - (amount || 1));
    }
    removed.forEach(function (tile) {
      decrement('type' + tile.type);
    });
    (created || []).forEach(function (tile) {
      if (tile.special === 'row' || tile.special === 'column') decrement('lines');
      decrement('specials');
    });
    indexes.forEach(function (i) {
      if (!self.board[i]) return;
      if (self.moss.has(i)) {
        obstacleHits.push({
          kind: 'moss',
          index: i,
          before: 1,
          after: 0,
          removed: true
        });
        mossRemoved.push(i);
        decrement('moss');
      }
      neighbors(i).forEach(function (j) {
        if (self.roots.has(j)) touchedRoots.add(j);
      });
    });
    sorted(touchedRoots).forEach(function (i) {
      var before = self.roots.get(i),
        after = Math.max(0, before - 1);
      obstacleHits.push({
        kind: 'roots',
        index: i,
        before: before,
        after: after,
        removed: after === 0
      });
      if (after === 0) {
        rootsRemoved.push(i);
        decrement('roots');
      }
    });
    // One current beacon per committed wave, never all future cells in a large blast.
    var target = this.beaconTarget();
    // A protected newly-created special is not a removed piece. It cannot fill a
    // typed socket. Untyped legacy lights retain their exact indexed-hit rule.
    var beaconHit = target && (target.typed ? removed.some(function (tile) {
      return tile.index === target.index && tile.type === target.type;
    }) : indexes.has(target.index)) ? target.index : null;
    if (beaconHit !== null) decrement('beacons');
    var goalsDelta = {};
    Object.keys(goalsAfter).forEach(function (key) {
      goalsDelta[key] = self.goals[key] - goalsAfter[key];
    });
    var plan = {
      version: this._version,
      kind: kind || 'match',
      indexes: indexes,
      removed: removed,
      created: created || [],
      specialTriggered: triggered,
      beaconHit: beaconHit,
      beaconCursor: this.beaconCursor,
      effects: effects,
      obstacleHits: obstacleHits,
      mossRemoved: mossRemoved,
      rootsRemoved: rootsRemoved,
      goalsBefore: copy(this.goals),
      goalsAfter: goalsAfter,
      goalsDelta: goalsDelta,
      goalDelta: goalsDelta,
      scoreDelta: removed.length * 10 + mossRemoved.length * 25 + touchedRoots.size * 20 + (created || []).length * 40,
      applied: false
    };
    if (this.beaconTypes) Object.defineProperties(plan, {
      _typedEngine: {
        value: this
      },
      _typedRoute: {
        value: JSON.stringify([this.beaconRoute, this.beaconTypes, this.beaconCursor])
      },
      _typedSignature: {
        value: typedWaveSignature(plan)
      }
    });
    return plan;
  };
  ForestEngine.prototype._matchPlan = function (preferred) {
    var data = this._matchData();
    return this._buildPlan(data.indices, this._creationPlans(data, preferred), [], [], 'match');
  };
  ForestEngine.prototype._specialSwapPlan = function (a, b) {
    var first = this.board[a],
      second = this.board[b],
      sa = first.special,
      sb = second.special,
      self = this;
    var seed = new Set(),
      effects = [],
      pre = [],
      kind = 'special';
    function effect(name, index, cells, type) {
      cells.forEach(function (i) {
        seed.add(i);
      });
      var item = {
        kind: name,
        index: index,
        cells: sorted(cells)
      };
      if (type !== undefined) item.type = type;
      effects.push(item);
    }
    if (sa && sb) {
      pre = [a, b];
      seed.add(a);
      seed.add(b);
      if (sa === 'color' && sb === 'color') {
        kind = 'color+color';
        effect('all', b, this._area('all', b));
      } else if (sa === 'color' || sb === 'color') {
        var colorIndex = sa === 'color' ? a : b,
          partnerIndex = sa === 'color' ? b : a,
          partner = this.board[partnerIndex];
        kind = 'color+' + partner.special;
        var typed = new Set([colorIndex]);
        this.board.forEach(function (tile, i) {
          if (tile && tile.type === partner.type) typed.add(i);
        });
        effect('color', colorIndex, typed, partner.type);
        // Each partner-colored tile emits the partner's effect, without changing
        // any tile IDs or placing temporary specials on the visible board.
        typed.forEach(function (i) {
          if (i !== colorIndex) effect(partner.special, i, self._area(partner.special, i));
        });
      } else if (sa === 'bomb' && sb === 'bomb') {
        kind = 'bomb+bomb';
        effect('bigBomb', b, this._area('bigBomb', b));
      } else if (sa === 'bomb' || sb === 'bomb') {
        kind = 'bomb+line';
        effect('wideCross', b, this._area('wideCross', b));
      } else {
        kind = 'line+line';
        effect('cross', b, this._area('cross', b));
      }
    } else {
      var specialIndex = sa ? a : b,
        partner = sa ? second : first;
      seed.add(specialIndex);
      if (this.board[specialIndex].special === 'color') {
        pre = [specialIndex];
        var same = new Set([specialIndex]);
        this.board.forEach(function (tile, i) {
          if (tile && tile.type === partner.type) same.add(i);
        });
        effect('color', specialIndex, same, partner.type);
        kind = 'color+type';
      }
    }
    return this._buildPlan(seed, [], effects, pre, kind);
  };
  ForestEngine.prototype.planSwap = function (a, b) {
    var result = {
      valid: false,
      a: a,
      b: b,
      wave: null
    };
    if (!this._canStart() || !this.isAdjacent(a, b) || !this.board[a] || !this.board[b]) return result;
    var special = this.board[a].special || this.board[b].special;
    if (!special && this.board[a].type === this.board[b].type) return result;
    result.tiles = [{
      id: this.board[a].id,
      from: a,
      to: b
    }, {
      id: this.board[b].id,
      from: b,
      to: a
    }];
    this._exchange(a, b);
    if (special || this._hasMatchAt(a) || this._hasMatchAt(b)) {
      result.valid = true;
      result.wave = special ? this._specialSwapPlan(a, b) : this._matchPlan([b, a]);
      result.wave.version = this._version + 1;
    }
    this._exchange(a, b);
    return result;
  };
  ForestEngine.prototype.swap = function (a, b) {
    var plan = this.planSwap(a, b);
    if (!plan.valid) return false;
    this._exchange(a, b);
    this.moves--;
    this._version++;
    this._turnActive = true;
    this._pendingPlan = plan.wave;
    return true;
  };
  ForestEngine.prototype.planActivation = function (index) {
    if (!this._canStart() || !validIndex(index) || !this.board[index] || !this.board[index].special) return {
      valid: false,
      index: index,
      wave: null
    };
    var wave = this._buildPlan(new Set([index]), [], [], [], 'activate');
    wave.version = this._version + 1;
    return {
      valid: true,
      index: index,
      wave: wave
    };
  };
  ForestEngine.prototype.activate = function (index) {
    var plan = this.planActivation(index);
    if (!plan.valid) return false;
    this.moves--;
    this._version++;
    this._turnActive = true;
    this._pendingPlan = plan.wave;
    return true;
  };
  // A limited inventory tool, distinct from tapping an earned bomb tile.
  ForestEngine.prototype.planBomb = function (index) {
    if (!this._canStart() || this.bombs <= 0 || !validIndex(index) || !this.board[index]) return {
      valid: false,
      index: index,
      wave: null
    };
    var cells = this._area('bomb', index);
    var wave = this._buildPlan(cells, [], [{
      kind: 'bomb',
      index: index,
      cells: sorted(cells)
    }], [], 'toolBomb');
    wave.version = this._version + 1;
    return {
      valid: true,
      index: index,
      wave: wave
    };
  };
  ForestEngine.prototype.bomb = function (index) {
    var plan = this.planBomb(index);
    if (!plan.valid) return false;
    this.bombs--;
    this._version++;
    this._turnActive = true;
    this._pendingPlan = plan.wave;
    return true;
  };
  // Journey owns these earned, rare charges. The engine only previews and
  // resolves their real board effects; neither moves nor free bombs are spent.
  ForestEngine.prototype.planRewardTool = function (kind, index) {
    var effect = kind === 'windBell' ? 'cross' : kind === 'tideBottle' ? 'bigBomb' : null;
    if (!effect || !this._canStart() || !validIndex(index) || !this.board[index]) return {
      valid: false,
      kind: kind,
      index: index,
      wave: null
    };
    var cells = this._area(effect, index);
    var wave = this._buildPlan(cells, [], [{
      kind: effect,
      index: index,
      cells: sorted(cells),
      rewardKind: kind
    }], [], 'rewardTool');
    wave.rewardKind = kind;
    wave.version = this._version + 1;
    return {
      valid: true,
      kind: kind,
      index: index,
      wave: wave
    };
  };
  ForestEngine.prototype.useRewardTool = function (kind, index) {
    var plan = this.planRewardTool(kind, index);
    if (!plan.valid) return false;
    this._version++;
    this._turnActive = true;
    this._pendingPlan = plan.wave;
    return true;
  };
  // Region inventory belongs to Journey. A preview is bound to this engine and
  // its complete board state, but does not reserve a charge or mutate the turn.
  // Only tideNet is a clearing wave. Seed/shears commit once and leave the UI
  // time to animate before calling settleDone (they must not call clearWave).
  function regionState(engine) {
    return JSON.stringify({
      board: engine.board,
      moss: sorted(engine.moss),
      roots: Array.from(engine.roots).sort(function (a, b) {
        return a[0] - b[0];
      }),
      goals: engine.goals,
      moves: engine.moves,
      bombs: engine.bombs,
      score: engine.score,
      beacons: engine.beaconRoute,
      beaconTypes: engine.beaconTypes,
      cursor: engine.beaconCursor
    });
  }
  function regionSignature(plan) {
    return JSON.stringify(plan, function (key, value) {
      return value instanceof Set ? sorted(value) : value;
    });
  }
  ForestEngine.prototype.planRegionTool = function (kind, index) {
    var mode = kind === 'tideNet' ? 'wave' : kind === 'sunSeed' ? 'seed' : kind === 'starShears' ? 'soften' : null;
    var plan = {
      valid: false,
      kind: kind,
      index: index,
      version: this._version,
      mode: mode,
      cells: [],
      wave: null,
      removed: [],
      created: [],
      specialTriggered: [],
      effects: [],
      obstacleHits: [],
      mossRemoved: [],
      rootsRemoved: [],
      beaconHit: null,
      beaconCursor: this.beaconCursor,
      goalsBefore: copy(this.goals),
      goalsAfter: copy(this.goals),
      goalsDelta: {},
      scoreDelta: 0,
      applied: false
    };
    Object.keys(this.goals).forEach(function (key) {
      plan.goalsDelta[key] = 0;
    });
    plan.goalDelta = plan.goalsDelta;
    if (!mode || !this._canStart() || !validIndex(index) || !this.board[index]) return plan;
    var self = this,
      tile = this.board[index];
    if (kind === 'tideNet') {
      var same = new Set();
      this.board.forEach(function (other, i) {
        if (other && other.type === tile.type) same.add(i);
      });
      var wave = this._buildPlan(same, [], [{
        kind: 'color',
        index: index,
        type: tile.type,
        cells: sorted(same),
        rewardKind: kind
      }], [], 'regionTool');
      wave.rewardKind = kind;
      wave.version = this._version + 1;
      plan.wave = wave;
      plan.cells = sorted(wave.indexes);
      ['removed', 'created', 'specialTriggered', 'effects', 'obstacleHits', 'mossRemoved', 'rootsRemoved', 'beaconHit', 'beaconCursor', 'goalsBefore', 'goalsAfter', 'goalsDelta', 'scoreDelta'].forEach(function (key) {
        plan[key] = wave[key];
      });
      plan.goalDelta = plan.goalsDelta;
    } else if (kind === 'sunSeed') {
      if (tile.special) return plan;
      var created = snapshot(tile, index);
      created.fromSpecial = null;
      created.special = 'column';
      plan.cells = [index];
      plan.created = [created];
    } else {
      this._area('bomb', index).forEach(function (i) {
        if (self.moss.has(i)) {
          plan.obstacleHits.push({
            kind: 'moss',
            index: i,
            before: 1,
            after: 0,
            removed: true
          });
          plan.mossRemoved.push(i);
        }
        if (self.roots.has(i)) {
          var before = self.roots.get(i),
            after = Math.max(0, before - 1);
          plan.obstacleHits.push({
            kind: 'roots',
            index: i,
            before: before,
            after: after,
            removed: after === 0
          });
          if (after === 0) plan.rootsRemoved.push(i);
        }
      });
      if (!plan.obstacleHits.length) return plan;
      plan.cells = sorted(new Set(plan.obstacleHits.map(function (hit) {
        return hit.index;
      })));
      ['moss', 'roots'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(plan.goalsAfter, key)) {
          plan.goalsAfter[key] = Math.max(0, plan.goalsAfter[key] - plan[key + 'Removed'].length);
          plan.goalsDelta[key] = self.goals[key] - plan.goalsAfter[key];
        }
      });
    }
    plan.valid = true;
    plan.changes = {
      removed: plan.removed,
      created: plan.created,
      obstacleHits: plan.obstacleHits
    };
    // Non-enumerable guards keep the public animation snapshot serializable.
    // Checking snapshots also rejects editor mutations that did not bump version.
    Object.defineProperties(plan, {
      _engine: {
        value: this
      },
      _state: {
        value: regionState(this)
      },
      _signature: {
        value: regionSignature(plan)
      }
    });
    return plan;
  };
  // Game validates the exact displayed preview before persisting its charge,
  // then submits that same plan. Validation itself never reserves or commits.
  ForestEngine.prototype.regionPlanValid = function (kind, index, plan) {
    if (!plan || !plan.valid || plan.applied || plan.kind !== kind || plan.index !== index || plan.version !== this._version || plan._engine !== this || !this._canStart()) return false;
    try {
      return plan._state === regionState(this) && plan._signature === regionSignature(plan);
    } catch (error) {
      return false;
    } // Malformed/circular previews are not chargeable.
  };
  ForestEngine.prototype.useRegionTool = function (kind, index, plan) {
    plan = plan || this.planRegionTool(kind, index);
    if (!this.regionPlanValid(kind, index, plan)) return false;
    this._version++;
    this._turnActive = true;
    plan.applied = true;
    if (plan.mode === 'wave') this._pendingPlan = plan.wave;else {
      var self = this;
      plan.created.forEach(function (item) {
        self.board[item.index].special = item.special;
      });
      plan.obstacleHits.forEach(function (hit) {
        if (hit.kind === 'moss') self.moss.delete(hit.index);else if (hit.after === 0) self.roots.delete(hit.index);else self.roots.set(hit.index, hit.after);
      });
      this.goals = copy(plan.goalsAfter);
    }
    return plan;
  };
  ForestEngine.prototype.nextWave = function () {
    if (this._pendingPlan) return this._pendingPlan;
    var plan = this._matchPlan([]);
    if (plan.indexes.size) this._pendingPlan = plan;
    return plan;
  };
  ForestEngine.prototype.clearWave = function (planOrIndexes) {
    if (this.status !== 'playing') return null;
    var plan;
    if (planOrIndexes && planOrIndexes.indexes instanceof Set) plan = planOrIndexes;else if (this._pendingPlan) plan = this._pendingPlan;else if (planOrIndexes && typeof planOrIndexes.forEach === 'function') {
      var data = this._matchData(),
        requested = new Set();
      planOrIndexes.forEach(function (i) {
        if (validIndex(i)) requested.add(i);
      });
      // Legacy clear(matches()) still creates specials. An arbitrary effect set
      // only creates specials for fully included genuine match groups.
      data.groups = data.groups.filter(function (group) {
        return sorted(group.indices).every(function (i) {
          return requested.has(i);
        });
      });
      plan = this._buildPlan(requested, this._creationPlans(data, []), [], [], 'clear');
    } else plan = this.nextWave();
    if (!plan || plan.applied || plan.version !== this._version) return null;
    if (this.beaconTypes || plan._typedEngine) {
      try {
        if (plan._typedEngine !== this || !this.beaconTypes || plan._typedRoute !== JSON.stringify([this.beaconRoute, this.beaconTypes, this.beaconCursor]) || plan._typedSignature !== typedWaveSignature(plan) || JSON.stringify(plan.goalsBefore) !== JSON.stringify(this.goals)) return null;
      } catch (error) {
        return null;
      }
    }
    // Verify snapshots as well as version, so external test/editor changes or
    // accidentally reused previews cannot silently clear the wrong tile IDs.
    var expected = plan.removed.concat(plan.created),
      self = this;
    if (expected.some(function (item) {
      return !self.board[item.index] || self.board[item.index].id !== item.id || self.beaconTypes && self.board[item.index].type !== item.type;
    })) return null;
    plan.removed.forEach(function (item) {
      self.board[item.index] = null;
    });
    plan.created.forEach(function (item) {
      self.board[item.index].special = item.special;
    });
    plan.obstacleHits.forEach(function (hit) {
      if (hit.kind === 'moss') self.moss.delete(hit.index);else if (hit.after === 0) self.roots.delete(hit.index);else self.roots.set(hit.index, hit.after);
    });
    if (plan.beaconHit !== null && plan.beaconHit !== undefined) this.beaconCursor++;
    this.goals = copy(plan.goalsAfter);
    this.score += plan.scoreDelta;
    plan.applied = true;
    this._pendingPlan = null;
    this._version++;
    return plan;
  };
  ForestEngine.prototype.clear = function (indexes) {
    var result = this.clearWave(indexes),
      removed = result ? result.removed.slice() : [];
    removed.created = result ? result.created : [];
    removed.specialTriggered = result ? result.specialTriggered : [];
    removed.obstacleHits = result ? result.obstacleHits : [];
    removed.vinesRemoved = result ? result.mossRemoved : [];
    removed.mossRemoved = result ? result.mossRemoved : [];
    removed.rootsRemoved = result ? result.rootsRemoved : [];
    return removed;
  };
  ForestEngine.prototype.fall = function () {
    var changes = {
      moved: [],
      spawned: []
    };
    if (this.status !== 'playing' || this._pendingPlan) return changes;
    for (var col = 0; col < SIZE; col++) {
      var write = SIZE - 1;
      for (var row = SIZE - 1; row >= 0; row--) {
        var from = row * SIZE + col,
          tile = this.board[from];
        if (!tile) continue;
        var to = write * SIZE + col;
        if (from !== to) {
          this.board[to] = tile;
          this.board[from] = null;
          changes.moved.push({
            id: tile.id,
            type: tile.type,
            special: tile.special,
            from: from,
            to: to
          });
        }
        write--;
      }
      var spawnRow = -1;
      while (write >= 0) {
        var index = write * SIZE + col,
          fresh = this._tile();
        this.board[index] = fresh;
        changes.spawned.push({
          id: fresh.id,
          type: fresh.type,
          special: fresh.special,
          from: spawnRow * SIZE + col,
          to: index
        });
        write--;
        spawnRow--;
      }
    }
    if (changes.moved.length || changes.spawned.length) this._version++;
    return changes;
  };
  ForestEngine.prototype.collapse = ForestEngine.prototype.fall;
  ForestEngine.prototype.possibleMoves = function (firstOnly) {
    var available = [];
    for (var a = 0; a < CELLS; a++) {
      if (!this.board[a]) continue;
      var near = [];
      if (a % SIZE < SIZE - 1) near.push(a + 1);
      if (a < CELLS - SIZE) near.push(a + SIZE);
      for (var n = 0; n < near.length; n++) {
        var b = near[n];
        if (!this.board[b]) continue;
        if (this.board[a].special || this.board[b].special) {
          available.push([a, b]);
          if (firstOnly) return available;
          continue;
        }
        if (this.board[a].type === this.board[b].type) continue;
        this._exchange(a, b);
        var matched = this._hasMatchAt(a) || this._hasMatchAt(b);
        this._exchange(a, b);
        if (matched) {
          available.push([a, b]);
          if (firstOnly) return available;
        }
      }
    }
    return available;
  };
  ForestEngine.prototype.firstMove = function () {
    return this.possibleMoves(true)[0] || null;
  };
  // Read-only, once-per-request planning. A directly reachable current lamp wins
  // over score farming; otherwise help remaining goals, with stable tie-breaking.
  ForestEngine.prototype.hintMove = function () {
    if (!this._canStart()) return null;
    var cached = this._hintCache;
    if (cached && cached.version === this._version) return cached.tip ? {
      cells: cached.tip.cells.slice(),
      beacon: cached.tip.beacon
    } : null;
    var self = this,
      best = null;
    function consider(cells, wave) {
      var score = wave.beaconHit !== null && wave.beaconHit !== undefined ? 10000 : 0;
      Object.keys(wave.goalsDelta).forEach(function (key) {
        score += wave.goalsDelta[key] * (key === 'roots' ? 8 : key === 'moss' ? 5 : key === 'lines' || key === 'specials' ? 10 : 1);
      });
      score += wave.removed.length * .01;
      if (!best || score > best.score) best = {
        cells: cells,
        score: score,
        beacon: wave.beaconHit !== null && wave.beaconHit !== undefined
      };
    }
    this.possibleMoves().forEach(function (cells) {
      var plan = self.planSwap(cells[0], cells[1]);
      if (plan.valid) consider(cells, plan.wave);
    });
    this.possibleActivations().forEach(function (index) {
      var plan = self.planActivation(index);
      if (plan.valid) consider([index], plan.wave);
    });
    var tip = best ? {
      cells: best.cells.slice(),
      beacon: best.beacon
    } : null;
    this._hintCache = {
      version: this._version,
      tip: tip
    };
    return tip ? {
      cells: tip.cells.slice(),
      beacon: tip.beacon
    } : null;
  };
  ForestEngine.prototype.possibleActivations = function () {
    var result = [];
    this.board.forEach(function (tile, i) {
      if (tile && tile.special) result.push(i);
    });
    return result;
  };
  ForestEngine.prototype.shuffle = function () {
    var report = {
      regenerated: false,
      attempts: 0,
      moved: [],
      recolored: []
    };
    if (this.status !== 'playing') return report;
    var old = new Map();
    this.board.forEach(function (tile, i) {
      if (tile) old.set(tile.id, {
        index: i,
        type: tile.type
      });
    });
    for (var i = 0; i < CELLS; i++) if (!this.board[i]) this.board[i] = this._tile();
    for (var attempt = 0; attempt < 96; attempt++) {
      for (var j = CELLS - 1; j > 0; j--) this._exchange(j, this._rand(j + 1));
      report.attempts++;
      if (!this.matches().size && this.possibleMoves(true).length) break;
    }
    if (this.matches().size || !this.possibleMoves(true).length) {
      this._guaranteedBoard();
      report.regenerated = true;
    }
    this.board.forEach(function (tile, to) {
      var previous = old.get(tile.id);
      if (previous && previous.index !== to) report.moved.push({
        id: tile.id,
        from: previous.index,
        to: to,
        type: tile.type,
        special: tile.special
      });
      if (previous && previous.type !== tile.type) report.recolored.push({
        id: tile.id,
        index: to,
        fromType: previous.type,
        type: tile.type
      });
    });
    this._pendingPlan = null;
    this._turnActive = false;
    this._version++;
    this.lastShuffle = report;
    return report;
  };
  ForestEngine.prototype.settleDone = function () {
    if (this.status !== 'playing') return this.status;
    if (this._pendingPlan || this.board.some(function (tile) {
      return !tile;
    }) || this.matches().size) return this.status;
    this._turnActive = false;
    var self = this;
    if (Object.keys(this.goals).every(function (key) {
      return self.goals[key] <= 0;
    })) this.status = 'won';else if (this.moves <= 0) this.status = 'lost';else if (!this.possibleMoves(true).length) this.shuffle();
    return this.status;
  };
  ForestEngine.prototype.finalize = ForestEngine.prototype.settleDone;
  return ForestEngine;
});
