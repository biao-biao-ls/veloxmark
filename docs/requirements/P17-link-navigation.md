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
- [ ] Ctrl（macOS Cmd）+ 点击渲染态链接文本 → 解析目标：
      - 相对/绝对路径指向 `.md`：打开该文档（工作区内走
        `openFileFromTree` 同款路径；工作区外的本地文件读入也允许）
      - `path.md#锚点`：打开后滚动到对应标题
      - 纯 `#锚点`：当前文档内跳转（标题 slug 匹配，GitHub 规则：
        小写、空格转 `-`、去标点、重复加 `-n` 后缀）
  - 点击目录路径：若为目录则在侧栏文件树中定位（可选，低优）
- [ ] 普通单击仍是"定位光标"（便于编辑链接文本/URL），不触发导航
- [ ] hover 链接：浮动提示显示解析后的目标路径 + 锚点标题（有则显示）

### 外部链接
- [ ] Ctrl/Cmd+点击 `http(s)://` 链接：弹确认（P02 对话框，显示目标
      URL）→ 确认后系统默认浏览器打开
- [ ] 设置项：`externalLinkConfirm: boolean`（默认开），关闭后直接打开
- [ ] `mailto:` 等其他协议首版仅显示提示，不打开

### 失效链接标注
- [ ] 指向不存在文件的相对路径链接：渲染态虚线下划线
      （`cm-md-link-broken`），hover 提示 "目标不存在"
- [ ] 检测结果缓存 + epoch 失效（仿 `imageEpoch` 模式）：文件 watcher
      （P07）推送与保存文档时 bump epoch 重检
- [ ] 仅在文件夹工作区打开时启用检测（无 baseDir 时跳过）

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
