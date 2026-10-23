/*
 * ui.js — everything the user sees and clicks.
 *   Views     : hash router for the four pages
 *   TileBoard : animated 3x3 board
 *   Engine    : runs searches in a Web Worker (falls back to the main thread)
 *   Player    : the Visualizer page — playback of a recorded search
 *   Bench     : the Benchmark page
 *   Theory    : the Theory page
 *   Demo      : the small animation on the Overview page
 *
 * Bowri Setty Jaswanth · 24BDS0071
 */
(function () {
  "use strict";

  var P = EightPuzzle;
  var byId = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var num = function (v) { return v === null || v === undefined ? "–" : Number(v).toLocaleString("en-US"); };
  var ms = function (t) { return t < 1 ? t.toFixed(2) + " ms" : t < 1000 ? t.toFixed(1) + " ms" : (t / 1000).toFixed(2) + " s"; };
  var kb = function (k) { return k < 1024 ? k.toFixed(1) + " KB" : (k / 1024).toFixed(2) + " MB"; };
  var memWord = function (k) { return k < 100 ? "Low" : k < 2048 ? "Medium" : "High"; };
  var STACKY = { dfs: 1, dls: 1, iddls: 1 };

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { /* storage blocked: ignore */ }
    return null;
  }

  /** Static thumbnail of a board. */
  function thumb(board, goal, big) {
    var out = '<div class="thumb' + (big ? " thumb-lg" : "") + '">';
    for (var i = 0; i < 9; i++) {
      var c = board[i];
      if (c === "0") out += '<i class="o"></i>';
      else out += '<i class="' + (goal && goal[i] === c ? "k" : "") + '">' + c + "</i>";
    }
    return out + "</div>";
  }

  /* =============================== TileBoard =============================== */
  function TileBoard(el) {
    this.el = el;
    this.cells = {};
    el.innerHTML = "";
    for (var d = 0; d <= 8; d++) {
      var c = document.createElement("div");
      c.className = "cell " + (d === 0 ? "hole" : "num");
      if (d) c.textContent = d;
      el.appendChild(c);
      this.cells[String(d)] = c;
    }
  }
  TileBoard.prototype.draw = function (board, goal) {
    for (var i = 0; i < 9; i++) {
      var cell = this.cells[board[i]];
      cell.style.setProperty("--x", i % 3);
      cell.style.setProperty("--y", Math.floor(i / 3));
      if (board[i] !== "0") cell.classList.toggle("hit", !!goal && goal[i] === board[i]);
    }
    this.el.classList.toggle("solved", !!goal && board === goal);
  };
  TileBoard.prototype.speed = function (t) {
    this.el.style.setProperty("--speed", t + "ms");
  };

  /* ================================ Engine ================================ */
  function Engine() {
    this.worker = null;
    this.dead = false;
    this.ticket = 0;
    this.waiting = {};
  }
  Engine.prototype.local = function (job) {
    setTimeout(function () {
      try { job.ok(Searches.run(job.key, job.start, job.goal, job.options)); }
      catch (e) { job.fail(e); }
    }, 25);
  };
  Engine.prototype.boot = function () {
    var self = this;
    try {
      this.worker = new Worker("js/worker.js");
      this.worker.onmessage = function (e) {
        var job = self.waiting[e.data.ticket];
        if (!job) return;
        delete self.waiting[e.data.ticket];
        if (e.data.error) job.fail(new Error(e.data.error));
        else job.ok(e.data.result);
      };
      this.worker.onerror = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        self.dead = true;
        self.worker = null;
        var jobs = Object.keys(self.waiting).map(function (k) { return self.waiting[k]; });
        self.waiting = {};
        jobs.forEach(function (j) { self.local(j); });
      };
    } catch (e) {
      this.dead = true;
      this.worker = null;
    }
  };
  Engine.prototype.run = function (key, start, goal, options) {
    var self = this;
    return new Promise(function (ok, fail) {
      var job = { key: key, start: start, goal: goal, options: options, ok: ok, fail: fail };
      if (!self.worker && !self.dead) self.boot();
      if (!self.worker) return self.local(job);
      var t = ++self.ticket;
      self.waiting[t] = job;
      self.worker.postMessage({ ticket: t, key: key, start: start, goal: goal, options: options });
    });
  };
  Engine.prototype.stop = function () {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    var w = this.waiting;
    this.waiting = {};
    Object.keys(w).forEach(function (k) { w[k].fail(new Error("stopped")); });
  };

  /* ================================= Views ================================= */
  var VIEWS = ["overview", "visualizer", "benchmark", "theory"];
  var Views = {
    current: "overview",
    go: function () {
      var want = (location.hash || "#overview").slice(1);
      var v = VIEWS.indexOf(want) >= 0 ? want : "overview";
      Views.current = v;
      VIEWS.forEach(function (x) { byId("view-" + x).hidden = x !== v; });
      all(".rail-nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-view") === v); });
      window.scrollTo(0, 0);
      Demo.active(v === "overview");
      if (v === "benchmark") Bench.opened();
    },
  };

  byId("modeBtn").addEventListener("click", function () {
    var root = document.documentElement;
    var next = root.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-bs-theme", next);
    store("lab-mode", next);
  });

  /* ================================= Demo ================================= */
  var Demo = (function () {
    var start = "283164705";
    var goal = "123804765";
    var tb = new TileBoard(byId("demoBoard"));
    tb.speed(320);
    tb.draw(start, goal);
    var steps = Searches.run("dfs", start, goal, { traceLimit: 40, maxExpansions: 40 }).steps;
    var deepest = Math.max.apply(null, steps.map(function (s) { return s.node.depth; })) || 1;
    var i = 0;
    var timer = null;
    function tick() {
      var s = steps[i];
      tb.draw(s.node.board, goal);
      byId("demoDepth").textContent = "depth " + s.node.depth;
      byId("demoMeter").style.width = (s.node.depth / deepest) * 100 + "%";
      byId("demoText").textContent = "expansion " + s.expanded + " · stack holds " + s.openSize + (s.backtrack ? " · backtracked" : "");
      i = (i + 1) % steps.length;
      timer = setTimeout(tick, i === 0 ? 1800 : 650);
    }
    return {
      active: function (on) {
        clearTimeout(timer);
        if (on) timer = setTimeout(tick, 600);
      },
    };
  })();

  /* ================================= Player ================================= */
  var DELAYS = [1500, 1100, 800, 600, 450, 330, 240, 170, 110, 60, 25, 5];
  var BLURBS = {
    dfs: "Stack (LIFO). DFS always continues from the newest state, so it dives deep and backtracks only when a branch is used up. Expect a very long, non-optimal path. Try changing the move order.",
    bfs: "Queue (FIFO). Expands every state at depth d before depth d + 1, so the first solution is the shortest.",
    dls: "DFS that never expands nodes at the depth limit l. If the solution needs more than l moves, it reports a cutoff.",
    iddls: "Runs DLS with l = 0, 1, 2, … until the goal appears. Optimal, but deep puzzles take a few seconds.",
    ucs: "Priority queue on g(n). With unit move costs it expands in the same order as BFS.",
    gbfs: "Priority queue on h(n). Rushes towards boards that look close to the goal; fast but not optimal.",
    astar: "Priority queue on f(n) = g(n) + h(n). Optimal with an admissible heuristic.",
  };

  var Player = (function () {
    var engine = new Engine();
    var now = new TileBoard(byId("boardNow"));
    var startB = new TileBoard(byId("boardStart"));
    var goalB = new TileBoard(byId("boardGoal"));
    var S = { start: null, goal: null, res: null, n: 0, total: 0, at: -1, playing: false, busy: false, timer: null, ticket: 0, optimal: null, reported: false, profileMax: 1 };

    var algo = function () { return byId("pickAlgo").value; };
    var delay = function () { return DELAYS[Number(byId("tSpeed").value) - 1]; };

    function say(msg, good) {
      var m = byId("setupMsg");
      m.hidden = !msg;
      m.textContent = msg || "";
      m.classList.toggle("ok", !!good);
    }

    function readBoards() {
      try {
        S.start = P.read(byId("inStart").value);
        S.goal = P.read(byId("inGoal").value);
      } catch (e) {
        say(e.message);
        return false;
      }
      startB.draw(S.start, S.goal);
      goalB.draw(S.goal, null);
      if (!S.res) now.draw(S.start, S.goal);
      if (!P.reachable(S.start, S.goal)) {
        say("Unsolvable: inversion count is " + P.inversionCount(S.start) + " for the initial state and " + P.inversionCount(S.goal) + " for the goal. Different parity means no sequence of moves connects them.");
      } else say("");
      return true;
    }

    function syncOptions() {
      var a = algo();
      byId("optHeur").hidden = !(a === "gbfs" || a === "astar");
      byId("optOrder").hidden = a === "gbfs" || a === "astar";
      byId("optLimit").hidden = a !== "dls";
      byId("optMax").hidden = a !== "iddls";
      byId("algoBlurb").textContent = BLURBS[a];
      byId("cOpenLbl").textContent = STACKY[a] ? "Open list (stack)" : a === "bfs" ? "Open list (queue)" : "Open list (priority q.)";
      byId("openTitle").textContent = STACKY[a] ? "Open list · top of stack first" : a === "bfs" ? "Open list · front of queue first" : "Open list · best priority first";
      document.querySelector(".chip-h").classList.toggle("off", !(a === "gbfs" || a === "astar"));
    }

    function buttons() {
      var has = !!S.res && !S.res.unsolvable && S.total > 0;
      var end = has && S.at >= S.total - 1;
      byId("tRun").disabled = S.busy;
      byId("tRun").textContent = S.busy ? "Searching…" : S.res ? "Run again" : "Run";
      byId("tPause").disabled = !S.playing;
      byId("tResume").disabled = !has || S.playing || end;
      byId("tBack").disabled = !has || S.at < 0;
      byId("tFwd").disabled = !has || end;
      byId("tToPath").disabled = !has || !S.res.found || S.at >= S.n;
      byId("tToEnd").disabled = !has || S.at === S.n - 1;
    }

    function phase(text, kind) {
      var p = byId("phase");
      p.textContent = text;
      p.className = "tag tag-" + kind;
    }

    function halt() {
      S.playing = false;
      clearTimeout(S.timer);
    }

    function blankPanels() {
      ["cGen", "cExp", "cOpen", "cClosed"].forEach(function (id) { byId(id).textContent = "0"; });
      ["cDepth", "cDeep", "cG", "cHF"].forEach(function (id) { byId(id).textContent = "–"; });
      byId("nodeNow").innerHTML = "–";
      byId("nodeParent").innerHTML = "–";
      byId("backtrack").hidden = true;
      byId("openList").innerHTML = '<li class="none">empty</li>';
      byId("kids").innerHTML = '<p class="none">The children of the expanded node appear here.</p>';
      byId("closedList").innerHTML = '<p class="none">–</p>';
      byId("profile").innerHTML = "";
      byId("truncNote").textContent = "";
    }

    function clear() {
      S.ticket++;
      if (S.busy) engine.stop();
      halt();
      S.res = null; S.n = 0; S.total = 0; S.at = -1; S.busy = false; S.optimal = null; S.reported = false;
      blankPanels();
      byId("pathBoards").innerHTML = '<p class="none">Run a search to see the path.</p>';
      byId("pathMoves").textContent = "";
      byId("pathInfo").textContent = "";
      byId("report").innerHTML = '<p class="none">The summary appears once the search reaches the goal (or gives up).</p>';
      byId("trackFill").style.width = "0%";
      byId("trackFill").classList.remove("path");
      byId("where").textContent = "Choose a puzzle and press Run.";
      phase("Idle", "muted");
      readBoards();
      buttons();
    }

    function solve() {
      if (!readBoards()) return;
      clear();
      var ticket = S.ticket;
      var a = algo();
      var options = {
        moveOrder: byId("pickOrder").value,
        heuristic: byId("pickHeur").value,
        depthLimit: Math.max(0, parseInt(byId("pickLimit").value, 10) || 0),
        maxDepth: Math.max(1, parseInt(byId("pickMax").value, 10) || 31),
      };
      S.busy = true;
      phase("Searching", "run");
      byId("where").textContent = "Running " + Searches.INFO[a].title + "…";
      buttons();
      engine.run(a, S.start, S.goal, options).then(function (res) {
        if (ticket !== S.ticket) return;
        S.busy = false;
        S.res = res;
        if (res.unsolvable) {
          phase("Unsolvable", "bad");
          byId("where").textContent = res.why;
          writeReport();
          showTab("tabReportBtn");
          buttons();
          return;
        }
        S.n = res.steps.length;
        S.total = S.n + res.boards.length;
        S.at = -1;
        byId("truncNote").textContent = res.stepsTotal > S.n ? "Replaying the first " + num(S.n) + " of " + num(res.stepsTotal) + " expansions; the summary counts all of them." : "";
        drawProfile();
        drawPath();
        play();
        if (res.found && (a === "dfs" || a === "dls" || a === "gbfs")) {
          engine.run("astar", S.start, S.goal, { traceLimit: 0 }).then(function (r) {
            if (ticket !== S.ticket) return;
            S.optimal = r.moves.length;
            if (S.reported) writeReport();
          }, function () {});
        }
      }, function (err) {
        if (ticket !== S.ticket) return;
        S.busy = false;
        say(err.message);
        phase("Error", "bad");
        buttons();
      });
    }

    function play() {
      if (!S.res || S.at >= S.total - 1) return;
      S.playing = true;
      buttons();
      loop();
    }

    function loop() {
      clearTimeout(S.timer);
      if (!S.playing) return;
      if (S.at >= S.total - 1) {
        S.playing = false;
        buttons();
        return;
      }
      seek(S.at + 1);
      S.timer = setTimeout(loop, S.at >= S.n ? Math.max(delay(), 120) : delay());
    }

    function seek(i) {
      if (!S.res) return;
      S.at = Math.max(-1, Math.min(S.total - 1, i));
      paint();
    }

    function nudge(d) {
      halt();
      seek(S.at + d);
    }

    function paint() {
      var r = S.res;
      now.speed(Math.max(40, Math.min(300, delay() * 0.7)));
      byId("trackFill").style.width = S.total ? ((S.at + 1) / S.total) * 100 + "%" : "0%";
      if (S.at < 0) {
        now.draw(S.start, S.goal);
        blankPanels();
        drawProfile();
        phase("Ready", "muted");
        byId("where").textContent = "At the initial state. Use Next step or Resume.";
        markPath(-1);
      } else if (S.at < S.n) {
        var s = r.steps[S.at];
        now.draw(s.node.board, S.goal);
        paintStep(s);
        byId("trackFill").classList.remove("path");
        markPath(-1);
        var lim = s.limit !== undefined ? " · limit l = " + s.limit : "";
        if (s.type === "goal") {
          phase("Goal found", "ok");
          byId("where").textContent = "Goal selected after " + num(s.expanded) + " expansions" + lim + ". Next: the solution path.";
        } else {
          phase("Expanding", "run");
          byId("where").textContent = "Expansion " + num(s.expanded) + " (step " + num(S.at + 1) + " of " + num(S.n) + ")" + lim;
        }
      } else {
        var j = S.at - S.n;
        if (S.n) paintStep(r.steps[S.n - 1]);
        now.draw(r.boards[j], S.goal);
        byId("trackFill").classList.add("path");
        phase("Path " + num(j) + " / " + num(r.moves.length), "ok");
        byId("where").textContent = j === 0 ? "Solution path · initial state" : "Solution path · move " + num(j) + " of " + num(r.moves.length) + " · blank " + P.MOVES[r.moves[j - 1]].name + " " + P.MOVES[r.moves[j - 1]].arrow;
        markPath(j);
      }
      if (S.n && S.at >= S.n - 1 && !S.reported) {
        writeReport();
        if (S.playing) showTab("tabReportBtn");
      }
      buttons();
    }

    function paintStep(s) {
      var r = S.res;
      var a = r.key;
      var informed = a === "gbfs" || a === "astar";
      var n = s.node;
      byId("cGen").textContent = num(s.generated);
      byId("cExp").textContent = num(s.expanded);
      byId("cOpen").textContent = num(s.openSize);
      byId("cClosed").textContent = num(s.closedSize);
      byId("cDepth").textContent = num(n.depth);
      byId("cDeep").textContent = num(s.deepest);
      byId("cG").textContent = num(n.g);
      byId("cHF").textContent = informed ? n.h + " · " + (a === "gbfs" ? n.h : n.f) : "–";

      byId("nodeNow").innerHTML = thumb(n.board, S.goal, true) + '<span class="mono">depth ' + n.depth + (n.move ? " · via " + P.MOVES[n.move].name : " · root") + "</span>";
      byId("nodeParent").innerHTML = s.parent ? thumb(s.parent, S.goal, true) + '<span class="mono">depth ' + (n.depth - 1) + "</span>" : "<span>root has no parent</span>";

      var bt = byId("backtrack");
      if (STACKY[a] && s.backtrack) {
        bt.hidden = false;
        bt.textContent = s.backtrackFrom === n.depth
          ? "↩ Backtrack: the node expanded last (depth " + n.depth + ") added nothing new to the stack, so DFS took its sibling at the same depth from the top of the stack."
          : "↩ Backtrack: the branch below depth " + n.depth + " is used up, so DFS climbed back from depth " + s.backtrackFrom + " to depth " + n.depth + " and continues with the next state on the stack.";
      } else if (a === "iddls" && S.at > 0 && r.steps[S.at - 1].limit !== s.limit) {
        bt.hidden = false;
        bt.textContent = "New iteration: depth limit raised to l = " + s.limit + ". The search restarts from the root.";
      } else bt.hidden = true;

      // Open list
      var pos = STACKY[a] ? ["top", "2nd", "3rd"] : a === "bfs" ? ["front", "2nd", "3rd"] : ["best", "2nd", "3rd"];
      var list = s.openPeek.map(function (o, i) {
        var v = a === "gbfs" ? "h=" + o.h : a === "astar" ? "f=" + o.f : a === "ucs" ? "g=" + o.g : "depth " + o.depth;
        return '<li><span class="pos">' + (pos[i] || i + 1 + "th") + "</span>" + thumb(o.board, S.goal) + '<span class="mono">' + v + "</span></li>";
      });
      if (s.openSize > s.openPeek.length) list.push('<li class="more">+ ' + num(s.openSize - s.openPeek.length) + " more</li>");
      byId("openList").innerHTML = list.length ? list.join("") : '<li class="none">empty</li>';

      // Children
      if (s.type === "goal") {
        byId("kids").innerHTML = '<p class="none">This node passed the goal test when it was taken from the open list, so it is not expanded.</p>';
      } else if (!s.children.length) {
        byId("kids").innerHTML = '<p class="none">No successors.</p>';
      } else {
        var nextKey = null;
        var fresh = s.children.filter(function (c) { return /^(pushed|enqueued|queued|cheaper)/.test(c.tag); });
        if (STACKY[a] && fresh.length) nextKey = fresh[0].board;
        if (informed && fresh.length) {
          nextKey = fresh.reduce(function (b, c) { return (a === "gbfs" ? c.h < b.h : c.f < b.f) ? c : b; }).board;
        }
        byId("kids").innerHTML = s.children.map(function (c) {
          var cls = /^(pushed|enqueued|queued)$/.test(c.tag) ? "flag-new" : /again|cheaper/.test(c.tag) ? "flag-dup" : "flag-old";
          var vals = informed ? "g=" + c.g + " h=" + c.h + " f=" + (a === "gbfs" ? c.h : c.f) : "g=" + c.g;
          var nxt = c.board === nextKey;
          return '<div class="kid' + (nxt ? " next" : "") + '">' + thumb(c.board, S.goal, true) +
            '<span class="mv">blank ' + P.MOVES[c.move].name + " " + P.MOVES[c.move].arrow + "</span>" +
            '<span class="vals">' + vals + "</span>" +
            '<span class="flag ' + cls + '">' + c.tag + "</span>" +
            (nxt ? '<span class="flag flag-new">' + (STACKY[a] ? "top of stack" : "best next") + "</span>" : "") + "</div>";
        }).join("");
      }

      byId("closedList").innerHTML = s.closedPeek.length
        ? s.closedPeek.map(function (b) { return thumb(b, S.goal, true); }).join("") + (s.closedSize > s.closedPeek.length ? '<span class="note align-self-center">+ ' + num(s.closedSize - s.closedPeek.length) + " more</span>" : "")
        : '<p class="none">empty</p>';

      moveCursor(S.at < S.n ? S.at : S.n - 1);
    }

    /* depth profile (SVG) */
    function drawProfile() {
      var box = byId("profile");
      if (!S.res || !S.n) {
        box.innerHTML = "";
        return;
      }
      var depths = S.res.steps.map(function (s) { return s.node.depth; });
      var max = Math.max.apply(null, depths) || 1;
      S.profileMax = max;
      var w = Math.max(1, depths.length - 1);
      var stride = Math.max(1, Math.floor(depths.length / 800));
      var pts = [];
      for (var i = 0; i < depths.length; i += stride) pts.push(i + "," + depths[i]);
      pts.push(depths.length - 1 + "," + depths[depths.length - 1]);
      box.innerHTML =
        '<svg viewBox="0 -' + max * 0.06 + " " + w + " " + max * 1.12 + '" preserveAspectRatio="none" role="img" aria-label="Depth of each expanded node">' +
        '<polygon class="area" points="0,0 ' + pts.join(" ") + " " + w + ',0"></polygon>' +
        '<polyline class="line" points="' + pts.join(" ") + '"></polyline>' +
        '<line id="profCursor" class="cursor" x1="0" x2="0" y1="0" y2="' + max * 1.06 + '"></line></svg>';
    }
    function moveCursor(i) {
      var c = byId("profCursor");
      if (c) {
        c.setAttribute("x1", i);
        c.setAttribute("x2", i);
      }
    }

    /* solution path */
    function drawPath() {
      var r = S.res;
      if (!r.found) {
        byId("pathBoards").innerHTML = '<p class="none">No solution path: ' + r.why + ".</p>";
        byId("pathInfo").textContent = "";
        return;
      }
      var n = r.boards.length;
      var idx = [];
      var i;
      if (n <= 300) for (i = 0; i < n; i++) idx.push(i);
      else {
        for (i = 0; i < 120; i++) idx.push(i);
        idx.push(-1);
        for (i = n - 60; i < n; i++) idx.push(i);
      }
      var html = "";
      idx.forEach(function (j, k) {
        if (j === -1) {
          html += '<div class="pgap">… ' + num(n - 180) + " boards not drawn …</div>";
          return;
        }
        if (k > 0 && idx[k - 1] !== -1) html += '<div class="parrow"><b>' + P.MOVES[r.moves[j - 1]].arrow + "</b>" + P.MOVES[r.moves[j - 1]].name + "</div>";
        html += '<div class="pstep" data-j="' + j + '"><small>' + (j === 0 ? "start" : "#" + j) + "</small>" + thumb(r.boards[j], S.goal) + "</div>";
      });
      byId("pathBoards").innerHTML = html;
      var letters = r.moves.slice(0, 600).join("") + (r.moves.length > 600 ? "…" : "");
      byId("pathMoves").textContent = r.moves.length ? "Blank moves (U/D/L/R): " + letters : "Start equals goal: no moves needed.";
      byId("pathInfo").textContent = num(r.moves.length) + " moves. Click a board to jump to it.";
    }
    function markPath(j) {
      all(".pstep.here").forEach(function (e) { e.classList.remove("here"); });
      if (j >= 0) {
        var e = document.querySelector('.pstep[data-j="' + j + '"]');
        if (e) e.classList.add("here");
      }
    }

    /* summary */
    function writeReport() {
      S.reported = true;
      var r = S.res;
      var a = r.key;
      var opt = [];
      if (STACKY[a] || a === "bfs" || a === "ucs") opt.push("order " + r.cfg.moveOrder);
      if (r.heuristic) opt.push(P.HEURISTICS[r.heuristic].title);
      if (a === "dls") opt.push("l = " + r.cfg.depthLimit);
      var facts = [
        ["Total moves", r.found ? num(r.moves.length) : "–"],
        ["Path cost", r.found ? num(r.cost) : "–"],
        ["Nodes generated", num(r.generated)],
        ["Nodes expanded", num(r.expanded)],
        ["Maximum search depth", num(r.deepest)],
        ["Execution time", ms(r.ms)],
        ["Memory (approx.)", kb(r.kb) + " · " + memWord(r.kb)],
        ["Peak nodes stored", num(r.peakStored)],
      ];
      var lesson = "";
      if (r.unsolvable) {
        lesson = '<div class="lesson">Inversions: initial ' + P.inversionCount(S.start) + ", goal " + P.inversionCount(S.goal) + ". Sliding a tile never changes the parity of this count on a 3 × 3 board, so these two boards are in separate halves of the state space.</div>";
      } else if (r.found && S.optimal !== null && (a === "dfs" || a === "dls" || a === "gbfs")) {
        var extra = r.moves.length - S.optimal;
        lesson = extra === 0
          ? '<div class="lesson good">This path is optimal: A* confirms the shortest solution is ' + S.optimal + " moves. " + (a === "dfs" ? "That is luck rather than a guarantee for DFS." : "") + "</div>"
          : '<div class="lesson">The shortest possible solution is <b>' + num(S.optimal) + " moves</b> (checked with A*). This " + r.label + " path is <b>" + num(extra) + " moves longer</b>. " +
            (a === "dfs" ? "DFS returns the first goal it bumps into along its current branch, not the shallowest one. Try another move order: the length changes completely." : "") + "</div>";
      } else if (r.found && a === "iddls") {
        lesson = '<div class="lesson good">IDDLS succeeded at depth limit l = ' + r.solvedAtLimit + ", which equals the optimal number of moves.</div>";
      } else if (!r.found && a === "dls") {
        lesson = '<div class="lesson">DLS gave up at depth ' + r.cfg.depthLimit + ". If the goal is deeper than that, DLS cannot see it. Raise the limit or use IDDLS.</div>";
      }
      byId("report").innerHTML =
        '<div class="report-head"><span class="verdict ' + (r.found ? "yes" : "no") + '">' + (r.found ? "Solution found" : "Solution not found") + "</span>" +
        '<span class="tag ' + (a === "dfs" ? "tag-dfs" : "tag-muted") + '">' + r.title + (opt.length ? " · " + opt.join(" · ") : "") + "</span>" +
        (r.found ? "" : '<span class="note m-0">' + r.why + "</span>") + "</div>" +
        '<div class="facts">' + facts.map(function (f) { return '<div class="chip"><span>' + f[0] + "</span><b>" + f[1] + "</b></div>"; }).join("") + "</div>" +
        lesson +
        '<p class="note mb-0 mt-3">Time is measured with performance.now() around the search, including the bookkeeping for the replay. Memory is estimated as the peak number of nodes held in the open and closed lists × ' + Searches.APPROX_BYTES_PER_NODE + " bytes.</p>";
    }

    function showTab(btnId) {
      var b = byId(btnId);
      if (window.bootstrap && b) bootstrap.Tab.getOrCreateInstance(b).show();
    }

    /* events */
    ["inStart", "inGoal"].forEach(function (id) {
      byId(id).addEventListener("input", function () {
        byId("pickExample").value = "";
        clear();
      });
    });
    byId("pickExample").addEventListener("change", function () {
      var v = this.value;
      if (!v) return;
      var parts = v.split("-");
      byId("inStart").value = P.show(parts[0]);
      byId("inGoal").value = P.show(parts[1]);
      clear();
    });
    byId("btnRandom").addEventListener("click", function () {
      var goal;
      try { goal = P.read(byId("inGoal").value); }
      catch (e) { goal = "123804765"; byId("inGoal").value = P.show(goal); }
      byId("inStart").value = P.show(P.scramble(goal, Number(byId("pickShuffle").value)));
      byId("pickExample").value = "";
      clear();
    });
    ["pickAlgo", "pickOrder", "pickHeur", "pickLimit", "pickMax"].forEach(function (id) {
      byId(id).addEventListener("change", function () {
        syncOptions();
        clear();
      });
    });
    byId("tRun").addEventListener("click", solve);
    byId("tPause").addEventListener("click", function () { halt(); buttons(); });
    byId("tResume").addEventListener("click", play);
    byId("tFwd").addEventListener("click", function () { nudge(1); });
    byId("tBack").addEventListener("click", function () { nudge(-1); });
    byId("tToPath").addEventListener("click", function () { halt(); seek(S.n); showTab("tabPathBtn"); });
    byId("tToEnd").addEventListener("click", function () { halt(); seek(S.n - 1); });
    byId("tReset").addEventListener("click", clear);
    byId("tSpeed").addEventListener("input", function () { byId("tSpeedVal").textContent = this.value; });
    byId("pathBoards").addEventListener("click", function (e) {
      var st = e.target.closest(".pstep");
      if (!st || !S.res) return;
      halt();
      seek(S.n + Number(st.getAttribute("data-j")));
    });
    document.addEventListener("keydown", function (e) {
      if (Views.current !== "visualizer" || !S.res) return;
      var tag = document.activeElement && document.activeElement.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === "ArrowRight") nudge(1);
      else if (e.key === "ArrowLeft") nudge(-1);
      else if (e.key === " " && tag !== "BUTTON") {
        e.preventDefault();
        if (S.playing) { halt(); buttons(); } else play();
      }
    });

    syncOptions();
    readBoards();
    buttons();
    return {
      boards: function () { return { start: byId("inStart").value, goal: byId("inGoal").value }; },
    };
  })();

  /* ================================= Bench ================================= */
  var Bench = (function () {
    var engine = new Engine();
    var ROWS = [
      { key: "dfs" },
      { key: "bfs" },
      { key: "dls" },
      { key: "iddls" },
      { key: "ucs" },
      { key: "gbfs", h: "misplaced" },
      { key: "gbfs", h: "manhattan" },
      { key: "astar", h: "misplaced" },
      { key: "astar", h: "manhattan" },
    ];
    var ORDER_NAMES = { UDLR: "Up, Down, Left, Right", LRUD: "Left, Right, Up, Down", RDLU: "Right, Down, Left, Up", DRUL: "Down, Right, Up, Left" };
    var running = false;
    var edited = false;
    var lastKey = null;
    var ticket = 0;

    var name = function (r) { return Searches.INFO[r.key].label + (r.h ? " (" + (r.h === "manhattan" ? "Manhattan" : "Misplaced") + ")" : ""); };

    function say(msg) {
      byId("bMsg").hidden = !msg;
      byId("bMsg").textContent = msg || "";
    }

    function opened() {
      if (!edited) {
        var b = Player.boards();
        byId("bStart").value = b.start;
        byId("bGoal").value = b.goal;
      }
      var key = byId("bStart").value + "|" + byId("bGoal").value + "|" + byId("bOrder").value;
      if (!running && key !== lastKey) go();
    }

    function bars(el, rows, field) {
      var vals = rows.map(function (x) { return x.res && x.res.found !== false ? (field === "moves" ? x.res.moves.length : x.res[field]) : 0; });
      var max = Math.max.apply(null, vals.concat([1]));
      el.innerHTML = rows.map(function (x, i) {
        var v = vals[i];
        var w = v > 0 ? (Math.log10(v + 1) / Math.log10(max + 1)) * 100 : 0;
        return '<div class="hbar' + (x.row.key === "dfs" ? " mine" : "") + '"><span>' + name(x.row) + '</span><div class="bg"><div class="fg" data-w="' + w.toFixed(1) + '"></div></div><span class="v">' + (v ? num(v) : "–") + "</span></div>";
      }).join("");
      requestAnimationFrame(function () {
        all("#" + el.id + " .fg").forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; });
      });
    }

    function go() {
      var start, goal;
      try {
        start = P.read(byId("bStart").value);
        goal = P.read(byId("bGoal").value);
      } catch (e) {
        say(e.message);
        return;
      }
      if (!P.reachable(start, goal)) {
        say("These boards are not reachable from each other (different inversion parity), so there is nothing to benchmark.");
        return;
      }
      say("");
      var my = ++ticket;
      var order = byId("bOrder").value;
      lastKey = byId("bStart").value + "|" + byId("bGoal").value + "|" + order;
      running = true;
      byId("bGo").disabled = true;
      byId("bGo").textContent = "Running…";
      var limit = Math.max(0, parseInt(byId("bLimit").value, 10) || 0);
      var body = byId("bBody");
      body.innerHTML = ROWS.map(function (r, i) {
        return '<tr id="bRow' + i + '" class="' + (r.key === "dfs" ? "mine" : "") + '"><td>' + name(r) + '</td><td colspan="8" class="note">queued…</td></tr>';
      }).join("");
      byId("bOrders").innerHTML = '<tr><td colspan="4" class="none">waiting…</td></tr>';
      byId("bNotes").innerHTML = '<p class="none">Running…</p>';
      var done = [];

      var chain = Promise.resolve();
      ROWS.forEach(function (row, i) {
        chain = chain.then(function () {
          if (my !== ticket) return;
          byId("bRow" + i).cells[1].textContent = "running…";
          return engine.run(row.key, start, goal, { heuristic: row.h || "manhattan", depthLimit: limit, moveOrder: order, traceLimit: 0 }).then(function (res) {
            if (my !== ticket) return;
            done.push({ row: row, res: res });
            byId("bRow" + i).innerHTML = "<td>" + name(row) + "</td>" +
              '<td><span class="tag ' + (res.found ? "tag-ok" : "tag-bad") + '" title="' + res.why + '">' + (res.found ? "Yes" : "No") + "</span></td>" +
              '<td class="r">' + (res.found ? num(res.moves.length) : "–") + "</td>" +
              '<td class="r">' + num(res.expanded) + "</td>" +
              '<td class="r">' + num(res.generated) + "</td>" +
              '<td class="r">' + num(res.deepest) + "</td>" +
              '<td class="r">' + ms(res.ms) + "</td>" +
              "<td>" + memWord(res.kb) + ' <span class="note">' + kb(res.kb) + "</span></td>" +
              '<td class="opt">…</td>';
          });
        });
      });
      chain.then(function () {
        if (my !== ticket) return;
        var best = done.filter(function (d) { return d.row.key === "astar" && d.row.h === "manhattan"; })[0];
        var optimal = best && best.res.found ? best.res.moves.length : null;
        done.forEach(function (d) {
          var i = ROWS.indexOf(d.row);
          var cell = document.querySelector("#bRow" + i + " .opt");
          if (!cell) return;
          cell.innerHTML = !d.res.found ? "–" : d.res.moves.length === optimal ? '<span class="tag tag-ok">Yes</span>' : '<span class="tag tag-bad">No · +' + num(d.res.moves.length - optimal) + "</span>";
        });
        bars(byId("bChartExp"), done, "expanded");
        bars(byId("bChartMoves"), done, "moves");
        // DFS move-order experiment
        var orders = Object.keys(P.MOVE_ORDERS);
        var rowsHtml = [];
        var c2 = Promise.resolve();
        orders.forEach(function (o) {
          c2 = c2.then(function () {
            if (my !== ticket) return;
            return engine.run("dfs", start, goal, { moveOrder: o, traceLimit: 0 }).then(function (res) {
              rowsHtml.push({ o: o, res: res });
            });
          });
        });
        return c2.then(function () {
          if (my !== ticket) return;
          byId("bOrders").innerHTML = rowsHtml.map(function (x) {
            return "<tr" + (x.o === order ? ' class="mine"' : "") + "><td>" + ORDER_NAMES[x.o] + '</td><td class="r">' + num(x.res.moves.length) + '</td><td class="r">' + num(x.res.expanded) + '</td><td class="r">' + ms(x.res.ms) + "</td></tr>";
          }).join("");
          notes(done, rowsHtml, optimal, limit);
        });
      }).then(function () {
        if (my !== ticket) return;
        running = false;
        byId("bGo").disabled = false;
        byId("bGo").textContent = "Run all";
      }, function () {
        running = false;
        byId("bGo").disabled = false;
        byId("bGo").textContent = "Run all";
      });
    }

    function notes(done, orders, optimal, limit) {
      var get = function (k, h) { var x = done.filter(function (d) { return d.row.key === k && (!h || d.row.h === h); })[0]; return x && x.res; };
      var dfs = get("dfs");
      var bfs = get("bfs");
      var dls = get("dls");
      var iddls = get("iddls");
      var astar = get("astar", "manhattan");
      var out = [];
      if (dfs && dfs.found && optimal !== null) {
        out.push(dfs.moves.length === optimal
          ? "<b>DFS</b> happened to find an optimal " + optimal + "-move path here. That is luck, not a guarantee."
          : "<b>DFS</b> found a path of <b>" + num(dfs.moves.length) + " moves</b> where <b>" + optimal + "</b> would do: " + (dfs.moves.length / Math.max(1, optimal) >= 10 ? "about " + Math.round(dfs.moves.length / Math.max(1, optimal)).toLocaleString("en-US") + "×" : "noticeably") + " longer than necessary. DFS stops at the first goal along its current branch.");
      }
      if (orders.length) {
        var lens = orders.map(function (x) { return x.res.moves.length; });
        out.push("Changing only the <b>move order</b> changed the DFS answer from " + num(Math.min.apply(null, lens)) + " to " + num(Math.max.apply(null, lens)) + " moves. DFS is very sensitive to the order in which children are pushed.");
      }
      if (dfs && bfs) out.push("<b>BFS</b> expanded " + num(bfs.expanded) + " nodes against DFS's " + num(dfs.expanded) + ", but BFS's path is guaranteed shortest. Its memory peak was " + kb(bfs.kb) + " against " + kb(dfs.kb) + " for DFS (closed list included).");
      if (dls) out.push(dls.found ? "<b>DLS</b> with l = " + limit + " capped the depth and returned " + num(dls.moves.length) + " moves: a cheap fix for DFS's runaway depth." : "<b>DLS</b> with l = " + limit + " failed: the goal is deeper than the limit.");
      if (iddls && iddls.found) out.push("<b>IDDLS</b> keeps DFS's stack but raises the limit one step at a time, so it found the optimal " + num(iddls.moves.length) + "-move path.");
      if (astar && astar.found) out.push("<b>A*</b> with Manhattan distance needed only " + num(astar.expanded) + " expansions for the optimal path. Information about the goal pays off.");
      byId("bNotes").innerHTML = out.map(function (t) { return '<div class="takeaway">' + t + "</div>"; }).join("");
    }

    ["bStart", "bGoal"].forEach(function (id) { byId(id).addEventListener("input", function () { edited = true; }); });
    byId("bGo").addEventListener("click", function () { if (!running) go(); });
    byId("bRandom").addEventListener("click", function () {
      var goal;
      try { goal = P.read(byId("bGoal").value); }
      catch (e) { goal = "123804765"; byId("bGoal").value = P.show(goal); }
      byId("bStart").value = P.show(P.scramble(goal, 22));
      edited = true;
      if (running) { ticket++; engine.stop(); running = false; }
      go();
    });

    return { opened: opened };
  })();

  /* ================================= Theory ================================= */
  (function Theory() {
    var short = {
      dfs: ["Yes*", "No", "LIFO stack"],
      bfs: ["Yes", "Yes†", "FIFO queue"],
      dls: ["Only if l ≥ d", "No", "LIFO stack, depth ≤ l"],
      iddls: ["Yes", "Yes†", "DLS with l = 0, 1, 2…"],
      ucs: ["Yes", "Yes", "Priority queue on g(n)"],
      gbfs: ["Yes*", "No", "Priority queue on h(n)"],
      astar: ["Yes", "Yes‡", "Priority queue on g + h"],
    };
    var A = THEORY.algorithms;
    byId("theoryTable").innerHTML =
      "<thead><tr><th>Algorithm</th><th>Type</th><th>Open list</th><th>Complete</th><th>Optimal</th><th>Time</th><th>Space</th></tr></thead><tbody>" +
      A.map(function (a) {
        return '<tr class="' + (a.mine ? "mine" : "") + '"><td>' + a.label + (a.mine ? " · assigned" : "") + "</td><td>" + a.family + "</td><td>" + short[a.key][2] + "</td><td>" + short[a.key][0] + "</td><td>" + short[a.key][1] + '</td><td class="mono">' + a.time + '</td><td class="mono">' + a.space.split(";")[0] + "</td></tr>";
      }).join("") +
      '</tbody><caption class="note">* graph search with a closed list, finite state space · † equal step costs · ‡ admissible heuristic</caption>';

    byId("theoryNav").innerHTML = A.map(function (a, i) {
      return '<button class="' + (i === 0 ? "active" : "") + '" data-bs-toggle="pill" data-bs-target="#th-' + a.key + '" type="button" role="tab">' + a.title + (a.mine ? ' <span class="tag tag-dfs">mine</span>' : "") + "</button>";
    }).join("");

    var li = function (xs) { return xs.map(function (x) { return "<li>" + x + "</li>"; }).join(""); };
    byId("theoryBody").innerHTML = A.map(function (a, i) {
      return '<div class="tab-pane fade' + (i === 0 ? " show active" : "") + '" id="th-' + a.key + '" role="tabpanel"><div class="panel theory-card">' +
        '<div class="d-flex flex-wrap gap-2 align-items-center"><h2 class="m-0">' + a.title + "</h2>" +
        '<span class="tag ' + (a.family === "Informed" ? "tag-run" : "tag-muted") + '">' + a.family + "</span>" + (a.mine ? '<span class="tag tag-dfs">Assigned · No. 2</span>' : "") + "</div>" +
        "<h3>Description</h3><p class=\"mb-0\">" + a.summary + "</p>" +
        "<h3>Working principle</h3><ol>" + li(a.steps) + "</ol>" +
        '<div class="row g-4"><div class="col-md-6"><h3>Advantages</h3><ul>' + li(a.pros) + '</ul></div><div class="col-md-6"><h3>Limitations</h3><ul>' + li(a.cons) + "</ul></div></div>" +
        '<div class="props4"><div><span>Time complexity</span>' + a.time + "</div><div><span>Space complexity</span>" + a.space + "</div><div><span>Completeness</span>" + a.complete + "</div><div><span>Optimality</span>" + a.optimal + "</div></div>" +
        "</div></div>";
    }).join("");

    byId("theoryHeur").innerHTML = THEORY.heuristics.map(function (h) {
      return '<div class="col-md-6"><div class="panel heur h-100"><h3 class="h-panel">' + h.title + '</h3><div class="rule">' + h.rule + "</div><p>" + h.why + '</p><p class="mb-0"><b>Example:</b> ' + h.example + "</p></div></div>";
    }).join("");
  })();

  window.addEventListener("hashchange", Views.go);
  Views.go();
})();
