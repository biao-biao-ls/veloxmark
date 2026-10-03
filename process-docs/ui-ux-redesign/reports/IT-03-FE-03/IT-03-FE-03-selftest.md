# IT-03-FE-03 自测报告 — hover 浮层/微操作防抖基座与退出纪律

- 任务：IT-03/FE-03（`ren-hover:discipline` 共用防抖显隐基座）
- 日期：2026-09-29
- 验证方式：Vitest 纯函数单测（useHoverDiscipline / renderFloatPos）+ 真机 CDP 自测（Electron 构建产物 + 原生 CDP Input/Runtime 协议精确计时，驱动脚本 `IT-03-FE-03-cdp-driver.mjs`，原始数据 `IT-03-FE-03-cdp-data.json`）
- 结论：阶段 1（开发验收）3/3 通过；阶段 2（自测验收）4/4 通过；阶段 3 仅 Esc 收拢半侧可验（FE-04/05/06 接入时序一致留待接入后联调）；实现图 `IT-03-FE-03-impl.png` 已留存

## 0. 验收环境与计时基线

| 项 | 值 |
|---|---|
| 视口 | 1280×900 |
| 测试文档 | `fe03-hover-selftest.md`（标题 + 含链接段落 + 4 列表行 + 2 任务行 + 图片 + 正文尾行），经 `window.__veloxP12.loadDoc` 注入 |
| 命中区计数 | img=1（无 broken）、link=1、list rows=6 |
| 防抖阈值 | `HOVER_DELAY_MS = 150`，全仓仅 1 处定义（`useHoverDiscipline.ts:25`）+ 3 处引用（`:8/:46/:149`），`grep -n '150\|HOVER_DELAY'` 与验收清单要求一致 |
| 计时来源 | 页内 `performance.now()`：capture 相位 mouseover/mouseout 打点 + MutationObserver 记录 `.render-float` 挂载/卸载时刻，dt = 浮层事件时刻 − 触发打点时刻 |

> **计时陷阱（后续 CDP 脚本必读）**：Electron 窗口被遮挡时 `document.visibilityState === 'hidden'`，Chromium 会把 150ms `setTimeout` 拉伸到 400–900ms，并把 `mouseout` 派发推迟数秒（实测一次 leave 延迟 4.9s，导致快速掠过假闪烁）。驱动脚本先发 `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled({enabled:true})` 强制页面活性后，计时恢复 150–165ms 名义值。下列数据均在 `visibilityState: visible` 下测得。

## 1. AC-FN-14 四判据（图片/链接/列表行各一次）

每条 hover 流程：中性点 → 悬停锚点中心 → 等浮现 → 移回中性点 → 等消失 → 查残留。

| 通道 | testId | 显现延迟 dt（判据 1 ≥150ms） | 消失延迟 dt（判据 3 ≥150ms） | 遮挡锚点（判据 2 = false） | 退出残留 DOM（判据 4 = 0） | 判定 |
|---|---|---|---|---|---|---|
| 图片浮层 | `image-edit-float` | **164.5ms** | **156.2ms** | false | 0 | 通过 |
| 链接浮层 | `link-hover-float` | **161.3ms** | **156.5ms** | false | 0 | 通过 |
| 列表行把手 | `list-drag-handle` | **152.2ms** | **151.8ms** | false | 0 | 通过 |

不遮挡判据原始矩形（float 与 anchor 矩形相交 = false，单位 px）：

| 通道 | 浮层 rect (l,t,r,b) | 锚点 rect (l,t,r,b) | 吸附关系 |
|---|---|---|---|
| 图片 | 377.5, 381.92, 416.5, 418.92 | 377.5, 426.92, 1145.5, 1194.92 | 图片 768×768 下方无空间 → 翻转至上方（浮层 bottom 418.92 < 锚点 top 426.92） |
| 链接 | 393.5, 227.58, 432.5, 264.58 | 393.5, 198.58, 566.95, 219.58 | 贴链接下方（浮层 top 227.58 > 锚点 bottom 219.58） |
| 列表把手 | 345.44, 247.77, 357.5, 268.77 | 361.5, 247.77, 1161.5, 273.36 | 行首左侧（浮层 right 357.5 < 行 left 361.5，间距 4px = HANDLE_GAP），行底色 `--bg-inset` 同步示 hover（见实现图） |

## 2. AC-NF-04 快速掠过闪烁计数 = 0

原始打点（`performance.now()`，ms）：

```
over:link@1484831.90 → over:list@1484847.50 → over:list@1484855.00
→ over:list@1484862.80 → over:list@1484878.00 → 离开至中性点
```

| 项 | 值 | 判定 |
|---|---|---|
| 掠过块级元素数 | 5（1 链接 + 4 列表行，≥3） | 通过 |
| 区际停留 dt | 15.6 / 7.5 / 7.8 / 15.2 ms（全部 << 150ms） | 通过 |
| 闪烁计数（appear 事件数） | **0** | 通过 |
| 掠过后残留 `.render-float` | 0 | 通过 |

## 3. AC-NF-05 位移 0px / 0px

测量对象：含链接段落 `.cm-line`（锚点所在行）、首个列表行、正文尾行 `trailing body text`。三个时刻：浮层显现前 / 显现中 / 消失后。

| 对象 | 显现中 − 显现前 (dx, dy) | 消失后 − 显现前 (dx, dy) | 判定 |
|---|---|---|---|
| 链接段落行 | 0.00px, 0.00px | 0.00px, 0.00px | 通过 |
| 列表行 | 0.00px, 0.00px | 0.00px, 0.00px | 通过 |
| 正文尾行 | 0.00px, 0.00px | 0.00px, 0.00px | 通过 |

浮层为 `position: fixed` 覆盖层，不占文档流，显隐全程正文零位移。

## 4. AC-FN-21 Esc 一键收拢（与 hush 语义衔接）

| 项 | 值 | 判定 |
|---|---|---|
| Esc 前浮层 | 已浮现（`list-drag-handle`，visible） | 通过 |
| 收拢延迟（keydown 打点 → 浮层卸载） | **0.6ms**（即时，明显短于 150ms 防抖） | 通过 |
| Esc 后残留 `.render-float` | 0 | 通过 |

收拢走 `RenderFloatHost` 的 `document.keydown → hoverDiscipline.hideAllNow()`（含 pinned 通道全清）。此为 `useHushLayer` 共享层落地前的过渡接线，其 `hideAllNow` 幂等，共享层落地后双监听不冲突。

## 5. UI-ELEM-05 静息零 chrome

- 静息（无 hover）时 `.render-float` 计数 0——把手/浮层整体不挂载（比 `is-idle` 透明度方案更彻底，无残留命中区）；
- 快速掠过全程 0 次 appear（§2），无常驻半透明遮罩；
- 实现图 `IT-03-FE-03-impl.png` 为列表行 hover 把手浮现态（行首 `⠿` accent 圆角小块 + 行底 `--bg-inset`，正文无遮挡）。

## 6. 阶段 1 开发验收

| 清单项 | 结果 |
|---|---|
| `npm run typecheck` 双 tsconfig | 0 error（tsconfig.web.json + tsconfig.node.json 全过） |
| `npm run test:unit` | **527 passed**（新增 27 条：useHoverDiscipline 16 + renderFloatPos 9 + 既有回归全绿） |
| 防抖常量单点定义 | `grep -n '150\|HOVER_DELAY' src/renderer/src/hooks/useHoverDiscipline.ts` → 1 定义 + 3 引用 |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-03/IT-03-FE-03-impl.png`（调度指定路径/前缀；任务模板中的 `reports/FE-03/` 路径以调度参数为准） |

## 7. e2e 缝未破坏（AC-RULE-17）

`Object.keys(window).filter(k => k.startsWith('__velox'))` = **24** 个，`__veloxP12.loadDoc` 与 `__veloxEditor.view` 均在；本次交付未新增/改名任何 `window.__velox*`、`data-op` 或命令 id。

## 8. 阶段 3 状态

| 清单项 | 状态 |
|---|---|
| FE-04/FE-05/FE-06 接入基座后三类控件显隐时序一致 | **待联调**（三任务接入 `registerHoverContent` 后补验；基座契约与禁自写 setTimeout 约束已就绪） |
| Esc 一键回安静 | 本侧已验（§4，过渡接线）；`useHushLayer` 落地后需复核共存 |

## 9. 交付物清单

| 文件 | 说明 |
|---|---|
| `src/renderer/src/hooks/useHoverDiscipline.ts` | 防抖状态机 + 单例 bus + `useHoverDiscipline` hook（契约 `ren-hover:discipline`） |
| `src/renderer/src/hooks/useHoverDiscipline.test.ts` | 16 条单测（双向防抖/0 闪烁/retain/pin/dispose/快照恒等） |
| `src/renderer/src/components/renderFloatPos.ts` | 纯定位函数（below→above→beside 翻转阶梯 + row-start） |
| `src/renderer/src/components/renderFloatPos.test.ts` | 9 条单测（翻转/夹取/不遮挡） |
| `src/renderer/src/components/RenderFloat.tsx` | 定位壳 + `RenderFloatHost` + `registerHoverContent` 注册口（FE-04/05/06 注入 UI 用） |
| `src/renderer/src/editor/livePreview/hoverZones.ts` | 命中区事件代理（无 Decoration 增量，树/正则 pass 顺序不变） |
| `src/renderer/src/styles/render-zone.css` | `.render-float` / `.cm-md-drag-handle` / `.cm-md-list-hover` 样式（全 token） |
| `src/renderer/src/i18n/zh.ts` + `en.ts` | `render.list.dragHandle` 文案 |
| `src/renderer/src/editor/setup.ts` | 挂载 `hoverZonesExtension` |
| `src/renderer/src/App.tsx` | 一行装配 `<RenderFloatHost />` |
