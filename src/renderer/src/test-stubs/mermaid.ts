// Vitest stub for mermaid — unit tests import buildDecorations (which pulls
// widgets.ts) but never render a MermaidWidget, so the real library (and its
// browser globals) is unnecessary. Keep the surface minimal: the module only
// needs `default.initialize` / `default.render` to exist at import time.
export default {
  initialize: (): void => {},
  render: async (): Promise<{ svg: string }> => ({ svg: '' })
}
