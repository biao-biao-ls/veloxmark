import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { codeTagStyles } from './syntaxColors'

export type ThemeName = 'light' | 'dark'

const lightEditorTheme = EditorView.theme(
  {
    '&': { color: '#333', backgroundColor: '#ffffff' },
    '.cm-content': {
      fontFamily: 'var(--editor-font-family)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: 'var(--editor-line-height)',
      maxWidth: 'var(--cm-content-max-width, var(--editor-max-width))',
      margin: '0 auto',
      caretColor: '#333',
      padding: 'var(--cm-content-padding, 16px 0 40vh 0)'
    },
    '.cm-line': { padding: '0 var(--editor-gutter, 16px)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#333', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#b3d4fc'
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-gutters': { backgroundColor: '#ffffff', color: '#bbb', border: 'none' }
  },
  { dark: false }
)

const darkEditorTheme = EditorView.theme(
  {
    '&': { color: '#d4d4d4', backgroundColor: '#1e1e1e' },
    '.cm-content': {
      fontFamily: 'var(--editor-font-family)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: 'var(--editor-line-height)',
      maxWidth: 'var(--cm-content-max-width, var(--editor-max-width))',
      margin: '0 auto',
      caretColor: '#d4d4d4',
      padding: 'var(--cm-content-padding, 16px 0 40vh 0)'
    },
    '.cm-line': { padding: '0 var(--editor-gutter, 16px)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#d4d4d4', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#264f78'
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#666', border: 'none' }
  },
  { dark: true }
)

const proseTags = (link: string): Parameters<typeof HighlightStyle.define>[0] => [
  { tag: t.heading1, fontWeight: 'bold' },
  { tag: t.heading2, fontWeight: 'bold' },
  { tag: t.heading3, fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: "'JetBrains Mono', Consolas, monospace" },
  { tag: t.link, color: link },
  { tag: t.url, color: '#8b949e' }
]

const lightHighlightStyle = HighlightStyle.define([
  ...proseTags('#0969da'),
  ...codeTagStyles('light')
])

const darkHighlightStyle = HighlightStyle.define([
  ...proseTags('#58a6ff'),
  ...codeTagStyles('dark')
])

export const lightTheme = [lightEditorTheme, syntaxHighlighting(lightHighlightStyle)]
export const darkTheme = [darkEditorTheme, syntaxHighlighting(darkHighlightStyle)]

export const compartmentThemes: Record<ThemeName, typeof lightTheme> = {
  light: lightTheme,
  dark: darkTheme
}
