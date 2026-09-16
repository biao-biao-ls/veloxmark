# P05 图片体验增强

优先级：P05 | 类别：UX/功能 | 预估规模：M

## 背景

当前 `ImageWidget`（`widgets.ts`）纯展示：图片不可点击、无缩放控件；粘贴
剪贴板图片走 `editPaste` 只读文本，直接丢图；`ImageWidget.cache` 是静态
Map，文件在外部被修改后不会刷新，且永不失效。

## 目标

对齐 Typora 的图片工作流：粘贴/拖拽图片自动落盘并插入 Markdown，点击
图片可缩放，缓存与磁盘保持一致。

## 功能需求

### 粘贴与拖入
- [ ] 粘贴剪贴板位图（Ctrl+V）→ 落盘到当前文档同目录（或配置的附件目录）
      `assets/` 下，文件名带时间戳，插入 `![](相对路径)`
- [ ] 粘贴/拖入本地图片文件路径 → 插入相对路径引用（在文档目录内时用
      相对路径，否则按设置决定复制进 assets 或绝对路径）
- [ ] 拖入远程图片 URL → 按设置下载落盘或保留 URL
- [ ] 设置项：附件目录名、是否重命名（时间戳 vs 保留原名）

### 渲染态交互
- [ ] 点击图片进入"选中态"：显示缩放控件（25%–400% 滑杆或 +/- 按钮）
- [ ] 缩放结果写回源码（`![alt](src =WxH)` 属性，Typora/pandoc 兼容），
      编辑源码同样生效
- [ ] 图片加载失败显示占位图标 + alt 文本，不再空白
- [ ] hover 显示导出/在文件管理器显示的小按钮（可选）

### 缓存
- [ ] `ImageWidget.cache` 改为按文件 mtime 失效：resolve 时由主进程返回
      `{ dataUrl/protocolUrl, mtime }`，mismatch 即重载
- [ ] 文件 watcher 触及图片文件时广播失效（复用 P07 folder watch 基建）

## 实现要点

- 落盘走主进程：新增 IPC `image:saveClipboard`（主进程用
  `clipboard.readImage().toPNG()` 写文件并返回路径）。`preload.ts` /
  `env.d.ts` 同步扩 API。
- 渲染进程粘贴拦截在 `App.tsx` 或 CM6 `domEventHandlers.paste`：先查
  `clipboard` 是否有图片（IPC 询问主进程），有则走落盘流程，否则默认文本
  粘贴。
- 拖拽：`EditorView.domEventHandlers.drop`，`e.dataTransfer.files` 过滤
  image/*。
- 缩放 UI：图片 Widget 外包一层容器，选中态 class 切换；`WxH` 属性解析
  正则与 `livePreview.ts` 的 Image 分支合并。
- 注意 `livePreviewConfig.baseDir` 已存在，落盘相对路径以它为基准。

## 验收标准

1. 截图后 Ctrl+V：文件出现在 `assets/`，编辑器插入正确相对路径，图片
   立即渲染。
2. 点击图片出现缩放控件；拖到 200% 后源码出现 ` =WxH`；重新打开文档
   尺寸保持。
3. 外部程序覆盖图片文件后，编辑器在 watch 或重新聚焦时更新显示。
4. 不存在的图片路径显示占位符而非空白。

## 非目标

- 图片编辑（裁剪/滤镜）、图床上传。
