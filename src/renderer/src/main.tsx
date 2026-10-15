import React from 'react'
import ReactDOM from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles.css'
import App from './App'

// 非 macOS 细滚动条的 CSS 门禁（styles/scrollbars.css）：仅显式非 darwin 命中，
// 属性缺省时回落系统原生（macOS 零回归 fail-safe）。调试预览：临时改成 'win32'。
document.documentElement.dataset.platform = window.api?.platform ?? ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
