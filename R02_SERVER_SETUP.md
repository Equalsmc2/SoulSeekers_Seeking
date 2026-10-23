**Already running R02 on Render?** Do not create another service. Extract R02.2, run `SYNC_TO_GITHUB.bat`, then commit and push through GitHub Desktop. Your existing Render Web Service should rebuild automatically if Auto-Deploy is enabled. If not, select **Manual Deploy → Deploy latest commit** in Render. Wait for the service to show **Live**, hard-refresh both browser windows, then create a **new DM room**. Rooms do not survive a server redeploy. Firebase does not need changes.

# R02.2 — Set up the online game server (Windows + GitHub Desktop + Render)

You have **not** made a mistake with Firebase. R01's architecture was the source of the large combat sync delays. R02 stops treating Firebase Realtime Database as a shooter transport.

## 1. Push R02 to GitHub (same as before)
1. Download and extract the R02.2 ZIP.
2. Double-click **`SYNC_TO_GITHUB.bat`**.
3. Press Y, choose **1** for GitHub Desktop.
4. In GitHub Desktop commit and **Push origin**. Make sure `server/index.mjs`, `package.json` and `render.yaml` appear in the committed files.

## 2. Deploy a Node server on Render
1. Open [https://dashboard.render.com/](https://dashboard.render.com/) and sign in.
2. Select **New → Web Service**, then connect your GitHub repository `SoulSeekers_Seeking`.
3. Configure:
   - **Language/Runtime:** Node
   - **Branch:** main
   - **Root directory:** leave blank (project root)
   - **Build command:** `npm install --omit=dev`
   - **Start command:** `npm start`
   - **Instance type:** Free for testing if offered (free plan can sleep on idle and has limits)
4. Deploy. **Do not select Static Site:** the game server must run Node.
5. When Render reports **Live**, open the `https://YOUR-SERVICE.onrender.com/health` URL; it should display JSON with `status:"ok"`.

## 3. Test both roles — simplest method
1. Open `https://YOUR-SERVICE.onrender.com` **directly**, not the GitHub Pages link at first.
2. The **GAME SERVER URL** field should automatically show `wss://YOUR-SERVICE.onrender.com/ws`.
3. In window A, choose **HOST AS DM**. Copy the generated room code or click **COPY INVITE LINK**.
4. In window B, paste the invite link, select a different character, enter a name, then choose **JOIN AS PARTY**.
5. Move, shoot and spawn an enemy. The match server continues running even when the DM tab is backgrounded.

To use GitHub Pages instead, open your usual Pages URL and enter **the same Render HTTPS address** into **GAME SERVER URL**. The game converts HTTPS to WSS automatically. Your browser remembers it. An invite link includes this address for guests.

## 4. What you do in Firebase

**Nothing new for R02 online combat.** Keep the existing Firebase project, authentication and rules. R02 uses its own WebSocket server for rooms and live gameplay, so there is no Firebase database collection to add or change. The existing Firebase config stays in the ZIP for later account features.

## 5. Troubleshooting

- **SERVER ADDRESS REQUIRED:** paste your Render URL, or play from the Render URL itself.
- **Can't connect:** make sure Render says Live, `/health` works, and the server address uses HTTPS (not the GitHub Pages URL).
- **First connection takes a while:** Render free services can take about a minute to wake after idle; reload when `/health` responds.
- **Room not found:** DM must host on the *same server* as the Party. Use **COPY INVITE LINK** to avoid typos.
- **Everything resets after a Render restart:** this prototype stores rooms in RAM. In-match persistence will be a later feature.
- **Two tabs in Zen:** WebSocket server simulation will not be throttled just because the DM tab is hidden, but animations for hidden tabs can still be throttled.
- **Rendering is laggy even offline:** that's a separate client-side performance problem; measure it separately from network desync.

**Important:** The game is a prototype. Local tests pass but live seven-player responsiveness cannot be guaranteed before field testing.
