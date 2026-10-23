/*
 * searches.js
 * -----------
 * Seven search strategies for the 8-puzzle, each written out in full so the
 * code reads like the textbook pseudocode:
 *
 *   depthFirst          (DFS)    <- assigned algorithm, No. 2
 *   breadthFirst        (BFS)
 *   depthLimited        (DLS)
 *   iterativeDeepening  (IDDLS)
 *   uniformCost         (UCS)
 *   greedyBestFirst     (GBFS)
 *   aStar               (A*)
 *
 * While a search runs, a Recorder stores a snapshot of every expansion
 * (node, parent, children, open list, closed list, counters) so the page can
 * replay the search one step at a time.
 *
 * Bowri Setty Jaswanth · 24BDS0071
 */
var Searches = (function () {
  "use strict";

  var P = typeof EightPuzzle !== "undefined" ? EightPuzzle : require("./board.js");
  var F = typeof Frontier !== "undefined" ? Frontier : require("./frontier.js");

  var APPROX_BYTES_PER_NODE = 150;
  var PEEK = 7;

  var INFO = {
    dfs: { label: "DFS", title: "Depth First Search", family: "Uninformed", mine: true },
    bfs: { label: "BFS", title: "Breadth First Search", family: "Uninformed" },
    dls: { label: "DLS", title: "Depth Limited Search", family: "Uninformed" },
    iddls: { label: "IDDLS", title: "Iterative Deepening DLS", family: "Uninformed" },
    ucs: { label: "UCS", title: "Uniform Cost Search", family: "Uninformed" },
    gbfs: { label: "GBFS", title: "Greedy Best First Search", family: "Informed" },
    astar: { label: "A*", title: "A* Search", family: "Informed" },
  };

  var clock = function () {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  /* ------------------------------ nodes ------------------------------ */

  var counter = 0;
  function Node(board, parent, move, g, h) {
    this.board = board;
    this.parent = parent;
    this.move = move;
    this.g = g;
    this.h = h;
    this.depth = parent ? parent.depth + 1 : 0;
    this.seq = counter++;
  }

  function lite(n) {
    return { board: n.board, g: n.g, h: n.h, f: n.g + n.h, depth: n.depth, move: n.move };
  }

  function pathTo(node) {
    var boards = [];
    var moves = [];
    for (var n = node; n; n = n.parent) {
      boards.push(n.board);
      if (n.move) moves.push(n.move);
    }
    return { boards: boards.reverse(), moves: moves.reverse() };
  }

  /* ---------------------------- recorder ----------------------------- */

  function Recorder(key, problem, cfg) {
    this.key = key;
    this.problem = problem;
    this.cfg = cfg;
    this.steps = [];
    this.stepsTotal = 0;
    this.generated = 1;
    this.expanded = 0;
    this.deepest = 0;
    this.peakStored = 1;
    this.lastDepth = -1;
    this.recentClosed = [];
    this.started = clock();
  }

  Recorder.prototype.wants = function () {
    return this.steps.length < this.cfg.traceLimit;
  };

  Recorder.prototype.expanding = function (node) {
    this.expanded++;
    if (node.depth > this.deepest) this.deepest = node.depth;
    this.recentClosed.unshift(node.board);
    if (this.recentClosed.length > PEEK) this.recentClosed.pop();
  };

  Recorder.prototype.stored = function (n) {
    if (n > this.peakStored) this.peakStored = n;
  };

  Recorder.prototype.snap = function (type, node, children, open, closedSize, extra) {
    this.stepsTotal++;
    var backtrack = this.lastDepth >= 0 && node.depth <= this.lastDepth && type === "expand";
    var from = this.lastDepth;
    if (type === "expand") this.lastDepth = node.depth;
    if (!this.wants()) return;
    var s = {
      type: type,
      node: lite(node),
      parent: node.parent ? node.parent.board : null,
      children: children,
      openSize: open.size,
      openPeek: open.peek(PEEK).map(lite),
      closedSize: closedSize,
      closedPeek: this.recentClosed.slice(),
      generated: this.generated,
      expanded: this.expanded,
      deepest: this.deepest,
      backtrack: backtrack,
      backtrackFrom: backtrack ? from : null,
    };
    if (extra) for (var k in extra) s[k] = extra[k];
    this.steps.push(s);
  };

  Recorder.prototype.done = function (goalNode, why) {
    var p = goalNode ? pathTo(goalNode) : { boards: [], moves: [] };
    var ms = clock() - this.started;
    return {
      key: this.key,
      label: INFO[this.key].label,
      title: INFO[this.key].title,
      found: !!goalNode,
      why: why || (goalNode ? "Goal reached" : "Every reachable state was explored"),
      boards: p.boards,
      moves: p.moves,
      cost: goalNode ? goalNode.g : null,
      generated: this.generated,
      expanded: this.expanded,
      deepest: this.deepest,
      ms: ms,
      peakStored: this.peakStored,
      kb: (this.peakStored * APPROX_BYTES_PER_NODE) / 1024,
      steps: this.steps,
      stepsTotal: this.stepsTotal,
      heuristic: this.cfg.heuristicUsed ? this.cfg.heuristic : null,
      cfg: this.cfg,
    };
  };

  function limitMessage(cfg) {
    return "Stopped after " + cfg.maxExpansions.toLocaleString("en-US") + " expansions (safety limit)";
  }

  /* ===================================================================
   * 2. DEPTH FIRST SEARCH (assigned)
   *    Open list : LIFO stack, so the newest (deepest) node is expanded first.
   *    Closed list: boards already expanded; a popped board that is already
   *                 closed is skipped. A board can sit in the stack more than
   *                 once; the copy pushed last is the one DFS reaches first.
   * =================================================================== */
  function depthFirst(problem, cfg) {
    var rec = new Recorder("dfs", problem, cfg);
    var open = new F.Stack();
    var closed = new Set();
    var everPushed = new Set([problem.start]);
    open.add(new Node(problem.start, null, null, 0, 0));

    while (open.size > 0) {
      var node = open.take();
      if (closed.has(node.board)) continue; // an older duplicate copy

      if (node.board === problem.goal) {
        rec.snap("goal", node, [], open, closed.size);
        return rec.done(node);
      }
      if (rec.expanded >= cfg.maxExpansions) return rec.done(null, limitMessage(cfg));

      closed.add(node.board);
      rec.expanding(node);

      var children = [];
      var toPush = [];
      P.expand(node.board, problem.order).forEach(function (s) {
        rec.generated++;
        var tag;
        if (closed.has(s.board)) tag = "already expanded";
        else {
          tag = everPushed.has(s.board) ? "pushed again" : "pushed";
          everPushed.add(s.board);
          toPush.push(new Node(s.board, node, s.move, node.g + 1, 0));
        }
        if (rec.wants()) children.push({ board: s.board, move: s.move, g: node.g + 1, h: 0, f: node.g + 1, tag: tag });
      });
      // Push in reverse so the FIRST move in the chosen order is popped first.
      for (var i = toPush.length - 1; i >= 0; i--) open.add(toPush[i]);

      rec.stored(open.size + closed.size);
      rec.snap("expand", node, children, open, closed.size);
    }
    return rec.done(null);
  }

  /* ===================================================================
   * 1. BREADTH FIRST SEARCH
   *    Open list: FIFO queue. A board is recorded as "seen" when it is added,
   *    so it never enters the queue twice.
   * =================================================================== */
  function breadthFirst(problem, cfg) {
    var rec = new Recorder("bfs", problem, cfg);
    var open = new F.Queue();
    var seen = new Set([problem.start]);
    var closedCount = 0;
    open.add(new Node(problem.start, null, null, 0, 0));

    while (open.size > 0) {
      var node = open.take();
      if (node.board === problem.goal) {
        rec.snap("goal", node, [], open, closedCount);
        return rec.done(node);
      }
      if (rec.expanded >= cfg.maxExpansions) return rec.done(null, limitMessage(cfg));
      closedCount++;
      rec.expanding(node);

      var children = [];
      P.expand(node.board, problem.order).forEach(function (s) {
        rec.generated++;
        var tag = seen.has(s.board) ? "already seen" : "enqueued";
        if (tag === "enqueued") {
          seen.add(s.board);
          open.add(new Node(s.board, node, s.move, node.g + 1, 0));
        }
        if (rec.wants()) children.push({ board: s.board, move: s.move, g: node.g + 1, h: 0, f: node.g + 1, tag: tag });
      });
      rec.stored(seen.size);
      rec.snap("expand", node, children, open, closedCount);
    }
    return rec.done(null);
  }

  /* ===================================================================
   * 3. DEPTH LIMITED SEARCH (one pass)
   *    DFS that refuses to expand nodes at depth >= limit. It remembers the
   *    shallowest depth each board was reached at and only revisits a board
   *    when it is reached higher up the tree, so it stays complete within the
   *    limit without exponential repetition.
   * =================================================================== */
  function dlsPass(rec, problem, cfg, limit) {
    var open = new F.Stack();
    var best = new Map([[problem.start, 0]]);
    var cutoff = false;
    open.add(new Node(problem.start, null, null, 0, 0));

    while (open.size > 0) {
      var node = open.take();
      if (best.get(node.board) < node.depth) continue; // reached higher up later

      if (node.board === problem.goal) {
        rec.snap("goal", node, [], open, best.size, { limit: limit });
        return { goal: node };
      }
      if (node.depth >= limit) {
        cutoff = true;
        continue;
      }
      if (rec.expanded >= cfg.maxExpansions) return { aborted: true };
      rec.expanding(node);

      var children = [];
      var toPush = [];
      P.expand(node.board, problem.order).forEach(function (s) {
        rec.generated++;
        var d = node.depth + 1;
        var tag;
        if (best.has(s.board) && best.get(s.board) <= d) tag = "already reached";
        else {
          tag = "pushed";
          best.set(s.board, d);
          toPush.push(new Node(s.board, node, s.move, d, 0));
        }
        if (rec.wants()) children.push({ board: s.board, move: s.move, g: d, h: 0, f: d, tag: tag });
      });
      for (var i = toPush.length - 1; i >= 0; i--) open.add(toPush[i]);
      rec.stored(open.size + best.size);
      rec.snap("expand", node, children, open, best.size, { limit: limit });
    }
    return { goal: null, cutoff: cutoff };
  }

  function depthLimited(problem, cfg) {
    var rec = new Recorder("dls", problem, cfg);
    var r = dlsPass(rec, problem, cfg, cfg.depthLimit);
    if (r.goal) return rec.done(r.goal);
    if (r.aborted) return rec.done(null, limitMessage(cfg));
    return rec.done(null, r.cutoff ? "Cutoff: no solution within depth limit " + cfg.depthLimit : "Every reachable state was explored");
  }

  /* ===================================================================
   * 4. ITERATIVE DEEPENING DEPTH LIMITED SEARCH
   *    Run DLS with limit 0, 1, 2, ... until it succeeds.
   * =================================================================== */
  function iterativeDeepening(problem, cfg) {
    var rec = new Recorder("iddls", problem, cfg);
    for (var limit = 0; limit <= cfg.maxDepth; limit++) {
      rec.lastDepth = -1;
      var r = dlsPass(rec, problem, cfg, limit);
      if (r.goal) {
        var out = rec.done(r.goal);
        out.solvedAtLimit = limit;
        return out;
      }
      if (r.aborted) return rec.done(null, limitMessage(cfg));
      if (!r.cutoff) return rec.done(null, "Every reachable state was explored");
    }
    return rec.done(null, "No solution up to depth " + cfg.maxDepth);
  }

  /* ===================================================================
   * 5-7. BEST-FIRST FAMILY: UCS (g), GBFS (h), A* (g + h)
   *    Open list: priority queue. UCS and A* re-queue a board when a cheaper
   *    path to it turns up; stale queue entries are skipped when popped.
   * =================================================================== */
  function bestFirst(key, score, problem, cfg) {
    var rec = new Recorder(key, problem, cfg);
    var hFn = key === "ucs" ? null : P.HEURISTICS[cfg.heuristic].fn;
    var h = function (b) {
      return hFn ? hFn(b, problem.goal) : 0;
    };
    var open = new F.PriorityQueue(function (a, b) {
      var sa = score(a);
      var sb = score(b);
      if (sa !== sb) return sa < sb;
      if (a.h !== b.h) return a.h < b.h;
      return a.seq < b.seq;
    });
    var reopen = key !== "gbfs";
    var bestG = new Map([[problem.start, 0]]);
    var closed = new Set();
    open.add(new Node(problem.start, null, null, 0, h(problem.start)));

    while (open.size > 0) {
      var node = open.take();
      if (closed.has(node.board) || bestG.get(node.board) < node.g) continue;

      if (node.board === problem.goal) {
        rec.snap("goal", node, [], open, closed.size);
        return rec.done(node);
      }
      if (rec.expanded >= cfg.maxExpansions) return rec.done(null, limitMessage(cfg));
      closed.add(node.board);
      rec.expanding(node);

      var children = [];
      P.expand(node.board, problem.order).forEach(function (s) {
        rec.generated++;
        var g = node.g + 1;
        var hv = h(s.board);
        var tag;
        if (closed.has(s.board)) tag = "already expanded";
        else if (bestG.has(s.board) && (!reopen || bestG.get(s.board) <= g)) tag = "already queued";
        else {
          tag = bestG.has(s.board) ? "cheaper path" : "queued";
          bestG.set(s.board, g);
          open.add(new Node(s.board, node, s.move, g, hv));
        }
        if (rec.wants()) children.push({ board: s.board, move: s.move, g: g, h: hv, f: g + hv, tag: tag });
      });
      rec.stored(open.size + closed.size);
      rec.snap("expand", node, children, open, closed.size);
    }
    return rec.done(null);
  }

  function uniformCost(problem, cfg) {
    return bestFirst("ucs", function (n) { return n.g; }, problem, cfg);
  }
  function greedyBestFirst(problem, cfg) {
    return bestFirst("gbfs", function (n) { return n.h; }, problem, cfg);
  }
  function aStar(problem, cfg) {
    return bestFirst("astar", function (n) { return n.g + n.h; }, problem, cfg);
  }

  /* ------------------------------ entry point ------------------------------ */

  var RUNNERS = {
    dfs: depthFirst,
    bfs: breadthFirst,
    dls: depthLimited,
    iddls: iterativeDeepening,
    ucs: uniformCost,
    gbfs: greedyBestFirst,
    astar: aStar,
  };

  /**
   * run("dfs", "283164705", "123804765", { moveOrder: "UDLR" })
   * Options: moveOrder, heuristic, depthLimit, maxDepth, maxExpansions, traceLimit.
   */
  function run(key, start, goal, options) {
    var o = options || {};
    var deep = key === "dls" || key === "iddls";
    var cfg = {
      moveOrder: o.moveOrder || "UDLR",
      heuristic: o.heuristic || "manhattan",
      heuristicUsed: key === "gbfs" || key === "astar",
      depthLimit: o.depthLimit !== undefined ? o.depthLimit : 20,
      maxDepth: o.maxDepth || 31,
      maxExpansions: o.maxExpansions || (deep ? 3000000 : 250000),
      traceLimit: o.traceLimit !== undefined ? o.traceLimit : 2500,
    };
    if (!RUNNERS[key]) throw new Error("Unknown algorithm: " + key);
    var problem = { start: start, goal: goal, order: P.MOVE_ORDERS[cfg.moveOrder] || P.MOVE_ORDERS.UDLR };

    if (!P.reachable(start, goal)) {
      var rec = new Recorder(key, problem, cfg);
      var out = rec.done(null, "Unsolvable: the two boards have different inversion parity");
      out.unsolvable = true;
      out.generated = 0;
      return out;
    }
    return RUNNERS[key](problem, cfg);
  }

  return { INFO: INFO, run: run, APPROX_BYTES_PER_NODE: APPROX_BYTES_PER_NODE };
})();

if (typeof module !== "undefined") module.exports = Searches;
