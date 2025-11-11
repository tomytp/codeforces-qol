# Codeforces QoL – Build Plan (for AI Agent)

This document describes step-by-step tasks for an AI coding agent to build the **Codeforces QoL** Firefox extension.

## 0. Goals / Feature List

Features to implement:

1. **Repository + project setup** (Firefox extension skeleton)
2. **Focus Mode**
   - Hide standings during contest/gym
   - Hide problem solve count during contest/gym
3. ~~Auto language selection~~ (replaced by Submit Clipboard in C++)
4. **Arrow keys to switch problems**
5. **Auto-scroll to problem statement**
6. **Standings: remember last country filter**
7. **Rating Anxiety Mode (global)**
   - Applies to the entire Codeforces site, not only standings
   - Hide rating numbers, rating graph, rating colors/ranks
8. **Gym Finder**
   - Find gyms where many friends have submissions
   - I (main handle) have no submissions

---

## 1. Repo and Base Project Setup

**Goal:** Create a minimal, working Firefox extension repo with structure ready for features.

### Tasks for AI Agent

1. **Initialize repository**
   - Create a new folder `codeforces-extended/`.
   - Initialize a git repository (just create `.gitignore`; actual git init is done by human).
   - Add a basic `.gitignore` for Node/JS.

2. **Create base structure**

   ```text
   codeforces-extended/
     manifest.json
     src/
       background/
         background.js
       content/
         global.js
         contest.js
         submit.js
         standings.js
       ui/
         popup.html
         popup.js
         popup.css
         options.html
         options.js
         options.css
       shared/
         storage.js
         dom-utils.js
     assets/
       icon-16.png
       icon-32.png
       icon-48.png
       icon-128.png
     README.md
     PLAN.md   <-- this file
   ```

---

## 2. Progress Status (current)

- Step 1: Completed. MV2 WebExtension scaffold done (manifest, background/content, popup/options, assets).
- Step 2: Focus Mode implemented.
  - Hides standings across contest/gym pages and the "Solved" column on problem lists.
  - Early CSS pre-hide at `document_start` to prevent flashes; storage-backed toggle (popup/options).
- Step 3 (changed): Implemented "Submit Clipboard in C++" instead of auto language selection.
  - Sidebar button between "Submit?" and "Last submissions" on problem pages.
  - Reads clipboard, opens background submit tab, selects latest available C++ (23/20/17/14/11), pastes code, auto-submits, then switches to My Submissions.
  - Single-flight lock and throttled observers to avoid duplicate submits and reload loops.

## 3. Next Up

- Arrow keys to switch problems.
- Auto-scroll to problem statement.
- Standings: remember last country filter.
- Rating Anxiety Mode (global).
- Gym Finder (friends have submissions; main handle doesn't).
