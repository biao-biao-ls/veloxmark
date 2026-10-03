# IT-03-FE-05 自测报告 — 链接 hover 浮层（编辑 URL 写回 .md / 外开 / 复制完整 URL）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-05.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend`
- 日期：2026-09-29
- 验收：AC-FN-19 / AC-OP-14 / AC-ERR-08 / UI-IXD-07 / AC-FN-14（防抖衔接）
- 实现图：[IT-03-FE-05-impl.png](./IT-03-FE-05-impl.png)（S1 hover 态：`link-url-box` + 编辑 URL / 外开 / 复制 三入口）
- 浏览器验收：CDP 驱动 [IT-03-FE-05-cdp-driver.mjs](./IT-03-FE-05-cdp-driver.mjs)，结果 [IT-03-FE-05-cdp-data.json](./IT-03-FE-05-cdp-data.json) — **49/49 checks passed**

## 0. 环境与测量口径

| 项 | 值 |
|---|---|
| 被测构建 | Electron `out/main/index.js` 产物（已运行实例，CDP `http://127.0.0.1:9444`，page title VeloxMark） |
| 驱动 | Node v22.18.0 + WebSocket CDP；`Page.bringToFront` + `Page.setWebLifecycleState(active)` + `Emulation.setFocusEmulationEnabled`（防遮挡窗口拖慢定时器） |
| 运行窗口 | 2026-09-29T12:42:49.950Z → 12:43:07.853Z（`meta.startedAt/finishedAt`，截图与断言同一次运行） |
| fixture | `fe05-link-float-selftest.md`：4 链接（设计规范文档 / OpenAI / MDN / Local file）+ 中性正文行 |
| 只读 fixture | `fe05-link-readonly-selftest.md`（同正文），chmod 0o444；测后 chmod 0o666 + 删除 |
| 剪贴板读通道 | `window.api.clipboardRead` **可用**（断言走真实读回，非 toast 替代；`clipboardWrite` 亦在 `window.api` 上） |
| 只读探针 | `window.api.isWritable` 可达（`{ok:true,v:true}` 于可写路径）— 非 stale 构建，无 LAUNCH_ERROR |
| hover 防抖 | `HOVER_DELAY_MS = 150`（show/hide 双向）；浮层显隐全走 FE-03 `hoverDiscipline` bus |
| 位移测量 | 全部 `.cm-line` 的 `boundingClientRect` 前后对比，零容差（`maxShift===0`） |

## 1. S1 hover 浮层结构 + 不遮挡链接文本 + 位移 0px（UI-IXD-07）

fixture 首链接 `[设计规范文档](https://example.com/design-spec)`，hover ≥250ms：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 浮层随 hover 浮现 | ≥150ms 防抖后出现 | 166ms 出现（`data-testid="link-hover-float"`） | ✓ |
| url-box 显示完整 URL | 含 `https://example.com/design-spec` | text=title=`https://example.com/design-spec` | ✓ |
| 三入口齐备 | 编辑 URL / 外开 / 复制 | `link-edit-url-btn` + `link-open-btn` + `link-copy-btn` 全在 | ✓ |
| 浮层不遮挡链接文本 | 浮层 rect 与链接 rect 零重叠 | link bottom=113 < float top=121（贴链接下方），`rectsOverlap=false` | ✓ |
| 浮现前后正文位移 0px | 全 `.cm-line` 零容差 | maxShift=0 | ✓ |

几何实测（CSS px）：链接 rect `left=378.13 top=92 right=474.13 bottom=113`；浮层 rect `left=378.13 top=121 right=784.13 bottom=178`。

截图前置：指针移入浮层内 **url-box**（非链接文本；`retain` 保显）令 linkNav 的 DOM tooltip
（`.vm-link-tooltip`，含「按住 Ctrl+点击打开」提示行）隐去后再截取
（`shotPrep: {float:true, tooltipVisible:false}`，两项均入 checks）→ `IT-03-FE-05-impl.png` 清晰呈现 url-box + 三按钮，无任何提示叠层。

## 2. S2 复制完整 URL（AC-FN-19 判据 2）

点 `link-copy-btn`（浮层仍处 S1 hover 态）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| toast 轻提示 | 「链接地址已复制」 | `toast.copiedLink` 原文命中 | ✓ |
| 剪贴板写入真实发生 | 覆盖预置 sentinel | 先写 sentinel 再点复制，读回被覆盖 | ✓ |
| 剪贴板 === 完整 URL | 含协议与路径 | `clipboardRead() === 'https://example.com/design-spec'` | ✓ |

**剪贴板断言输出**（`window.api.clipboardRead()` 真读回，非 toast 替代）：

```
{"toast":"链接地址已复制","clipboardReadAvailable":true,"clipValue":"https://example.com/design-spec"}
```

无遗留缺口：`clipboardRead` 通道存在且实测可用，未退化为 toast-only 断言。

## 3. S3 外开 + 非 http(s) 拦截（AC-FN-19 判据 1 / AC-NF-12）

http(s) 分支：`__veloxP17.setExternalConfirm(false)` + `setOpenExternalImpl(async (url) => capture)` 缝捕获，
点 `link-open-btn`：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 外开走固定入口 | 经 `getCtxRuntime().openLink` → App 外开缝，不拼接用户可控串 | 缝捕获 `https://example.com/design-spec`（与 url-box 一致） | ✓ |
| 非 http(s) 弹 dialog | message「仅支持打开 http(s) 链接」 | 同文档 `[Local file](./rel.md)` 外开 → dialog 出现 | ✓ |
| 非 http(s) 不外开 | 捕获值不变 | 外开捕获仍为 `https://example.com/design-spec` | ✓ |
| dialog 可关闭 | 点确认按钮 | 「确定」点击后 `present:false` | ✓ |

**dialog 文案原文**（DOM `.dialog-message`）：`仅支持打开 http(s) 链接`；按钮：`["确定"]`。

实测数据：`{"captured":"https://example.com/design-spec","dialogState":{"present":true,"message":"仅支持打开 http(s) 链接","buttons":["确定"]},"dialogAfter":{"present":false}}`。

## 4. S4 编辑 URL 写回 + 一步 undo + 新 URL 外开（AC-OP-14）

**URL 前后 diff 样例**（`__veloxP13.getDoc()` 全文仅 destination 槽变化）：

```
- See [设计规范文档](https://example.com/design-spec) for details.
+ See [设计规范文档](https://example.com/design-spec-v2) for details.
```

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 编辑态三件套 | input 预填 + 确认/取消 | `link-url-input/confirm/cancel` 齐备 | ✓ |
| input 预填旧 URL | `https://example.com/design-spec` | 逐字命中 | ✓ |
| 写回只换 href | 锚文本不变 | `[设计规范文档](` 原样，新 dest `https://example.com/design-spec-v2` | ✓ |
| 旧 URL 离开 .md | 完整 dest 槽消失 | `](https://example.com/design-spec)` 与 `<…>` 形态均不存在（旧值为新值前缀，按槽比对） | ✓ |
| toast 回执 | 「已更新链接地址（Ctrl+Z 可撤销）」 | 逐字命中（`render.toast.linkUpdated`） | ✓ |
| 一次 Ctrl+Z 还原 | 单事务边界 | `docUndone === docBefore` 逐字节还原 | ✓ |
| 再编辑后外开用新 URL | 缝捕获新值 | `https://example.com/design-spec-v2` | ✓ |

undo 前后文档字符串与编辑前完全一致（byte-level：`docBefore == docUndone`，见 `scenarios.s4`）。

## 5. S5 只读拦截（AC-ERR-08）

fixture：`fe05-link-readonly-selftest.md` chmod 0o444 后 `loadDocExpanded` 同路径。

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 只读探针 | `file:isWritable` → false | `{"ok":true,"v":false}`（`fs.access W_OK` 真源） | ✓ |
| toast 文案精确 | 「文件为只读，无法修改，可另存后编辑」 | 全等命中（`err.readonly` 冻结文案） | ✓ |
| 文档逐字节不变 | 写回被拒不落任何字节 | before === after（`getDoc()` 串全等） | ✓ |
| 拒写后留编辑态 | `confirmEdit` 拒绝时保持输入态（设计意图） | `editMode:{input,confirm,cancel}` 全在、浮层在 | ✓ |

**只读拦截 doc 比对**（before/after 均为下文，无一字节差）：

```
See [设计规范文档](https://example.com/design-spec) for details.

Also visit [OpenAI](https://openai.com) and [MDN](https://developer.mozilla.org).

Try [Local file](./rel.md) too.

Another line of body text for neutral clicking.
```

补充：拒写留编辑态会 `hoverDiscipline.pin` 通道（hide 在 pin 期间按设计被忽略）——S6 前置先走点外部
`hideNow` 清场并断言 `render-float=0` 且无 `.cm-md-link-pop`，见 §6。

## 6. S6 hover 纪律（AC-FN-14 / UI-IXD-07）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 快速掠过 0 闪现 | ≥3 块、每点驻留 <150ms，浮层不得出现 | 7 个目标点（4 链接 + 3 正文），逐点采样 `present=false`，`flashes=0` | ✓ |
| 悬停 ≥250ms 出现 | 越过 150ms 防抖后浮现 | 164ms 浮现 | ✓ |
| 移出 ~600ms 内消失 | debounce 150ms 双向 | 180ms 消失（`render-float` 移除） | ✓ |
| 移出无残留 | `render-float=0` 且无 `.cm-md-link-pop` | `{floats:0, linkPops:0}` | ✓ |
| 点外部即隐且无残留 | mousedown capture → `hideNow` | `{floats:0, linkPops:0}` | ✓ |
| 显隐循环位移 0px | 全 `.cm-line` 零容差 | maxShift=0 | ✓ |
| 过程 .md 无改动 | 只测显隐 | `getDoc()` 前后全等 | ✓ |

S6 前置清场断言：`{floats:0, linkPops:0}`（S5 拒写 pin 态经点外部 `hideNow` 退出后）。

## 7. toast 文案原文汇总

| 场景 | i18n key | 原文 |
|---|---|---|
| S2 复制 | `toast.copiedLink` | `链接地址已复制` |
| S4 编辑写回 | `render.toast.linkUpdated` | `已更新链接地址（Ctrl+Z 可撤销）` |
| S5 只读拒写 | `err.readonly` | `文件为只读，无法修改，可另存后编辑` |
| S3 非 http(s) | `link.otherProtocol`（dialog message） | `仅支持打开 http(s) 链接` |

## 8. AC 验收证据映射

### AC-FN-19（复制完整 URL / 外开）
§2 剪贴板真读回 === `https://example.com/design-spec` + toast；§3 外开缝捕获同 URL、非 http(s) 弹 dialog 不外开。

### AC-OP-14（编辑 URL 写回 + 回执 + 一步 undo + 新 URL 外开）
§4 全表（URL 前后 diff、锚文本不变、toast 含「（Ctrl+Z 可撤销）」、一次 Ctrl+Z 逐字节还原、外开新 URL）。

### AC-ERR-08（只读拦截）
§5 全表（W_OK 真源探针 false、toast 逐字、doc byte-identical）。

### UI-IXD-07（hover 浮层 + 不遮挡 + 移出无残留 + 位移 0px）
§1 结构/不遮挡/位移 0px + §6 显隐纪律（0 闪现、180ms 消失、0 残留、位移 0px）。

### AC-FN-14（hover 防抖衔接）/ AC-NF-12（外开固定入口）
§6 防抖实测（150ms 之下掠过 0 闪现、之上 164ms 浮现）；§3 外开仅经既有通道缝捕获，无自拼 URL（grep 门禁见开发验收）。

## 9. 遗留问题

1. **linkNav 悬停提示（`.vm-link-tooltip`，含「按住 Ctrl+点击打开」行）会叠在浮层上方**（瞬时现象，
   非布局缺陷）：指针停在链接文本上时该 DOM tooltip 悬于浮层中部。实现图已改为「指针移入浮层内
   **url-box**（retain 保显，linkNav mousemove 因命中点非 `.cm-md-link` 而隐去 tooltip）后截取」——
   `shotPrep: {float:true, tooltipVisible:false}` 双断言入 checks；几何断言显示浮层与链接 rect 零重叠、
   正文位移 0px，产品层无遮挡问题。
2. **拒写留编辑态会 pin 住通道**（设计意图，非 bug）：S5 只读拒写后 `confirmEdit` 保留输入态并 `pin`，
   `hide()` 在 pin 期间按设计忽略——用户需点外部/取消/Esc 退出。本驱动在 S6 前置显式清场并断言 0 残留。
3. **阶段 3 联调项不在本 driver 范围**：AC-OP-18 导出三通道链接 URL 一致（FE-10 复验）、linkNav 键盘跳转
   零回归，需联调阶段补测。
4. **多 CDP 客户端共用 9444 实例会互相干扰**：并行会话若同时向同一 Electron 注入输入，hover 会被对方
   mouseout 打断（本次早期一轮 S1 误报即由此产生）。单客户端串行重跑后 49/49 全过；建议验收期独占实例。

## 10. 文件清单

- `process-docs/ui-ux-redesign/reports/IT-03-FE-05/IT-03-FE-05-cdp-driver.mjs` — CDP 自测驱动（S0-S6）
- `process-docs/ui-ux-redesign/reports/IT-03-FE-05/IT-03-FE-05-cdp-data.json` — 原始结果（49 checks + scenarios 原文）
- `process-docs/ui-ux-redesign/reports/IT-03-FE-05/IT-03-FE-05-impl.png` — 实现图（hover 态 url-box + 三入口）
- `process-docs/ui-ux-redesign/reports/IT-03-FE-05/IT-03-FE-05-self-test.md` — 本报告
