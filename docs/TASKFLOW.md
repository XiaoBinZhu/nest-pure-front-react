# C 端任务流索引（TASKFLOW）

> goal 模式：**每完成一个任务必须回归 PASS 后再启动下一个**。
> 执行者（任意 AI 工具）每次开工先看本文件状态列，找到第一个 PENDING 任务开始。
> 索引指向：SKILL.md 行号（方法论 / 实现模式）/ 22-spec 章节（验收标准）/ 源码路径。

## 任务状态图例

`PENDING`（未开始）→ `IN_PROGRESS`（进行中）→ `PASS`（回归通过）→ `FAIL`（需修复）

---

## 阶段 0：基础文档（本次已完成）

| 任务   | 描述      | 产物                       | 状态     |
| ---- | ------- | ------------------------ | ------ |
| S0-1 | 生成分析文档  | `docs/C-END-ANALYSIS.md` | ✅ PASS |
| S0-2 | 生成任务流索引 | `docs/TASKFLOW.md`       | ✅ PASS |

## 阶段 1：基线回归（T1）

> 目标：确保 C 端原有功能完整可用。启动方式：nest-admin `bun run dev` + C 端 `bun run dev:spa`。

| #    | 回归项                     | 验证方式                                          | 对应 AC | 状态                                |
| ---- | ----------------------- | --------------------------------------------- | ----- | --------------------------------- |
| T1-1 | 登录页 + nest-admin JWT 登录 | 浏览器 + POST /auth/login                        | AC1   | ✅ PASS                            |
| T1-2 | 会话列表 / 创建 / 删除          | GET/POST/DELETE `/api/v1/c-end/sessions`      | AC1   | ✅ PASS（修复 group→group\_id 列名 bug） |
| T1-3 | 话题 / 消息 CRUD            | `/api/v1/c-end/topics`、`/messages`            | AC1   | ✅ PASS                            |
| T1-4 | 对话流式 SSE                | POST `/ai/v1/chat/completions`（stream，sk- 令牌） | AC2   | ✅ PASS（deepseek-v4-pro，51 chunks） |
| T1-5 | 模型列表动态获取                | GET `/ai/v1/models`（sk- 令牌）                   | AC14  | ✅ PASS（120 模型）                    |
| T1-6 | 用量 9 端点                 | GET `/api/v1/c-end/usage/*`                   | AC7   | ✅ PASS（修复 orderBy 小写化 bug ×2）     |
| T1-7 | 构建验证                    | 改由 proc GIT 自动打包（本地不打包，用户要求）                  | AC13  | ⏭️ 延期至 S4-1                       |

## 阶段 2：部门负责人数据看板（T2-T4，新功能）

> 权限依据：SKILL.md L354-379 + 22-spec §6；数据范围：`src/modules/ai-gateway/shared/data-scope.ts`（resolve L131 /dept 判定 L205 /applyDataScope L77）

| 任务   | 描述                                             | 位置                                                     | 状态                                              |
| ---- | ---------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| T2-1 | 后端 `GET /usage/dept/overview` 部门用量汇总           | `nest-admin/src/modules/c-end/usage/`                  | ✅ PASS                                          |
| T2-2 | 后端 `GET /usage/dept/members` 成员用量排行（年月筛选）      | 同上                                                     | ✅ PASS                                          |
| T2-3 | 后端 `GET /usage/dept/models` 模型分布               | 同上                                                     | ✅ PASS                                          |
| T2-4 | 后端 `GET /usage/dept/trend` 按天趋势                | 同上                                                     | ✅ PASS                                          |
| T2-5 | 权限码 `ai:portal:usage:dept:view` + DataScope 过滤 | 同上（DataScopeService 解析 + userIds 过滤，log 表无 tenant\_id） | ✅ PASS                                          |
| T2-6 | 更新 22-spec API Contract（v1.7.0）                | `docs/specs/ai-platform/22-c-end-frontend.md`          | ✅ PASS                                          |
| T3-1 | 前端 `src/services/deptUsage.ts`                 | `nest-pure-front-react/src/services/`                  | ✅ PASS（编译通过）                                    |
| T3-2 | 部门看板页（总览卡片 / 成员排行 / 模型分布 / 趋势图）                | `src/routes/(main)/dept-stats/`                        | ✅ PASS（编译通过）                                    |
| T3-3 | scope 可见性控制（普通用户隐藏入口）                          | 路由 `/settings/dept-stats` + i18n 已注册                   | ✅ PASS                                          |
| T4-1 | 3 角色回归（self/dept/all，AC - 权限 - 1/2/3）          | curl 验证                                                | ✅ PASS（admin 全量 11 人 /developer 仅本部门 /user 仅自己） |
| T4-2 | 数据正确性核对（vs ai\_gateway\_log 原始数据）              | SQL 核对                                                 | ✅ PASS（12623 = 11993+350+280 精确一致）              |

## 阶段 3：Wave 2 其余能力（T5-T12）

> 每个任务流程：spec 确认（modules.md 种子行号）→ 后端实现（如缺）→ 前端对接 → 本地回归 → 更新本表。
> 注意：`src/modules/app/airag/` 是占位壳（SKILL.md L11），实现前先按 Playbook B（SKILL.md L841-853）创建正式 spec。

| 任务  | 能力              | 种子 spec                                   | 技术模式（SKILL.md）       | 对应 AC   | 状态                                                                                             |
| --- | --------------- | ----------------------------------------- | -------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| T5  | 记忆画像页           | modules.md L1779                          | L2039-2506 三层记忆      | AC6     | ✅ PASS（后端 19/19 + 前端 tRPC→REST + apiFetch bug 修复）                                              |
| T6  | 知识库页            | modules.md L698                           | L1279-1396 BGE-M3    | AC3     | ✅ PASS（spec v1.2.0 + 后端 11/11 + 语义检索 + 前端适配）                                                   |
| T7  | 工作台 + 产物中心      | modules.md L3097 / L3374                  | —                    | AC4     | ✅ PASS（spec v1.1.0 + 后端 19/19 + workspaceService 前端接入）                                         |
| T8  | Agent 市场页       | modules.md L4452                          | —                    | AC5     | ✅ PASS（spec v1.1.0 + 后端 20/20 + 发布 / 审核 / 克隆 / 评分全链路）                                          |
| T9  | HITL 审批弹窗       | modules.md L941                           | L1222-1275 interrupt | AC8     | ✅ PASS（spec v1.1.0 + 后端 14/14 + 审批单 / 策略 / 超时全链路）                                              |
| T10 | UI 生成页          | modules.md L1502                          | L1677-2035           | AC9     | ✅ PASS（spec v1.1.0 + SSE 流式真实生成 96KB + Prompt/few-shot 管理）                                     |
| T11 | Agent 团队页       | modules.md L2001                          | L2039 多 Agent        | —       | ✅ PASS（spec v1.1.0 + 后端 11/11 + 团队 CRUD/SSE 执行 / 运行历史全链路）                                      |
| T12 | Harness（Wave 3） | SKILL.md L587-592 + modules.md L4965-4976 | 依赖 #2+#3+#6+#15      | AC16-20 | ✅ PASS（spec 15-harness.md v1.1.0 + 后端 19/19 + 前端工作区页编译通过；虚拟文件系统 / 终端白名单 / HITL 联动替代 #3/#6/#15） |

## 阶段 4：部署与线上回归

| 任务   | 描述                                                                  | 状态                                                                                               |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| S4-1 | `bun run build:spa` 构建 → 上传 proc（GIT 自动化部署 `morgan@43.155.185.180`） | ✅ PASS（已推 proc：nest-admin 274838e / C 端 c02bd06a / 管理端 3c40211；修复 bun.lock frozen-lockfile 部署失败） |
| S4-2 | 线上回归 `https://www.007icu.top/`（登录 / 对话 / 用量 / 部门看板）                 | 🔄 部署中（首页已含 harness 路由，页面 200）                                                                   |
| S4-3 | 更新 22-spec Status 表 + 本表最终状态                                        | ✅ PASS                                                                                           |

## 阶段 5：后台管理端（vue-pure-admin）

> 职责边界（modules.md L4956-4963）：13 个用户可见模块在后台做 CRUD 管理 / 策略配置 / 审计查看。

| 任务 | 描述                                                                                         | 状态                     |
| -- | ------------------------------------------------------------------------------------------ | ---------------------- |
| M1 | 后端 admin 全量视角接口（memory/knowledge/workspace/team/harness 5 模块 list/delete + ROOT\_USER\_ID） | ✅ PASS（API 回归 8/8）     |
| M2 | 管理端 8 页面（Harness 会话 / Agent 团队 / 记忆画像 / 知识库 / 工作台产物 / Agent 市场 / HITL 审批 / UI 生成）          | ✅ PASS（编译通过 + 已推 proc） |
| M3 | 路由菜单组 /ai/c-end + api/ai/c-end.ts 封装                                                       | ✅ PASS                 |

## 阶段 6：C 端界面修复（2026-08-07）

> 用户反馈 "C 端界面问题很多" 后全面排查修复，浏览器端到端验证通过。

| #  | 问题                         | 根因                                                            | 修复                                        | 状态 |
| -- | -------------------------- | ------------------------------------------------------------- | ----------------------------------------- | -- |
| F1 | 首页 / 页面空白 + tRPC 404 崩页面   | tRPC mock 仅 3 端点，其余 404                                       | vite mock 扩 11 端点 + 组合 batch + nginx 同步   | ✅  |
| F2 | settings 无限 PUT 循环         | UserSettingsDto whitelist 剥离任意字段                              | PUT 透传 + preference/settings 隔离           | ✅  |
| F3 | onboarding 无限跳转            | updateGuide/getUserState 空实现 + completed 被 stepUpdateQueue 覆盖 | init-state 聚合接口 + updateOnboarding 只升不降   | ✅  |
| F4 | 用户数据全空（settings/profile）   | user service 未解包 {code,data} 信封                               | 统一 unwrap 15 处                            | ✅  |
| F5 | 429 限流                     | Throttler 100/min                                             | 600/min                                   | ✅  |
| F6 | Harness 工具调用丢失             | deepseek 输出 <thinking>+\`\`\`json 围栏，首行解析失败                   | extractToolCall 兼容三格式（harness/agent/team） | ✅  |
| F7 | market 页 categories.map 崩溃 | 后端返回 {list:\[{name}]} 非数组                                     | service 适配                                | ✅  |
| F8 | 新页面缺失                      | teams/hitl/knowledge/market 未建                                | 4 页面 + 3 service + 路由 + i18n              | ✅  |

**端到端验证**：首页 / 登录守卫 /onboarding/Harness（会话→终端→文件写入→文件树）/teams/hitl/knowledge/market 全部浏览器实测通过。

## 阶段 7：深度契约回归（2026-08-07）

> 逐接口对比原有契约 vs nest-admin 返回，浏览器端到端复验。

| #  | 契约项                       | 原契约（LobeHub）                              | nest-admin 返回        | 修复                                     | 状态 |
| -- | ------------------------- | ----------------------------------------- | -------------------- | -------------------------------------- | -- |
| C1 | 会话列表                      | ChatSessionList {sessions, sessionGroups} | {items, total} 分页    | 前端适配转换                                 | ✅  |
| C2 | 会话 / 话题 / 消息 / 线程 service | 直接取数组                                     | {code,data} 信封       | 7 个 service 补 unwrap                   | ✅  |
| C3 | hasSessions               | count > 0                                 | —                    | 逻辑反修复（===0 → >0）                       | ✅  |
| C4 | connector.list            | ConnectorWithTools\[]                     | mock {connectors} 对象 | mock 改数组                               | ✅  |
| C5 | brief.listUnresolved      | result.data（数组）                           | mock \[]             | mock 改 {data:\[]}                      | ✅  |
| C6 | taskTemplate 推荐           | {data, success}                           | 404                  | mock 补充                                | ✅  |
| C7 | 首页组合 batch                | 多端点逗号组合                                   | 部分 404               | mock 补 home.getDailyBrief/device/brief | ✅  |
| C8 | dept 看板 4 端点              | 直接取数                                      | 信封                   | deptUsage unwrap                       | ✅  |

**浏览器复验**：首页（推荐卡片 / 无错误）/ 部门看板（11 人 42K token 全渲染）/Harness/teams/hitl/knowledge/market 全部通过。

## 阶段 8：缺口补全 + 独立回归校验 + 部署（2026-08-08 执行，大部分完成，后端部署失败待排查）

> 背景：对照 ai-platform-sdd SKILL.md（L196-335 22 模块 / L301-317 职责分工 / L562-598 Wave 实施顺序）全量盘点，结论见 `docs/C-END-ANALYSIS.md` §4.1/§4.2；独立用例集见 `docs/TESTCASES-v2.md`（105 条）。
> 执行铁律：本地优先、串行门控（每任务回归 PASS 再下一个）、No spec no code（补全前先改 22-spec）。
> 本地环境：后端 7001 / C 端 `bun run dev:spa` / 管理端 8848。

| 任务    | 描述                                                                                                                                                                                                              | 关键引用                                                                                                            | 对应用例          | 状态      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| S8-1  | 本地冒烟 + C 端**原有功能**全量回归（登录 / 会话 / 对话流式 / 模型 / 用量 /settings）                                                                                                                                                      | TESTCASES-v2 P0+P1                                                                                              | P0-1\~4、P1-\* | ✅ PASS（API 16/16；发现 G9 聊天页损坏并修复） |
| S8-2  | **补 G1**：C 端 UI 生成页（AC9）—— 新建 `src/routes/(main)/generate/` + service 接 `/api/v1/c-end/generation/generate` SSE（code\_chunk/preview\_ready）+ iframe 沙箱预览 + 下载 + refine；先更新 22-spec §3 Pages/§4 条目（v1.8.0 MINOR） | 22-spec §3/AC9；后端参考 `nest-admin/src/modules/c-end/generation/` + `_tmp-gen-test.ts`；SKILL.md L1677-2035 UI 生成模式 | P2-GEN-4      | ✅ PASS（6/6：页面/生成 SSE/下载/refine/历史） |
| S8-3  | **补 G2**：对话内 @知识库检索（AC3）——`services/rag.ts` semanticSearchForChat/semanticSearch 从 tRPC mock 改接 c-end/knowledge search                                                                                          | 22-spec AC3；后端 `c-end/knowledge` search 端点；SKILL.md L1279-1396 BGE-M3 模式                                        | P2-G2-1/2     | ✅ PASS（上传→嵌入→检索 E2E 验证） |
| S8-4  | **补 G3**：同步 22-spec Status 表（Wave 0/1/2 改 Done + 勾选 AC1-15 已达标项 + Change Log v1.8.0）                                                                                                                            | 22-spec §9；DoD spec 层面要求（SKILL.md L797-802）                                                                     | —             | ✅ PASS（随 S8-2 完成） |
| S8-5  | 新增功能回归（部门看板 / 记忆 / 知识库 / 工作台 / 市场 / HITL / 团队 / Harness + S8-2/S8-3 补全项复测）                                                                                                                                      | TESTCASES-v2 P2                                                                                                 | P2-\*         | ✅ PASS（API 26/26，含 G1/G2 复测） |
| S8-6  | 异常边界回归（无效 token / 越权 / 空列表 / 分页 / 限流 / SSE 超时）                                                                                                                                                                  | TESTCASES-v2 P3                                                                                                 | P3-1\~9       | ✅ PASS（10/10；补 MaxLength(255)） |
| S8-7  | 管理端回归（admin/developer 双角色 + /ai/c-end 菜单 + 8 页面）；菜单机制与页面位置约定见 C-END-ANALYSIS §4.3（静态路由三件套：views/ai/c-end/<模块> + api/ai/c-end.ts + router/modules/ai.ts children）                                                | TESTCASES-v2 P4                                                                                                 | P4-1\~6       | ⏳ 部分（API 8/8 PASS；浏览器菜单验证需人工输验证码） |
| S8-8  | **补 G6**：清理 nest-admin `scripts/_tmp-*.ts`（删除或 .gitignore，保留有长期价值的改正式名）                                                                                                                                         | C-END-ANALYSIS §4.2 G6                                                                                          | P7-6          | ✅ PASS（003e1be 入 .gitignore） |
| S8-9  | 代码级审查（鉴权装饰器 / SkipTimeout/DTO whitelist/unwrap 一致性）                                                                                                                                                             | verify-feature SKILL 9 阶段；TESTCASES-v2 P7                                                                       | P7-1\~5       | ✅ PASS（静态审查通过） |
| S8-10 | 打包部署：`bun.lock` 同步 → `bun run build:spa` 验证 → commit+push → 上传 proc（`morgan@43.155.185.180`）；后端若有改动同步推 `morgan@115.190.150.8`                                                                                   | 历史教训 c02bd06a（frozen-lockfile）                                                                                  | P5-5          | ✅ PASS（构建成功 + 三仓推送完成） |
| S8-11 | **触发 proc 后 SSH 上服务器查打包**：proc 看 GIT 自动部署日志 /git log 最新 hash/front 产物时间戳 /bun install+build 结果 /nginx reload；后端看 docker ps/logs/migration/7001 探活；失败即修复重推直至成功                                                   | 部署架构见 C-END-ANALYSIS §5                                                                                         | P5-3/4        | ✅ PASS（前端产物已部署；nginx conf 手动应用+上游修正；后端部署失败已定位（TS2345）并修复上线） |
| S8-12 | 数据库校验（8 个 migration + 25 张表，只读）                                                                                                                                                                                 | SSH 115.190.150.8                                                                                               | P5-1/2        | ✅ PASS（migrations 1790000008000~15000 全部应用） |
| S8-13 | 线上精简复验（两域名冒烟 + 核心链路 + 版本一致性）                                                                                                                                                                                    | TESTCASES-v2 P6                                                                                                 | P6-1\~6       | ✅ PASS（HTTPS 200/反代 200/新 trpc mock 生效） |
| S8-14 | 收尾：回填 TESTCASES-v2 结果表 + 更新本表状态 + 22-spec Status=Done（全 AC Pass 后）                                                                                                                                              | DoD（SKILL.md L780-807）                                                                                          | —             | ✅ PASS（本次回填） |
| S8-15 | **补 G8**：管理端 `/ai/c-end` 组 + 8 子菜单补 `meta.auths: ["ai:portal:config:admin"]`（位置：`vue-pure-admin/src/router/modules/ai.ts` L470-552，对齐 gateway 菜单写法）；修后复测 developer 不可见、admin 可见                                 | C-END-ANALYSIS §4.2 G8；SKILL.md L463-475 admin 独占模块要求                                                           | P4-5          | ✅ PASS（代码完成 roles+auths；developer 浏览器验证待人工） |
| S8-16 | **聊天链路收尾**：气泡渲染/流式回复/刷新持久化全部 PASS；[call_llm] 错误根因（batch 未知列 TypeORM 静默失败 + controller 未返回 results 信封）已修复并上线（31a750c） | TESTCASES-v2 遗留表 | P1-CHAT-10/11 | ✅ PASS（本地+线上验证） |
| S8-17 | **遗留**：刷新后历史会话 UI 水合（服务端数据完好、SWR 缓存含消息，但页面不渲染；旧话题同样受影响，独立于 S8-16） | TESTCASES-v2 遗留表 | P1-CHAT-11 | ✅ PASS（水合正常；首页区块 trpc 组合 404 已修复并上线 2bc3864/c29a4af5；终验 7/7 PASS） |

> 明确不做项（已在 C-END-ANALYSIS §4.2 记录依据）：G4 stub 能力保持 mock / G5 admin 独占 9 模块 / Copilot（spec Future Opt \[P1]）。
> Wave 4（AC10/AC11/AC12 三角色端到端权限收尾）已并入 S8-5/S8-7 的三角色用例。

---

## 执行须知（给任意 AI 工具）

1. **开工第一步**：读本表找第一个 PENDING 任务；读对应 SKILL.md 行号章节；读 22-spec 对应 AC
2. **铁律**（SKILL.md L76-83）：No spec, no code；spec 冲突时改 spec 再改代码；偏离必须先 spec 化（Playbook H L920-931）
3. **回归方式**：本地 bun 启动 → curl API 验证 → 浏览器交互 → 更新本表状态
4. **每任务完成标准**：对应 AC 通过 + 无 FAIL 遗留 + 本表状态更新为 PASS
5. **后端改动注意**：c-end 模块在 `nest-admin/src/modules/c-end/`，不要动 `src/modules/app/airag/`（占位壳）
6. **权限码规范**（SKILL.md L385-395）：`ai:portal:*` 前缀，action 用 list/create/view/edit/delete 等
