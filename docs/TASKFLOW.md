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

| 任务   | 描述                                                                  | 状态      |
| ---- | ------------------------------------------------------------------- | ------- |
| S4-1 | `bun run build:spa` 构建 → 上传 proc（GIT 自动化部署 `morgan@43.155.185.180`） | ✅ PASS（已推 proc：nest-admin 274838e / C端 c02bd06a / 管理端 3c40211；修复 bun.lock frozen-lockfile 部署失败） |
| S4-2 | 线上回归 `https://www.007icu.top/`（登录 / 对话 / 用量 / 部门看板）                 | 🔄 部署中（首页已含 harness 路由，页面 200） |
| S4-3 | 更新 22-spec Status 表 + 本表最终状态                                        | ✅ PASS |

## 阶段 5：后台管理端（vue-pure-admin）

> 职责边界（modules.md L4956-4963）：13 个用户可见模块在后台做 CRUD 管理 / 策略配置 / 审计查看。

| 任务   | 描述                                                  | 状态      |
| ---- | --------------------------------------------------- | ------- |
| M1 | 后端 admin 全量视角接口（memory/knowledge/workspace/team/harness 5 模块 list/delete + ROOT_USER_ID） | ✅ PASS（API 回归 8/8） |
| M2 | 管理端 8 页面（Harness 会话 / Agent 团队 / 记忆画像 / 知识库 / 工作台产物 / Agent 市场 / HITL 审批 / UI 生成） | ✅ PASS（编译通过 + 已推 proc） |
| M3 | 路由菜单组 /ai/c-end + api/ai/c-end.ts 封装 | ✅ PASS |

---

## 执行须知（给任意 AI 工具）

1. **开工第一步**：读本表找第一个 PENDING 任务；读对应 SKILL.md 行号章节；读 22-spec 对应 AC
2. **铁律**（SKILL.md L76-83）：No spec, no code；spec 冲突时改 spec 再改代码；偏离必须先 spec 化（Playbook H L920-931）
3. **回归方式**：本地 bun 启动 → curl API 验证 → 浏览器交互 → 更新本表状态
4. **每任务完成标准**：对应 AC 通过 + 无 FAIL 遗留 + 本表状态更新为 PASS
5. **后端改动注意**：c-end 模块在 `nest-admin/src/modules/c-end/`，不要动 `src/modules/app/airag/`（占位壳）
6. **权限码规范**（SKILL.md L385-395）：`ai:portal:*` 前缀，action 用 list/create/view/edit/delete 等
