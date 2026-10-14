---
name: run-veloxmark
description: Launch and observe the VeloxMark Electron Markdown editor (macOS). Use when asked to run, start, or screenshot VeloxMark, or inspect its window title/tabs. Primary path is the observation driver at .claude/skills/run-veloxmark/driver.mjs.
---

# run-veloxmark

VeloxMark is an Electron + electron-vite Markdown editor (React 19 renderer).
This skill covers **launch + window-level observation** (screenshot, title,
bounds) via `driver.mjs`. The driver is observe-only — it does not click or
type into the UI (no CDP port is wired up). All paths relative to the repo root.

## Prerequisites

macOS with Xcode Command Line Tools (`clang`), `osascript`, `screencapture`,
Node ≥ 20. First time only:

```bash
npm install
```

## Run (agent path)

```bash
node .claude/skills/run-veloxmark/driver.mjs launch   # npm run dev + wait for window
node .claude/skills/run-veloxmark/driver.mjs win      # JSON lines: id, title, bounds
node .claude/skills/run-veloxmark/driver.mjs title    # OS title | x,y | WxH (System Events)
node .claude/skills/run-veloxmark/driver.mjs front    # bring window to front
node .claude/skills/run-veloxmark/driver.mjs ss name  # window screenshot → $SCREENSHOT_DIR
node .claude/skills/run-veloxmark/driver.mjs quit     # stop dev + sweep Electron leftovers
```

Screenshots land in `/tmp/veloxmark-shots/` (override with `SCREENSHOT_DIR`).
`ss` captures the **window itself** by CGWindowID, so occlusion doesn't matter.
The driver compiles a small CGWindowList helper with clang on first use
(`$TMPDIR/veloxmark-winid`) — no manual step.

**Look at the screenshot** before reporting anything about the UI.

## Run (human path)

```bash
npm run dev
```

Opens a window on the desktop. Ctrl-C to stop (see Gotcha about orphans).

## Gotchas

- **The swift toolchain on this machine is broken** (`redefinition of module
  'SwiftBridging'` / SDK-vs-compiler mismatch). Don't write swift one-liners
  for window lookup — the driver compiles an Objective-C helper with `clang`
  instead. That's the only working path found.
- **`screencapture -R x,y,w,h` captures the screen region, not the window** —
  anything overlapping the app lands in the shot. Always use
  `screencapture -l<windowid>` (what `ss` does). Find the id via `win`.
- **Killing `electron-vite` leaves an orphaned Electron main process** with the
  window still alive. `quit` kills the npm process group AND sweeps leftover
  `veloxmark/node_modules/electron/dist` pids — use it instead of `pkill`.
- **JXA (`osascript -l JavaScript`) can't enumerate CGWindowList** —
  `ObjC.deepUnwrap` chokes on the CFArray (`TypeError: {} is not iterable`).
  Use the clang helper.
- **AppleScript: a `&` concatenation in `return` must stay on one line** —
  line-wrapping it is a syntax error (`expected end tell, found &`).
- **The welcome tab's display name is localized** — tab, in-app titlebar and
  OS window title all show `Welcome`/`欢迎` (`t('tabs.welcome')`) and flip live
  on language switches. Its mechanical `name` is `'welcome'`; the untitled
  counter starts at 1 for real New File tabs. Driver window selection keys on
  the `VeloxMark` title suffix, which is unchanged.
