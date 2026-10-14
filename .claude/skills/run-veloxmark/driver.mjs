#!/usr/bin/env node
/**
 * VeloxMark observation driver (macOS).
 *
 * Launch `npm run dev`, locate the app window via a tiny clang-compiled
 * CGWindowList helper (the swift toolchain on this machine is broken — see
 * SKILL.md Gotchas), screenshot the window itself (not the screen region —
 * `screencapture -R` captures whatever is on top), and read the OS window
 * title / bounds via osascript.
 *
 * Usage: node driver.mjs <command> [args]
 *   launch          start `npm run dev` (or attach to an already-running one)
 *   win             list VeloxMark windows as JSON lines (id, title, bounds)
 *   title           OS window title + position/size via System Events
 *   front           bring the window to the front
 *   ss [name]       screenshot the window → $SCREENSHOT_DIR (default /tmp/veloxmark-shots)
 *   quit            stop the dev process started by `launch`
 */
import { spawn, execFileSync, execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const REPO = path.resolve(import.meta.dirname, '../../..')
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/veloxmark-shots'
const WINID_SRC = path.join(os.tmpdir(), 'veloxmark-winid.m')
const WINID_BIN = path.join(os.tmpdir(), 'veloxmark-winid')
const PID_FILE = path.join(os.tmpdir(), 'veloxmark-dev.pid')
const LOG_FILE = path.join(os.tmpdir(), 'veloxmark-dev.log')

// ---- the CGWindowList helper (clang; swift toolchain is broken on this box) --
const WINID_M = `#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
int main() {
  CFArrayRef list = CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
      kCGNullWindowID);
  for (NSDictionary *w in (__bridge NSArray *)list) {
    NSString *owner = w[(__bridge NSString *)kCGWindowOwnerName] ?: @"";
    NSString *title = w[(__bridge NSString *)kCGWindowName] ?: @"";
    int layer = [w[(__bridge NSString *)kCGWindowLayer] intValue];
    BOOL isOurs = [owner isEqualToString:@"Electron"] || [owner isEqualToString:@"VeloxMark"]
        || [title containsString:@"VeloxMark"];
    if (isOurs && layer == 0) {
      CGRect b = CGRectZero;
      CGRectMakeWithDictionaryRepresentation(
          (__bridge CFDictionaryRef)w[(__bridge NSString *)kCGWindowBounds], &b);
      printf("{\\"id\\":%d,\\"owner\\":\\"%s\\",\\"title\\":\\"%s\\","
             "\\"x\\":%.0f,\\"y\\":%.0f,\\"w\\":%.0f,\\"h\\":%.0f}\\n",
             [w[(__bridge NSString *)kCGWindowNumber] intValue],
             owner.UTF8String, title.UTF8String,
             b.origin.x, b.origin.y, b.size.width, b.size.height);
    }
  }
  return 0;
}
`

function ensureWinid() {
  if (fs.existsSync(WINID_BIN)) return
  fs.writeFileSync(WINID_SRC, WINID_M)
  execFileSync('clang', [
    '-framework', 'CoreGraphics', '-framework', 'Foundation',
    '-o', WINID_BIN, WINID_SRC
  ], { stdio: 'inherit' })
}

function windows() {
  ensureWinid()
  const out = execFileSync(WINID_BIN, { encoding: 'utf8' })
  return out.split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

function pickWindow() {
  const all = windows()
  if (all.length === 0) return null
  // Prefer a window whose OS title mentions VeloxMark (unambiguous).
  return all.find((w) => w.title.includes('VeloxMark')) ?? all[0]
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim()
}

/** osascript helper: pass the AppleScript source, not a pre-quoted -e string. */
function osa(script) {
  return run('osascript', ['-e', script])
}

// ---- commands ---------------------------------------------------------------
const COMMANDS = {
  launch() {
    const existing = pickWindow()
    if (existing) {
      console.log(`already running (window ${existing.id}: "${existing.title}")`)
      console.log('use `quit` first if you want a cold launch')
      return
    }
    const child = spawn('npm', ['run', 'dev'], {
      cwd: REPO,
      detached: true,
      stdio: ['ignore', fs.openSync(LOG_FILE, 'a'), fs.openSync(LOG_FILE, 'a')]
    })
    child.unref()
    fs.writeFileSync(PID_FILE, String(child.pid))
    console.log(`launched: npm run dev (pid ${child.pid}, log ${LOG_FILE})`)
    // Poll up to 60s for the window to show up.
    for (let i = 0; i < 60; i++) {
      const w = pickWindow()
      if (w) {
        console.log(`window ready (id ${w.id}): "${w.title}" ${w.w}x${w.h}+${w.x}+${w.y}`)
        return
      }
      execSync('sleep 1')
    }
    console.log('TIMEOUT: no VeloxMark window after 60s — check', LOG_FILE)
    process.exit(1)
  },

  win() {
    const all = windows()
    if (all.length === 0) return console.log('no VeloxMark window found')
    for (const w of all) console.log(JSON.stringify(w))
  },

  title() {
    // AppleScript: keep the return expression on ONE line — line breaks inside
    // a `&` chain are a syntax error.
    console.log(osa(`
tell application "System Events" to tell (first process whose name is "Electron" or name is "VeloxMark")
  set n to name of window 1
  set p to position of window 1
  set s to size of window 1
  return n & " | " & ((item 1 of p) as text) & "," & ((item 2 of p) as text) & " | " & ((item 1 of s) as text) & "x" & ((item 2 of s) as text)
end tell`))
  },

  front() {
    osa('tell application "System Events" to set frontmost of (first process whose name is "Electron" or name is "VeloxMark") to true')
    console.log('frontmost')
  },

  ss(name) {
    const w = pickWindow()
    if (!w) return console.log('ERROR: no VeloxMark window — run `launch` first')
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png')
    execFileSync('screencapture', ['-x', `-l${w.id}`, f])
    console.log('screenshot:', f, `(window ${w.id}: "${w.title}")`)
  },

  quit() {
    const pid = fs.existsSync(PID_FILE) ? Number(fs.readFileSync(PID_FILE, 'utf8')) : null
    if (pid) {
      try {
        process.kill(-pid, 'SIGTERM') // the whole detached npm process group
        console.log(`stopped dev process group ${pid}`)
      } catch {
        console.log(`pid ${pid} already gone`)
      }
      fs.rmSync(PID_FILE, { force: true })
      execSync('sleep 2')
    } else {
      console.log('no pid file — no instance started by this driver')
    }
    // Killing the npm group does NOT take the Electron main process down —
    // it detaches, keeps the window alive and respawns crash helpers. Sweep
    // the WHOLE veloxmark node_modules tree (electron-vite parent, esbuild,
    // Electron main + helpers), escalating to SIGKILL. SIGTERM alone is not
    // enough: with a dead renderer the close handshake can stall the main
    // process into a zombie that ignores SIGTERM (fixed in main.ts, but an
    // older build may still be running).
    const sweep = (sig) => {
      const pids = execSync('pgrep -f "veloxmark/node_modules" || true', {
        encoding: 'utf8'
      }).split('\n').filter(Boolean)
      for (const p of pids) {
        try { process.kill(Number(p), sig) } catch { /* already gone */ }
      }
      return pids
    }
    const term = sweep('SIGTERM')
    if (term.length > 0) {
      console.log(`swept (SIGTERM) pids: ${term.join(', ')}`)
      execSync('sleep 2')
    }
    const kill = sweep('SIGKILL')
    if (kill.length > 0) console.log(`swept (SIGKILL) pids: ${kill.join(', ')}`)
    const remain = sweep('SIGKILL')
    console.log(
      remain.length === 0
        ? 'clean: no veloxmark processes remain'
        : `WARNING: still alive after SIGKILL: ${remain.join(', ')}`
    )
  },

  help() {
    console.log('commands: launch, win, title, front, ss [name], quit')
  }
}

const [cmd, ...rest] = process.argv.slice(2)
const fn = COMMANDS[cmd ?? 'help']
if (!fn) {
  console.log(`unknown command: ${cmd} — try: help`)
  process.exit(1)
}
fn(rest.join(' '))
