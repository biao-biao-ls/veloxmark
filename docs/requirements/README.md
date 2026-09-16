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
| P09 | [行内元素细粒度 WYSIWYG](P09-inline-wysiwyg.md) | UX | 光标在行中不再整行闪回源码 | L |
| P10 | [表格单元格级编辑](P10-table-editing.md) | UX/功能 | 表格从"整块黑盒"到单元格直接编辑 | L |
| P11 | [扩展语法支持](P11-extended-syntax.md) | 功能 | front matter、脚注、==高亮== | M |
| P12 | [自动保存与崩溃恢复](P12-autosave.md) | 功能 | 数据安全兜底 | M |
| P13 | [文件夹全局搜索](P13-global-search.md) | 功能 | 侧栏内跨文件查找/替换 | M |
| P14 | [界面 i18n 与状态栏](P14-i18n-statusbar.md) | 功能 | 中文化 + 字数统计 | S–M |
| P15 | [工程质量加固](P15-quality.md) | 工程 | 数学渲染性能、自动测试 | M |

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

## 通用约束（所有需求适用）

- Markdown 源文本是唯一数据源，渲染态不允许持有独立状态。
- 块级 Widget/多行 replace 装饰只能由 StateField 提供（CM6 限制，见
  `src/renderer/src/editor/livePreview/field.ts` 头注释）。
- UI 必须跟随应用明暗主题；Windows/Linux 为自绘标题栏，macOS 走原生菜单。
- 验证手段：`npx electron . --remote-debugging-port=9223` + `scripts/cdp-test.mjs`。
