# Publish SoulSeekers: Seeking with GitHub Desktop

You were given `START_LOCAL.bat` to play the game offline. **`SYNC_TO_GITHUB.bat` is the missing publishing helper.** You don't need to install new tools beyond GitHub Desktop.

## First time

1. Open GitHub Desktop and select the **SoulSeekers_Seeking** repository shown in your screenshot.
2. In the top menu choose **Repository → Show in Explorer**. This is the **cloned repository folder**. It is NOT your Downloads/SoulSeekers_Seeking_R01 folder.
3. Extract this updated ZIP into a normal folder and double-click **SYNC_TO_GITHUB.bat** inside it.
4. When asked for the repository folder, click File Explorer's **address bar**, copy the path, and paste into the BAT window.
5. Confirm the destination; the script copies the game files into your cloned repo without deleting `.git` or using `/MIR`. It may **overwrite same-named project files**, so don't run an old ZIP over a newer project.
6. Choose **1** to finish in GitHub Desktop. Under **Changes**, enter a summary and click **Commit to main**, then **Push origin** (or **Publish repository** if it hasn't been published).

You can choose **2** to attempt automatic stage/commit/push if Git is installed or bundled by GitHub Desktop. If this fails (for example, authentication or an unpublished remote), it falls back to the Desktop instructions. This option stages **all repository changes**: use it only when you recognize the changes.

## Future updates

Download and extract a **newer** SoulSeekers: Seeking ZIP, then run its `SYNC_TO_GITHUB.bat`. The batch file remembers your repository folder for this Windows user in `%LOCALAPPDATA%\SoulSeekersSeeking\github-repo-path.txt` so you shouldn't need to pick it again. You can edit/delete that path file to change repositories.

## Enable the website

On GitHub, open repository **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch → main → /(root)** and save. The site should use your repository's root `index.html`. GitHub Pages deployment can take some time after a push.

**GitHub Pages does not provide game multiplayer.** To enable Firebase rooms, separately configure `firebase-config.js`, Realtime Database, Authentication, and database rules as described in `README.md`. The Firebase configuration must be saved to the repository and pushed like other files.

## Why GitHub Desktop originally showed zero files

Your screenshot showed the extracted R01 contents in `Downloads\SoulSeekers_Seeking_R01`, while GitHub Desktop was watching the **different folder that holds your repository**. The copy step fixes that; the commit and push actually publish your work to GitHub.


## R02 GAME SERVER

GitHub Pages hosts static files only. After GitHub Desktop pushes R02, you must also deploy the server via Render > New > Web Service, linked to the SAME GitHub repository. Build: `npm install --omit=dev`; Start: `npm start`. Render gives you `https://YOUR-SERVER.onrender.com`. You may play directly at that Render URL, or paste it into the GitHub Pages site’s GAME SERVER URL field. See `R02_SERVER_SETUP.md`.
