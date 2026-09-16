import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MenuDef } from '../components/MenuBar'
import {
  buildCommands,
  buildMenus,
  fmtShortcut,
  matchGlobalShortcut,
  type CommandOps
} from '../commands'

interface Args extends CommandOps {
  isMac: boolean
}

/**
 * Wires the command registry to the three consumers: the in-app MenuBar,
 * the global keydown and the macOS native-menu dispatch (`menu:<id>`).
 * All of them are generated from commands.ts — nothing is hand-listed here.
 */
export function useMenus({ isMac, ...ops }: Args): {
  menus: MenuDef[]
  formatShortcut: (shortcut: string) => string
} {
  // Rebuilt every render so handlers always close over the latest ops;
  // subscriptions below read through a ref instead of re-binding.
  const commands = buildCommands(ops)
  const commandsRef = useRef(commands)
  commandsRef.current = commands

  const menus = useMemo(() => buildMenus(commands, isMac), [commands, isMac])

  // macOS native menu: every command id gets a `menu:<id>` channel; ids the
  // native menu never sends simply stay silent.
  useEffect(() => {
    const offs = commandsRef.current.map((cmd) =>
      window.api.onMenu(`menu:${cmd.id}`, () => commandsRef.current.find((c) => c.id === cmd.id)?.run())
    )
    return () => offs.forEach((off) => off())
  }, [])

  // Global shortcuts (native accelerators are gone with the native menu on
  // Win/Linux). Only `bindGlobal` commands participate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const cmd = matchGlobalShortcut(e, commandsRef.current)
      if (!cmd) return
      e.preventDefault()
      cmd.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const formatShortcut = useCallback((s: string) => fmtShortcut(s, isMac), [isMac])
  return { menus, formatShortcut }
}
