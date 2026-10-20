# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VeloxMark — a Typora-style Markdown desktop reader/editor with live preview. Electron + electron-vite + React + TypeScript; the editor core is CodeMirror 6. Open source (MIT) for a global audience.

## Language policy (strict)

- Git commit messages: English only (conventional-commit style, e.g. `fix(titlebar): ...`).
- Code comments, docs, README, CI/build-config comments: English only.
- Chinese (and other translations) belong ONLY in the localization packs:
  - `src/renderer/src/i18n/zh.ts` — UI dictionary (plus the `'prefs.langZh': '中文'` language self-name in `en.ts`)
  - `electron/shared/menuStrings.ts` — the `zh` section of native menu strings
  - `src/renderer/src/content.ts` — the `*_ZH` welcome/help document constants
  - `src/renderer/src/editor/mermaidTemplates.ts` — the `zh` template bodies
- No other file in the repo may contain CJK text. Write CJK character classes as `\u` escapes (see `src/renderer/src/statusbar/stats.ts`).

## Commands

```bash
npm install       # if Electron downloads fail: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
npm run dev       # dev mode with hot reload
npm run build     # build main/renderer to out/
npm run typecheck # tsc --noEmit (web + node configs) — run before committing
npm run build:mac # package dmg/zip; also build:win, build:linux
```

There is no unit-test suite. Verification is `npm run typecheck` + `npm run build`, plus CDP-driven probe runs against the e2e seams in `src/renderer/src/e2e/seams/` when touching editor behavior.

## Architecture

Big-picture invariant: **Markdown source text is the only data source.** Saving writes plain `.md` with zero round-trip loss; everything rich is an ephemeral decoration. Decorations must never mutate the document — content edits go through transactions back into the source range the widget owns.

- `electron/` — main process: windows, file dialogs, the `mdres://` image protocol, native menus (`menu/darwin.ts`, labels from `shared/menuStrings.ts`), and `updater.ts` (auto-update routing).
- `electron/preload.ts` + `electron/shared/api.ts` — the contextBridge-safe IPC contract; extend `api.ts` when adding IPC.
- `src/renderer/src/editor/livePreview/` — the live-preview engine: a CodeMirror 6 StateField rebuilds Decorations on every document/selection change. Syntax markers are hidden with replace decorations; code/math/mermaid/image blocks are swapped for widgets; the caret line stays in source form.
- `src/renderer/src/editor/table/` — table widget with nested CodeMirror cell editors. The commit/handoff protocol (`nestedSession.ts`, `parse.ts`, `widget.ts`) exists to prevent microtask commit death loops on widget rebuilds — read the comments there before touching cell editing or column resize.
- `src/renderer/src/editor/mermaid/` and `editor/math/` — block widgets that render in place and switch to source editing on click.
- `src/renderer/src/i18n/` — `t(key)` / `useTranslation()` dictionaries (en/zh). `getLang()` drives locale-dependent content (`content.ts`, `mermaidTemplates.ts`); locale-specific sample text must be selected through these functions, never hardcoded.
- `src/renderer/src/export/` — PDF/HTML export renders the document from source (via `export/renderDoc/`), not from the editor DOM.

## Release process

Releases ship via GitHub Releases; electron-updater consumes the release assets. Pushing a `v*` tag triggers `.github/workflows/release.yml` (validate → dual-arch builds on macos-15/windows-latest/ubuntu-22.04 → collect assets + `SHA256SUMS.txt` → upload to a draft release → promote to published).

Standard flow:

1. Clean tree, `npm run typecheck` green.
2. Bump the version — `package.json` `version` MUST equal the tag (CI enforces this). `npm version patch --no-git-tag-version`, or edit by hand for minor/major.
3. Commit and `git push origin main` first; let it land.
4. Tag and push it **separately** (never in the same push as main or as a workflow-file change — the race silently skips the run):
   `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
5. CI runs fully automatically; afterwards walk the checklist below.

Pre-releases: a tag with a `-` suffix (e.g. `v0.2.0-rc.1`) is auto-marked prerelease; it must still match the package.json version.

Artifacts (per version, dual-arch x64+arm64 unless noted):

- Windows: NSIS `VeloxMark-Setup-<ver>-<arch>.exe` (auto-update) + universal `VeloxMark-Setup-<ver>.exe` (the update manifest `path:` points here) + portable `VeloxMark-Win-<arch>-<ver>.zip` (no auto-update)
- macOS: `dmg` + `zip` (the zip is the auto-update vehicle; builds are unsigned)
- Linux: `AppImage` (auto-update) + `deb`/`rpm`/`tar.gz` + `snap` (x64 only)
- Manifests: `latest.yml` / `latest-mac.yml` / `latest-linux.yml` / `latest-linux-arm64.yml` + `SHA256SUMS.txt`

Note: `${arch}` resolves per packaging format (AppImage/rpm: `x86_64`/`aarch64`; deb: `amd64`/`arm64`; tar.gz: `x64`/`arm64`) — that is each format's convention; don't unify.

Update-channel behavior (`electron/updater.ts` routes by install form): full check/download/install on Windows NSIS installs and Linux AppImage; unsigned macOS builds fail Squirrel.Mac and degrade to opening the releases page; everything else (portable zip, deb/rpm/snap/tar.gz, dev mode) is notify-only manual checking. After download, the app asks the user before quitting to install.

Signing: route A — no certificates ($0). Do NOT treat locally packaged builds as representative of releases (the dev keychain signs `build:mac`, CI does not). Upgrade path later: add `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` secrets and set `mac.notarize: { teamId }` in `electron-builder.yml`; nothing else changes.

Post-release checklist:

1. All three build jobs + the release job green;
2. Releases page has the full asset set; `SHA256SUMS.txt` passes `sha256sum -c`;
3. Update path: install an old version → check for updates → download → restart → version changes (full auto on Windows NSIS / Linux AppImage; mac verifies the fallback prompt; notify-only forms don't error);
4. Clean-machine install matches the release-notes guidance (mac: `xattr -d com.apple.quarantine`);
5. Release notes contain the xattr + checksum guidance (auto-composed by the release job).

Troubleshooting (field-tested):

- Tag pushed but no workflow run → the tag shared a push with the workflow-file change; re-push the tag alone: `git push origin :refs/tags/vX.Y.Z && git push origin vX.Y.Z`.
- After editing the workflow, "re-run failed jobs" uses the OLD workflow — delete and re-push the tag instead (delete any leftover draft release first to avoid asset collisions).
- The release job does no checkout; every `gh` call there needs `--repo "$GITHUB_REPOSITORY"`.
- If only the promote step failed and assets are fully uploaded: PATCH the draft to `draft:false` via the API instead of rebuilding.
