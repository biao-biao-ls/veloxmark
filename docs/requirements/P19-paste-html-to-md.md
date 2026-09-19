# P19 粘贴 HTML 转 Markdown

优先级：P19 | 类别：UX/功能 | 预估规模：S–M

## 背景

从网页、公众号、飞书文档复制内容时剪贴板通常带 `text/html` 富文本，
当前粘贴按纯文本落入编辑器：加粗/标题/链接全部丢失或变成裸 HTML 文本。
P01 只做了 "选区 + URL → 链接"，P05 只接管了图片位图；富文本→MD 的
转换是空白。粘贴拦截基建已就绪：`editor/images.ts`（Prec.high 图片
handler）与 `editor/assists/paste.ts`（文本变换）。

## 目标

粘贴富文本得到干净的 Markdown：结构保留、样式剥离、无原始 HTML 透传
（与 P11 安全策略一致）。

## 功能需求

### 转换覆盖
- [x] 标题 h1–h6 → ATX 标题；`<p>` → 段落（空行分隔）；`<br>` → 行尾
      双空格
- [x] `<strong>/<b>` → `**`，`<em>/<i>` → `*`，`<del>/<s>` → `~~`，
      `<code>` → 反引号（内容含反引号时自动加长定界）
- [x] `<a href>` → `[text](href)`（text 为空时用 href）；裸 URL 文本保持
      （后续可由 P01 设定决定是否包 `<url>`）
- [x] 列表：ul/ol 嵌套 → 缩进列表；`<li>` 内块级内容拍平为首行 + 续行
- [x] `<blockquote>` → `>` 引用（嵌套逐级加 `>`）；`<hr>` → `---`
- [x] 表格：thead/tbody/tr/th/td → GFM 表格（复用 `editor/table/parse.ts`
      的 `formatTable` 对齐输出）
- [x] `<img src>` → `![](src)`：src 为远程 URL 时按 P05 设置
      `imageDownloadRemote` 决定下载或保留；本地文件路径走 P05
      `importLocalImage`
- [x] `<pre><code>` → fenced code（class 提取语言，无则纯 fence）
- [x] 未知标签：剥壳取文本；`<script>/<style>/<iframe>` 及其内容整体丢弃
- [x] 行内 style/class 属性一律忽略

### 行为与开关
- [x] 优先级：剪贴板有位图 → 图片流程（P05）；有 `text/html` → 本转换；
      否则走 assists 文本变换 → 默认粘贴
- [x] 转换开关进 EditingAssists/P03 偏好：`pasteHtmlToMd: boolean`
      （默认开）；关闭后富文本按纯文本粘贴（取 `text/plain`）
- [x] 菜单 Edit>Paste 路径同步支持：新增 IPC `clipboardReadHtml()` 返回
      HTML 串（主进程 `clipboard.readHTML()`），菜单粘贴与 Ctrl+V 行为
      一致
- [x] 转换失败（DOMParser 异常）回退纯文本粘贴，不插入垃圾内容
- [ ] 大段粘贴（>100KB HTML）不阻塞输入：转换同步但限时，超时回退纯
      文本并提示（可选，低优）

## 实现要点

- 纯函数转换器 `editor/assists/htmlToMd.ts`：
  `htmlToMarkdown(html: string): string`——`DOMParser` 解析 + 递归
  serialize，**不引入 turndown 依赖**（覆盖集可控；若质量不达标再评估
  引入，决策记录进本文档修订）。
- 粘贴管道挂载 `editor/assists/index.ts`（`editingAssistsExtension`）：
  在现有 `pasteEventHandler` 之前注册 HTML 分支，受同一 assists 开关与
  新增 `pasteHtmlToMd` 控制；`Prec` 仍低于 `images.ts` 的图片 handler。
- 菜单粘贴：`commands.ts` 的 `paste` 命令当前走 `clipboardRead` 纯文本；
  扩展为先 `clipboardReadHtml` 再走同一 transform 路径。IPC 类型扩
  `electron/shared/api.ts`（单一源）。
- 开关持久化：`assists/config.ts` 的 `EditingAssistsConfig` 增字段，
  `preferences/store.ts` 的 Preferences/迁移函数同步补默认值；
  `Preferences.tsx` 增勾选项。
- 列表/表格转换逻辑单测（P15 vitest 目标新增 `htmlToMd`）。
- 验证素材：浏览器复制段落、公众号文章片段、飞书表格、Word 列表各一，
  存 `scripts/tmp-p19/` 作为夹具。

## 验收标准

1. 从浏览器复制含标题/加粗/链接/列表的段落粘贴：得到结构对应的
   Markdown，无 HTML 标签残留。
2. 复制 HTML 表格粘贴：得到 `|` 对齐的 GFM 表格，编辑器立即渲染为
   TableWidget。
3. 关闭偏好开关后同一操作粘贴为纯文本。
4. Edit 菜单 Paste 与 Ctrl+V 结果一致。
5. 复制含 `<script>` 的片段：脚本内容不出现文档中。
6. 粘贴内容含 `<img src="https://…">`：按 P05 设置下载进 assets 或保留
   URL，图片立即渲染。

## 非目标

- Word/Excel 专有命名空间（mso 样式、endnote）的完整保真
- 网页代码块的语法高亮元数据（语言探测仅从 class 猜测，不做更多）
- 反向能力（MD→富文本复制，属 P20）

## 实施状态（已完成）

提交：`feat(P19): paste HTML→Markdown — mini-parser converter, pipeline + menu path, pref toggle`（分支 feat/P11-P26-scenarios）

### 与实现要点的偏差（如实记录）

- **转换器不是 `DOMParser`，而是自研栈式 mini HTML 解析器**（`editor/assists/htmlToMd.ts`
  内 `parseFragment`/`inlineMd`/`blocksToMd`）。原因：P15 起 vitest 为 node
  环境、项目无 jsdom 依赖，`DOMParser` 在单测中不存在；自研解析器让渲染进程
  与 node 单测走同一条代码路径。**turndown 未引入**（符合要点）；质量靠
  23 条 `htmlToMd.test.ts` 用例锁定。解析器覆盖：void 标签、隐式闭合
  （li/li、td/tr、块级标签顶掉 `<p>`）、实体解码（数字+命名）、注释/
  doctype 跳过、script/style/iframe 原文级丢弃（RAW_DROP，不进序列化）。
- **解析在 `preventDefault` 之前**：`htmlPasteEventHandler` 先跑
  `htmlToMarkdownSafe(html)`，结果为 null/空（含 script-only 剪贴板）时
  返回 false 交给后续纯文本路径——比"转换失败再回退"更干净，浏览器默认
  粘贴行为全程可用。
- **菜单粘贴单一实现**：新增 `assists/htmlPaste.ts#runMenuPaste(view, ensureSaved)`，
  `commands.ts` 的 paste 命令与 e2e 钩子 `__veloxP19.pasteFromClipboard` 共用
  同一函数，菜单 == Ctrl+V 在代码路径上不可漂移。顺序：P05 位图 →
  P19 HTML → P01 URL 变换 → 默认插入。
- **IPC 顺带补齐**：`clipboard:readHtml`（需求要求）+ `clipboard:writeHtml`
  （`clipboard.write({text, html})`，供本需求 e2e 与 P20 富文本复制复用）；
  类型在 `electron/shared/api.ts` 单一源扩展，preload 桥接同步补齐。
- **P19 发现并修复的产品缺口**：`useFileOps.loadContent` 此前不调用
  `setBaseDir(path)`——程序化加载（最近文件/草稿/e2e）后 `baseDir` 仍指向
  上一个文件目录，粘贴 `file://` 图片走 P05 `importLocalImage` 时因
  `baseDir === ''` 提前返回、URL 原样落盘。现在 `path != null` 时
  loadContent 自行 `setBaseDir(path)`（与 openFile/saveFileAs 既有行为对齐）。
- **粘贴图片二遍解析**（`resolvePastedImages`）：`file://`/绝对路径 →
  `window.api.importLocalImage`（文档目录内文件转相对路径，目录外按
  copyExternal 复制进 assets）；`https?://` 且 `downloadRemoteImages` 开且
  有 baseDir → `downloadRemoteImage`；否则保留 URL（预览照常渲染）。任一
  图片解析失败不影响粘贴本身（原 src 落文档）。
- **e2e 表格断言的边界行为**：TableWidget 在光标落入表格区间时按设计退回
  原文（`blockTouched` 闭区间，P09 规则）；e2e 先粘贴再把光标移到表外段落
  验证 `.cm-md-table-wrap` 渲染——验收标准 ② 成立。

### 测试证据

- 单测：`npm run test:unit` **111/111**（新增 `htmlToMd.test.ts` 23 例：
  内联/列表/引用/表格对齐与 `\|` 转义/pre 语言 fence/丢弃标签/实体/畸形
  HTML/collectImageSrcs）
- e2e：`node scripts/cdp-p19.mjs`（端口 9236）**31/31 ALL PASS**——浏览器
  片段转换与 DOM 粘贴、GFM 表格 + TableWidget、偏好关→纯文本、菜单路径
  与 DOM 路径输出一致、script/style/iframe 内容不出现、file:// 图片走 P05
  转相对路径 + 控件渲染、远程 URL 在 downloadRemoteImages=off 时保留、
  畸形 HTML 回退无垃圾
- 冒烟：`npm run test:smoke` **5/5**；`npm run typecheck` 干净

### 低优未做项

- **>100KB HTML 限时回退 + 提示**（需求标注"可选，低优"）：当前转换为同步
  纯字符串扫描，实测对大段粘贴无阻塞问题；限时中断机制未单独实现。
