# Repository Guidelines

## Project Structure & Module Organization

This repository is a Firefox WebExtension (Codeforces QoL). Keep source in `src/` and static assets in `assets/`.

Example layout:

manifest.json
src/
  background/background.js
  content/global.js, contest.js, submit.js, standings.js
  ui/popup.{html,js,css}, options.{html,js,css}
  shared/storage.js, dom-utils.js
assets/icon-16.png, icon-32.png, icon-48.png, icon-128.png

## Build, Test, and Development Commands

Use Node 20+ and npm.
- `npm install`: install dependencies.
- `npm run dev`: run the extension in Firefox via `web-ext` with live reload.
- `npm run build`: produce `dist/` with a release zip of the extension.
- `npm test`: run unit tests (Vitest/Jest).
- `npm run lint` / `npm run format`: check and format code (ESLint + Prettier).

If `web-ext` is not installed, add it to devDependencies and wire scripts accordingly.

## Coding Style & Naming Conventions

- Indentation: 2 spaces; UTF-8; LF line endings.
- JavaScript: ES2020+, modules preferred. Use `const`/`let`, strict equality.
- Naming: camelCase variables/functions, PascalCase classes, kebab-case filenames (e.g., `dom-utils.js`).
- Imports: prefer relative within `src/`.
- Lint/format: ESLint + Prettier; run `npm run lint` before pushing.

## Testing Guidelines

- Framework: Vitest or Jest.
- Location: `tests/` or colocated `__tests__/` near modules.
- Names: `*.test.js` (e.g., `dom-utils.test.js`).
- Coverage: target >=80% on `src/shared`; use DOM mocks for content scripts.
- Run: `npm test` locally and in CI.

## Commit & Pull Request Guidelines

- Commits: Conventional Commits (e.g., `feat: add focus mode` / `fix: debounce auto-select`). Keep subjects imperative, <=72 chars.
- PRs: include description, linked issue, before/after screenshots for UI, and test notes for background/content changes.
- Keep PRs small; update `manifest.json` and changelog when permissions or user-visible behavior change.

## Security & Configuration Tips

- Minimize `manifest.json` permissions; avoid `all_urls` unless essential. Current perms: `storage`, `clipboardRead`, `tabs`, and Codeforces host patterns.
- Bundle all scripts; do not load remote code. Use `chrome.storage.local` for options.
- Guard content scripts: run only on Codeforces URLs; run at `document_start` to prevent UI flashes.
- Manifest uses MV2 (`background.scripts`) for temporary install compatibility. If migrating to MV3, switch to `background.service_worker` and enable Firefox MV3 flags.

## Current Features (Overview)

- Focus Mode: Hides standings and solved counts on contest/gym pages; includes early CSS pre-hide to avoid flashes; live toggle via popup/options.
- Submit Clipboard in C++: Sidebar button (between “Submit?” and “Last submissions”) reads clipboard, opens a background submit tab, selects latest C++ (e.g., 23/20/17…), pastes code, auto-submits, then switches to “My submissions.” Includes single-flight lock and throttled observers.
