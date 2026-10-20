import { useEffect, useMemo, useRef } from 'react'
import type { MenuDef } from '../components/MenuBar'
import {
  buildCommands,
  buildMenus,
  matchGlobalShortcut,
  type CommandOps,
  type RecentItem
} from '../commands'

interface Args extends CommandOps {
  isMac: boolean
  recentItems: RecentItem[]
}

export function useMenus({ isMac, recentItems, ...ops }: Args): {
  menus: MenuDef[]
} {
  const commands = buildCommands(ops)
  const commandsRef = useRef(commands)
  commandsRef.current = commands

  const menus = useMemo(
    () => buildMenus(commands, isMac, recentItems, ops),
    [commands, isMac, recentItems]
  )

  useEffect(() => {
    const offs = commandsRef.current.map((cmd) =>
      window.api.onMenu(cmd.id, () => commandsRef.current.find((c) => c.id === cmd.id)?.run())
    )
    return () => offs.forEach((off) => off())
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      const cmd = matchGlobalShortcut(e, commandsRef.current)
      if (!cmd) return
      e.preventDefault()
      cmd.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { menus }
}
