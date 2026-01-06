# Repository Guidelines

## Project Structure & Module Organization

This repository is a Firefox WebExtension (Codeforces QoL). Keep source in `src/` and static assets in `assets/`.

```
manifest.json
src/
  background/background.js
  content/
    global.js         ← Submit Clipboard button
    contest.js        ← Focus Mode
    submit.js         ← Auto-fill submit form
    submission.js     ← Hide Test Case Info
    navigation.js     ← Instant Problem Navigation
    gym-page.js       ← Friend Gym Finder
  ui/
    popup.{html,js,css}
    options.{html,js,css}
  shared/
    storage.js        ← Cross-browser storage utilities
    cf-api.js         ← Codeforces API wrapper
    sha512.js         ← SHA-512 for API signatures
assets/
  icon-16.png, icon-32.png, icon-48.png, icon-128.png
```

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
- JavaScript: ES2020+, IIFEs preferred for content scripts. Use `const`/`let`, strict equality.
- Naming: camelCase variables/functions, PascalCase classes, kebab-case filenames.
- Imports: use `window.cfxStorage` or `window.storage` from shared module (no ES modules in MV2).
- Lint/format: ESLint + Prettier; run `npm run lint` before pushing.

## Testing Guidelines

- Framework: Vitest or Jest.
- Location: `tests/` or colocated `__tests__/` near modules.
- Names: `*.test.js` (e.g., `storage.test.js`).
- Coverage: target >=80% on `src/shared`; use DOM mocks for content scripts.
- Run: `npm test` locally and in CI.

## Commit & Pull Request Guidelines

- Commits: Conventional Commits (e.g., `feat: add focus mode` / `fix: debounce auto-select`). Keep subjects imperative, <=72 chars.
- PRs: include description, linked issue, before/after screenshots for UI, and test notes for background/content changes.
- Keep PRs small; update `manifest.json` and changelog when permissions or user-visible behavior change.

## Security & Configuration Tips

- Minimize `manifest.json` permissions; avoid `all_urls` unless essential. Current perms: `storage`, `clipboardRead`, `tabs`, `tabHide`, and Codeforces host patterns.
- Bundle all scripts; do not load remote code. Use `chrome.storage.local` for options.
- Guard content scripts: run only on Codeforces URLs; run at `document_start` to prevent UI flashes.
- Manifest uses MV2 (`background.scripts`) for temporary install compatibility.

## Current Features

| Feature | Description | Files |
|---------|-------------|-------|
| **Focus Mode** | Hides standings and solved counts on contest/gym pages | `contest.js` |
| **Submit Clipboard in C++** | Button to auto-submit clipboard code with latest C++ | `global.js`, `submit.js`, `background.js` |
| **Instant Problem Navigation** | ArrowLeft/ArrowRight to switch problems seamlessly | `navigation.js` |
| **Hide Test Case Info** | Hides "on test X" from verdict (ICPC style) | `submission.js` |
| **Friend Gym Finder** | Finds gyms where friends have virtual submissions | `gym-page.js`, `cf-api.js` |
