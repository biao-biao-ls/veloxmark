/// <reference types="vite/client" />

// The bridge shape is defined once in electron/shared/api.ts — never
// redeclare it here. (Importing keeps this file a module, so Window is
// declared via `global`.)
import type { RendererApi } from '../../../electron/shared/api'

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
