# Demonstration video plan (3–5 minutes)

Record the screen with your voice (Windows: Win + G; macOS: Cmd + Shift + 5 → Options → Microphone). Use the live GitHub Pages site and explain things in your own words.

| Time | Screen | Talking points |
|---|---|---|
| 0:00 | **Overview** | Name, registration number 24BDS0071, course. The assigned algorithm is No. 2, Depth First Search. What the 8-puzzle is. |
| 0:30 | Overview → *search problem* card | State, actions (move the blank), goal test, path cost 1 per move, 181,440 reachable states, parity check for solvability. |
| 0:55 | **Visualizer** → setup | Show typing the initial and goal boards, the examples list, and **Generate Random Puzzle**. Choose the *Unsolvable* example to show the parity message, then go back to the *Assignment example*. |
| 1:20 | Run **DFS** on the assignment example, speed ≈ 3 | Press **Run** and **Pause** after a few steps. Explain the stack (top first), the node being expanded and its parent, the children tags (pushed / already expanded / top of stack), the closed list, and the counters. Step with **Next step** and **Prev step**. |
| 2:00 | Step to expansion 5 | Point out that the goal `123/8_4/765` was **generated and pushed here**, but *Down* is on top of the stack, so DFS dives away. Show the backtracking banner and the depth profile. |
| 2:30 | **Go to goal** → *Solution summary* | The solution was found, but it takes 99,663 moves when the optimum is 5. Read out nodes generated and expanded, max depth, time and memory. Explain why DFS is not optimal. |
| 2:55 | Change the move order to L→R→U→D and run again | The path length changes completely: DFS depends on move order. |
| 3:15 | **Benchmark** (load the *Medium* example first) | Compare DFS with BFS, DLS, IDDLS, UCS, GBFS and A*: moves, nodes expanded, memory. Show the move-order experiment table and the takeaways. |
| 4:00 | **Theory** → DFS | Working principle, advantages and limitations, O(bᵐ) time, O(bm) stack space, complete (graph search) but not optimal. Mention the two heuristics used by GBFS and A*. |
| 4:30 | GitHub repository | README, folder structure, live link. Thank you. |
