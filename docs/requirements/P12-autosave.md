# P12 自动保存与崩溃恢复

优先级：P12 | 类别：功能 | 预估规模：M

## 背景

当前只有手动 Ctrl+S；进程崩溃、断电、系统重启时未保存内容全部丢失
（`savedContentRef` 只在内存）。关闭窗口时也没有 dirty 拦截——
`windowClose` 直接关，脏内容静默丢弃。Typora 有自动保存、关闭确认、
未保存草稿恢复。

## 目标

三层数据安全：① 关闭拦截不丢内容；② 定时自动保存（可选）；③ 崩溃后
恢复未保存草稿。

## 功能需求

### 关闭/切换拦截
- [x] 窗口关闭请求（含 `window.api.windowClose`、系统 Cmd+Q/Alt+F4）在
      dirty 时弹 P02 自绘确认：保存并关闭 / 不保存关闭 / 取消
- [x] 打开另一个文件前的 `confirmDiscard` 升级为三选项（当前只有
      放弃/取消，缺"先保存"）
- [x] macOS `open-file` 切换文件同样走三选项

### 自动保存
- [x] 设置项：关闭 / 输入停止 N 秒（debounce，默认 3s）/ 固定间隔 N 分钟
- [x] 有 filePath 时直接写原文件；无路径的 Untitled 写草稿区
- [x] 自动保存不清除 dirty 状态语义需明确：采用"保存即 clean"（简单）；
      标题栏指示自动保存时间（可选）

### 崩溃恢复
- [x] 草稿机制：每次文档变更 debounce 后把 `{path, content, mtime}`
      写入 `app.getPath('userData')/drafts/`（按 hash 命名，防路径非法字符）
- [x] 保存成功或显式放弃后删除草稿
- [x] 启动时若存在草稿且对应文件的 mtime/content 与草稿不一致 → 提示
      恢复（P02 对话框：恢复 / 丢弃草稿）
- [x] 会话恢复（对接 P03）：启动时恢复上次打开的文件 + 光标位置

## 实现要点

- 关闭拦截：主进程 `mainWindow.on('close', e => ...)`，询问渲染进程
  `app:queryClose` → 渲染进程回 `allow/deny`（deny 时渲染进程自己弹对话框
  再调用保存，成功后置 flag 重试关闭）。需处理 macOS `open-file` 与关闭
  竞态。
- 草稿写入建议在**主进程**做（渲染进程发 IPC 带内容，主进程节流写盘），
  避免渲染进程崩溃瞬间丢掉最后一次 debounce。
- 自动保存直接复用 `hooks/useFileOps.ts` 的 `saveFile`；注意与
  `editPaste` 等的事务边界无关——文档级保存即可。
- dirty 判定现有 `doc !== savedContentRef.current`（useFileOps 内）每次
  变更全文比较，大文件下可改为脏标记置位 + 保存时清零（微优化，顺手做）。

## 验收标准

1. 编辑后点窗口 ×：出现"保存并关闭/不保存/取消"三选；选保存写盘后关闭。
2. 开启 3s 自动保存：输入停 3 秒后文件 mtime 更新，kill -9 进程重启不丢
   已自动保存内容。
3. 关闭自动保存，编辑后 kill 进程，重启出现草稿恢复提示，恢复内容与
   崩溃前一致。
4. 保存后崩溃重启不再提示草稿。

## 非目标

- 版本历史/时光机（文件级多版本快照另立需求）。

---

## 实施状态（已完成）

实现于 `feat/P11-P26-scenarios`（e2e：`scripts/cdp-p12.mjs`，全部 PASS）。

### 关闭拦截（IPC 回环）
- 主进程 `mainWindow.on('close')` → `preventDefault` + `webContents.send('app:queryClose')`；
  渲染进程 `Dialog.choose` 三选（macOS 顺序：取消 / 不保存 / 保存；Enter→默认键，Esc→取消）
  → `app:closeResponse(allow)` → 置 `closeApproved` 后重试 `win.close()`。
- P02 `Dialog` 新增 `kind:'choose'`（`dialog.choose()` → `'confirm'|'discard'|'cancel'`）；
  `useFileOps.confirmDiscard`（打开/切换文件、macOS open-file 路径）与 `queryClose`
  共用同一三选实现；"保存"→`saveFile()`（Save As 被取消时中止关闭），
  "不保存"→丢弃该文档草稿后放行。

### 自动保存
- 偏好新增 `autoSaveMode:'off'|'debounce'|'interval'`（默认 debounce）、
  `autoSaveDelaySec`（默认 3，钳制 1–60）、`autoSaveIntervalMin`（默认 5，钳制 1–60）、
  `crashRecoveryEnabled`（默认 true）；Preferences 面板新增 "Autosave & Recovery" 分区。
- `hooks/useAutoSave.ts`：debounce/interval 两条管线；有路径复用 `saveFile()`，
  Untitled 写草稿区并同步 `savedContentRef`（"保存即 clean"）；标题栏显示
  "Auto-saved HH:MM"（`.tb-autosave`）。

### 崩溃恢复草稿
- `electron/ipc/drafts.ts`：`userData/drafts/<sha1(path|'__untitled__')>.json`，
  写入在主进程 500ms 尾随节流（latest-wins），渲染进程侧变更后 1s debounce 触发
  `draft:write`；`draft:discard` 保存/显式放弃时删除；`draft:list` 先 flush 后读。
- 启动恢复：`sessionSynced` 后 `checkDrafts()` — 与磁盘一致→静默丢弃；
  不一致→对话框 恢复 / 丢弃草稿 / 稍后（Untitled 草稿单独提示）；恢复时
  `savedContentRef`=磁盘内容，dirty=草稿≠磁盘。
- dirty 微优化：变更置位/保存清零（`dirtyRef`），程序化加载经 `suppressDirtyRef`
  抑制，不再每次变更全文比较。

### 会话对接（P03）
- `SessionState.lastCursor`：选区变化 500ms 节流持久化；启动恢复上次文件后
  若 `0 < lastCursor ≤ doc.length` 则应用光标位置。

### e2e 卫生
- 既有 cdp 脚本（p03/p05/p06/p08–p11）boot pin 增加
  `crashRecoveryEnabled:false, autoSaveMode:'off'`（p03/p05/p06 另清一次草稿），
  防止草稿恢复对话框干扰其他场景脚本；`scripts/tmp-p*/` 已入 .gitignore。
- e2e 钩子：`window.__veloxP12`（queryClose/confirmDiscard/saveFile/loadDoc/
  draft*/runDraftCheck/getLastAutoSaveAt）；`__veloxPrefs.setPreferences` 供脚本
  动态改偏好。SIGKILL 后 localStorage 可能未提交，脚本等待 2s 再杀；若重启后
  偏好丢失则以 `runDraftCheck()` 走同一恢复代码路径（产品默认即开启恢复）。
