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
                  ├─ /app/front-hub/*  → nest-admin 后端 (7001, 服务器 115.190.150.8)
                  ├─ /ai/v1/*         → nest-admin relay（OpenAI 兼容 7 端点）
                  └─ /auth/* /system/* → nest-admin 认证子系统
```

- **前端**：LobeHub fork（`D:\code\my\nest-pure-front-react`），Vite SPA 构建（`bun run build:spa`），本地开发 `bun run dev:spa`
- **后端**：nest-admin（`D:\code\my\nest-admin`），c-end 模块 9 子模块 + ai-gateway 模块（已实现 v1.5.0）
- **部署**：C 端 /vue-pure-admin/gateway → `ssh morgan@43.155.185.180` proc GIT 自动化部署；nest-admin → `ssh morgan@115.190.150.8`（Docker 容器监听 7001）

## 2. C 端前端现状盘点（services 层 → API 映射）

前端服务层位于 `src/services/`，统一走 `_api.ts` 的 `apiFetch` / `apiStream`（JWT Bearer + 401 自动刷新）。

| 前端 service 文件                                           | 对接端点                                                             | 状态         |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ------------ |
| `services/session/index.ts`                                 | `/app/front-hub/sessions`（列表 / 创建 / 克隆 / 更新 / 删除 / 计数） | ✅ 已对接    |
| `services/topic/index.ts`                                   | `/app/front-hub/topics`（CRUD）                                      | ✅ 已对接    |
| `services/message/index.ts`                                 | `/app/front-hub/messages`（CRUD / 批量）                             | ✅ 已对接    |
| `services/thread/index.ts`                                  | `/app/front-hub/threads`                                             | ✅ 已对接    |
| `services/share/index.ts`                                   | `/app/front-hub/share`                                               | ✅ 已对接    |
| `services/sessionGroup`（`session-group`）                  | `/app/front-hub/session-groups`                                      | ✅ 已对接    |
| `services/usage.ts`                                         | `/app/front-hub/usage/*`（monthly/daily/agent-stats）                | ✅ 已对接    |
| `services/upload.ts`                                        | `/app/front-hub/files`（multipart 上传）                             | ✅ 已对接    |
| `services/agent.ts` / `aiAgent.ts` / `aiChat.ts`            | `/app/front-hub/agents`                                              | ✅ 已对接    |
| `services/config.ts`                                        | `/app/front-hub/config`                                              | ✅ 已对接    |
| `services/notification.ts`                                  | `/app/front-hub/notifications`                                       | ✅ 已对接    |
| `services/user*`（auth-adapter）                            | `/app/front-hub/user`                                                | ✅ 已对接    |
| `services/rag.ts` / `knowledgeBase.ts`                      | stub 端点（`tools/search`、`knowledge-bases` 等）                    | ⚠️ Stub 占位 |
| `services/mcp.ts`                                           | `/app/front-hub/mcp/*`                                               | ⚠️ Stub 占位 |
| `services/discover.ts`                                      | `/app/front-hub/discover/*`                                          | ⚠️ Stub 占位 |
| `services/task.ts` / `work.ts` / `generation*.ts`           | 未对接（依赖 #13/#8 后端）                                           | ❌ 缺失      |
| `services/userMemory.ts`                                    | 未对接（依赖 #9 后端）                                               | ❌ 缺失      |
| `services/agentMarketplace.ts`                              | 未对接（依赖 #18 后端）                                              | ❌ 缺失      |
| `services/webBrowsing.ts` / `python.ts` / `cloudSandbox.ts` | 未对接（依赖 #3/#12 后端）                                           | ❌ 缺失      |

## 3. 后端能力盘点

### 3.1 c-end 模块（已实现，73 路由，`src/modules/c-end/`）

| 子模块              | Controller 前缀   | 主要端点                                                                                               |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| session             | `/sessions`       | CRUD + clone + count                                                                                   |
| topic               | `/topics`         | CRUD + sessionId 过滤                                                                                  |
| message             | `/messages`       | CRUD + batch                                                                                           |
| thread              | `/threads`        | CRUD                                                                                                   |
| share               | `/share`          | 分享                                                                                                   |
| session-group       | `/session-groups` | 分组                                                                                                   |
| usage               | `/usage`          | monthly/daily/agent-stats/summary/model-stats/count/recent/tokens/cost（9 端点）                       |
| agent               | `/agents`         | Agent CRUD                                                                                             |
| file                | `/files`          | 上传                                                                                                   |
| config              | `/config`         | 门户配置                                                                                               |
| notification        | `/notifications`  | 通知                                                                                                   |
| auth-adapter        | `/user`           | 用户资料                                                                                               |
| better-auth-adapter | `/api/auth`       | better-auth 兼容（get-session/check-user/sign-in/sign-up/sign-out）                                    |
| stub                | `/`               | tools/search、web-browsing、mcp、knowledge-bases、discover、devices、acceptance、plugins（**占位壳**） |

### 3.2 ai-gateway 模块（已实现 v1.5.0，`src/modules/ai-gateway/`）

- `/ai/v1/chat/completions`、`/completions`、`/embeddings`、`/models`、`/images/generations`、`/audio/speech`、`/audio/transcriptions`（relay.controller.ts L81-139）
- 渠道 / 模型 / 令牌 / 日志 / 账单 / 兑换码 / 策略 / 护栏 / 积分（19 子模块）
- **定价引擎 6 级优先级 + 积分第 7 级**（SKILL.md L4805-4872）
- **DataScopeService**（`src/modules/ai-gateway/shared/data-scope.ts`）：`resolve(uid, roles)` → `{ all, userIds }`；admin→all /dept leader→本部门全员 / 普通用户→self；`applyDataScope(qb, scope, alias)` 通用 SQL 过滤

## 4. 功能缺口矩阵（13 项 C 端能力 × 后端状态 × AC）

> v2 盘点（2026-08-07，读代码核实）：对应 SKILL.md L301-317 职责分工 + 22-spec AC1-AC20。✅= 可用 / ⚠️= 部分 / ❌= 缺失。

| C 端能力           | C 端页面                    | 后端模块                           | 后端状态                            | 前端对接                                       | AC       |
| ------------------ | --------------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------------------- | -------- |
| 对话（流式）       | `src/routes/(main)/(chat)/` | c-end/agent-orchestration + /ai/v1 | ✅ SSE 实测 51 chunks               | ✅ session/topic/message REST                  | AC2      |
| 模型切换           | 模型选择器                  | /ai/v1/models                      | ✅ 120 模型                         | ⚠️ 待验证 G7（aiModel service）                | AC14     |
| 知识库 RAG         | /knowledge 页               | c-end/knowledge（bge-m3 1024 维）  | ✅ 11/11                            | ⚠️ 页面已接；对话内 @知识库检索未接（G2）      | AC3      |
| HITL 审批          | /hitl 页                    | c-end/hitl                         | ✅ 14/14                            | ✅ hitl.ts REST                                | AC8      |
| UI 生成            | ❌ 无页面（G1）             | c-end/generation                   | ✅ SSE 实测 96KB                    | ❌ generation.ts 仍是 LobeHub 图片 / 视频 tRPC | AC9      |
| 记忆画像           | settings/memory 页          | c-end/memory                       | ✅ 19/19                            | ✅ userMemory REST                             | AC6      |
| Agent 团队         | /teams 页                   | c-end/agent-team                   | ✅ 11/11                            | ✅ agentTeam REST+SSE                          | —        |
| 工作台             | workspace service           | c-end/workspace                    | ✅ 19/19                            | ✅ workspace.ts REST                           | AC4      |
| 产物中心           | 工作台内产物 Tab            | workspace/artifacts                | ✅ 版本 /diff/ 下载                 | ✅ workspace.ts                                | AC4      |
| Agent 市场         | /market 页                  | c-end/marketplace                  | ✅ 20/20                            | ✅ marketplace.ts REST                         | AC5      |
| 用量 / 余额 / 令牌 | settings/usage + dept-stats | c-end/usage（9+4 端点）            | ✅                                  | ✅ usage/deptUsage REST                        | AC7/AC11 |
| 前端 Copilot       | 无                          | #20 page-agent                     | ❌ 规划中（SKILL 标注新增・规划中） | ❌ 本期不做（spec Future Opt \[P1]）           | —        |
| Harness            | /harness 页                 | c-end/harness                      | ✅ 19/19                            | ✅ harness.ts REST+SSE                         | AC16-20  |

### 4.1 ai-platform-sdd 22 模块完成度矩阵（读代码核实）

| #   | 模块           | 后端                                 | 管理端                    | C 端                     | 结论                                               |
| --- | -------------- | ------------------------------------ | ------------------------- | ------------------------ | -------------------------------------------------- |
| 1   | 模型路由       | ✅ /ai/v1/models（Gateway）          | ✅ gateway 页面           | ✅ 模型选择器（G7 待验） | 已实现                                             |
| 2   | Agent 编排     | ✅ c-end/agent-orchestration         | —                         | ✅ 对话                  | 已实现                                             |
| 3   | 工具系统       | ⚠️ 仅 harness MODE\_TOOLS 白名单替代 | ❌                        | —                        | admin 独占・本期不做（SKILL 标注新增，无 spec）    |
| 4   | 知识库 RAG     | ✅ c-end/knowledge                   | ✅ ai/c-end/knowledge     | ⚠️ G2                    | 已实现（对话内检索待补）                           |
| 5   | HITL           | ✅ c-end/hitl                        | ✅ ai/c-end/hitl          | ✅                       | 已实现                                             |
| 6   | Harness 可靠性 | ⚠️ C 端用虚拟文件系统 + 白名单替代   | ❌ 配置层未做             | —                        | admin 独占・本期不做（#22 子能力已覆盖用户侧）     |
| 7   | 模型微调       | ❌                                   | ❌                        | —                        | admin 独占 P2・明确不做（SKILL 新增无 spec）       |
| 8   | UI 生成        | ✅ c-end/generation                  | ✅ ai/c-end/generation    | ❌ G1 缺页面             | 后端已实现，C 端页面待补                           |
| 9   | 记忆画像       | ✅ c-end/memory                      | ✅ ai/c-end/memory        | ✅                       | 已实现                                             |
| 10  | Agent 团队     | ✅ c-end/agent-team                  | ✅ ai/c-end/agent-team    | ✅                       | 已实现                                             |
| 11  | AI Gateway     | ✅ v1.5.0（7 子模块）                | ✅ gateway 34 页          | ✅ 用量子集              | 已实现                                             |
| 12  | 浏览器 Agent   | ❌                                   | ❌                        | —                        | admin 独占・明确不做（SKILL 新增无 spec）          |
| 13  | Workspace      | ✅ c-end/workspace                   | ✅ ai/c-end/workspace     | ✅                       | 已实现                                             |
| 14  | Artifact       | ✅ 并入 workspace                    | ✅                        | ✅ 下载 /diff            | 已实现                                             |
| 15  | Runtime        | ❌                                   | ❌                        | —                        | admin 独占・明确不做（SKILL 新增无 spec）          |
| 16  | Governance     | ❌                                   | ❌                        | —                        | admin 独占・明确不做（SKILL 新增无 spec）          |
| 17  | Prompt Studio  | ⚠️ 仅 UI 生成专用 Prompt/few-shot    | ✅ ai/c-end/generation 内 | —                        | 部分实现；独立平台明确不做（SKILL 新增无 spec）    |
| 18  | Marketplace    | ✅ c-end/marketplace                 | ✅ ai/c-end/marketplace   | ✅                       | 已实现                                             |
| 19  | Protocol Hub   | ❌                                   | ❌                        | —                        | P3 规划中（SKILL 明确标注）                        |
| 20  | 前端 Copilot   | ❌                                   | ❌                        | ❌                       | P2 规划中（SKILL 明确标注；spec Future Opt \[P1]） |
| 21  | 动态 BUG 修复  | ❌                                   | ❌                        | —                        | 规划中（SKILL 明确标注）                           |
| 22  | C 端前端       | ✅ 18 子模块                         | —                         | 进行中                   | Wave 0-3 Done，Wave 4 权限收尾未做                 |

> 结论：本期 C 端交付 scope（13 项能力）内，已实现 11 项，缺口 2 项（G1 UI 生成页面 / G2 对话内知识库检索）；Copilot 明确规划中不做；admin 独占 9 模块不影响 C 端交付。

### 4.2 缺口清单（G 编号，任务流引用）

| 编号 | 严重级                 | 描述                                                                                                                                                                                            | 决策                                                     |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G1   | CRITICAL（AC9 不达标） | C 端无 UI 生成页：需新建 `src/routes/(main)/generate/` 页面 + service 对接 `/app/front-hub/generation/generate` SSE（code\_chunk/preview\_ready）+ iframe 预览 + 下载 + refine                  | 本期补全（TASKFLOW S8-2）                                |
| G2   | WARNING（AC3 部分）    | 对话内 @知识库 检索未接：`services/rag.ts` semanticSearchForChat 仍走 tRPC mock                                                                                                                 | 本期补全：改接 c-end/knowledge search（TASKFLOW S8-3）   |
| G3   | INFO（spec 滞后）      | 22-spec Status 表 Wave 0/1/2 仍 Not Started、AC1-15 未勾选，与实际不符（DoD 要求 spec 同步）                                                                                                    | 补更（TASKFLOW S8-4）                                    |
| G4   | INFO（明确不做）       | stub 501 能力（mcp/discover/plugins/social/devices/acceptance/web-browsing/tools-search）非 13 项能力，LobeHub 原有非核心页靠 tRPC mock 兼容                                                    | 保持 stub+mock，已在本文档标注理由                       |
| G5   | INFO（明确不做）       | #3/#6/#7/#12/#15/#16/#17/#19/#21 admin 独占或规划中模块                                                                                                                                         | SKILL 依据：职责分工 B 表 + 状态标注新增 / 规划中        |
| G6   | WARNING（工程卫生）    | nest-admin `scripts/_tmp-*.ts` 40+ 临时脚本入库                                                                                                                                                 | 清理或加 .gitignore（TASKFLOW S8-6）                     |
| G7   | INFO（待验证）         | 前端模型选择器（aiModel service）是否已接 /ai/v1/models                                                                                                                                         | 测试用例 P2-MODEL 验证，FAIL 则补接                      |
| G8   | WARNING（权限缺口）    | 管理端 `/ai/c-end` 8 个菜单（`vue-pure-admin/src/router/modules/ai.ts` L478-551）meta 无 `auths`，无 auths 的路由不被 filterNoPermissionTree 过滤 → developer 等任意登录账号可见 admin 独占菜单 | 补 `auths: ["ai:portal:config:admin"]`（TASKFLOW S8-15） |

### 4.3 管理端新增页面 / 菜单位置约定（vue-pure-admin）

> 菜单机制：静态路由（constantMenus）+ 后端 getAccountMenus 合并，`wholeMenus = filterNoPermissionTree(constantMenus.concat(后端菜单))`。c-end 管理页走静态路由三件套，**无需 sys\_menu 种子**：

| 件   | 位置                                                          | 说明                                                                                                    |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 页面 | `src/views/ai/c-end/<模块>/index.vue`                         | 参考现有 8 页                                                                                           |
| API  | `src/api/ai/c-end.ts`                                         | 统一封装 admin 全量接口                                                                                 |
| 菜单 | `src/router/modules/ai.ts` → `/ai/c-end` 组 children 追加子项 | path=`/ai/c-end/<模块>`、component、meta.title/icon；**必须带 `auths` 权限码**（对齐 gateway 菜单写法） |

> G1/G2 为 C 端能力，无需新增管理端菜单；仅未来新增 admin 管理模块时按上表三件套落地。

## 5. 部署架构与命令

| 项目                  | 本地启动                                 | 构建                                 | 部署                                                            |
| --------------------- | ---------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| nest-pure-front-react | `bun run dev:spa`（vite, 默认端口 5173） | `bun run build:spa` → `dist/desktop` | scp/tar → proc（GIT 自动化部署）→ nginx 静态托管                |
| nest-admin            | `bun run dev`（需 .env: DB/Redis）       | —                                    | Docker 容器（bun:1.3-alpine:7001）+ postgres (pgvector) + redis |
| vue-pure-admin        | `bun run dev`                            | `bun run build`                      | proc GIT 自动化部署                                             |

**线上域名**：C 端 `https://www.007icu.top/`、后台 `https://admin.007icu.top/`
**nginx 反代规则**（`deploy/web/c-end.conf`）：`/api/*` `/ai/*` `/auth/*` `/system/*` → 127.0.0.1:7001；`/` → SPA 回退

## 6. 关键决策记录

1. **纯静态 SPA 部署**（非 Next.js SSR）：next build 内存 17GB+ 超服务器 7.8GB，改用 vite build 产物（SKILL.md L5316-5323）
2. **统一后端 nest-admin**：C 端不自建后端，全部走 `/app/front-hub/*`（22-spec v1.4.0 方案 B）
3. **tRPC → REST 改造**：前端 services 层从 tRPC client 改为 apiFetch REST（已完成）
4. **数据权限**：部门负责人看板复用 DataScopeService，不新建权限体系
5. **换 AI 工具执行**：本计划由任意 AI 工具执行，执行前先读 SKILL.md 对应行号章节（见 TASKFLOW\.md 索引）
