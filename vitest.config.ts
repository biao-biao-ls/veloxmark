import { defineConfig } from 'vitest/config'

// P15 unit-test harness: plain node environment, no DOM needed for the pure
// functions under test (outline extract, table parse, live-preview build,
// extended-syntax parsers, status-bar stats). Heavy browser-oriented deps
// that only matter at widget *render* time stay out via stubs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20000
  },
  resolve: {
    alias: {
      // mermaid touches browser globals at import time in some builds; unit
      // tests never render widgets, a stub module is enough for the import
      // graph of build.ts → handlers.ts → widgets.ts.
      mermaid: new URL('./src/renderer/src/test-stubs/mermaid.ts', import.meta.url).pathname
    }
  }
})
