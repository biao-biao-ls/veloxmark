/**
 * P10 table context menu — plain DOM float reusing the `.tree-menu` styles
 * from the file tree (TreeMenu.tsx is React; CM widgets stay framework-free).
 */

export interface TableMenuItem {
  label: string
  danger?: boolean
  disabled?: boolean
  action: () => void
}

let menuEl: HTMLElement | null = null

export function closeTableMenu(): void {
  if (!menuEl) return
  menuEl.remove()
  menuEl = null
  document.removeEventListener('mousedown', onOutside, true)
  document.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', closeTableMenu)
  window.removeEventListener('blur', closeTableMenu)
}

function onOutside(e: MouseEvent): void {
  if (menuEl && !menuEl.contains(e.target as Node)) closeTableMenu()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    closeTableMenu()
  }
}

/** Open the menu at viewport coordinates; replaces any open table menu. */
export function showTableMenu(x: number, y: number, items: TableMenuItem[]): void {
  closeTableMenu()
  const el = document.createElement('div')
  el.className = 'tree-menu cm-md-table-menu'
  el.setAttribute('role', 'menu')
  for (const item of items) {
    const btn = document.createElement('button')
    btn.className = `tree-menu-item${item.danger ? ' tree-menu-danger' : ''}`
    btn.setAttribute('role', 'menuitem')
    btn.textContent = item.label
    btn.disabled = item.disabled ?? false
    btn.addEventListener('click', () => {
      closeTableMenu()
      if (!btn.disabled) item.action()
    })
    el.appendChild(btn)
  }
  document.body.appendChild(el)
  // Flip into the viewport when the menu would overflow.
  const rect = el.getBoundingClientRect()
  el.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`
  el.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`
  menuEl = el
  document.addEventListener('mousedown', onOutside, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', closeTableMenu)
  window.addEventListener('blur', closeTableMenu)
}
