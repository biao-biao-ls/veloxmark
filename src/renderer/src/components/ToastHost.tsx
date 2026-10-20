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
