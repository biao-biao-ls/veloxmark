/**
 * ToastHost — glb-toast render face (ui_07 「操作 toast 两态」).
 *
 * Presentation-only: reads the useToast singleton bus via useSyncExternalStore
 * and forwards the undo button to runToastAction(). The card is a fixed
 * window-bottom-right overlay (ui_07 toast-anchor) so show/hide never shifts
 * the document (UI-ELEM-03), and it never takes keyboard focus — the button
 * drops tabIndex and cancels mousedown default so the caret stays put.
 */
import React from 'react'
import { runToastAction, useToast } from '../hooks/useToast'

export function ToastHost(): React.JSX.Element | null {
  const toast = useToast()
  if (!toast) return null
  return (
    <div className="toast-host" data-testid="toast-host" role="status" aria-live="polite">
      <div className="toast" key={toast.id}>
        <span className="toast-msg">{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            className="toast-undo-btn"
            data-testid="toast-undo-btn"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runToastAction()}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
