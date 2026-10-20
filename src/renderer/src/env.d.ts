/// <reference types="vite/client" />

import type { RendererApi } from '../../../electron/shared/api'

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
