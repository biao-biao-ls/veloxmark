# IT-03-FE-06 自测报告 — 列表行首拖拽排序与任务项勾选（把手按需浮现、层级不变、轻量口径）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-06.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend`
- 日期：2026-09-30
- 验收：AC-OP-15 / AC-OP-16 / AC-RULE-04 / AC-ERR-08 / UI-IXD-08 / UI-IXD-09（+ 阶段 3 AC-OP-18 列表/任务切片、FE-03 hover 纪律联调）
- 实现图：[IT-03-FE-06-impl.png](./IT-03-FE-06-impl.png)（hover 把手浮现 + 任务两态：`review PRs` 已勾选删除线 / `write docs` 行 hover 把手 + 未勾选）
- 浏览器验收：CDP 驱动 [IT-03-FE-06-cdp-driver.mjs](./IT-03-FE-06-cdp-driver.mjs)，结果 [IT-03-FE-06-cdp-data.json](./IT-03-FE-06-cdp-data.json) + [IT-03-FE-06-run.log](./IT-03-FE-06-run.log) — **62/62 checks passed**

## 0. 环境与测量口径

| 项 | 值 |
|---|---|
| 被测构建 | 全新 Electron 实例（独立调试端口 + 独立 user-data-dir），`out/main/index.js` 产物，CDP `http://127.0.0.1:9456`，page title VeloxMark |
| 驱动 | Node + WebSocket CDP；`Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled`（防遮挡窗口拖慢 hover/autosave 定时器）；`Runtime.evaluate` 全程 8s 墙钟超时 |
| fixture | `fe06-list-drag-selftest.md`：嵌套列表（alpha/alpha-a1/a2, beta, gamma）+ 任务列表（`[x] review PRs` / `[ ] write docs` / `[ ] ship release`）+ 单项列表（only-item）+ 尾段正文 |
| 只读 fixture | `fe06-list-readonly-selftest.md`（同终态正文），chmod 0o444；测后 chmod 0o666 + 删除 |
| 草稿对话框口径 | 「恢复未保存的草稿」一律点 **「稍后」** 关闭——**全程未丢弃任何草稿**（`dismissAnyDialog` 目标序：`稍后` → `确定`；无 draftDiscard 调用） |
| hover 防抖 | `HOVER_DELAY_MS = 150`（FE-03 hoverDiscipline bus，把手显隐零自写定时器） |
| toast 面 | `.toast-host .toast-msg`（getCtxRuntime().toast = useToast bus → ToastHost） |
| 位移测量 | 全部 `.cm-line` 的 `boundingClientRect` 前后对比，零容差（`maxShift===0`） |
| autosave | 偏好默认 debounce 3s；落盘断言 = 直读磁盘文件 vs `__veloxP13.getDoc()` |
| e2e 缝 | 仅消费既有 `__veloxP12/P13/P18/P21`；**未新增任何 `data-op` / `window.__velox*` / 命令 id**（`data-testid` 为新增：`list-drag-handle`（沿用 FE-03 占位名）/`list-drag-ghost`/`list-drop-indicator`/`task-checkbox`） |

**夹具设计动态发现（影响断言口径）**：CommonMark 语义下同缩进、仅空行相连的 bullet 是**同一个 loose list**（同一重排组）。首轮驱动把三个「列表」只用空行分隔，`only-item` 实际有 6 个同级兄弟——S4 单例灰显因此假失败。夹具改为非空段落（`Task list below.` / `Singleton below.`）块级隔断后，only-item 成为真·单例（`canReorderListItem=false` → 把手灰显）。实现层按 GFM 语义分组是正确行为（与 `listDrag.test.ts` loose-list 用例一致），未改实现。

## 1. S1 hover 把手（UI-IXD-08 判据1 + FE-03 联调）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 静置不渲染把手 | 无常驻占位、零 DOM 残留 | `handles=0, floats=0`（无 `.is-idle` 常驻变体） | ✓ |
| hover 行首把手浮现 | ≥150ms 防抖后出现 | 167ms 出现（`data-testid="list-drag-handle"`） | ✓ |
| 把手标识 | title/aria「拖拽排序」 | `render.list.dragHandle` 原文命中 | ✓ |
| 可拖行把手非灰显 | 非 `is-disabled` | `className="cm-md-drag-handle"`，`data-disabled` 缺省 | ✓ |
| 不遮挡行文本 | 把手 rect 与行 rect 零重叠 | handle `right=317.5` < row `left=321.5`（row-start 左侧），`rectsOverlap=false` | ✓ |
| 浮现前后正文位移 0px | 零容差 | maxShift=0（19 行） | ✓ |
| 移出即隐 | ~600ms 内消失 | 163ms 消失 | ✓ |
| 移出零残留 | 把手/浮层均卸载 | `handles=0, floats=0` | ✓ |
| 快速掠过 0 闪现 | 每点 <150ms 驻留 | 6 行掠过 `flashes=0` | ✓ |
| 任务行 hover 亦浮现 | 把手可挂任务行 | 168ms 出现 | ✓ |

几何实测（CSS px）：把手 rect `left=299.5 top=198.08 w=18 h=22`（18×22 accent 块，ui_06 block C）；alpha 行 rect `left=321.5`。

**impl 图**：hover `write docs` 任务行 → 同帧呈现嵌套列表 + 把手（accent ⠿ 块 + 行 hover 底色）+ 任务两态（`review PRs` 蓝勾 + 删除线 / `write docs`、`ship release` 未勾选）+ 单项列表区，与设计稿 block C 同区域。

## 2. S2 拖拽排序（AC-OP-16 + UI-IXD-08 判据2）

### 2a. Esc 取消（会话清理）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 拖动会话中 ghost + 插入指示线 | 两者可见 | `ghost=true`，indicator `display:block, w=800, h=2`（2px accent 插入线） | ✓ |
| 拖动中把手稳定不消失 | pin 住通道 | `handle=true`（mid-drag 采样仍在） | ✓ |
| Esc 取消清场 | ghost/指示线移除 | `ghost=false, indicator=null` | ✓ |
| Esc 取消零写入 | 文档不变 | getDoc 逐字节不变 | ✓ |

### 2b. 同层级换序 + 一步 undo + toast 回执

拖 `gamma`（顶层第 3 项）到 `alpha` 行上半（placement=before）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 同层级顺序调整 | gamma 移到 alpha 前 | 行序 `gamma,alpha,alpha-a1,alpha-a2,beta,…` | ✓ |
| 缩进不变（层级保持） | 每行缩进前缀逐项相等 | 全部 item 缩进映射一致（alpha-a1/a2 保持 2 空格） | ✓ |
| 子树整体随行移动 | alpha-a1/a2 跟随 alpha | 块级移动，子行序保持 | ✓ |
| toast 回执 | 精确「已移动列表项（Ctrl+Z 可撤销）」 | `render.toast.listMoved` 原文命中 | ✓ |
| 一次 Ctrl+Z 还原 | 单 transaction = 单 undo 步 | getDoc 与拖前逐字节相等 | ✓ |

**.md 前后 diff（拖拽 1）**：

```diff
  # FE-06 selftest
  
- - alpha
+ - gamma
-   - alpha-a1
+ - alpha
-   - alpha-a2
+   - alpha-a1
- - beta
+   - alpha-a2
- - gamma
+ - beta
  
  Task list below.
  （后文不变）
```

### 2c. 反向拖拽 + autosave 落盘

还原后拖 `beta` 到 `gamma` 行下半（placement=after）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 反向落位 | beta 移到 gamma 后 | 行序 `alpha,alpha-a1,alpha-a2,gamma,beta,…` | ✓ |
| toast 同文案 | 回执一致 | 同 `render.toast.listMoved` | ✓ |
| 缩进仍不变 | 逐项相等 | 一致 | ✓ |
| autosave 落盘 | 磁盘 === 编辑器 === 预期 | `matchesDoc:true, matchesExpected:true`（`lastAutoSaveAt` 非空） | ✓ |

**.md 前后 diff（拖拽 2）**：

```diff
  - alpha
    - alpha-a1
    - alpha-a2
- - beta
+ - gamma
- - gamma
+ - beta
```

## 3. S3 任务勾选（AC-OP-15 + AC-RULE-04 + UI-IXD-09 + PEND-15）

单击未勾选任务框 `write docs`（单击 toggle 轻量口径，Q9 裁决：节点多选=不实现）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 勾选前 toast 基线清空 | 无残留 toast | `null`（S2 回执 5s 驻留结束后再测） | ✓ |
| 即时反馈（UI-IXD-09） | 勾选 + 删除线 | **6ms** 内 `checked=true` + 行 `cm-md-task-done` | ✓ |
| .md 写回 `[ ]`→`[x]`（AC-OP-15） | 源即唯一真源 | 落 `- [x] write docs` | ✓ |
| 其它任务项不变 | 旁项状态不动 | review PRs 仍 `[x]`、ship release 仍 `[ ]` | ✓ |
| 展示态与源一致（AC-RULE-04） | 只来自源重建 | 3 项 DOM 勾选态 === 源 `[x]` 槽 | ✓ |
| 全程无 toast（PEND-15） | 0 弹出 | 5 次采样全 `false` | ✓ |
| 一次 Ctrl+Z 还原 | 单步 undo | 回到 `[ ]`，全文逐字节还原 | ✓ |
| 再勾选 + autosave 落盘 | 磁盘落终态 | `matchesDoc:true, matchesExpected:true` | ✓ |

**.md 前后 diff（勾选）**：

```diff
  Task list below.
  
  - [x] review PRs
- - [ ] write docs
+ - [x] write docs
  - [ ] ship release
```

**PEND-15 差异声明**：任务勾选轻量口径 **全程无 toast**——`render.toast.*` 字典锁定为 4 键（imageSize/imageAlign/linkUpdated/listMoved），**无 `render.toast.taskChecked` / `render.toast.fold*` 键，勿补**（差异声明见 `i18n/zh.ts`/`en.ts` 注释）。拖拽排序有回执 toast（AC-OP-16 明文要求），二者口径不同是显式产品决策。

## 4. S4 单项列表空态（把手灰显不可拖）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 单项列表把手仍浮现 | hover 可见 | 170ms 出现 | ✓ |
| 灰显 | `is-disabled` + `data-disabled="true"` | `className="cm-md-drag-handle is-disabled"` | ✓ |
| 不启动拖拽会话 | 无 ghost/指示线 | `ghost=false, indicator=null` | ✓ |
| 拖拽尝试零写入 | 文档不变 | getDoc 逐字节不变 | ✓ |

## 5. S6 导出一致性（AC-OP-18 列表/任务切片）

`__veloxP21.renderExportHtml()` 静态渲染 vs 编辑视图：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 导出行序 === 编辑视图 | `alpha,alpha-a1,alpha-a2,gamma,beta,review PRs,write docs,ship release,only-item` | 一致 | ✓ |
| 导出勾选态 === 编辑视图 | `[F,F,F,F,F,T,T,F,F]` | 一致（`<input type="checkbox" disabled checked>` 槽位） | ✓ |
| 编辑视图行序 === .md 源 | DOM 顺序 = 源顺序 | 一致 | ✓ |

## 6. S5 只读拦截（AC-ERR-08）

chmod 0o444 只读文件 + `isWritable` 探针 `{ok:true,v:false}`：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 只读探针 | 报告不可写 | `v:false` | ✓ |
| 拖拽被拦（提交时闸门） | 会话可建立、落点拒绝 | ghost/指示线可见；`dropListMove` 经 `assertWritable` 拒绝 | ✓ |
| 拖拽 toast 冻结文案 | 「文件为只读，无法修改，可另存后编辑」 | `err.readonly` 原文命中 | ✓ |
| 拖拽零写入 | 文档逐字节不变 | 不变 | ✓ |
| 勾选被拦 | toast 冻结文案 | 同文案 | ✓ |
| 勾选零写入 + 不闪变 | 源/展示态均不动 | 文档不变；checkbox 保持原态（`preventDefault` 回滚，无瞬时误勾） | ✓ |
| 另存后（恢复可写）恢复 | 拖拽回到正常路径 | 探针 `v:true`；拖拽落位 + 回执 toast + 真实写入 | ✓ |

**零瞬时态说明**：勾选点击走 `preventDefault` 回滚原生 checkbox 翻转——拒绝写入时无任何视觉闪变（AC-RULE-04 展示态只来自源重建）；拖拽会话放开 grab（与 ImageEditFloat resize 同口径），闸门在 commit（`dropListMove`），拒绝时零 dispatch。

## 7. 质量门禁（converge）

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 通过（0 error） |
| `npm run test:unit`（Vitest） | 通过（729/729，含 `listDrag.test.ts` 19 用例 + `build.test.ts` 任务两态断言） |
| e2e 缝硬契约 | 未破坏：无新增 `data-op`/`window.__velox*`/命令 id；`data-testid="list-drag-handle"` 沿用 FE-03 占位名 |
| CDP 自测 | 62/62 checks passed（本报告 §1–§6） |
| 冻结文案 | `toast.*/ctx.*/err.*` 零改动；消费既有 key（`render.toast.listMoved`/`err.readonly`/`render.list.dragHandle`） |

## 8. 遗留与边界

- 拖拽中指针掠过其它列表行时，把手会随 hoverDiscipline 的 anchor 重定向到新行（通道保持可见不消失；FE-03 既有 retarget 语义）。拖拽会话本身（ghost/指示线/落点）不受影响。
- 有序列表拖拽不改写源 marker 数字（渲染层 `data-vm-n` 构建期重排号）——与 5A 既有口径一致。
- 空行相连的同级 bullet 属同一 loose list 重排组（GFM 语义）；要分组须块级内容隔断。单元测试已覆盖 loose-list 缝隙行固定不随块移动。
