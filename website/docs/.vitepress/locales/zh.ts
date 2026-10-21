/**
 * Website UI strings — Simplified Chinese.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const ZH: WebsiteLocaleStrings = {
  label: '简体中文',
  lang: 'zh-CN',
  hreflang: 'zh-CN',
  link: '/zh/',
  ogLocale: 'zh_CN',
  titleTemplate: '实时预览的 Markdown 编辑器',
  description:
    '免费开源的 Markdown 编辑器，支持 macOS、Windows 和 Linux。KaTeX 公式、Mermaid 图表、原生表格——全部实时渲染。',
  homeOgTitle: 'VeloxMark — 实时预览的 Markdown 编辑器',
  keywords:
    'markdown 编辑器, 实时预览, 开源, 所见即所得, KaTeX, Mermaid, Typora 替代品, Electron, CodeMirror',
  nav: [
    { text: '文档', link: '/zh/docs/' },
    { text: '下载', link: '/zh/download' }
  ],
  sidebar: [
    {
      text: '快速开始',
      items: [
        { text: '介绍', link: '/zh/docs/' },
        { text: '安装', link: '/zh/docs/installation' },
        { text: '基础', link: '/zh/docs/basics' }
      ]
    },
    {
      text: '写作',
      items: [
        { text: '深入编辑', link: '/zh/docs/editing' },
        { text: 'Markdown 语法', link: '/zh/docs/markdown-syntax' },
        { text: '图片', link: '/zh/docs/images' }
      ]
    },
    {
      text: '参考',
      items: [
        { text: '偏好设置', link: '/zh/docs/preferences' },
        { text: '快捷键', link: '/zh/docs/key-bindings' },
        { text: '语言与本地化', link: '/zh/docs/language' },
        { text: '导出文档', link: '/zh/docs/export' },
        { text: '主题', link: '/zh/docs/themes' }
      ]
    },
    {
      text: '帮助',
      items: [
        { text: '自动更新', link: '/zh/docs/updates' },
        { text: '常见问题', link: '/zh/docs/faq' }
      ]
    }
  ],
  editLinkText: '在 GitHub 上编辑此页',
  footerMessage: '基于 MIT 许可证发布。',
  outlineLabel: '本页目录',
  docPrev: '上一页',
  docNext: '下一页',
  breadcrumbHome: '首页',
  breadcrumbDocs: '文档',
  trustTicks: ['macOS · Windows · Linux', '本地优先，无需账户', 'MIT 许可，永久免费'],
  schemaDescription:
    '免费开源的 Markdown 编辑器，支持 macOS、Windows 和 Linux，带实时预览。Markdown 源码是唯一的数据源——保存写回纯 .md 文件，往返零损失。KaTeX 公式、Mermaid 图表、原生表格编辑、提示块、脚注与高亮，全部实时渲染。',
  schemaFeatures: [
    '实时预览编辑（Typora 风格，就地渲染）',
    'KaTeX 公式与 Mermaid 图表实时渲染',
    '原生表格编辑（嵌套单元格编辑器）',
    '专注模式、打字机模式、明暗主题',
    'PDF 与 HTML 导出',
    '纯 Markdown 文件，往返零损失',
    '九种界面语言'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark 是一款免费开源（MIT）的 Markdown 编辑器，支持 macOS、Windows 和 Linux，带实时预览。Markdown 源码是唯一的数据源：编辑器就地渲染标题、公式、图表和表格，而磁盘上的文件始终是纯 Markdown，往返保存零损失。\n\n' +
    'VeloxMark 基于 Electron 和 CodeMirror 6 构建。其实时预览引擎在光标离开一行后隐藏语法标记（Typora 风格），任何渲染块——代码、KaTeX 公式、Mermaid 图表、表格、图片——都可点击编辑其 Markdown 源码。提供原生表格编辑、专注模式与打字机模式、明暗主题、PDF/HTML 导出、九种界面语言，以及 Windows（NSIS）和 Linux（AppImage）上的自动更新。\n\n' +
    '关键事实：MIT 许可 · 无需账户、无遥测 · 本地优先 · 提供 macOS（dmg/zip）、Windows（NSIS 安装包、便携 zip）、Linux（AppImage、deb、rpm、tar.gz、snap）安装包 · GitHub Releases 附带 SHA256SUMS.txt 校验。\n\n' +
    '## 文档\n\n' +
    '- [介绍](https://veloxmark.knzn.net/zh/docs/)：VeloxMark 是什么、实时预览如何工作、零往返损失保证\n' +
    '- [安装](https://veloxmark.knzn.net/zh/docs/installation)：各平台安装包、校验验证、从源码构建、卸载\n' +
    '- [基础](https://veloxmark.knzn.net/zh/docs/basics)：窗口结构、侧栏（文件/大纲/搜索）、标签页、编辑器模式\n' +
    '- [深入编辑](https://veloxmark.knzn.net/zh/docs/editing)：实时预览行为、块级组件、表格编辑、输入辅助\n' +
    '- [Markdown 语法](https://veloxmark.knzn.net/zh/docs/markdown-syntax)：所有特殊渲染——标题、KaTeX 公式、Mermaid、提示块、脚注、高亮、前置元数据\n' +
    '- [图片](https://veloxmark.knzn.net/zh/docs/images)：路径解析、`=WxH` 尺寸、`{align=}`/`{flip=}` 属性、附件\n' +
    '- [偏好设置](https://veloxmark.knzn.net/zh/docs/preferences)：全部设置项及默认值——外观、编辑器、文件、自动保存、图片\n' +
    '- [快捷键](https://veloxmark.knzn.net/zh/docs/key-bindings)：各平台完整命令/快捷键表\n' +
    '- [语言与本地化](https://veloxmark.knzn.net/zh/docs/language)：九种界面语言及语言选择方式\n' +
    '- [导出文档](https://veloxmark.knzn.net/zh/docs/export)：PDF 与 HTML 导出选项、仅选区导出\n' +
    '- [主题](https://veloxmark.knzn.net/zh/docs/themes)：明暗主题、切换方式、主题如何应用到组件\n' +
    '- [自动更新](https://veloxmark.knzn.net/zh/docs/updates)：各安装形式的更新行为（NSIS/AppImage 全自动；其余仅提示）\n' +
    '- [常见问题](https://veloxmark.knzn.net/zh/docs/faq)：支持的平台、许可、故障排除、数据存放位置\n\n' +
    '## 下载\n\n' +
    '- [下载](https://veloxmark.knzn.net/zh/download)：各平台安装包、校验验证与更新行为\n\n' +
    '## 源码\n\n' +
    '- [GitHub 仓库](https://github.com/biao-biao-ls/veloxmark)：源码、问题追踪、发布（MIT 许可）\n\n' +
    '## 可选\n\n' +
    '- [完整文档纯文本](https://veloxmark.knzn.net/zh/llms-full.txt)：全部文档内容拼接，供离线 LLM 使用\n'
}
