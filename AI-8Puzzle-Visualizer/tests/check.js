// Run with:  node tests/check.js
const P = require("../js/board.js");
const S = require("../js/searches.js");
let ok = 0, bad = 0;
const expect = (cond, what) => (cond ? ok++ : (bad++, console.log("  ✗", what)));

function legal(r, start, goal) {
  if (!r.found || r.boards[0] !== start || r.boards[r.boards.length - 1] !== goal) return false;
  for (let i = 1; i < r.boards.length; i++) {
    const step = P.expand(r.boards[i - 1]).find((s) => s.board === r.boards[i]);
    if (!step || step.move !== r.moves[i - 1]) return false;
  }
  return r.cost === r.moves.length && r.moves.length === r.boards.length - 1;
}

// board model
expect(P.read("283\n164\n7_5") === "283164705", "read multi-line");
expect(P.read("2,8,3,1,6,4,7,0,5") === "283164705", "read commas");
let threw = false; try { P.read("12345678"); } catch (e) { threw = true; } expect(threw, "rejects 8 symbols");
threw = false; try { P.read("113456780"); } catch (e) { threw = true; } expect(threw, "rejects duplicate");
expect(P.manhattan("283164705", "123804765") === 5, "manhattan = 5");
expect(P.misplaced("283164705", "123804765") === 4, "misplaced = 4");
expect(!P.reachable("213456780", "123456780"), "parity check");
expect(P.expand("123405786").length === 4 && P.expand("012345678").length === 2, "branching 4 / 2");

const S0 = "283164705", G0 = "123804765";
console.log("Example 283/164/7_5 -> 123/8_4/765");
for (const k of ["dfs", "bfs", "dls", "iddls", "ucs", "gbfs", "astar"]) {
  const r = S.run(k, S0, G0, {});
  expect(legal(r, S0, G0), k + " legal path");
  console.log(`  ${r.label.padEnd(6)} moves=${String(r.moves.length).padStart(6)} expanded=${String(r.expanded).padStart(7)} deepest=${r.deepest} ${r.ms.toFixed(1)}ms steps=${r.steps.length}/${r.stepsTotal}`);
}
console.log("DFS by move order:");
for (const o of Object.keys(P.MOVE_ORDERS)) {
  const r = S.run("dfs", S0, G0, { moveOrder: o, traceLimit: 0 });
  expect(legal(r, S0, G0), "dfs " + o);
  console.log(`  ${o}: moves=${r.moves.length} expanded=${r.expanded}`);
}

let seed = 11; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const G = "123456780";
for (let t = 0; t < 40; t++) {
  const st = P.scramble(G, 8 + Math.floor(rnd() * 50), rnd);
  const best = S.run("astar", st, G, { traceLimit: 0 }).moves.length;
  expect(S.run("bfs", st, G, { traceLimit: 0 }).moves.length === best, "bfs optimal");
  expect(S.run("ucs", st, G, { traceLimit: 0 }).moves.length === best, "ucs optimal");
  expect(S.run("astar", st, G, { heuristic: "misplaced", traceLimit: 0 }).moves.length === best, "A* h1 optimal");
  if (t < 10) expect(S.run("iddls", st, G, { traceLimit: 0 }).moves.length === best, "iddls optimal");
  for (const o of Object.keys(P.MOVE_ORDERS)) { const d = S.run("dfs", st, G, { moveOrder: o, traceLimit: 0 }); expect(legal(d, st, G) && d.moves.length >= best, "dfs valid " + o); }
  const g = S.run("gbfs", st, G, { traceLimit: 0 }); expect(legal(g, st, G) && g.moves.length >= best, "gbfs valid");
  const l = S.run("dls", st, G, { depthLimit: best, traceLimit: 0 }); expect(legal(l, st, G), "dls at d");
  if (best > 0) { const l2 = S.run("dls", st, G, { depthLimit: best - 1, traceLimit: 0 }); expect(!l2.found && /Cutoff/.test(l2.why), "dls below d fails"); }
}
expect(S.run("astar", "867254301", G, { traceLimit: 0 }).moves.length === 31, "hardest = 31");
const u = S.run("dfs", "213456780", G, {}); expect(u.unsolvable && !u.found, "unsolvable flagged");
// trace sanity: DFS backtracking flagged
const tr = S.run("dfs", S0, G0, {}).steps; expect(tr.some((s) => s.backtrack), "dfs backtrack recorded");
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
