# Auto-update

VeloxMark checks [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
for new versions and routes the update differently depending on how you installed it.

## Behavior by install form

| Install form | Update behavior |
| --- | --- |
| Windows NSIS installer | Full check → download → prompt → install on restart |
| Linux AppImage | Full check → download → prompt → install on restart |
| macOS (dmg / zip) | Check only — the unsigned build can't complete Squirrel.Mac updates, so the app opens the releases page |
| Portable zip / deb / rpm / snap / tar.gz | Notify-only — a new version is announced and linked |
| Dev mode (`npm run dev`) | Notify-only |

After a download completes, **the app asks before quitting to install** — nothing happens
behind your back.

## Checking manually

Use **Help → Check for updates** in the app menu. On notify-only install forms this opens
or points you at the releases page.

## Update manifests

Release assets include electron-updater manifests (`latest.yml`, `latest-mac.yml`,
`latest-linux.yml`, `latest-linux-arm64.yml`) and `SHA256SUMS.txt`. The Windows manifest's
`path` points at the universal `VeloxMark-Setup-<ver>.exe`.

## If an update fails

1. Check your network / proxy — updates come from GitHub Releases.
2. Verify the download manually against `SHA256SUMS.txt`
   (see [Installation](./installation#verify-the-download)).
3. Fall back to a fresh install from the [releases page](https://github.com/biao-biao-ls/veloxmark/releases) —
   your settings and drafts are kept.
