# Publishing on GitHub Pages

1. On github.com, signed in as **jaswanthbowrisetty**, click **New repository**. Name it **`AI-8Puzzle-Visualizer`**, choose **Public**, and leave "Add a README" unticked.
2. Upload the project so that `index.html` sits at the **top level** of the repository:
   - **GitHub Desktop:** File → Add local repository → choose this folder → Publish (untick "Keep this code private"), or
   - **Command line:**
     ```bash
     git init && git add . && git commit -m "8-Puzzle Search Lab – DFS (24BDS0071)"
     git branch -M main
     git remote add origin https://github.com/jaswanthbowrisetty/AI-8Puzzle-Visualizer.git
     git push -u origin main
     ```
3. In the repository, go to **Settings → Pages**. Set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After 1–2 minutes the site is live at **https://jaswanthbowrisetty.github.io/AI-8Puzzle-Visualizer/**
5. Record the demo video, name it **`demo-video.mov`**, and add it to the `assets/` folder:
   - The website uploader only accepts files under 25 MB, so use GitHub Desktop (limit 100 MB).
   - If the file is too large, export a smaller copy at 720p, or upload it to YouTube as Unlisted and use that link.
6. Put the four links (repository, live site, README, video) in a PDF and upload it on VTOP.
