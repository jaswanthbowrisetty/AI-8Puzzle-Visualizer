/*
 * board.js
 * --------
 * The 8-puzzle board model. A board is stored as a 9-character string read
 * row by row, with "0" standing for the empty square:
 *
 *      1 2 3
 *      8 _ 4     ->   "123804765"
 *      7 6 5
 *
 * Strings are immutable and hash well, so a board doubles as its own key in
 * the Sets and Maps used by the search algorithms.
 *
 * Bowri Setty Jaswanth · 24BDS0071
 */
var EightPuzzle = (function () {
  "use strict";

  var WIDTH = 3;
  var CELLS = 9;
  var BLANK = "0";

  // Each move is named after the direction the BLANK travels.
  var MOVES = {
    U: { name: "Up", row: -1, col: 0, arrow: "↑" },
    D: { name: "Down", row: 1, col: 0, arrow: "↓" },
    L: { name: "Left", row: 0, col: -1, arrow: "←" },
    R: { name: "Right", row: 0, col: 1, arrow: "→" },
  };

  // Orders the user can pick for DFS. The order matters a lot for DFS.
  var MOVE_ORDERS = {
    UDLR: ["U", "D", "L", "R"],
    LRUD: ["L", "R", "U", "D"],
    RDLU: ["R", "D", "L", "U"],
    DRUL: ["D", "R", "U", "L"],
  };

  /** Turn free-form text ("283 164 7_5", "2,8,3,1,6,4,7,0,5" …) into a board string. */
  function read(text) {
    var cleaned = String(text)
      .replace(/[\s,;|/]+/g, "")
      .replace(/[_.\-*xXbB]/g, BLANK);
    if (!/^[0-8]{9}$/.test(cleaned)) {
      throw new Error("A board needs exactly 9 symbols: the digits 1-8 and one blank (_ or 0).");
    }
    for (var d = 0; d <= 8; d++) {
      var count = cleaned.split(String(d)).length - 1;
      if (count !== 1) {
        throw new Error(d === 0 ? "Use exactly one blank (_ or 0)." : "Digit " + d + " must appear exactly once.");
      }
    }
    return cleaned;
  }

  /** Three-line text form, blank shown as "_". */
  function show(board) {
    var b = board.replace(BLANK, "_");
    return b.slice(0, 3) + "\n" + b.slice(3, 6) + "\n" + b.slice(6, 9);
  }

  /** One-line form "283/164/7_5". */
  function inline(board) {
    return show(board).split("\n").join("/");
  }

  function swap(board, i, j) {
    var a = board.split("");
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
    return a.join("");
  }

  /**
   * All legal successors of a board, in the requested move order.
   * Returns [{ board, move: "U"|"D"|"L"|"R" }].
   */
  function expand(board, order) {
    var gap = board.indexOf(BLANK);
    var r = Math.floor(gap / WIDTH);
    var c = gap % WIDTH;
    var list = [];
    (order || MOVE_ORDERS.UDLR).forEach(function (m) {
      var nr = r + MOVES[m].row;
      var nc = c + MOVES[m].col;
      if (nr >= 0 && nr < WIDTH && nc >= 0 && nc < WIDTH) {
        list.push({ board: swap(board, gap, nr * WIDTH + nc), move: m });
      }
    });
    return list;
  }

  /** Count pairs of tiles that are in the wrong relative order (blank ignored). */
  function inversionCount(board) {
    var tiles = board.replace(BLANK, "");
    var n = 0;
    for (var i = 0; i < tiles.length; i++) {
      for (var j = i + 1; j < tiles.length; j++) {
        if (tiles[i] > tiles[j]) n++;
      }
    }
    return n;
  }

  /** On an odd-width board, sliding never changes inversion parity. */
  function reachable(from, to) {
    return inversionCount(from) % 2 === inversionCount(to) % 2;
  }

  /* ---------------------------- heuristics ---------------------------- */

  function misplaced(board, goal) {
    var h = 0;
    for (var i = 0; i < CELLS; i++) {
      if (board[i] !== BLANK && board[i] !== goal[i]) h++;
    }
    return h;
  }

  function manhattan(board, goal) {
    var h = 0;
    for (var i = 0; i < CELLS; i++) {
      var tile = board[i];
      if (tile === BLANK) continue;
      var j = goal.indexOf(tile);
      h += Math.abs(Math.floor(i / WIDTH) - Math.floor(j / WIDTH)) + Math.abs((i % WIDTH) - (j % WIDTH));
    }
    return h;
  }

  var HEURISTICS = {
    manhattan: { title: "Manhattan distance", fn: manhattan },
    misplaced: { title: "Misplaced tiles", fn: misplaced },
  };

  /** Shuffle by walking `steps` random legal moves away from the goal (always solvable). */
  function scramble(goal, steps, random) {
    random = random || Math.random;
    var board = goal;
    var previous = null;
    for (var s = 0; s < steps; s++) {
      var options = expand(board).filter(function (n) {
        return n.board !== previous;
      });
      previous = board;
      board = options[Math.floor(random() * options.length)].board;
    }
    return board === goal ? scramble(goal, steps, random) : board;
  }

  return {
    BLANK: BLANK,
    MOVES: MOVES,
    MOVE_ORDERS: MOVE_ORDERS,
    HEURISTICS: HEURISTICS,
    read: read,
    show: show,
    inline: inline,
    expand: expand,
    inversionCount: inversionCount,
    reachable: reachable,
    misplaced: misplaced,
    manhattan: manhattan,
    scramble: scramble,
  };
})();

if (typeof module !== "undefined") module.exports = EightPuzzle;
