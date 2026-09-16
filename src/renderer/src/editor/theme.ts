import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

export type ThemeName = 'light' | 'dark'

const lightEditorTheme = EditorView.theme(
  {
    '&': { color: '#333', backgroundColor: '#ffffff' },
    '.cm-content': {
      // Appearance comes from :root CSS variables (P03 preferences store).
      fontFamily: 'var(--editor-font-family)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: 'var(--editor-line-height)',
      maxWidth: 'var(--editor-max-width)',
      margin: '0 auto',
      caretColor: '#333',
      padding: '16px 0 40vh 0'
    },
    '.cm-line': { padding: '0 48px' },
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
      // Appearance comes from :root CSS variables (P03 preferences store).
      fontFamily: 'var(--editor-font-family)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: 'var(--editor-line-height)',
      maxWidth: 'var(--editor-max-width)',
      margin: '0 auto',
      caretColor: '#d4d4d4',
      padding: '16px 0 40vh 0'
    },
    '.cm-line': { padding: '0 48px' },
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

// Syntax highlighting for markdown source mode (delimiters, urls, etc.)
const lightHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: 'bold' },
  { tag: t.heading2, fontWeight: 'bold' },
  { tag: t.heading3, fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: "'JetBrains Mono', Consolas, monospace" },
  { tag: t.link, color: '#0969da' },
  { tag: t.url, color: '#8b949e' },
  { tag: t.comment, color: '#8b949e' }
])

const darkHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: 'bold' },
  { tag: t.heading2, fontWeight: 'bold' },
  { tag: t.heading3, fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: "'JetBrains Mono', Consolas, monospace" },
  { tag: t.link, color: '#58a6ff' },
  { tag: t.url, color: '#8b949e' },
  { tag: t.comment, color: '#8b949e' }
])

export const lightTheme = [lightEditorTheme, syntaxHighlighting(lightHighlightStyle)]
export const darkTheme = [darkEditorTheme, syntaxHighlighting(darkHighlightStyle)]

export const compartmentThemes: Record<ThemeName, typeof lightTheme> = {
  light: lightTheme,
  dark: darkTheme
}
