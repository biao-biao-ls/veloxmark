#!/usr/bin/env node
// Dev mode runs inside node_modules' Electron.app, and macOS takes the
// menu-bar app name from that bundle's CFBundleName ("Electron").
// app.setName() cannot change it — Electron documents that it only overrides
// the name used internally, "not the name that the OS uses". So patch the
// dev bundle's Info.plist. Idempotent; skipped on non-macOS or before the
// Electron binary has been downloaded.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') process.exit(0)

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const plist = join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Info.plist')
if (!existsSync(plist)) process.exit(0)

try {
  for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
    execFileSync('/usr/bin/plutil', ['-replace', key, '-string', 'VeloxMark', plist], {
      stdio: 'ignore'
    })
  }
} catch {
  // Non-fatal: dev still runs, only the menu-bar name stays "Electron".
  console.warn('[patch-dev-electron-name] failed to patch Info.plist')
}
