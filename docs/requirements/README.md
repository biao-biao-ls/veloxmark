# VeloxMark 需求清单（对标 Typora）

来源：对 V1（2026-09）代码盘点后与 Typora 的差距分析。每个需求一个文档，
按优先级编号 P00–P15，数字越小越先做。

## 优先级总览

| 编号 | 需求 | 类别 | 一句话动机 | 预估规模 |
| --- | --- | --- | --- | --- |
| P00 | [需求前置重构](P00-refactor.md)（已完成） | 工程 | 拆 God Component/命令注册表/装饰纯函数化，为后续需求清障 | M |
| P01 | [编辑输入辅助](P01-typing-assists.md) | UX | 列表/链接/标题自动化，日常体感提升最大 | S–M |
| P02 | [自绘模态对话框](P02-dialogs.md) | UX/工程 | 替代 window.confirm 等原生亮色弹窗 | S |
| P03 | [偏好设置与会话持久化](P03-preferences.md) | 功能 | 字号/侧栏/最近文件可配置且记住 | M |
| P04 | [导出 PDF / HTML](P04-export.md) | 功能 | 从"能编辑"到"能交付"的分界线 | M |
| P05 | [图片体验增强](P05-images.md) | UX/功能 | 粘贴图片落盘、点击缩放、缓存失效 | M |
| P06 | [渲染块交互增强](P06-block-widgets-ux.md) | UX | 代码块复制按钮、渲染块悬停工具条 | S |
| P07 | [文件夹工作区增强](P07-workspace.md) | 功能 | 忽略规则、新建文件夹、拖拽移动、Quick Open | M |
| P08 | [专注/打字机/源码模式](P08-focus-modes.md) | UX | Typora 标志性写作体验 | S–M |
| P09 | [行内元素细粒度 WYSIWYG](P09-inline-wysiwyg.md)（已完成） | UX | 光标在行中不再整行闪回源码 | L |
| P10 | [表格单元格级编辑](P10-table-editing.md)（已完成） | UX/功能 | 表格从"整块黑盒"到单元格直接编辑 | L |
| P11 | [扩展语法支持](P11-extended-syntax.md)（已完成） | 功能 | front matter、脚注、==高亮== | M |
| P12 | [自动保存与崩溃恢复](P12-autosave.md)（已完成） | 功能 | 数据安全兜底 | M |
| P13 | [文件夹全局搜索](P13-global-search.md)（已完成） | 功能 | 侧栏内跨文件查找/替换 | M |
| P14 | [界面 i18n 与状态栏](P14-i18n-statusbar.md)（已完成） | 功能 | 中文化 + 字数统计 | S–M |
| P15 | [工程质量加固](P15-quality.md)（已完成） | 工程 | 数学渲染性能、自动测试 | M |
| P16 | [Mermaid 图表体验增强](P16-mermaid-ux.md)（已完成） | UX/功能 | 错误不清屏、模板插入、PNG/图片剪贴板、大图 lightbox | M |
| P17 | [链接导航与文档间跳转](P17-link-navigation.md)（已完成） | UX/功能 | 相对路径/锚点跳转，文件夹工作区闭环的最后一环 | S–M |
| P18 | [标题折叠](P18-heading-fold.md)（已完成） | UX | 长文按章节折叠，大纲联动、会话记忆 | S–M |
| P19 | [粘贴 HTML 转 Markdown](P19-paste-html-to-md.md) | UX/功能 | 网页/公众号富文本粘贴得到干净 Markdown | S–M |
| P20 | [复制为富文本与选区导出](P20-copy-rich-text.md) | 功能 | 选区/全文复制富文本，直接贴微信/飞书 | S |
| P21 | [Callout 提示块](P21-callouts.md) | 功能 | `> [!NOTE]` GitHub/Obsidian 风格提示块 | S |
| P22 | [表格插入辅助](P22-table-insert.md) | UX/功能 | 行列选择器一键插表，TSV/CSV 选区转表 | S |
| P23 | [文档格式化](P23-format-document.md) | UX/工程 | 保守规则一键整形全文，单 transaction 可回退 | S–M |
| P24 | [代码块显示增强](P24-code-block-display.md) | UX | 超长代码块折叠、行号、软换行 | S |
| P25 | [Mermaid 源码实时预览](P25-mermaid-live-preview.md)（V2 后置） | UX/功能 | 编辑 fence 时预览面板实时跟随图 | M |
| P26 | [多文档标签页](P26-multi-doc-tabs.md)（V2 后置） | UX/工程 | 多文档并存切换，各自保留编辑状态 | L |

## 排序原则

0. **P00 先行（已完成）**：行为零变化的结构性重构（App.tsx 拆 hooks、
   命令注册表、装饰纯函数化、BlockWidget 基类、IPC 类型单一源），避免
   后续每个需求都在 God Component 上冲突。P02 紧随其后——对话框 async 化
   涟漪落在刚拆好的 hooks 上最省。
1. **性价比优先**：P01–P03 成本低、覆盖面广，先做。
2. **先补"没有"再优化"有但不好"**：导出（P04）先于行内 WYSIWYG（P09）。
3. **难题后置**：P09/P10 是 CM6 装饰模型上的硬骨头，等前面的基建
   （对话框、持久化）就绪后再动。
4. P09 与 P10 无依赖关系，团队并行时可同时开工。
5. **P16+ 为盘点后的探索性补充**：P16–P24 沿两类场景外延——渲染态
   交互（Mermaid、折叠、代码块显示、callout）与工作区闭环（链接导航、
   粘贴/富文本复制、表格插入、格式化），规模以 S–M 为主，可按性价比
   插队推进，不阻塞既有主线收尾。P25/P26 明确标注 V2 后置：P25 属
   编辑回路重设计，适用"难题后置"原则（同 P09/P10）；P26 多标签页
   超出 Typora 对标范围（超越项而非差距项），建议待 P13 全局搜索与
   P17 链接导航落地、跨文件工作流成型后再评估排期。

## 通用约束（所有需求适用）

- Markdown 源文本是唯一数据源，渲染态不允许持有独立状态。
- 块级 Widget/多行 replace 装饰只能由 StateField 提供（CM6 限制，见
  `src/renderer/src/editor/livePreview/field.ts` 头注释）。
- UI 必须跟随应用明暗主题；Windows/Linux 为自绘标题栏，macOS 走原生菜单。
- 验证手段：`npx electron . --remote-debugging-port=9223` + `scripts/cdp-test.mjs`。
