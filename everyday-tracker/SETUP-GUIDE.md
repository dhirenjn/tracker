# Everyday Tracker — Setup Guide (Phase 1)

This is a plain-language walkthrough for getting the app running, with **zero coding experience assumed**. It covers Phase 1 only: the fully working, fully offline app on your own devices. Phase 2 (cross-device sync) and Phase 3 (AI Insights) are separate, optional, and covered at the bottom — you don't need them for the app to be useful.

---

## What you actually got

A complete, working app — not a mockup. It has:

- **Grid view** (full month, all your rows, tap any cell to check it off)
- **Today view** (mobile-style quick check-in, sectioned by Habits / Tasks / Projects / Weekly slot)
- All 4 row types from the spec: Habit, Task, Bounded Project, Weekly Slot, plus Project grouping
- Add/Edit flow, 2–3 day backfill window, overdue flags, archive-not-delete
- Month Turnover wizard (habit keep/edit/drop + photo & reflection gate), with the multi-month-lapse rule handled
- Growth Gallery
- Settings with **data export/import** (your real backup/insurance, works today, no server needed)
- Installable, fully offline PWA (works with no internet once loaded)

It runs entirely in the browser. Nothing is sent anywhere. There's no login.

**What's not built yet:** cross-device sync (needs a server) and AI Insights (needs a server + Gemini key). Those are Phase 2/3 — real additional steps involving other companies' free tiers, not just code, so it's worth getting Phase 1 solid on your own devices first. Say the word whenever you want to tackle either.

---

## Step 1 — Try it right now, on this computer

1. Download the project files (I'll attach them as a .zip).
2. Unzip it anywhere.
3. You need a tiny local web server to open it correctly (opening `index.html` directly with double-click won't work — browsers block some features for security when there's no server). The easiest way:
   - **If you have Python installed** (most Macs/Linux do; Windows may not): open a terminal in the unzipped folder and run:
     ```
     python3 -m http.server 8080
     ```
     Then open `http://localhost:8080` in your browser.
   - **No Python?** Install the free **VS Code** editor, install its "Live Server" extension, open the folder, right-click `index.html` → "Open with Live Server."
4. Click around: add a habit, check off today's cell, add a project.

---

## Step 2 — Put it on the real internet for free (Cloudflare Pages)

This gives you a real installable URL you can open from your phone too — no more local server needed.

1. **Create a free GitHub account** at github.com if you don't have one.
2. **Create a new repository** (top right → "+" → "New repository"). Name it `everyday-tracker`. Keep it Public or Private, your choice.
3. Upload the files: on the repo page, click "Add file" → "Upload files," then drag in everything from the unzipped folder (keep the folder structure — `css/`, `js/`, `icons/` should stay as folders). Commit.
4. **Create a free Cloudflare account** at cloudflare.com.
5. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**. Pick your GitHub account, then the `everyday-tracker` repo.
6. Build settings: leave the build command **empty** and the output directory as `/` (this is a static site, no build step needed). Click Deploy.
7. Cloudflare gives you a URL like `everyday-tracker.pages.dev`. That's your app, live, for free, forever, on Cloudflare's free tier.

---

## Step 3 — Install it like a real app

- **On your phone (Android/Chrome):** open the `.pages.dev` link, tap the browser menu → "Add to Home screen" / "Install app."
- **On iPhone (Safari):** open the link, tap Share → "Add to Home Screen."
- **On a PC (Chrome/Edge):** open the link, click the install icon (⊕) in the address bar.

Once installed, it opens like a normal app and works offline.

**Important:** each device you install it on has its **own separate local copy** of your data right now — adding a habit on your phone won't show up on your PC yet. That's exactly what Phase 2 (sync) solves. Until then, use **Settings → Export** on one device and **Import** on another if you want to carry data over manually — this also doubles as your backup.

---

## What's next, when you're ready

- **Phase 2 — Sync across devices:** a small free server (Oracle Cloud's Always Free tier) that only your own devices talk to, with QR-code pairing. This involves creating an Oracle Cloud account and setting up a lightweight API — a good next session together, not a quick add-on.
- **Phase 3 — AI Insights:** a free Gemini API key, plus a scheduled job on that same server to generate weekly reports and propose new rows as Drafts.

Both are genuinely free and match the report's design — just come back whenever you want to build them, and we'll go step by step the same way.

---

## If something looks off

The app is a first working version — the completion-percentage math, the exact visual polish, and a couple of edge cases (like Weekly Slot history browsing) are simplified for now. Tell me what you'd like refined and I'll adjust the code directly.
