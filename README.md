# Codeforces QoL

Quality-of-life enhancements for Codeforces. A Firefox WebExtension (MV2).

## Installation

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on..."
3. Select `manifest.json` from this repository

## Features

### Focus Mode
Hides standings and solve counts on contest pages to avoid distraction. Toggle from the popup or options page. Changes apply live.

### Submit Clipboard in C++
On problem pages, a sidebar button lets you:
1. Read C++ code from clipboard
2. Automatically open submit form
3. Select the latest C++ compiler
4. Paste and auto-submit your code

### Instant Problem Navigation
Use **ArrowLeft/ArrowRight** to switch between problems instantly without page reload. Works on contest and gym problem pages.

### Hide Test Case Info
Hides "on test X" from verdict messages for an ICPC-style experience. Toggle from popup/options.

### Friend Gym Finder
On the `/gyms` page, find 5-hour gyms from the last 8 years where your friends have virtual submissions but you don't. Requires API key setup in options.

## Structure

```
manifest.json
src/
  background/background.js     ← Background script
  content/
    global.js                  ← Submit Clipboard button
    contest.js                 ← Focus Mode
    submit.js                  ← Submit form auto-fill
    submission.js              ← Hide Test Case Info
    navigation.js              ← Instant Navigation
    gym-page.js                ← Friend Gym Finder
  ui/
    popup.{html,js,css}        ← Extension popup
    options.{html,js,css}      ← Options page
  shared/
    storage.js                 ← Cross-browser storage
    cf-api.js                  ← Codeforces API wrapper
    sha512.js                  ← SHA-512 for API auth
assets/
  icon-{16,32,48,128}.png      ← Extension icons
```

## Configuration

### Popup Toggles
- **Focus Mode** – Hide standings/solve counts
- **Instant Problem Navigation** – Arrow key navigation
- **Hide Test Case Info** – ICPC-style verdicts

### Options Page
All popup toggles plus API credentials for Friend Gym Finder:
- **Codeforces Handle** – Your username
- **API Key / Secret** – From [codeforces.com/settings/api](https://codeforces.com/settings/api)

## Notes

- Icons are placeholders; replace with real PNGs.
- Uses MV2 for Firefox temporary install compatibility.
- Content scripts run at `document_start` to prevent UI flashes.
