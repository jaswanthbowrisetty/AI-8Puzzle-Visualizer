# DFS walkthrough: assignment example

**Initial** `283 / 164 / 7_5` → **Goal** `123 / 8_4 / 765` · move order **Up, Down, Left, Right**

This output comes straight from `Searches.run("dfs", …)` in `js/searches.js`. The Visualizer shows the same steps.

| # | Popped from stack (depth) | Children (tag) | Stack size | Closed size |
|---|---|---|---|---|
| 1 | `283/164/7_5` (0) | Up `283/1_4/765` pushed · Left `283/164/_75` pushed · Right `283/164/75_` pushed | 3 | 1 |
| 2 | `283/1_4/765` (1) | Up `2_3/184/765` pushed · Down (already expanded) · Left `283/_14/765` pushed · Right `283/14_/765` pushed | 5 | 2 |
| 3 | `2_3/184/765` (2) | Down (already expanded) · Left `_23/184/765` pushed · Right `23_/184/765` pushed | 6 | 3 |
| 4 | `_23/184/765` (3) | Down `123/_84/765` pushed · Right (already expanded) | 6 | 4 |
| 5 | `123/_84/765` (4) | Up (already expanded) · Down `123/784/_65` pushed · **Right `123/8_4/765` pushed ← this is the goal** | 7 | 5 |
| 6 | `123/784/_65` (5) | Up (already expanded) · Right `123/784/6_5` pushed | 7 | 6 |
| 7 | `123/784/6_5` (6) | Up `123/7_4/685` pushed · Left (already expanded) · Right `123/784/65_` pushed | 8 | 7 |
| 8 | `123/7_4/685` (7) | Up, Left, Right pushed · Down (already expanded) | 10 | 8 |
| … | DFS keeps diving | | | |

## What happened at step 5

The goal `123/8_4/765` was **generated at depth 5** and pushed onto the stack. The children were pushed in reverse order (Right, then Down), so **Down** ended up on top. DFS popped Down and kept going deeper down that branch.

The goal test only runs when a node is **popped**, so the goal waited at the bottom of the stack while DFS explored about 107,000 other states. Final result:

- **Solution found:** yes
- **Moves:** 99,663 (optimal is 5)
- **Nodes expanded:** 107,132 · **generated:** 299,331
- **Maximum depth:** 99,662

This is the clearest way to show that **DFS is complete in this finite space but not optimal**, and that its result depends on the move order. Changing the order to D→R→U→L gives a 48,551-move answer, and L→R→U→D gives 37,139.
