# P17 链接导航与文档间跳转

优先级：P17 | 类别：UX/功能 | 预估规模：S–M

## 背景

渲染态链接目前只是样式（`handlers.ts` 的 `enterLink` 打 `cm-md-link`
类，P09 负责括号显隐），点击无任何行为。文件夹工作区（P07）与全局搜索
（P13）都已就绪，但文档之间唯一的互联方式失效——`[说明](./guide.md)`
点不开、`#小节` 不跳转，知识库场景闭环缺最后一环。P09 非目标中留了
"链接目标编辑可另立需求"的口子，一并归入本需求低优项。

## 目标

链接成为工作区内的导航原语：相对路径文档一键打开、锚点文档内跳转、
外部链接安全交给系统浏览器、失效链接可见可修。

## 功能需求

### 文档内与文档间跳转
- [x] Ctrl（macOS Cmd）+ 点击渲染态链接文本 → 解析目标：
      - 相对/绝对路径指向 `.md`：打开该文档（工作区内走
        `openFileFromTree` 同款路径；工作区外的本地文件读入也允许）
      - `path.md#锚点`：打开后滚动到对应标题
      - 纯 `#锚点`：当前文档内跳转（标题 slug 匹配，GitHub 规则：
        小写、空格转 `-`、去标点、重复加 `-n` 后缀）
  - [ ] 点击目录路径：若为目录则在侧栏文件树中定位（可选，低优）
- [x] 普通单击仍是"定位光标"（便于编辑链接文本/URL），不触发导航
- [x] hover 链接：浮动提示显示解析后的目标路径 + 锚点标题（有则显示）

### 外部链接
- [x] Ctrl/Cmd+点击 `http(s)://` 链接：弹确认（P02 对话框，显示目标
      URL）→ 确认后系统默认浏览器打开
- [x] 设置项：`externalLinkConfirm: boolean`（默认开），关闭后直接打开
- [x] `mailto:` 等其他协议首版仅显示提示，不打开

### 失效链接标注
- [x] 指向不存在文件的相对路径链接：渲染态虚线下划线
      （`cm-md-link-broken`），hover 提示 "目标不存在"
- [x] 检测结果缓存 + epoch 失效（仿 `imageEpoch` 模式）：文件 watcher
      （P07）推送与保存文档时 bump epoch 重检
- [x] 仅在文件夹工作区打开时启用检测（无 baseDir 时跳过）

### 链接目标编辑（低优）
- [ ] 光标在链接内时（P09 已显示完整标记）：浮动小按钮 "打开" / "编辑
      URL"；编辑 URL 就地改源码 `[](…)` 部分

## 实现要点

- 点击处理：不做 per-mark DOM 事件（mark 装饰无法挂监听），用
  `EditorView.domEventHandlers({ mousedown })`：命中位置
  `syntaxTree.state.resolve` 找 `Link`/`URL` 父节点，取 URL 文本解析。
  mousedown 时检测修饰键（`window.api.platform` 区分 Ctrl/Cmd）。
- 路径解析以 `LivePreviewConfig.baseDir` 为基准（Facet 注入已有）；
  URL 解码、`%20`、`../` 归一化用 Node `path` 语义（渲染进程内手写轻量
  resolve，或经 IPC 让主进程解析——推荐后者，顺便返回 exists）。
- 新增 IPC：`resolveLink(baseDir, href) → { kind: 'file'|'dir'|'anchor'|'external'|'broken', absPath?, exists?, anchor? }`，
  handler 落 `electron/ipc/files.ts`，类型扩 `electron/shared/api.ts`。
- 外部链接打开：新增 IPC `openExternal(url)`（主进程
  `shell.openExternal`，与 `main.ts` 窗口 openHandler 一致的 deny 策略）。
- 打开文档：`useFileOps` 需提供 `openFileByPath(path, anchor?)`——现有
  `openFileFromTree`（workspace hook）已按 path 打开，抽出可复用部分；
  锚点跳转复用 `App.tsx` 的 `goToHeading`（slug 匹配
  `outline/extract.ts` 的条目）。
- 失效检测：渲染进程 `Map<absPath, exists>` 缓存，build 时同步读缓存出
  装饰，异步 `pathExists` 结果回来后 bump epoch 触发重建（同 P05
  `imageEpoch` → `invalidateImageCache` 模式）。cache 装饰加进
  `handlers.ts` 的 `enterLink`。
- hover 提示：编辑器级单例 tooltip 元素，mousemove 命中链接 span 时
  定位显示（仿表格/图片的全局单例思路，不给每个 span 挂 listener）。
- 打开文件前的 dirty 拦截：复用 `useFileOps` 现有 "Unsaved Changes"
  确认流程，不允许链接导航绕过。

## 验收标准

1. 文档 A 中 Ctrl/Cmd+点击 `[B](./b.md)`：编辑器切换到 b.md；未保存时先
   弹出确认。
2. `[小节](#安装步骤)` 跳到当前文档 "## 安装步骤"；`[b](./b.md#配置)`
   打开 b.md 后定位到 "## 配置"。
3. 普通单击链接文本只把光标放进去，不打开文件。
4. 删除目标文件后，源文档中该链接变虚线；hover 提示不存在；恢复文件并
   触发 watcher 后虚线消失。
5. Ctrl/Cmd+点击 `https://example.com` 弹确认框，确认后系统浏览器打开；
   设置关闭确认后直接打开。

## 非目标

- Wiki 风格 `[[双链]]` 语法、反向链接面板
- 全库链接图谱、链接自动重命名联动（改文件名批量改引用）
- PDF/HTML 导出中链接策略变更（导出保持原样 href，由浏览器处理）

---

## 实施状态（已完成）

实施分支：`feat/P11-P26-scenarios`。e2e：`scripts/cdp-p17.mjs`（端口 9234，
30 项全部 PASS）；单测 73/73；冒烟 5/5；typecheck 通过。

**核心实现**

- **IPC**：`link:resolve`（`electron/ipc/files.ts`，主进程完成
  percent-decode、`..` 归一化、`stat` 存在性探测，返回
  `LinkResolveResult{kind,absPath,exists,anchor}`）；`shell:openExternal`
  （`electron/ipc/window.ts`，仅放行 `http(s)://`，其余协议返回 false）。
  类型/预加载同步扩展 `api.ts` / `preload.ts`。
- **slug**：`outline/extract.ts` 新增 `slugify`（GitHub 规则：小写、去
  标点、空白逐字符转 `-`，CJK 保留）与 `findHeadingBySlug`（文档序重复
  标题 `-n` 后缀消歧）。
- **导航**：新模块 `editor/livePreview/linkNav.ts`——
  `EditorView.domEventHandlers` 捕获 mousedown（darwin `metaKey`，其余
  `ctrlKey`，经 `window.api.platform` 判定），语法树向上找
  `Link/URL/Autolink` 取 href，经 nav-bus 回调 App 的
  `resolveAndNavigate`：anchor → `findHeadingBySlug`+`goToHeading`；
  file → `openFileByPath`（P12 dirty 闸门原样保留）后按 `#anchor` 二跳；
  external → 非 http(s) 提示，否则按 `externalLinkConfirm` 偏好弹
  P02 confirm（消息内嵌目标 URL）→ `openExternal`；broken → alert。
  普通单击不拦截（handler 仅在修饰键命中时 `return true`）。
- **失效标注**：渲染进程 `Map<'${baseDir}\n${href}', broken>` 缓存
  （`rememberLinkStatus` 仅在状态翻转时返回 true）；`LivePreviewConfig`
  增加 `linkEpoch`，翻转时 `bumpLinkEpoch`（仿 `bumpImageEpoch`）触发
  装饰重建；`handlers.ts` `enterLink` 按缓存改用
  `cm-md-link cm-md-link-broken` 装饰（scheme/`#anchor` 永不标破）。
  重检触发：打开/切换文件、`folder:tree` watcher 事件、autosave 落盘、
  窗口 focus，统一 200ms 防抖。
- **hover 提示**：编辑器级单例 `.vm-link-tooltip`（懒创建、
  `pointer-events:none`），mousemove 命中 `.cm-md-link` span 时显示；
  broken 即时显示本地化文案，否则异步 `resolveLink` 补全
  绝对路径 + 锚点标题（当前文档大纲或目标文件大纲解析）。
- **偏好**：`externalLinkConfirm`（默认 true，sanitize 兜底）+
  Preferences 行为区复选框 + zh/en 文案（`prefs.externalLinkConfirm`、
  `link.*` 四键）。

**e2e 纪律（沿用 P16 经验）**

- `window.api` contextBridge 冻结 → `openExternal` 走
  `__veloxP17.setOpenExternalImpl` 产品接缝；捕获数组挂在独立全局
  `__veloxP17Capture`（App 重渲染会整体重建 `__veloxP17` 钩子对象）。
- P09 触发态：未触碰链接的 URL 半段被装饰隐藏，e2e 以可见标签文本命中
  span，光标位置断言放宽至链接区间 ±1。

**低优未做（如实记录）**

- 「链接目标编辑」浮动按钮（打开/编辑 URL）——低优，未实现。
- 点击目录路径在侧栏文件树定位——需求标注"可选，低优"，未实现；
  `LinkResolveResult.kind==='dir'` 已由 IPC 返回，后续可直接接线。
