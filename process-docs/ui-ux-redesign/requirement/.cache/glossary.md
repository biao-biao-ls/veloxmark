# 术语表（Phase 1 调研沉淀 · 供 M01 术语定义派生）

> 来源：VeloxMark 代码仓 + docs/markdown-ux-optimization.md + docs/refactor-tasks.md 一手扫描（2026-09-28）。

| 术语 | 定义 |
|------|------|
| VeloxMark | 本项目产品名。类 Typora 的 Markdown 桌面阅读/编辑器（Electron + CodeMirror 6） |
| live preview（实时预览） | 编辑器内"所见即所得"渲染：Markdown 源码是唯一数据源，预览靠 CodeMirror Decoration 投影（语法标记隐藏、代码/公式/图替换为 Widget） |
| 源码态 / 渲染态 | 光标进入语法范围时显示原始 Markdown 源码（源码态），移开后恢复渲染（渲染态）；又称 click-to-source 语义 |
| 块级元素 | 表格、代码块、块级公式、mermaid 图表、图片、callout、front-matter 等占据整块的 Markdown 元素 |
| 块级 chrome | 块级元素周边的交互性界面件（按钮簇/工具栏/chip/把手/错误条）的统称；已有「块级 chrome 规范」（docs/markdown-ux-optimization.md 文末附录，11A 定稿） |
| chrome 四态 | 块级 chrome 的显隐时机分类：静息（零 chrome）/ hover（浮现一簇）/ 聚焦编辑（状态 chrome）/ 错误（错误条+跳源码） |
| 双区编辑 | 聚焦公式/mermaid 时"上方源码区 + 下方实时预览"上下并存的编辑模式（8B/10A 落地） |
| 表格编辑工具栏 | 表格聚焦时浮于表头上方的工具条（7C）：左「⊞ 行列网格 + 对齐三键」，右「⋮ 更多操作 + 🗑 删除」 |
| 行列把手（+/− 把手） | 表格左带/顶带散落的行/列增删小按钮（`data-table-handle` 探针契约家族） |
| 网格选择器（⊞） | Excel 式 N×M 拖选 popover：向右/下拖加行/列、向左/上拖删行/列，一拖完成整表扩/缩（7E） |
| 结构操作 | 表格行列的插入/删除/移动/对齐/缩放等改变表格结构的操作 |
| 零布局抖动 | UX-P28 F3 契约：编辑态进出不得推挤正文布局（位移 ≤1px） |
| 正文列对齐 | 阅读版心契约：正文行与全部块 widget 统一到居中内容列（5B） |
| e2e 缝 | 测试探针硬契约：`window.__velox*` 系列、`data-op` id、命令 id 字面量、`data-table-handle` 等；重构不得破坏 |
| SDD | Spec-Driven Development：spec → plan → implement → converge 的任务推进协议（docs/sdd-workflow.md） |
| 块级 chrome 规范 | 11A 收口的横向 UI 规范（N1 显隐四态 / N2 位置槽位 / N3 点击语义 / N4 皮肤 + 形态索引） |
| 右键菜单 delta | 编辑器右键菜单按上下文（普通块/表格单元格/链接…）动态拼装的菜单项集合（contextMenu/registry 体系） |
| 主题 token | `:root` CSS 变量体系（`--space-*`/`--radius-*`/色彩 token），主题差异只翻 `.theme-light`/`.theme-dark` token 值 |
| 菜单栏（顶部） | 自绘 Titlebar 内的 MenuBar（File/Edit/Format/Tabs/View/Insert 等下拉）；macOS 另有原生菜单双源 |
| 现代极简风 | 本次重设计的目标风格：Notion（留白/内容优先/悬浮才现控件）+ Linear（克制密度/精细圆角/快捷键驱动/短促动效）双锚点混搭 |
| 设计规范（本需求） | 《UI/UX 设计规范》：视觉微调原则 + 交互模式库 + 块级 chrome 规范扩展 + 快捷键总表 + 信息架构，是"按规范长 UI"的全界面升级 |
| 总看板 | 新建 docs/ui-redesign-tasks.md：本需求全部改造项的 SDD 任务清单；既有两看板收敛成果作为红线引用 |
| Shift 升档键位 | 表格结构快捷键方案 A：Ctrl+Enter 下插行（兼容）、Ctrl+Shift+Enter 上插行、Ctrl+Shift+←/→ 左/右插列；Alt+方向保持移行列 |
| 对照走查 | 按设计规范逐区域人工走查验收（深浅主题各一遍），基准=设计规范 + Notion/Linear 参照（非 Typora 截图） |
| 左侧导航栏 | 文件树/大纲双 tab 侧栏 + 底部栏（+ / 目录名 / 操作 / 列表树切换）+ 操作面板（排序/最近目录） |
| 可发现性 | 用户能否自行发现功能入口/快捷键的 UX 维度（菜单快捷键提示、hover chip 等均属此类） |
