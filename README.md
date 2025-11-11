# Codeforces QoL

Minimal Firefox WebExtension (MV2) skeleton for Codeforces quality-of-life features.

Load temporarily in Firefox: open about:debugging > This Firefox > Load Temporary Add-on… and select manifest.json. MV2 is used for compatibility with temporary installs.

Structure:

- manifest.json
- src/background/background.js
- src/content/{global,contest,submit,standings}.js
- src/ui/{popup.{html,js,css}, options.{html,js,css}}
- src/shared/{storage.js, dom-utils.js}
- assets/icon-16.png, icon-32.png, icon-48.png, icon-128.png

Notes:

- Icons are placeholders; replace with real PNGs.
- Background runs via MV2 background script.
- Content scripts include basic URL guards only.

Popup:

- Toggle Focus Mode on/off from the extension popup. Changes apply live on contest pages; reload if needed.

Features:

- Focus Mode: hides standings and solved counts on contest/gym pages.
- Submit Clipboard in C++: on problem pages, a sidebar button (between “Submit?” and “Last submissions”) reads your clipboard, opens a background submit tab, selects the most recent available C++ version, pastes your code, auto-submits, and then switches to My Submissions.
