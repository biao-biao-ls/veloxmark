# P16 Mermaid 图表体验增强

优先级：P16 | 类别：UX/功能 | 预估规模：M

## 背景

Mermaid 在 V1 只有"渲染 + P06 工具条（Copy 源码 / 导出 SVG）"。差距集中在
交互回路：渲染失败时 `MermaidWidget.toDOM`（`editor/widgets.ts`）用错误
文本**替换**整个图，正在编辑时图直接消失；没有图模板入口，新手记不住
语法；导出只有 SVG，中文写作场景（贴微信/飞书）需要 PNG/图片剪贴板；
大图无法放大查看。P05 的 `ImageWidget` 已有点击选中/缩放交互先例，P15
的渲染限流是本需求的性能前置。

## 目标

把 Mermaid 从"能渲染"提升到"敢编辑、好交付"：编辑出错不清屏、模板一键
插入、PNG 导出/复制、大图可放大细看。

## 功能需求

### 错误与编辑态体验
- [ ] 重渲染期间保留上一版图（降透明度 + "Updating…" 角标），渲染成功
      后原位替换
- [ ] 渲染失败：图保留并变暗，错误信息以覆盖条显示在图底部（不再替换
      内容）；错误文本含位置信息时提供 "跳到源码" 按钮 → 跳到 fence 内
      对应行
- [ ] 从未成功渲染过的 fence 失败时：显示占位框 + 错误信息（与图片
      占位符风格一致）

### 图模板插入
- [ ] Insert 菜单 / 命令 `insertMermaidDiagram`：选择图类型后在光标处
      插入骨架代码；类型：flowchart / sequence / class / state / ER /
      gantt / pie 七种
- [ ] 选择 UI：复用对话框体系（列表选择，键盘上下 + 回车）
- [ ] 模板内容含中文注释示例（帮助理解语法结构），插入后光标落在第一个
      可编辑节点名上
- [ ] 若光标已在 mermaid fence 内：不插入新 fence，改为提示已存在（首版
      直接不动作）

### 导出补全
- [ ] 工具条新增 "PNG"：SVG 栅格化（canvas，devicePixelRatio 2x）后走
      保存对话框，默认文件名 `diagram.png`
- [ ] 工具条新增 "Copy Image"：PNG 写入系统剪贴板（图片格式），可直接
      粘贴到微信/飞书/邮件
- [ ] 暗色主题下 PNG 保留当前 mermaid 主题配色（与所见一致）

### 大图预览（lightbox）
- [ ] 点击渲染态图形本体进入 lightbox 全屏预览（半透明遮罩 + 居中 SVG）
- [ ] 滚轮缩放（以光标为中心）、拖拽平移、双击恢复 100%、Esc/点击遮罩
      关闭
- [ ] lightbox 打开时仅一个实例（仿 `closeOpenImageZoom` 的互斥模式）
- [ ] 点击图形与 P06 "点击块回源码" 的关系：图形命中进 lightbox，块
      padding 命中仍回源码

## 实现要点

- 错误态改造集中在 `MermaidWidget.toDOM`（`widgets.ts`）：`body` 拆为
  `svgHost` + `errorBar` 两层；`renderMermaid` 的 then/catch 只更新对应
  层，旧 SVG 节点在成功前不移除。
- `renderMermaid(code, theme)` 已按 `theme\ncontent` 缓存（`mermaidCache`），
  stale 展示不需要改缓存逻辑；theme 切换的 `clearMermaidCache()`（
  `hooks/useAppTheme.ts`）保持不变。
- 模板插入：命令注册进 `commands.ts` 注册表（id/label/run），Menu 布局在
  MENU_LAYOUT 加 Insert 分组；选择对话框走 P02 `dialog` 体系（需要一个
  列表选择变体，可仿 `ExportDialog.tsx` 的自绘模式）。插入用
  `view.dispatch` 在光标处 replace selection，前后补齐空行。
- PNG 导出：复用 `exportSvg` 的克隆/serialize 流程，加一步
  `Image + canvas` 栅格化；clipboard 图片写入需新增 IPC
  `clipboardWriteImage(dataUrl: string)`（主进程
  `clipboard.write(nativeImage.createFromDataURL)`），类型扩
  `electron/shared/api.ts`。
- lightbox：应用级浮层（挂在 App 根部 portal，非 CM6 widget 内），打开时
  由工具条/图形点击传入 SVG 字符串；样式进 `styles.css`
  （`.vm-mermaid-lightbox`），明暗主题各一套。
- 命令需要访问 EditorView：沿用 `commands.ts` 现有 ops 注入模式
  （如 `openPreferences` 拿不到 view 的写法对照 `find` 命令）。
- 验证：`scripts/cdp-test.mjs` 模式补充场景——故意写错语法确认图不清屏；
  插入模板后 fence 渲染成功。

## 验收标准

1. 把合法 mermaid 改成语法错误：上一版图变暗保留，底部出现错误条；改回
   合法内容后图原位更新，无闪烁清空。
2. Insert 菜单选 "sequence"：光标处出现带中文注释的 sequence 骨架，渲染
   成图。
3. 点击 "PNG" 得到 2x 分辨率图片文件；"Copy Image" 后在外部应用粘贴出
   图。
4. 点击大图进入 lightbox，滚轮可缩放，Esc 关闭；点击块 padding 仍跳回
   源码。
5. 暗色主题下错误条/角标/遮罩对比度达标。

## 非目标

- 源码分屏实时预览（另见 P25）、PlantUML 等其他图语言
- 渲染并发限流（属 P15）、mermaid 配置项自定义主题色
- 图内节点点击跳转/交互图
