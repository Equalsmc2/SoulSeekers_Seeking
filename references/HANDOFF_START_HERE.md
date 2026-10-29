# START HERE — SoulSeekers: Seeking — New Conversation Integration Handoff
**Prepared:** October 29, 2026.

**Goal:** Use the three complete project sources in this archive to make **one** working 6v1 multiplayer SoulSeekers: Seeking website. The old three-lane Seeking site's static Boston map is superseded by a **DM-built modular dungeon**. Keep the site's dedicated-server networking and clean gold UI. Integrate the advanced Party V19.2 mechanics and DM R05.4 card builder.

## What to do in your new ChatGPT conversation
1. Start a new chat.
2. Attach **this entire ZIP**.
3. Open `04_HANDOFF_DOCUMENTS/NEW_CHAT_COPY_PASTE_PROMPT.md` and paste it as your first message, or paste its content from the assistant reply.
4. Tell the assistant which integration milestone to do first, or say **"Start milestone M1 now and deliver a runnable build"**. It should inspect the actual source instead of just writing a plan.

## Contents
- `01_LATEST_SEEKING_SITE_R03_5/` — full live-base client + WebSocket server + tests + Render/GitHub BAT.
- `02_LATEST_PARTY_LAB_V19_2/` — last Party weapon/dodge/magic/rest standalone HTML.
- `03_LATEST_DM_COMMANDER_R05_4/` — last DM dungeon/card/monster/camp standalone HTML (includes the intuitive controls patch).
- `04_HANDOFF_DOCUMENTS/` — copy-paste new-chat prompt, full game spec, integration roadmap, controls, checklist, provenance, test log.
- `05_ORIGINAL_RELEASE_ZIPS/` — unchanged archives of the 3 releases in case a recipient needs the original packages.

## Cautions
- These are THREE SEPARATE playable programs. They are **not yet merged** into one multiplayer game.
- No Gemini work is involved; the user explicitly paused that direction.
- The latest verified website is R03.5 at GitHub commit `2425f7b`; the latest Party lab is V19.2, latest DM lab R05.4.
- Keep the server authoritative; do not return to using Firebase Realtime Database as the fast combat transport.
- Preserve finite card hands, sealed Party camps (no friendly spawn), seven souls, DM possession, and 40-minute play phase. Any changes to these are design decisions to discuss, not accidental merge side effects.
