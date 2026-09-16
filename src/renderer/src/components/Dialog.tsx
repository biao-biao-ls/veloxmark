import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * In-app modal dialogs replacing the native alert/confirm/prompt.
 *
 * Imperative, Promise-based API (`dialog.confirm({...})`) backed by a
 * module-level singleton queue. `DialogHost` is mounted once at the App root
 * and renders the active request; callers anywhere (including non-React
 * hooks) just await the promise. Theme follows the app via CSS variables.
 */

export interface AlertOptions {
  message: string
  title?: string
  okLabel?: string
}

export interface ConfirmOptions {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive action — confirm button uses the danger color. */
  danger?: boolean
}

export interface PromptOptions {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

// ---- singleton store --------------------------------------------------------

interface DialogRequest {
  id: number
  kind: 'alert' | 'confirm' | 'prompt'
  title?: string
  message?: string
  defaultValue: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  resolve: (value: unknown) => void
}

let nextId = 1
let current: DialogRequest | null = null
const queue: DialogRequest[] = []
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DialogRequest | null {
  return current
}

function open(req: Omit<DialogRequest, 'id'>): void {
  const full = { ...req, id: nextId++ }
  if (current) queue.push(full)
  else {
    current = full
    listeners.forEach((l) => l())
  }
}

function settle(value: unknown): void {
  const req = current
  if (!req) return
  current = queue.shift() ?? null
  listeners.forEach((l) => l())
  req.resolve(value)
}

export const dialog = {
  alert(opts: AlertOptions | string): Promise<void> {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => {
      open({
        kind: 'alert',
        title: o.title,
        message: o.message,
        defaultValue: '',
        confirmLabel: o.okLabel ?? 'OK',
        cancelLabel: '',
        danger: false,
        resolve: () => resolve()
      })
    })
  },

  confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      open({
        kind: 'confirm',
        title: opts.title,
        message: opts.message,
        defaultValue: '',
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: opts.danger ?? false,
        resolve: (v) => resolve(v as boolean)
      })
    })
  },

  prompt(opts: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      open({
        kind: 'prompt',
        title: opts.title,
        message: opts.message,
        defaultValue: opts.defaultValue ?? '',
        placeholder: opts.placeholder,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: false,
        resolve: (v) => resolve(v as string | null)
      })
    })
  }
}

// Handle for CDP smoke tests (scripts/cdp-*.mjs) — no other runtime consumers.
declare global {
  interface Window {
    dialog: typeof dialog
  }
}
window.dialog = dialog

// ---- host + presentational component ----------------------------------------

/** Mount once inside the themed App root. Renders nothing when idle. */
export function DialogHost(): React.JSX.Element | null {
  const req = useSyncExternalStore(subscribe, getSnapshot)
  if (!req) return null
  return <Dialog key={req.id} req={req} />
}

interface Props {
  req: DialogRequest
}

function Dialog({ req }: Props): React.JSX.Element {
  const isMac = window.api.platform === 'darwin'
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const defaultBtnRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(req.defaultValue)

  const confirm = (): void => settle(req.kind === 'prompt' ? value : true)
  const cancel = (): void => settle(req.kind === 'prompt' ? null : false)

  // Initial focus: the input (with its default selected) or the default button.
  useEffect(() => {
    if (req.kind === 'prompt') {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      defaultBtnRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    // Keep the editor and window-level shortcuts from seeing dialog keys.
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
    } else if (e.key === 'Tab') {
      // Focus stays inside the dialog: cycle through its focusable elements.
      const root = dialogRef.current
      if (!root) return
      const list = Array.from(root.querySelectorAll<HTMLElement>('button, input'))
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // macOS puts the confirming action rightmost; Windows/Linux put it first.
  const confirmBtn = (
    <button
      ref={defaultBtnRef}
      className={`dialog-btn dialog-btn-primary${req.danger ? ' dialog-btn-danger' : ''}`}
      onClick={confirm}
    >
      {req.confirmLabel}
    </button>
  )
  const cancelBtn = (
    <button className="dialog-btn" onClick={cancel}>
      {req.cancelLabel}
    </button>
  )

  return (
    <div className="dialog-overlay" onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title ?? 'Dialog'}
      >
        {req.title && <div className="dialog-title">{req.title}</div>}
        {req.message && <div className="dialog-message">{req.message}</div>}
        {req.kind === 'prompt' && (
          <input
            ref={inputRef}
            className="dialog-input"
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="dialog-buttons">
          {req.kind === 'alert' ? (
            confirmBtn
          ) : isMac ? (
            <>
              {cancelBtn}
              {confirmBtn}
            </>
          ) : (
            <>
              {confirmBtn}
              {cancelBtn}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
