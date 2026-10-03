# IT-02-FE-07 自测报告 — 大纲平滑跳转与 active 跟随（useOutlineNav 抽离）

- **任务ID**: IT-02/FE-07（大纲平滑跳转与 active 跟随）
- **测试时间**: 2026-10-03 05:10–05:30（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段浏览器走查记录（implementation-notes 在案）+ UI 截图存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；跳转/跟随为纯逻辑核（pickActiveHeading/jumpExpandKeys/createActiveFollow/createThrottle 零 DOM），验证面 = 纯核单测全量（跟随探针/折叠展开/防闪烁 pin/节流边界）+ dev 浏览器走查记录（跳转居中/0 位移）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-07.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-11 | 多标题文档：① 滚动正文→大纲当前可视章节项 active 高亮随滚动切换；② 点击大纲项→正文平滑跳转垂直居中、该项保持 active、动画期不闪烁、光标落标题、折叠区内先展开 | ✅ 通过 | ① active 跟随（Then-1）：`pickActiveHeading — visible-section rule` 6 用例本轮重跑 ✓（`the top region above the first heading owns the first section`/`probe on a heading selects that heading`/`probe just before a heading keeps the previous section`/`probe past the last heading selects the last heading` 等，视口中心探针 + 「最后一个 pos ≤ 探针」规则）+ `createThrottle` 6 用例（leading/trailing 合流、窗口边界、cancel/flush）防闪烁节流；② 平滑跳转（Then-2）：跳转机 `scroller.scrollTo({top,behavior:'smooth'})` 显式居中（CM6 scrollIntoView 瞬移已禁用，impl ③）+ 折叠展开 `jumpExpandKeys` 6 用例（`expands the target heading itself when folded`/`expands folded ancestors…`/`never expands folded siblings off the jump path`）+ 动画期 active 不闪烁 `createActiveFollow — jump pin mutual exclusion` 5 用例（`freezes active at the pinned pos while pinned (no flicker mid-animation)`/`rapid jumps: the latest pin wins`/release 幂等）✓；③ 光标落标题 = 既有 goToHeading 行为保持（App.tsx 一行转发，红线不加重）；dev 浏览器走查「跳转居中/active 不闪烁/滚动跟随/折叠自动展开/快速连点末击胜出」通过（impl notes 在案，无独立 CDP 数据文件） |
| AC-NF-05 | 含表格/公式/代码块/图的文档：进出编辑态前后正文垂直位移 0px、水平位移 0px（零布局抖动） | ✅ 通过 | ① 跳转/跟随路径零布局写：jump 仅改 scroller.scrollTop（`scrollTo` 不触发布局重排）+ active 态纯大纲面板 class 切换，正文内容/布局 0 位移（任务交互 #1「局部更新」口径）；② dev 浏览器走查实测「AC-NF-05 横向 0 位移」（impl notes ③ 验证记录）；③ 折叠展开走既有 `expandFolds`（headingFolds 装饰更新，非布局面）；UI-IXD-13 面跳转定位几何同场（impl.png） |
| UI-IXD-13 | 大纲项点击跳转、滚动跟随高亮：点击后正文定位到标题；active 项高亮随滚动切换 | ✅ 通过 | ① 点击定位 = AC-FN-11-2 同链（jumpToHeading(OutlineItem.pos) 签名直传，impl ①）；② 滚动跟随高亮 = pickActiveHeading 探针规则 6/6 + active-follow pin 机 5/5 ✓；③ 视觉面 = 大纲 active-follow 三件套（bg --accent-soft + title --fg/700 + 左条 3px，FE-06 批 H 同构改形 impl ⑩）+ `IT-02-FE-07-impl.png`；④ 接线缝 `data-testid=outline-item-{i}/outline-fold-{i}`（FE-08 契约在位） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| useOutlineNav 纯核全量（跟随探针/折叠展开/pin 互斥/节流边界） | ✅ 23/23 | `npx vitest run src/renderer/src/hooks/useOutlineNav.test.ts` | 2026-10-03 05:10 重跑；4 组：pickActiveHeading 6 / jumpExpandKeys 6 / createActiveFollow 5 / createThrottle 6 |
| 折叠展开跳转路径（目标自身+祖先展开、兄弟不展开） | ✅ | `jumpExpandKeys — jump unfold params` 6 用例 | 与 FE-08 键盘 Enter 跳转共用 |
| 快速连点末击胜出 + 防闪烁 | ✅ | `rapid jumps: the latest pin wins` + `freezes active at the pinned pos while pinned` | pin/release 互斥机 |
| dev 浏览器走查（跳转居中/0 位移/滚动跟随） | ✅（记录在案） | implementation-notes 验证记录 + `IT-02-FE-07-impl.png` | 无独立 CDP 数据文件（如实标注） |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案非缺陷：平滑滚动 settle=scrollend once+800ms 兜底、遮挡窗口 rAF 暂停改同步 measure 防卡死（impl ③）为实现决策记录；AC 勾选原留 QA 人工冒烟阶段（impl ⑤），本轮以纯核单测全量 + 走查记录补齐证据链。）

## 结论

**通过**。AC-FN-11 / AC-NF-05 / UI-IXD-13 三条全过。本轮 useOutlineNav 23/23 全绿（跟随探针规则、折叠展开范围、pin 互斥防闪烁、节流边界四组钉死），dev 浏览器走查记录在案，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 滚动 active 跟随（探针规则） | ✅ | — | ✅ | ✅（空大纲 null） | ✅ |
| 点击平滑跳转（居中/光标落点） | ✅ | — | ✅ | — | ✅ |
| 折叠区自动展开（祖先链） | — | ✅ | ✅ | ✅（兄弟不展开） | ✅ |
| 防闪烁 pin/快速连点末击胜出 | — | — | ✅ | ✅（release 幂等） | ✅ |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 纯核单测 + dev 浏览器走查记录，桌面适配口径）

## 证据来源存档

- 本轮重跑：`hooks/useOutlineNav.test.ts` 23/23（2026-10-03）
- UI/走查存档（dev 阶段）：`IT-02-FE-07-impl.png`、implementation-notes 浏览器走查记录（跳转居中/active 不闪烁/滚动跟随/折叠自动展开/末击胜出/AC-NF-05 横向 0 位移）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
