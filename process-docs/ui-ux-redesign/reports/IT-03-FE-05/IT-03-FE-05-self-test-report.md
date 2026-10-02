# IT-03-FE-05 自测报告 — 链接 hover 浮层（编辑 URL 写回 .md / 外开 / 复制完整 URL）

- **任务ID**: IT-03/FE-05（链接 hover 浮层）
- **测试时间**: 2026-10-03 02:55–03:15（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（S1–S6 场景 `IT-03-FE-05-cdp-data.json`）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = linkEdit 写回纯函数/会话单测 + CDP 实测（三入口/写回/只读/外开拦截）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-05.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-19 | 「打开」经系统默认浏览器打开；「复制」复制完整 URL | ✅ 通过 | ① 复制完整 URL：CDP 存档 §2（S2 复制完整 URL，剪贴板 roundtrip 逐字）；② 外开：§3（S3 外开 + 非 http(s) 拦截）——经 `shell.openExternal` 固定入口（AC-NF-12 同场）；③ 浮层三入口在位：UI-IXD-07 面（`IT-03-FE-05-impl.png`） |
| AC-OP-14 | 编辑 URL 写回 .md：触发反馈、落盘、单事务一步 undo、回执、新 URL 可外开 | ✅ 通过 | ① 写回纯函数：`linkEdit.test.ts` 本轮重跑 **21/21** ✓（`rewriteLinkHref` 外科式只换 destination 槽——锚文本含 `\]` 转义/嵌套 `[]`/内嵌图片字节保真、title 三引号形态保真、空格/括号 URL 落 `<…>` 尖括号目标位读回零损耗、非法 href 拒绝返回 null）；② CDP 存档 §4（S4 编辑写回 + 一步 undo + 新 URL 外开）；③ 回执冻结 `render.toast.linkUpdated`（render.toast.* 四键封顶，i18n.test 同场钉住） |
| AC-NF-12 | contextIsolation/sandbox 保持开启；外链仅经 shell.openExternal 固定入口，不传用户可控串 | ✅ 通过 | ① CDP 存档 §3（非 http(s) 协议拦截：`javascript:`/`file:` 等拒绝外开）；② 外开通道 = preload 显式 `shell.openExternal` 固定 API（electron 入口不接渲染进程任意串，宪法约束）；③ 安全面 = AC-NF-16 缝扫描（`__velox*` 面未破坏）+ 收口批安全批面（收-B）同场 |
| AC-ERR-08 | 只读文件：拦截不写入、逐字节不变、冻结提示 | ✅ 通过 | ① 只读前置闸：apply 层复用 `readOnlyGuard.assertWritable`（真源 `file:isWritable`/fs.access W_OK）；② CDP 存档 §5（S5 只读拦截，双路径 byte-identical + 冻结 toast「文件为只读，无法修改，可另存后编辑」逐字）；③ 禁止永不 reject（不会挂起） |
| UI-IXD-07 | hover 浮层含「打开/复制/编辑」三入口；不遮挡链接；移出无残留 | ✅ 通过 | ① CDP 存档 §1（S1 浮层结构 + 不遮挡链接文本 + 位移 0px）+ §6（S6 hover 纪律移出无残留）；② 基座纪律 = hoverDiscipline（FE-03 22/22：无自写 setTimeout、无第二 RenderFloatHost）；③ 会话态 = `linkFloatSession.test.ts` 5/5（编辑会话 pin/unpin） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| linkEdit 纯函数+apply 语义全量 | ✅ 21/21 | `npx vitest run src/renderer/src/editor/linkEdit.test.ts` | 2026-10-03 02:55 重跑 |
| linkFloatSession 编辑会话 | ✅ 5/5 | `npx vitest run src/renderer/src/components/linkFloatSession.test.ts` | pin/unpin 纪律 |
| S2/S3/S4/S5 CDP 实测（复制/外开/写回/只读） | ✅ | `IT-03-FE-05-cdp-data.json` + `-run.log` | dev 存档 |
| S1/S6 浮层纪律（不遮挡/无残留/位移 0px） | ✅ | dev 存档 §1/§6 | hover 基座 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（dev 存档 §9 遗留问题均已随收口批闭环，无未决项。）

## 结论

**通过**。AC-FN-19 / AC-OP-14 / AC-NF-12 / AC-ERR-08 / UI-IXD-07 五条全过。本轮 linkEdit 21/21 + linkFloatSession 5/5 全绿，CDP S1–S6 存档证据在场（含非 http(s) 外开拦截与只读双路径逐字节不变），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 编辑 URL 写回（外科式） | ✅ | ✅ | ✅（非法拒绝） | ✅（只读拦截） | ✅ |
| 复制完整 URL | — | ✅ | — | — | ✅ |
| 外开（固定入口/协议拦截） | — | — | ✅ | ✅ | ✅ |
| 浮层三入口/纪律 | ✅ | — | — | ✅ | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 写回/会话单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/linkEdit.test.ts` 21/21、`components/linkFloatSession.test.ts` 5/5（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-03-FE-05-self-test.md`（S1–S6 + AC 证据映射）、`IT-03-FE-05-cdp-data.json`、`IT-03-FE-05-cdp-driver.mjs`、`IT-03-FE-05-impl.png`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
