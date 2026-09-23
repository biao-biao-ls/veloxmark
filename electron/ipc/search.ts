import { ipcMain } from 'electron'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import {
  IpcChannels,
  type SearchFileResult,
  type SearchMatch,
  type SearchOptions,
  type SearchReplaceRequest,
  type SearchReplaceResult,
  type SearchRunPayload
} from '../shared/api'
import { applyFolderScanOptions, isIgnoredPath } from './folder'

/**
 * P13 folder-wide search/replace (main process).
 *
 * Traversal reuses folder.ts ignore rules so the search scope matches the
 * sidebar tree exactly. Results stream to the renderer on `search:results`
 * in batches, yielding to the event loop between batches so large trees
 * never block the main process. Replace writes whole files in main; the
 * renderer passes skipPaths for documents it holds open+dirty.
 */

const DEFAULT_EXTS = ['md', 'markdown', 'mdown', 'txt']
const MAX_SCAN_DEPTH = 8
const MAX_BATCH_MATCHES = 50
const PER_FILE_HARD_CAP = 200
const PATHOLOGICAL_LINE_CAP = 5000

let searchCounter = 0

function extList(options: SearchOptions | undefined): string[] {
  const exts = options?.exts?.filter((e) => typeof e === 'string' && e.trim() !== '')
  return exts?.length ? exts.map((e) => e.toLowerCase().replace(/^\./, '')) : DEFAULT_EXTS
}

function hasExt(name: string, exts: string[]): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && exts.includes(name.slice(dot + 1).toLowerCase())
}

type Compiled = { re: RegExp } | { error: string }

function compile(pattern: string, options: SearchOptions): Compiled {
  if (!pattern) return { error: 'Empty pattern' }
  const flags = options.caseSensitive ? 'g' : 'gi'
  try {
    if (options.regex) {
      const body = options.wholeWord ? `\\b(?:${pattern})\\b` : pattern
      return { re: new RegExp(body, flags) }
    }
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return { re: new RegExp(options.wholeWord ? `\\b${escaped}\\b` : escaped, flags) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid regular expression' }
  }
}

/** Walk the tree with the same ignore/hidden rules as the folder listing. */
async function collectFiles(root: string, exts: string[], depth = 0, acc: string[] = []): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return acc
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (isIgnoredPath(entry.name)) continue
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(full, exts, depth + 1, acc)
    } else if (entry.isFile() && hasExt(entry.name, exts)) {
      acc.push(full)
    }
  }
  return acc
}

/** Window the line around the match so long lines stay readable. */
function snippetOf(lineText: string, col: number, length: number): { text: string; snippetCol: number } {
  const start = Math.max(0, col - 40)
  const end = Math.min(lineText.length, col + length + 40)
  let text = lineText.slice(start, end).replace(/\t/g, '  ')
  if (text.length > 200) text = `${text.slice(0, 200)}…`
  return { text, snippetCol: Math.max(0, col - start) }
}

function matchFile(
  content: string,
  re: RegExp,
  maxMatches: number
): { matches: SearchMatch[]; count: number } {
  const matches: SearchMatch[] = []
  let count = 0
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]
    re.lastIndex = 0
    let m: RegExpExecArray | null
    let lineHits = 0
    while ((m = re.exec(lineText)) !== null) {
      count++
      lineHits++
      if (matches.length < maxMatches && m[0].length >= 0) {
        const { text, snippetCol } = snippetOf(lineText, m.index, m[0].length)
        matches.push({
          line: i + 1,
          col: m.index,
          length: m[0].length,
          lineText: text,
          snippetCol
        })
      }
      if (m[0].length === 0) re.lastIndex++
      if (lineHits > PATHOLOGICAL_LINE_CAP) break
    }
    if (count > PATHOLOGICAL_LINE_CAP * 2) break
  }
  return { matches, count }
}

export function registerSearchIpc(): void {
  ipcMain.handle(
    IpcChannels.searchRun,
    (
      e,
      rootPath: string,
      pattern: string,
      options: SearchOptions
    ): { searchId: number; error?: string } => {
      const searchId = ++searchCounter
      if (options?.scanOptions) applyFolderScanOptions(options.scanOptions)
      const safeOptions: SearchOptions = options ?? { caseSensitive: false, wholeWord: false, regex: false }
      const compiled = compile(pattern, safeOptions)
      if ('error' in compiled) return { searchId, error: compiled.error }

      const sender = e.sender
      void (async () => {
        const exts = extList(safeOptions)
        const files = await collectFiles(rootPath, exts)
        let totalMatches = 0
        let batch: SearchFileResult[] = []
        let batchMatches = 0
        const flush = (done: boolean): void => {
          const payload: SearchRunPayload = {
            searchId,
            files: batch,
            done,
            ...(done ? { totalMatches } : {})
          }
          batch = []
          batchMatches = 0
          if (!sender.isDestroyed()) sender.send(IpcChannels.searchResults, payload)
        }
        for (const file of files) {
          let content: string
          try {
            content = await readFile(file, 'utf8')
          } catch {
            continue
          }
          const { matches, count } = matchFile(
            content,
            new RegExp(compiled.re.source, compiled.re.flags),
            safeOptions.maxPerFile ?? PER_FILE_HARD_CAP
          )
          if (count === 0) continue
          totalMatches += count
          batch.push({
            path: file,
            relPath: relative(rootPath, file).split(sep).join('/'),
            matches,
            matchCount: count
          })
          batchMatches += matches.length
          if (batchMatches >= MAX_BATCH_MATCHES) {
            flush(false)
            await new Promise((resolve) => setImmediate(resolve))
          }
        }
        flush(true)
      })()
      return { searchId }
    }
  )

  ipcMain.handle(IpcChannels.searchReplace, async (_e, req: SearchReplaceRequest): Promise<SearchReplaceResult> => {
    const empty = { replaced: 0, skipped: [], written: [] }
    try {
      if (!req || typeof req.rootPath !== 'string' || typeof req.pattern !== 'string') {
        return { ...empty, error: 'Invalid replace request' }
      }
      if (req.options?.scanOptions) applyFolderScanOptions(req.options.scanOptions)
      const safeOptions: SearchOptions = req.options ?? {
        caseSensitive: false,
        wholeWord: false,
        regex: false
      }
      const compiled = compile(req.pattern, safeOptions)
      if ('error' in compiled) return { ...empty, error: compiled.error }

      const skip = new Set(req.skipPaths ?? [])
      let targets: string[]
      if (req.scope === 'all') {
        targets = await collectFiles(req.rootPath, extList(safeOptions))
      } else if (req.path) {
        targets = [req.path]
      } else {
        return { ...empty, error: 'Missing file path for replace' }
      }

      let replaced = 0
      const skipped: string[] = []
      const written: string[] = []
      for (const file of targets) {
        if (skip.has(file)) {
          skipped.push(file)
          continue
        }
        let content: string
        try {
          content = await readFile(file, 'utf8')
        } catch {
          continue
        }
        const nl = content.includes('\r\n') ? '\r\n' : '\n'
        const lines = content.split(/\r?\n/)

        if (req.scope === 'one') {
          const lineNo = req.line ?? 0
          const col = req.col ?? -1
          const re = new RegExp(compiled.re.source, compiled.re.flags)
          let done = false
          const out = lines.map((lt, idx) => {
            if (done || idx + 1 !== lineNo) return lt
            re.lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = re.exec(lt)) !== null) {
              if (m.index === col) {
                done = true
                return lt.slice(0, m.index) + req.replace + lt.slice(m.index + m[0].length)
              }
              if (m[0].length === 0) re.lastIndex++
            }
            return lt
          })
          // Stale result (content changed since the search) — skip quietly.
          if (!done) continue
          await writeFile(file, out.join(nl))
          replaced++
          written.push(file)
        } else {
          const re = new RegExp(compiled.re.source, compiled.re.flags)
          let count = 0
          // Literal replacement — `$` patterns in the replace string are not expanded.
          const next = content.replace(re, () => {
            count++
            return req.replace
          })
          if (count === 0) continue
          await writeFile(file, next)
          replaced += count
          written.push(file)
        }
      }
      return { replaced, skipped, written }
    } catch (err) {
      return { ...empty, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
