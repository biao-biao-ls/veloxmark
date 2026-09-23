import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { t, useTranslation } from '../i18n'

/**
 * In-app modal dialogs replacing the native alert/confirm/prompt.
 *
 * Imperative, Promise-based API (`dialog.confirm({...})`) backed by a
 * module-level singleton queue. `DialogHost` is mounted once at the App root
 * and renders the active request; callers anywhere (including non-React
 * hooks) just await the promise. Theme follows the app via CSS variables.
 */

/**
 * wave④/P17-F5: i18n key-based copy. When `*Key` fields are present the host
 * resolves them with t() at RENDER time, so an open dialog live-relabels when
 * the UI language changes (App re-renders on prefs.language). Resolved string
 * fields remain as fallback for call sites that pass pre-built copy.
 */
export interface DialogKeyedCopy {
  titleKey?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

export interface AlertOptions extends DialogKeyedCopy {
  message?: string
  title?: string
  okLabel?: string
}

export interface ConfirmOptions extends DialogKeyedCopy {
  message?: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive action — confirm button uses the danger color. */
  danger?: boolean
}

export interface PromptOptions extends DialogKeyedCopy {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

/** P12: three-way choice (e.g. Save / Don't Save / Cancel). */
export type ChooseResult = 'confirm' | 'discard' | 'cancel'

export interface ChooseOptions extends DialogKeyedCopy {
  message?: string
  title?: string
  confirmLabel?: string
  discardLabel?: string
  cancelLabel?: string
  /** Destructive third action — discard button uses the danger color. */
  danger?: boolean
}

// ---- singleton store --------------------------------------------------------

interface DialogRequest {
  id: number
  kind: 'alert' | 'confirm' | 'prompt' | 'choose'
  title?: string
  message?: string
  /** wave④/P17-F5: key-based copy resolved at render (live lang switch). */
  titleKey?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
  defaultValue: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  /** P12 choose dialogs only — middle/third button label. */
  discardLabel: string
  /** Label keys — resolved at render when the resolved label is empty. */
  confirmLabelKey?: string
  cancelLabelKey?: string
  discardLabelKey?: string
  danger: boolean
  resolve: (value: unknown) => void
}

/**
 * e2e canned responses (scripts/cdp-*.mjs). While one is active every dialog
 * kind resolves immediately with a canned value — nothing renders, nothing
 * queues — so a cdp script awaiting a product promise behind a modal (close
 * unsaved docs, crash-recovery drafts, search replace-all, external-link
 * confirm) can never wedge. Production never writes the localStorage key, so
 * runtime behavior is unchanged. Scripts that assert dialog UI (cdp-p12/p13/
 * p17/p26 sections) call `dialog.setAutoResponse(null)` to see real modals.
 *
 * Omitted kinds still auto-settle — "never wedge" beats fidelity. Defaults:
 * alert→ok, confirm→false, prompt→null, choose→'cancel' (no disk writes).
 * Boot pins prefer `choose: 'discard'` so close flows finish without routing
 * an untitled tab through the native Save As dialog (which the seam can't
 * dismiss).
 */
export interface DialogAutoResponse {
  alert?: boolean
  confirm?: boolean
  prompt?: string | null
  choose?: ChooseResult
}

const AUTO_KEY = 'veloxE2eDialogAuto'

let nextId = 1
let current: DialogRequest | null = null
const queue: DialogRequest[] = []
const listeners = new Set<() => void>()
let autoResponse: DialogAutoResponse | null = null

function readAutoFromStorage(): DialogAutoResponse | null {
  try {
    const raw = localStorage.getItem(AUTO_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as DialogAutoResponse)
      : null
  } catch {
    return null
  }
}

function activeAuto(): DialogAutoResponse | null {
  // Lazy consult: a boot-pin written before Page.reload covers dialogs that
  // open before the cdp script reconnects (leftover draft recovery, …).
  if (!autoResponse) autoResponse = readAutoFromStorage()
  return autoResponse
}

/** Canned value for a kind, or undefined when the real dialog must show. */
export function dialogAutoValue(
  kind: DialogRequest['kind'],
  auto: DialogAutoResponse | null
): boolean | string | null | ChooseResult | undefined {
  if (!auto) return undefined
  if (kind === 'alert') return auto.alert ?? true
  if (kind === 'confirm') return auto.confirm ?? false
  if (kind === 'prompt') return auto.prompt ?? null
  return auto.choose ?? 'cancel'
}

function settleWithAuto(req: Omit<DialogRequest, 'id'>): boolean {
  const v = dialogAutoValue(req.kind, activeAuto())
  if (v === undefined) return false
  req.resolve(v)
  return true
}

/** Settle everything pending (current + queue) with the active canned values. */
function drainPending(): number {
  const pending = [...(current ? [current] : []), ...queue]
  if (pending.length === 0) return 0
  current = null
  queue.length = 0
  listeners.forEach((l) => l())
  for (const req of pending) {
    const v = dialogAutoValue(req.kind, activeAuto())
    req.resolve(v === undefined ? true : v)
  }
  return pending.length
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DialogRequest | null {
  return current
}

function open(req: Omit<DialogRequest, 'id'>): void {
  if (settleWithAuto(req)) return
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
        titleKey: o.titleKey,
        messageKey: o.messageKey,
        messageParams: o.messageParams,
        defaultValue: '',
        confirmLabel: o.okLabel ?? '',
        confirmLabelKey: 'dialog.ok',
        cancelLabel: '',
        discardLabel: '',
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
        titleKey: opts.titleKey,
        messageKey: opts.messageKey,
        messageParams: opts.messageParams,
        defaultValue: '',
        confirmLabel: opts.confirmLabel ?? '',
        confirmLabelKey: 'dialog.ok',
        cancelLabel: opts.cancelLabel ?? '',
        cancelLabelKey: 'dialog.cancel',
        discardLabel: '',
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
        titleKey: opts.titleKey,
        messageKey: opts.messageKey,
        messageParams: opts.messageParams,
        defaultValue: opts.defaultValue ?? '',
        placeholder: opts.placeholder,
        confirmLabel: opts.confirmLabel ?? '',
        confirmLabelKey: 'dialog.ok',
        cancelLabel: opts.cancelLabel ?? '',
        cancelLabelKey: 'dialog.cancel',
        discardLabel: '',
        danger: false,
        resolve: (v) => resolve(v as string | null)
      })
    })
  },

  /** P12: three-way dialog — confirm / discard / cancel. */
  choose(opts: ChooseOptions): Promise<ChooseResult> {
    return new Promise((resolve) => {
      open({
        kind: 'choose',
        title: opts.title,
        message: opts.message,
        titleKey: opts.titleKey,
        messageKey: opts.messageKey,
        messageParams: opts.messageParams,
        defaultValue: '',
        confirmLabel: opts.confirmLabel ?? '',
        confirmLabelKey: 'dialog.save',
        cancelLabel: opts.cancelLabel ?? '',
        cancelLabelKey: 'dialog.cancel',
        discardLabel: opts.discardLabel ?? '',
        discardLabelKey: 'dialog.dontSave',
        danger: opts.danger ?? false,
        resolve: (v) => resolve(v as ChooseResult)
      })
    })
  },

  /**
   * e2e seam — canned responses for every dialog kind (see DialogAutoResponse).
   * Non-null enables auto-settle and immediately drains any pending modal so a
   * script that is already stuck unsticks on the next evaluate. Null restores
   * real dialogs. The value also round-trips through localStorage so it
   * survives Page.reload before the script reconnects.
   */
  setAutoResponse(responses: DialogAutoResponse | null): { pendingDrained: number } {
    autoResponse = responses
    try {
      if (responses) localStorage.setItem(AUTO_KEY, JSON.stringify(responses))
      else localStorage.removeItem(AUTO_KEY)
    } catch {
      /* storage unavailable — in-memory flag still covers this page session */
    }
    return { pendingDrained: responses ? drainPending() : 0 }
  },

  /** e2e diagnostics — active auto map, the rendered request, queue depth. */
  getState(): {
    auto: DialogAutoResponse | null
    current: { kind: DialogRequest['kind']; title?: string; message?: string } | null
    queued: number
  } {
    return {
      auto: activeAuto(),
      // Resolve keyed copy at read time so probes see current-language text.
      current: current
        ? {
            kind: current.kind,
            title: current.titleKey ? t(current.titleKey) : current.title,
            message: current.messageKey
              ? t(current.messageKey, current.messageParams)
              : current.message
          }
        : null,
      queued: queue.length
    }
  }
}

// Handle for CDP smoke tests (scripts/cdp-*.mjs) — no other runtime consumers.
declare global {
  interface Window {
    dialog: typeof dialog
  }
}
// Guarded for node-env unit imports (2B command tests pull this module);
// the renderer always assigns the CDP seam.
if (typeof window !== 'undefined') window.dialog = dialog

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
  // wave④/P17-F5: subscribe to lang changes — keyed copy below re-resolves via
  // t() on every render, including language switches while the modal is open.
  useTranslation()
  const isMac = window.api.platform === 'darwin'
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const defaultBtnRef = useRef<HTMLButtonElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const [value, setValue] = useState(req.defaultValue)

  // wave④/P17-F5: resolve keyed copy at render — App re-renders on language
  // change, so an OPEN dialog live-relabels instead of freezing open-time t().
  const title = req.titleKey ? t(req.titleKey) : req.title
  const message = req.messageKey ? t(req.messageKey, req.messageParams) : req.message
  const confirmLabel = req.confirmLabel || (req.confirmLabelKey ? t(req.confirmLabelKey) : '')
  const cancelLabel = req.cancelLabel || (req.cancelLabelKey ? t(req.cancelLabelKey) : '')
  const discardLabel = req.discardLabel || (req.discardLabelKey ? t(req.discardLabelKey) : '')

  const confirm = (): void =>
    settle(req.kind === 'prompt' ? value : req.kind === 'choose' ? 'confirm' : true)
  const cancel = (): void =>
    settle(req.kind === 'prompt' ? null : req.kind === 'choose' ? 'cancel' : false)
  const discard = (): void => settle('discard')

  // Initial focus: the input (with its default selected) or the default button.
  // UX-P02/P03/P14: capture the trigger element first and restore it on close —
  // without this, focus drops to <body> after every modal settles.
  useEffect(() => {
    prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
    if (req.kind === 'prompt') {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      defaultBtnRef.current?.focus()
    }
    return () => {
      const prev = prevFocusRef.current
      // Meaningful = still in the DOM and not the document root. Menubar
      // triggers leave activeElement on <body>, which is not a restore target.
      const meaningful =
        prev != null &&
        prev.isConnected &&
        prev !== document.body &&
        prev !== document.documentElement &&
        typeof prev.focus === 'function'
      if (meaningful) {
        prev!.focus()
        return
      }
      // Trigger is gone or was body (native menu) — fall back to editor.
      document.querySelector<HTMLElement>('.cm-content')?.focus()
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
      {confirmLabel}
    </button>
  )
  const cancelBtn = (
    <button className="dialog-btn" onClick={cancel}>
      {cancelLabel}
    </button>
  )
  const discardBtn = (
    <button
      className={`dialog-btn${req.danger ? ' dialog-btn-danger' : ''}`}
      onClick={discard}
    >
      {discardLabel}
    </button>
  )

  return (
    <div className="dialog-overlay" onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title ?? t('dialog.dialog')}
      >
        {title && <div className="dialog-title">{title}</div>}
        {message && <div className="dialog-message">{message}</div>}
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
          ) : req.kind === 'choose' ? (
            isMac ? (
              <>
                {cancelBtn}
                {discardBtn}
                {confirmBtn}
              </>
            ) : (
              <>
                {confirmBtn}
                {discardBtn}
                {cancelBtn}
              </>
            )
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
