---
name: project-overview
description: 'nest-pure-front-react（LobeHub OSS fork，C 端 AI 门户前端）架构地图。用于定位代码层、理解 apps/packages/src 布局、前端→nest-admin 后端对接方式、构建与部署拓扑、迁移现状与缺口。面向本仓库开发、加页面、接后端、排查链路时自动加载。'
user-invocable: false
---

# nest-pure-front-react 项目总览

> 目录清单是**关键位置地图**，不是全量树。`packages/`、`src/features/`、`src/store/` 会持续增长——需要最新集合请对真实目录 `ls`。

## 1. 这个仓库是什么

- **血缘**：LobeHub 开源仓库（`github.com/lobehub/lobehub`，包名 `@lobehub/lobehub`，版本 **2.2.9**）的 **fork**。本仓库 remote：`git@github.com:XiaoBinZhu/nest-pure-front-react.git`。
- **定位**：**C 端 AI 门户前端**（线上 `https://www.007icu.top/`）。它不是独立产品，而是「nest-admin + gateway + 本前端」三件套里的 C 端。
- **与上游最大的差别**：**后端不是 LobeHub 自带的 tRPC/Server DB，而是 nest-admin**。
  - C 端业务数据走 REST：`/app/front-hub/*`
  - AI 中继走：`/ai/v1/*`（nginx rewrite → nest-admin `/v1/*`）
  - 认证走：`/system/auth/refresh-token`（nest-admin JWT）+ `/api/auth/*`（better-auth 兼容壳）
  - 详见 §4「后端对接（本项目最关键的部分）」
- **代码基线文档（开工前必读）**：
  - `docs/C-END-ANALYSIS.md`（170 行）——services↔API 映射、后端能力矩阵、22 模块完成度、缺口清单 G1–G8、部署架构
  - `docs/TASKFLOW.md`——任务流索引（状态 PENDING / IN_PROGRESS / PASS / FAIL，**每完成一个任务必须回归 PASS 再进下一个**）
  - `docs/API-AUDIT.md`、`docs/TESTCASES.md` / `TESTCASES-v2.md`
  - `AGENTS.md`（`CLAUDE.md` 直接 `@AGENTS.md` 引用）——上游开发规范，仍适用

## 2. 技术栈（已核实）

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 16 + React 19 |
| 路由 | Next.js 内嵌 SPA，用 `react-router-dom` |
| 语言 | TypeScript（`type-check` 用 `tsgo --noEmit`） |
| UI 组件 | `@lobehub/ui`、antd |
| CSS-in-JS | antd-style（**优先 `createStaticStyles` + `cssVar.*` 零运行时**，仅在确需运行时计算时用 `createStyles` + `token`；见 `.cursor/docs/createStaticStyles_migration_guide.md`） |
| 组件优先级 | **`@lobehub/ui/base-ui`（headless）优先** → `@lobehub/ui` 根包 → antd 兜底。base-ui 已覆盖 `Select`、`Modal`/`createModal`/`confirmModal`、`DropdownMenu`、`ContextMenu`、`Popover`、`ScrollArea`、`Switch`、`Toast`、`FloatingSheet` |
| 图标 | lucide-react、`@ant-design/icons` |
| i18n | react-i18next（18 个 locale，源在 `packages/locales/src/default/`，产物 `locales/*`） |
| 状态 | zustand（31 个 store） |
| URL 参数 | nuqs |
| 数据获取 | SWR（store 内 `useClientDataSWR`）+ **REST `apiFetch`（本 fork 新增主路径）**；tRPC 仅存于未迁移的上游链路 |
| Hooks | aHooks |
| 日期 | dayjs |
| 工具 | es-toolkit |
| 数据库（上游遗留） | PostgreSQL + Drizzle ORM（`packages/database`） |
| 测试 | Vitest（单元）+ Cucumber/Playwright（`e2e/`） |
| 包管理 | pnpm 管依赖，**bun 跑 npm scripts**，bunx 跑可执行包 |

## 3. 仓库布局

```
(repo root)
├── apps/
│   ├── cli/                 # LobeHub CLI
│   ├── desktop/             # Electron 桌面端
│   └── server/              # 上游 Next.js 后端: featureFlags, globalConfig, modules,
│                            #   routers(async|lambda|mobile|tools), services, utils, workflows
├── docs/                    # C-END-ANALYSIS / TASKFLOW / API-AUDIT / TESTCASES / changelog / development / self-hosting
├── locales/                 # 18 个语种产物（ar, de-DE, en-US, ja-JP, ko-KR, zh-CN, zh-TW, ...）
├── packages/                # 89 个 @lobechat/* workspace 包，关键：
│   ├── agent-runtime/       # Agent 运行时核心
│   ├── agent-manager-runtime/ agent-gateway-client/ agent-mock/ agent-templates/
│   ├── agent-signal/        # Agent Signal 管线
│   ├── agent-tracing/       # Tracing / 快照
│   ├── builtin-tool-*/      # 每个内置工具一个包（calculator / web-browsing / claude-code /
│   │                        #   browser / local-system / memory / notebook / task / skills ...）
│   ├── builtin-tools/       # 中央注册表，组合 builtin-tool-*
│   ├── business/ business-server/   # 开源 stub（cloud 仓库提供真实实现）
│   ├── context-engine/ conversation-flow/
│   ├── database/            # src/{models,schemas,repositories} — Drizzle
│   ├── model-bank/          # 模型定义与 provider card
│   ├── model-runtime/       # src/{core,providers}
│   ├── locales/             # i18n 源: packages/locales/src/default/
│   ├── env/                 # env schema（@/envs/* → packages/env/src/*）
│   ├── app-config/ const/ types/ utils/ trpc/ web-crawler/ file-loaders/ python-interpreter/
│   ├── chat-adapter-{feishu,imessage,line,qq,wechat}/   # IM 渠道适配器
│   ├── electron-client-ipc/ electron-server-ipc/ desktop-bridge/
│   ├── device-{control,gateway-client,identity}/ heterogeneous-agents/ tool-runtime/
│   └── observability-otel/ llm-generation-tracing/ eval-{dataset-parser,rubric}/
├── e2e/                     # Cucumber + Playwright
├── scripts/                 # 构建/迁移/发布脚本（migrateServerDB、copySpaBuild、compressSpa 等）
└── src/
    ├── app/                 # Next.js App Router 外壳
    │   ├── (backend)/       # 后端路由壳（api, f, market, middleware, oidc, trpc, webapi）
    │   ├── spa/             # SPA HTML 模板服务
    │   ├── spa-auth/        # Auth HTML 外壳（SSR）
    │   └── [variants]/ layout.tsx manifest.ts robots.tsx not-found.tsx
    ├── routes/              # SPA 页面段（**只放薄壳**，业务委托 features/）
    │   └── (main)/ (mobile)/ (desktop)/ (popup)/ auth/ onboarding/ share/ verify/ verify-im/ acceptance/
    ├── spa/                 # SPA 入口 + 路由配置
    │   ├── entry.{web,mobile,desktop,popup,auth}.tsx
    │   ├── AppLayer.tsx  runtime.ts  atoms/  initialize/
    │   └── router/          # authRouter / desktopRouter(.config.tsx + .desktop.tsx) /
    │                        #   mobileRouter / popupRouter / routeMeta.ts
    ├── features/            # 115 个领域组件目录（AgentSetting, ChatInput, Conversation,
    │                        #   PageEditor, Workspace, Setting, MCP, Messenger, ...）
    ├── store/               # 31 个 zustand store（agent, agentGroup, aiInfra, chat, session,
    │                        #   topic, message, file, tool, user, userMemory, workspace, ...）
    ├── services/            # 客户端服务层（77 个入口）——REST 与 tRPC 双轨，见 §4
    ├── business/            # 开源 stub（client/server）
    ├── libs/ hooks/ layout/ components/ utils/ types/ const/ styles/ helpers/
    ├── auth.ts              # JWT 认证适配壳（实际校验在 proxy.ts）
    └── proxy.ts             # Next.js middleware：accessToken 存在性守卫
```

**分层映射**

| 层 | 位置 |
| --- | --- |
| UI 组件 / 业务组件 | `src/components`、`src/features` |
| SPA 页面（薄） | `src/routes/` |
| React Router 配置 | `src/spa/router/` |
| 全局 Provider | `src/layout` |
| Zustand Store | `src/store` |
| 客户端服务 | `src/services/` |
| REST API（上游） | `src/app/(backend)/webapi` |
| tRPC 路由（上游） | `apps/server/src/routers/{async,lambda,mobile,tools}` |
| Server 服务 | `apps/server/src/services`（可访问 DB） |
| Server 模块 | `apps/server/src/modules`（不访问 DB） |
| DB Schema / Model / Repo | `packages/database/src/{schemas,models,repositories}` |
| 第三方集成 | `src/libs` |
| 内置工具 | `packages/builtin-tool-*` → `packages/builtin-tools` |

## 4. 后端对接（本项目最关键的部分）

### 4.1 REST 客户端层（`src/services/_*.ts`）

| 文件 | 职责 |
| --- | --- |
| `src/services/_api.ts` | **核心**：`apiFetch<T>(path, options)` + `apiStream`（SSE）+ `setAuthTokens` / `clearAuthTokens`；统一 JWT 注入、**401 自动刷新**、响应解包 |
| `src/services/_url.ts` | `API_ENDPOINTS`（oauth `/api/auth`、trace、chat、models、tts）与 `MARKET_OIDC_ENDPOINTS` |
| `src/services/_auth.ts` | provider keyVault → 上游鉴权 payload（Bedrock/Azure/Vertex 等） |
| `src/services/_header.ts` | 遗留 OpenAI 兼容头构造（`@deprecated`，待 TTS 重构后删） |

`apiFetch` 行为要点：

- `API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''`（同域相对路径，靠 nginx 反代）
- 仅在有 body 时设置 `Content-Type: application/json`——**无 body 请求（如 DELETE）带该头会被 Fastify 拒绝**（`Body cannot be empty when content-type is set to 'application/json'`）
- 401 → 用 `localStorage.refreshToken` POST `/system/auth/refresh-token`（nest-admin `@Public` 端点，返回 `{ token, refreshToken, expires }`）→ 成功后重试
- `unwrapData()` 解开 nest-admin 信封 `{ code, data, message }`；`@Bypass` 端点返回原始格式，调用方需兼容
- 各 service 内通常再包一层 `unwrap<T>()`（如 `src/services/session/index.ts`）

### 4.2 端点映射（前端 service → nest-admin）

| 前端 service | 端点 | 状态 |
| --- | --- | --- |
| `session/index.ts` | `/app/front-hub/sessions`（CRUD / clone / count） | ✅ |
| `topic/index.ts` | `/app/front-hub/topics` | ✅ |
| `message/index.ts` | `/app/front-hub/messages`（CRUD / batch） | ✅ |
| `thread/index.ts` | `/app/front-hub/threads` | ✅ |
| session-group | `/app/front-hub/session-groups` | ✅ |
| `usage.ts` / `deptUsage.ts` | `/app/front-hub/usage/*`（monthly / daily / agent-stats / summary / model-stats / count / recent / tokens / cost） | ✅ |
| `upload.ts` | `/app/front-hub/files`（multipart） | ✅ |
| `agent.ts` / `aiAgent.ts` / `aiChat.ts` | `/app/front-hub/agents` | ✅ |
| `config.ts` | `/app/front-hub/config` | ✅ |
| `notification.ts` | `/app/front-hub/notifications` | ✅ |
| `user/*`、`userMemory/*` | `/app/front-hub/user`、`memory` | ✅ |
| `hitl.ts`、`harness.ts`、`marketplace.ts`、`workspace.ts`、`agentTeam.ts`、`quota.ts`、`knowledgeBase.ts` | 同名 front-hub 前缀（部分 REST + SSE） | ✅ |
| `rag.ts` / `mcp.ts` / `discover.ts` | stub | ⚠️ 占位 |
| `task.ts` / `work.ts` / `generation*.ts`（非 Portal）/ `webBrowsing.ts` / `python.ts` / `cloudSandbox.ts` | 未对接 | ❌ |

- **AI 中继**：`API_ENDPOINTS.chat()` = `/ai/v1/chat/completions`。历史沿革（注释中有记录）：G9 修复前走 `/webapi/chat`（Next.js 后端），纯 SPA 模式无 Next 后端后改直连 nest-admin；2026-08-19 起 `/v1` 让位给对外 gateway 直连入口，C 端统一走 `/ai/v1`，由 **nginx `rewrite /ai/v1/(.*) → /v1/$1`** 转发到 nest-admin（后端零改动）。
- **鉴权**：`localStorage` 存 `accessToken` / `refreshToken`；`src/proxy.ts` 是 Next.js middleware，只做「有没有 accessToken」的守卫（`/login`、`/_next`、`/_spa`、`/api`、`/auth`、`/ai` 前缀直接放行），**真正的 JWT 校验在 nest-admin 侧**。`src/auth.ts` 是替代 better-auth 的占位壳。

### 4.3 双轨现状（迁移中，务必确认再动手）

- 已迁移到 REST（`apiFetch`）的文件：**29 个**（`src/services/` 下 agent、agentTeam、aiChat、aiModel、browserAgent、deptUsage、developer、generationPortal、global、harness、hitl、knowledgeBase、marketplace、message、notification、protocolHub、quota、session、thread、topic、usage、user、userMemory、workspace 等）
- 仍使用上游 tRPC `lambdaClient` 的文件：**116 个**
- **新写 / 改写的 C 端业务代码必须用 `apiFetch` 打 `/app/front-hub/*`，不要再新增 `lambdaClient` 调用**；只有纯上游遗留链路（桌面端、market OIDC、部分 stub）才继续走 tRPC。
- `stub` 能力（tools/search、web-browsing、mcp、knowledge-bases、discover、devices、acceptance、plugins）后端返回 **501**，前端保持 tRPC mock 兼容（缺口 G4，明确不做）。

## 5. 部署架构

```
浏览器 → https://www.007icu.top/  (C 端 SPA，Vite 构建产物 public/_spa)
             │ JWT (localStorage accessToken)
             ▼
     nginx 反代（境外服务器 43.155.185.180）
             ├─ /app/front-hub/*   → nest-admin（115.190.150.8:7001，Docker）
             ├─ /ai/v1/*  → rewrite → /v1/*  → nest-admin relay（OpenAI 兼容端点）
             └─ /auth/* /system/*  → nest-admin 认证子系统
```

- 前端部署：`ssh morgan@43.155.185.180`，proc GIT 自动化部署（与 vue-pure-admin、gateway 同机）
- nest-admin 部署：`ssh morgan@115.190.150.8`（Docker 监听 7001）
- 改动 nginx 配置时注意 `c-end.conf` 的实际部署路径（历史 bug：路径不匹配，commit `d58ee92b`）

## 6. 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev:spa` | **C 端开发首选**：只起 Vite SPA（默认代理 API 到 3010/网关），端口见终端输出 |
| `bun run dev` | 全栈开发：`tsx scripts/devStartupSequence.mts`（Next.js + Vite SPA 并发） |
| `bun run dev:next` | 只起 Next.js（`-p 3010`） |
| `bun run build` | `build:spa` + `build:spa:auth` + `build:spa:copy` + `build:next` |
| `bun run build:spa` | Vite 构建 SPA → `public/_spa`（+ `compress:spa` 压缩） |
| `bun run check [files...]` | **质量门禁**：`.agents/scripts/check/cli.ts`。无参数 = 变更文件全跑（lint+test 一次通过）；`--lint` / `--test` / `--type` 可组合 |
| `bun run type-check` | `tsgo --noEmit` |
| `bun run test` | `test-app` + `test-server`（**全量约 10 分钟，日常别直接跑**） |
| `bun run i18n` | 补齐其余语种（慢，PR 前跑一次） |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle（上游 Server DB，C 端主链路不依赖） |

单测手动跑法：**先 `cd` 进所属包**再跑，例如 `cd packages/database && bunx vitest run --silent='passed-only' '[file-path]'`。

Debug Proxy：`dev:spa` 启动后终端会打印 `https://app.lobehub.com/_dangerous_local_dev_proxy?debug-host=...`，用于在**生产后端环境**里加载本地 Vite SPA（保留 HMR）。

## 7. 与上游 Cloud 仓库的关系

上游开源仓库被独立的私有 cloud（SaaS）仓库以 git submodule 方式挂载在 `lobehub/`，cloud 提供 `src/business/{client,server}` 与 `packages/business/*` 的真实实现覆盖本仓库的 stub。
**本 fork 不使用 cloud 层**：C 端业务逻辑由 nest-admin 提供，`src/business/` 与 `packages/business*/` 的 stub 在本仓库仍是源码事实。

## 8. 已知缺口（G 编号，详见 `docs/C-END-ANALYSIS.md` §4.2 与 `docs/TASKFLOW.md`）

| 编号 | 级别 | 内容 |
| --- | --- | --- |
| G1 | CRITICAL | C 端无 UI 生成页，需新建 `src/routes/(main)/generate/` + 接 `/app/front-hub/generation/generate` SSE（code_chunk / preview_ready）+ iframe 预览 + 下载 + refine |
| G2 | WARNING | 对话内 `@知识库` 检索未接：`services/rag.ts` 的 `semanticSearchForChat` 仍走 tRPC mock，应改接 c-end/knowledge search |
| G3 | INFO | 22-spec 状态表与 AC 未同步 |
| G4 | INFO | stub 501 能力保持 mock（明确不做） |
| G5 | INFO | admin 独占 / 规划中模块（#3 #6 #7 #12 #15 #16 #17 #19 #21）不影响 C 端交付 |
| G6 | WARNING | nest-admin `scripts/_tmp-*.ts` 临时脚本入库（工程卫生） |
| G7 | INFO | 模型选择器（aiModel service）是否已接 `/v1/models`，待验证 |
| G8 | WARNING | 管理端 `/ai/c-end` 菜单缺 `auths`，任意登录账号可见 admin 独占菜单 |

## 9. Skill 路由（本仓库 `.agents/skills` 内联动）

| 任务 | 读取 |
| --- | --- |
| SPA 路由 / features 归属 / 桌面端双配置同步 | `spa-routes`（**桌面路由必须同时改 `desktopRouter.config.tsx` 与 `.desktop.tsx`**，否则白屏；`desktopRouter.sync.test.tsx` 守这条不变式） |
| service → store → SWR 数据流 | `data-fetching-architecture`（注意：本 fork 的 service 层主路径是 `apiFetch` REST，不是 `lambdaClient`） |
| zustand store 结构与 List/Detail 形态 | `zustand`、`store-data-structures` |
| 上游 tRPC 路由开发（仅遗留链路） | `trpc-router` |
| DB schema / 迁移 | `drizzle`、`db-migrations` |
| React 组件与布局 | `react`（含 `layout-kit`） |
| 测试 | `testing`（含 agent-runtime / zustand store / desktop / electron 专项） |
| i18n | `i18n` |
| 代码评审 | `deep-review`（普通评审用 light 模式） |
| UX 自审 / 设计规范 | `ux-audit`、`ux`、`product-design`、`DESIGN.md`（自然 / 意义感 / 确定性 / 成长） |

## 10. 开发约定速记

- **每个 bug fix 必须配一条回归测试**：修复前 FAIL、修复后 PASS。
- 单文件超过 ~800 行就拆分（子组件 / hooks / helpers / types）。
- i18n：key 加到 `packages/locales/src/default/*.ts`，手写 en-US + zh-CN 供开发预览，其余语种 PR 前跑 `bun run i18n` 补齐，不要手翻。
- Git：开发分支 `canary`，发布分支 `main`（从 canary cherry-pick）；新分支从 `canary` 切，PR 打向 `canary`；`git pull` 用 rebase；提交信息带 gitmoji；分支名 `<type>/<feature-name>`。
- 涉及对话/中继链路改动时，同步确认 nest-admin 侧与 nginx rewrite 规则（`/ai/v1` ↔ `/v1`）。
