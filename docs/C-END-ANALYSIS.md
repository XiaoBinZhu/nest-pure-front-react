# C 端项目分析文档（C-END ANALYSIS）

> 生成日期：2026-08-07
> 依据：`D:\code\my\nest-admin\.agents\skills\ai-platform-sdd\SKILL.md`（下称 SKILL.md）+ `D:\code\my\nest-admin\docs\specs\ai-platform\22-c-end-frontend.md`（下称 22-spec）
> 本文档是 C 端（nest-pure-front-react）开发的事实基线，所有任务请配合 `TASKFLOW.md` 使用。

---

## 1. 项目架构总览

```
用户浏览器 → https://www.007icu.top/ (C 端 SPA, nest-pure-front-react)
                  │  JWT (localStorage accessToken)
                  ▼
          nginx 反代（服务器 43.155.185.180）
                  ├─ /api/v1/c-end/*  → nest-admin 后端 (7001, 服务器 115.190.150.8)
                  ├─ /ai/v1/*         → nest-admin relay（OpenAI 兼容 7 端点）
                  └─ /auth/* /system/* → nest-admin 认证子系统
```

- **前端**：LobeHub fork（`D:\code\my\nest-pure-front-react`），Vite SPA 构建（`bun run build:spa`），本地开发 `bun run dev:spa`
- **后端**：nest-admin（`D:\code\my\nest-admin`），c-end 模块 9 子模块 + ai-gateway 模块（已实现 v1.5.0）
- **部署**：C 端 /vue-pure-admin/gateway → `ssh morgan@43.155.185.180` proc GIT 自动化部署；nest-admin → `ssh morgan@115.190.150.8`（Docker 容器监听 7001）

## 2. C 端前端现状盘点（services 层 → API 映射）

前端服务层位于 `src/services/`，统一走 `_api.ts` 的 `apiFetch` / `apiStream`（JWT Bearer + 401 自动刷新）。

| 前端 service 文件                                               | 对接端点                                                  | 状态         |
| ----------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| `services/session/index.ts`                                 | `/api/v1/c-end/sessions`（列表 / 创建 / 克隆 / 更新 / 删除 / 计数） | ✅ 已对接      |
| `services/topic/index.ts`                                   | `/api/v1/c-end/topics`（CRUD）                          | ✅ 已对接      |
| `services/message/index.ts`                                 | `/api/v1/c-end/messages`（CRUD / 批量）                   | ✅ 已对接      |
| `services/thread/index.ts`                                  | `/api/v1/c-end/threads`                               | ✅ 已对接      |
| `services/share/index.ts`                                   | `/api/v1/c-end/share`                                 | ✅ 已对接      |
| `services/sessionGroup`（`session-group`）                    | `/api/v1/c-end/session-groups`                        | ✅ 已对接      |
| `services/usage.ts`                                         | `/api/v1/c-end/usage/*`（monthly/daily/agent-stats）    | ✅ 已对接      |
| `services/upload.ts`                                        | `/api/v1/c-end/files`（multipart 上传）                   | ✅ 已对接      |
| `services/agent.ts` / `aiAgent.ts` / `aiChat.ts`            | `/api/v1/c-end/agents`                                | ✅ 已对接      |
| `services/config.ts`                                        | `/api/v1/c-end/config`                                | ✅ 已对接      |
| `services/notification.ts`                                  | `/api/v1/c-end/notifications`                         | ✅ 已对接      |
| `services/user*`（auth-adapter）                              | `/api/v1/c-end/user`                                  | ✅ 已对接      |
| `services/rag.ts` / `knowledgeBase.ts`                      | stub 端点（`tools/search`、`knowledge-bases` 等）           | ⚠️ Stub 占位 |
| `services/mcp.ts`                                           | `/api/v1/c-end/mcp/*`                                 | ⚠️ Stub 占位 |
| `services/discover.ts`                                      | `/api/v1/c-end/discover/*`                            | ⚠️ Stub 占位 |
| `services/task.ts` / `work.ts` / `generation*.ts`           | 未对接（依赖 #13/#8 后端）                                     | ❌ 缺失       |
| `services/userMemory.ts`                                    | 未对接（依赖 #9 后端）                                         | ❌ 缺失       |
| `services/agentMarketplace.ts`                              | 未对接（依赖 #18 后端）                                        | ❌ 缺失       |
| `services/webBrowsing.ts` / `python.ts` / `cloudSandbox.ts` | 未对接（依赖 #3/#12 后端）                                     | ❌ 缺失       |

## 3. 后端能力盘点

### 3.1 c-end 模块（已实现，73 路由，`src/modules/c-end/`）

| 子模块                 | Controller 前缀     | 主要端点                                                                                       |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| session             | `/sessions`       | CRUD + clone + count                                                                       |
| topic               | `/topics`         | CRUD + sessionId 过滤                                                                        |
| message             | `/messages`       | CRUD + batch                                                                               |
| thread              | `/threads`        | CRUD                                                                                       |
| share               | `/share`          | 分享                                                                                         |
| session-group       | `/session-groups` | 分组                                                                                         |
| usage               | `/usage`          | monthly/daily/agent-stats/summary/model-stats/count/recent/tokens/cost（9 端点）               |
| agent               | `/agents`         | Agent CRUD                                                                                 |
| file                | `/files`          | 上传                                                                                         |
| config              | `/config`         | 门户配置                                                                                       |
| notification        | `/notifications`  | 通知                                                                                         |
| auth-adapter        | `/user`           | 用户资料                                                                                       |
| better-auth-adapter | `/api/auth`       | better-auth 兼容（get-session/check-user/sign-in/sign-up/sign-out）                            |
| stub                | `/`               | tools/search、web-browsing、mcp、knowledge-bases、discover、devices、acceptance、plugins（**占位壳**） |

### 3.2 ai-gateway 模块（已实现 v1.5.0，`src/modules/ai-gateway/`）

- `/ai/v1/chat/completions`、`/completions`、`/embeddings`、`/models`、`/images/generations`、`/audio/speech`、`/audio/transcriptions`（relay.controller.ts L81-139）
- 渠道 / 模型 / 令牌 / 日志 / 账单 / 兑换码 / 策略 / 护栏 / 积分（19 子模块）
- **定价引擎 6 级优先级 + 积分第 7 级**（SKILL.md L4805-4872）
- **DataScopeService**（`src/modules/ai-gateway/shared/data-scope.ts`）：`resolve(uid, roles)` → `{ all, userIds }`；admin→all /dept leader→本部门全员 / 普通用户→self；`applyDataScope(qb, scope, alias)` 通用 SQL 过滤

## 4. 功能缺口矩阵（13 项 C 端能力 × 后端状态 × AC）

> 对应 SKILL.md L301-317 职责分工 + 22-spec AC1-AC20。✅= 可用 / ⚠️=stub / ❌= 未实现。

| C 端能力          | C 端页面                       | 后端模块                         | 后端状态                     | AC      |
| -------------- | --------------------------- | ---------------------------- | ------------------------ | ------- |
| 对话（流式）         | `src/routes/(main)/(chat)/` | #2 Agent + /ai/v1            | ⚠️ /ai/v1 ✅，Agent 编排 ❌   | AC2     |
| 模型切换           | 模型选择器                       | /ai/v1/models                | ✅                        | AC14    |
| 知识库 RAG        | 知识库页                        | #4 RAG                       | ⚠️ stub（knowledge-bases） | AC3     |
| HITL 审批        | 审批弹窗                        | #5 HITL                      | ❌                        | AC8     |
| UI 生成          | UI 生成页                      | #8 UI Generator              | ❌                        | AC9     |
| 记忆画像           | `routes/(main)/memory/`     | #9 Memory                    | ❌（userMemory 未对接）        | AC6     |
| Agent 团队       | 团队页                         | #10 多 Agent                  | ❌                        | —       |
| 工作台            | `routes/(main)/task/`       | #13 Workspace                | ❌                        | AC4     |
| 产物中心           | 产物页                         | #14 Artifact                 | ❌                        | AC4     |
| Agent 市场       | 市场页                         | #18 Marketplace              | ❌                        | AC5     |
| 用量 / 余额 / 令牌   | 用量账单页                       | #11 子集                       | ✅（c-end usage 9 端点）      | AC7     |
| 前端 Copilot     | 浮动按钮                        | #20 page-agent               | ❌                        | —       |
| Harness        | Harness 页                   | 聚合 #2+#3+#6+#15              | ❌                        | AC16-20 |
| **部门负责人看板（新）** | stats 部门看板页                 | DataScope + ai\_gateway\_log | ❌（本次 T2 实现）              | AC11    |

## 5. 部署架构与命令

| 项目                    | 本地启动                               | 构建                                   | 部署                                                          |
| --------------------- | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| nest-pure-front-react | `bun run dev:spa`（vite, 默认端口 5173） | `bun run build:spa` → `dist/desktop` | scp/tar → proc（GIT 自动化部署）→ nginx 静态托管                       |
| nest-admin            | `bun run dev`（需 .env: DB/Redis）    | —                                    | Docker 容器（bun:1.3-alpine:7001）+ postgres (pgvector) + redis |
| vue-pure-admin        | `bun run dev`                      | `bun run build`                      | proc GIT 自动化部署                                              |

**线上域名**：C 端 `https://www.007icu.top/`、后台 `https://admin.007icu.top/`
**nginx 反代规则**（`deploy/web/c-end.conf`）：`/api/*` `/ai/*` `/auth/*` `/system/*` → 127.0.0.1:7001；`/` → SPA 回退

## 6. 关键决策记录

1. **纯静态 SPA 部署**（非 Next.js SSR）：next build 内存 17GB+ 超服务器 7.8GB，改用 vite build 产物（SKILL.md L5316-5323）
2. **统一后端 nest-admin**：C 端不自建后端，全部走 `/api/v1/c-end/*`（22-spec v1.4.0 方案 B）
3. **tRPC → REST 改造**：前端 services 层从 tRPC client 改为 apiFetch REST（已完成）
4. **数据权限**：部门负责人看板复用 DataScopeService，不新建权限体系
5. **换 AI 工具执行**：本计划由任意 AI 工具执行，执行前先读 SKILL.md 对应行号章节（见 TASKFLOW\.md 索引）
