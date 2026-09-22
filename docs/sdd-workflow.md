# SDD 工作流 — 规格驱动推进任务清单

对齐 [GitHub Spec Kit](https://github.com/github/spec-kit) 的 Spec-Driven Development 方法论，适配本仓库的重构推进。核心思想（spec-kit"权力反转"）：**规格是真源，代码是规格的表达**——维护软件 = 演进规格；本仓库中 [CLAUDE.md](../CLAUDE.md) 即 Constitution（项目宪法），[refactor-tasks.md](refactor-tasks.md) 是规格化 Backlog。

## 循环总览

```
constitution（一次）→ specify → plan → tasks → implement → converge ↩（未收敛则回到 implement）
```

| 阶段 | 产物 | 本仓库落点 |
|---|---|---|
| constitution | 项目原则/质量规范 | `CLAUDE.md`（根 + electron/ + src/renderer/） |
| specify | 规格：what/why、验收标准 | `docs/specs/<task-id>/spec.md` |
| plan | 技术方案：how、决策理由 | `docs/specs/<task-id>/plan.md` |
| tasks | 可执行任务拆分 | 并入 plan.md 的任务小节，或 `docs/specs/<task-id>/tasks.md` |
| implement | 代码 | 正常开发流程 |
| converge | 收敛验证 | 跑验收命令，勾销 refactor-tasks.md checkbox |

## 与 refactor-tasks.md 的映射

- **粒度**：refactor-tasks.md 的每个编号任务（如 1.4、2.3）或一组强耦合小任务（如 1.1+1.2）= 一个 spec 单元 = `docs/specs/<task-id>/` 目录
- **阶段 0 类**（补声明/加测试/删死代码）：spec 可极简（一段 what/why + 验收即可），免 plan 或 plan 数行
- **拆分类**（1.x/2.x/3.x）：spec 必写「行为不变」约束与 e2e 缝清单；plan 必写文件切法、状态归属、import 改动面
- **契约类**（3.1/3.7 前置 API）：spec 必写接口形态与不可拆散的协议两端（如 `pendingHandoff`）
- 每完成一个 spec 单元就回 refactor-tasks.md 勾 checkbox——**清单是收敛看板**

## specify — 规格模板（docs/specs/<task-id>/spec.md）

```markdown
# <task-id> <标题>          # 例: 1.4 拆分 styles.css
## What / Why               # 只写做什么、为什么；不写技术方案（避免过早陷入实现）
## 背景与现状                # 文件/行号/体量（引用评估结论，不重复展开）
## 验收标准（AC）            # 可测试的条目；行为不变类任务写明"以下行为不得改变：…"
## 约束                      # e2e 缝清单、探针契约、与 Constitution 的对齐点
## [NEEDS CLARIFICATION]    # 规格歧义必须显式标记，不许猜
```

spec-kit 纪律：**只写 WHAT/WHY，不写 HOW**（HOW 在 plan）；**歧义标记 `[NEEDS CLARIFICATION: 具体问题]`**，不默认假设。

## plan — 方案模板（docs/specs/<task-id>/plan.md）

```markdown
# <task-id> 实施方案
## 技术决策与理由            # 每个选择一句 why；与 spec 的 AC 可追溯
## 文件切法                  # 源 → 目标文件映射表（拆分类必写到函数级）
## 状态/契约归属              # 模块级可变状态的单一归属；不可拆散的协议对
## import 改动面             # 谁的 import 要改；是否保留 re-export barrel 兼容
## 任务拆分 [P]              # [P]=可并行；给出安全并行组
## 验证方案                  # converge 要跑什么（含新增单测点）
```

## implement — 执行纪律

1. 从 plan 的任务表取一项做完再取下一项（标注 [P] 的可并行派发）
2. 机械搬运类改动优先保持"零行为变化"：先平移、顺手重构（如合并重复逻辑）单独成 commit
3. 每完成一个 spec 单元立即 converge，不要攒批

## converge — 收敛判据（全过才算 Converged）

```bash
npm run typecheck && npm run test:unit
```

- [ ] typecheck + unit 全绿
- [ ] e2e 缝未破坏：`window.__velox*` 钩子、`data-op` id、命令 id 字面量（涉及时跑 `npm run test:smoke` / 对应 `scripts/cdp-*.mjs`）
- [ ] AC 逐条核对（行为不变类：人工冒烟 UI 无回归）
- [ ] refactor-tasks.md 对应 checkbox 已勾
- [ ] 必要时更新 Constitution（发现新的"好模式/禁忌"）与子模块文档

未收敛 → 回到 implement 修复，**禁止在收敛失败时勾 checkbox**。

## 研究环节（Research-Driven Context）

spec-kit 强调规划前的研究。本仓库外部资料获取方式：

- WebFetch/WebSearch 工具直连（GitHub 常失败）
- **本地代理可用**：`curl -x http://127.0.0.1:7890 <url>`（Clash，已验证 GitHub/raw 可达）
- 研究结论写入 plan.md 的"技术决策与理由"，不散落聊天记录

## 与 Spec Kit 官方工具链的关系

可选进阶：`uv tool install specify-cli` 后用 `/speckit-specify` 等技能托管上述循环（产物在 `specs/<branch>/`）。本仓库默认用轻量约定（docs/specs/ + 模板），不强制安装；两者产物结构兼容，随时可迁。
