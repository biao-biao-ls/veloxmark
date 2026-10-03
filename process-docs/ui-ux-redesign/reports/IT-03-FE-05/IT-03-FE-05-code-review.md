## 代码审查报告 — IT-03/FE-05 链接 hover 浮层（编辑 URL 写回 / 外开 / 复制）

**得分：96/100（阈值：90）　状态：✅ 通过**
**基线规范：** code-review/SKILL.md + rubric-code-review.md + 项目/渲染层 CLAUDE.md
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- 已有代码风格（最高）：FE-04 同型先例（ImageEditFloat.tsx 注册/点击外区 hideNow/编辑会话 pin、imageEdit.ts 外科式写回+readOnlyGuard+单 dispatch、render-zone.css 纯 token 几何）——FE-05 逐项对齐，模式一致。
- CLAUDE.md：App 只接线（仅副作用 import 一行，App.tsx:48）、i18n 双字典对齐、CSS token 化、纯逻辑配同目录单测——全部遵守。
- 团队规范（最低）：仅 linkEdit.ts 中部 import 与同型文件体例相异，记 Minor。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现（AC-FN-19/OP-14/NF-12/ERR-08/UI-IXD-07） | 10 | 10 | — | 实测：三入口/写回/只读闸/外开固定入口/非遮挡定位齐备 |
| 遗漏需求点 | 8 | 8 | — | 空 URL disabled、同值不写、空 dest 可填、N1 互斥、en/zh+i18n.test 登记均覆盖 |
| 多做需求之外 | 8 | 8 | — | 无 scope creep（tooltip 压制属 N1 必修） |
| 需求理解 | 7 | 7 | — | 外开=固定入口不拼串、toast 冻结后缀、undo 单事务口径均正确 |
| 边界与异常覆盖 | 4 | 7 | -3 | 换靶/编辑会话边界缺口（见 P1，客观正确性） |
| 职责分离 | 10 | 10 | — | 纯层/apply 层/浮层 UI/N1 各归其位 |
| 错误处理 | 10 | 10 | — | 永不 reject、失败留编辑态、try/catch 兜底、只读前置无半提交 |
| 项目风格与模式 | 7 | 8 | -1 | linkEdit.ts 中部 import 与 imageEdit.ts 置顶体例不一致（P2） |
| 测试覆盖 | 8 | 8 | — | 21 用例钉字节契约（自核 it 数=21 吻合）+ linkNav 抑制用例 + frozen 句式断言 |
| 安全 | 8 | 8 | — | window.api.openExternal 全仓仅 App.tsx:1112 一处（grep 复核）；keyed 文案；React 文本渲染无注入 |
| 性能 | 8 | 8 | — | 无自写定时器、惰性单订阅、按动作短串解析 |
| DRY | 4 | 4 | — | https? 预检与 App 双判为设计内防御，非冗余债 |
| YAGNI | 4 | 4 | — | 无多余功能 |
| **合计** | **96** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Important | 换靶后编辑会话可误写错链 | href/editing/draft 仅挂载时 useState 初始化；FE-03 显式支持行扫式 retarget（useHoverDiscipline.test.ts:135），RenderFloatHost 复用实例仅换 anchor prop 无 key（RenderFloat.tsx:194），同通道 show() 换靶不看本通道 pin（useHoverDiscipline.ts:175-183）。编辑 pin 期间 hover 另一链接→浮层带 A 的 draft 跳到 B，确认后 applyLinkEditAtAnchor(B,draft) 把 A 的 URL 写进 B（错链写回）；展示态 url-box 亦显示旧 href | src/renderer/src/components/LinkHoverFloat.tsx:47-49,100-115 | 增加 anchor 变更守卫 useEffect([anchor])：setHref(hrefAtAnchor(anchor) ?? '')、setEditing(false) 清 draft；或 registerHoverContent 按 anchor 加 key 强制重挂（顺带惠及 FE-04 同型隐患）；更彻底可在 discipline show() 对本通道 pinned 时拒靶 → **裁定必修，fix-cr-IT03FE05-anchor** |
| Minor | 中部 import 体例 | apply 层 import 写在文件中部，与最近同型文件 imageEdit.ts（全置顶）不一致；语义无害（ESM 提升） | src/renderer/src/editor/linkEdit.ts:203-208 | 挪至文件顶部对齐 imageEdit.ts → 随 fix-cr-IT03FE05-anchor 顺带 |
| Info | 实现注释与行为不符 | 注释称 Autolink 无 hover chrome，实际 enterLink 对 Link/Autolink 一律上 cm-md-link（build.ts:102、handlers-tree.ts:112），`<url>` hover 会唤浮层；仅 GFM 裸 URL literal 无装饰。行为不违 AC（Autolink 写回 auto 形态已测） | tasks/IT-03/FE-05.md implementation-notes #8 | 修注释表述 → 随 fix-cr-IT03FE05-anchor 顺带（任务注释勘误） |
| Info | 快捷键回显单源（AC-FN-07/AC-RULE-11）已核口径 | render.toast.linkUpdated 后缀「（Ctrl+Z 可撤销）」为 ac.md 冻结字面量（frozenCopy.test.ts:21-35 全句断言），非菜单回显范畴；en UNDO_SUFFIX 空格已由 fix-cr-IT03FE01 收口；darwin 键面残留属已登记双源债 | src/renderer/src/i18n/en.ts:7,zh.ts:5 | 无需动作（与 FE-01 已核结论一致） |
| Info | 任务未全收敛 | 阶段 3「linkNav 键盘联调零回归」checkbox 未勾、阶段 4 QA 未执行；代码侧无 document 级键盘监听，劫持面为零 | tasks/IT-03/FE-05.md:169,174-175 | 完成联调冒烟后勾销并留记录（Phase 2 selfTest 收口） |

### 结论

✅ 通过（96 ≥ 90）。AC-FN-19/AC-OP-14/AC-NF-12/AC-ERR-08/UI-IXD-07 实现面逐条对得上真实代码：写回外科式+单事务 undo、只读闸复用 readOnlyGuard、外开零新增 window.api.openExternal 调用点、浮层走 FE-03 基座无第二 host/无自写定时器、i18n 双字典与 frozen 断言全对齐、样式全 token 化零裸 px。唯一实质问题是 Important 级换靶误写风险（P1，根因在 FE-03 retarget 合同 + 无 key 重挂，FE-05 编辑会话放大为错链写回）——裁定必修，派 fix-cr-IT03FE05-anchor 定点修复（anchor 变更守卫），单测证据收口，不触发全量重审。
