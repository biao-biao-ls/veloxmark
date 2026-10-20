import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { t, useTranslation } from '../i18n'
import { hushLayers, setModalProbe } from '../hooks/useHushLayer'
import DialogTitleBar from './DialogTitleBar'


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
  confirmLabelKey?: string
  cancelLabelKey?: string
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

export type ChooseResult = 'confirm' | 'discard' | 'cancel'

export interface ChooseOptions extends DialogKeyedCopy {
  message?: string
  title?: string
  confirmLabel?: string
  discardLabel?: string
  cancelLabel?: string
  danger?: boolean
}


interface DialogRequest {
  id: number
  kind: 'alert' | 'confirm' | 'prompt' | 'choose'
  title?: string
  message?: string
  titleKey?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
  defaultValue: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  discardLabel: string
  confirmLabelKey?: string
  cancelLabelKey?: string
  discardLabelKey?: string
  danger: boolean
  resolve: (value: unknown) => void
}

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
  if (!autoResponse) autoResponse = readAutoFromStorage()
  return autoResponse
}

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
        confirmLabelKey: opts.confirmLabelKey ?? 'dialog.ok',
        cancelLabel: opts.cancelLabel ?? '',
        cancelLabelKey: opts.cancelLabelKey ?? 'dialog.cancel',
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

  setAutoResponse(responses: DialogAutoResponse | null): { pendingDrained: number } {
    autoResponse = responses
    try {
      if (responses) localStorage.setItem(AUTO_KEY, JSON.stringify(responses))
      else localStorage.removeItem(AUTO_KEY)
    } catch {
    }
    return { pendingDrained: responses ? drainPending() : 0 }
  },

  getState(): {
    auto: DialogAutoResponse | null
    current: { kind: DialogRequest['kind']; title?: string; message?: string } | null
    queued: number
  } {
    return {
      auto: activeAuto(),
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
  },

  isModalOpen(): boolean {
    return current !== null
  }
}

export function cancelActiveDialog(): void {
  const req = current
  if (!req) return
  settle(req.kind === 'prompt' ? null : req.kind === 'choose' ? 'cancel' : false)
}

export function isDialogOverlayTarget(target: unknown): boolean {
  return target instanceof Element && target.closest('[data-testid="dialog-overlay"]') != null
}

setModalProbe(() => dialog.isModalOpen())

declare global {
  interface Window {
    dialog: typeof dialog
  }
}
if (typeof window !== 'undefined') window.dialog = dialog


export function DialogHost(): React.JSX.Element | null {
  const req = useSyncExternalStore(subscribe, getSnapshot)
  const reqId = req?.id
  useEffect(() => {
    if (reqId == null) return
    return hushLayers.register({
      id: 'dialog-modal',
      tier: 'modal',
      close: () => cancelActiveDialog(),
      owns: isDialogOverlayTarget
    })
  }, [reqId])
  if (!req) return null
  return <Dialog key={req.id} req={req} />
}

interface Props {
  req: DialogRequest
}

function Dialog({ req }: Props): React.JSX.Element {
  useTranslation()
  const isMac = window.api.platform === 'darwin'
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const defaultBtnRef = useRef<HTMLButtonElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const [value, setValue] = useState(req.defaultValue)

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
      document.querySelector<HTMLElement>('.cm-content')?.focus()
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
    } else if (e.key === 'Tab') {
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

  const confirmBtn = (
    <button
      ref={defaultBtnRef}
      data-testid="dialog-confirm-btn"
      className={`dialog-btn dialog-btn-primary${req.danger ? ' dialog-btn-danger' : ''}`}
      onClick={confirm}
    >
      {confirmLabel}
    </button>
  )
  const cancelBtn = (
    <button className="dialog-btn" data-testid="dialog-cancel-btn" onClick={cancel}>
      {cancelLabel}
    </button>
  )
  const discardBtn = (
    <button
      className={`dialog-btn${req.danger ? ' dialog-btn-danger' : ''}`}
      data-testid="dialog-discard-btn"
      onClick={discard}
    >
      {discardLabel}
    </button>
  )

  const onOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) cancel()
  }

  return (
    <div
      className="dialog-overlay"
      data-testid="dialog-overlay"
      onKeyDown={onKeyDown}
      onClick={onOverlayClick}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title ?? t('dialog.dialog')}
      >
        <DialogTitleBar title={title ?? ''} onClose={cancel} lights="close-only" />
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
          ) : (
            <>
              {cancelBtn}
              {confirmBtn}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
