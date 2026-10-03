# IT-03-FE-02 自测报告 — SessionState.quoteFolds 字段与 sanitizer 白名单扩展

- 任务：IT-03/FE-02
- 日期：2026-09-29
- 验证方式：Vitest 单测（store.test.ts）+ 真机 CDP 自测（Electron 构建产物 + agent-browser/CDP 注入 localStorage 后重启载入）
- 结论：阶段 1（开发验收）4/4 通过；阶段 2（自测验收）脏数据用例 2/2 通过（报告即本文件）

## 1. 脏数据用例输入/输出对照表（AC-NF-14 判据 1/2/3）

### 用例 A：污染 quoteFolds（AC-NF-14 判据 1/3）

输入（手工污染 `veloxmark.session.quoteFolds`，其余键位保持原值）：

```json
quoteFolds: { "a.md": "bad", "b.md": [1, {}], "": ["x"] }
```

重启载入（reload 重跑 store 模块初始化，等价于应用重启读取路径）后输出：

| 项 | 污染前 | 注入值 | 重启后（normalizeSession 输出） | 判定 |
|---|---|---|---|---|
| `quoteFolds["a.md"]` | 无 | `"bad"`（非 Array） | 整条丢弃 | 通过 |
| `quoteFolds["b.md"]` | 无 | `[1, {}]`（元素全非 string） | 元素全被丢弃、空条目剪除 | 通过 |
| `quoteFolds[""]` | 无 | `["x"]`（键为空串） | 整条丢弃 | 通过 |
| `quoteFolds` 顶层 | `{}` | 脏对象 | `{}` | 通过 |
| `headingFolds` | `{}` | 未触碰 | `{}`（语义不变） | 通过 |
| `tableColWidths` | `{}` | 未触碰 | `{}`（语义不变） | 通过 |
| `sidebarWidth` | `240` | 未触碰 | `240`（语义不变） | 通过 |
| 启动异常 | — | — | 无异常、不阻塞启动 | 通过 |

### 用例 B：旧版本 session JSON 缺 quoteFolds 键（AC-NF-14 判据 2）

输入：从 `veloxmark.session` 中删除 `quoteFolds` 键（模拟升级前存盘），重启载入。

| 项 | 注入值 | 重启后输出 | 判定 |
|---|---|---|---|
| `quoteFolds` | 键缺失 | `{}`（DEFAULT 降级） | 通过 |
| 抛错 | — | 无 | 通过 |
| `sidebarVisible` 等既有键 | 保持原值 | 语义不变 | 通过 |

### 用例 C：合法值透传（回写种子数据）

输入：`quoteFolds: { "/docs/a.md": ["q:12:3", "q:40:8"], "/docs/b.md": ["q:1:1"] }`，重启载入后 `getSession().quoteFolds` 逐字节相等。通过。

## 2. 单测矩阵（store.test.ts，9 条新增全绿）

| # | 用例 | 覆盖规则 | 结果 |
|---|---|---|---|
| 1 | passes a valid quoteFolds map through untouched | 合法透传 | 绿 |
| 2 | defaults quoteFolds to {} when the key is missing | 缺键默认 `{}` | 绿 |
| 3 | discards a non-object quoteFolds value without throwing | 非对象/非数组顶层丢弃 | 绿 |
| 4 | drops entries whose value is not an array | 非数组条目整条丢弃 | 绿 |
| 5 | drops non-string elements and prunes entries that filter empty | 非 string 元素丢弃 + 空条目剪除 | 绿 |
| 6 | drops empty-string file keys | 空键条目丢弃 | 绿 |
| 7 | drops every polluted entry of the AC-NF-14 pollution sample | 自测样本 A 钉死 | 绿 |
| 8 | never throws on arbitrary garbage (AC-NF-14-3) | 脏数据不抛错 | 绿 |
| 9 | leaves every other session key semantically unchanged | 既有键位语义不变 | 绿 |

## 3. 空条目口径裁决（STORE §3.2「可保留或剪除」）

选择**剪除**：过滤后为空数组的文件条目不落盘（对齐 normalizeColWidths「empty paths drop out」先例；展开最后一个折叠块后写 `[]`，下次载入等价于无条目，消费方 `?? []` 兜底一致）。该口径由 store.test 用例 5 钉住。

## 4. 其余验收自查

| 验收项 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 0 error |
| `npm run test:unit` | 37 文件 378 用例全绿 |
| `grep -n 'quoteFolds' store.ts` | 恰好 3 处（L121 接口声明 / L190 DEFAULT_SESSION / L428 normalizeSession），无第四处平行写点 |
| 实现图 | `IT-03-FE-02-impl.png`（DevTools Application 面板 Local storage > file:// > veloxmark.session，JSON 树含 `quoteFolds: {/docs/a.md: ["q:12:3", "q:40:8"], …}`） |
| e2e 缝 | 未触碰 `window.__velox*` / `data-op` / 命令 id；`window.__veloxPrefs` 形状不变 |

阶段 3（与 FE-08 联调）依赖 FE-08 消费方落地后联合验证，不在本任务闭环内。
