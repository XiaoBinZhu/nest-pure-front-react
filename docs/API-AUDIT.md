# 前端 ↔ nest-admin 接口对照审计与清理记录

> 日期：2026-08 ｜ 审计方式：后端以本地启动日志的 Mapped 路由表（764 条）为权威；前端以 src 全量 URL 字面量 + trpc lambdaClient 调用为清单。

## 一、结论

1. **REST 层对照结果：无孤儿接口。** 前端 105 处 REST 调用中：
   - 60 处直接命中 nest-admin 路由（/app/front-hub/*、/ai/*、/v1/*、/api/auth/*、/share、/trpc）。
   - 其余 24 处分类如下（全部有归属，非孤儿）：
     | 调用 | 归属 | 处置 |
     |---|---|---|
     | /api/agent/*（含 /api/agent/messenger/:platform/install、/api/agent/stream） | monorepo 自带 apps/server（Hono，LobeHub 本地/桌面运行时） | 保留：桌面端本地服务负责；Web 端 404 属预期（上游 LobeHub 服务器未随 SPA 部署） |
     | /api/workflows/*、/api/version、/api/dev/agent-tracing | apps/server / 桌面远程 / __DEV__ 开关 | 保留（getServerVersion 对 404 显式容错） |
     | /share/page、/share/t | 前端路由（非 API） | 误报，忽略 |
     | /api/*（robots.tsx、define-config.ts） | Next 代理配置声明（非调用） | 误报，忽略 |
2. **trpc 层**：前端约 400 个 procedure（55+ 路由）。nest-admin 的 trpc stub 仅实现以下（其余由线上 nginx mock 兜底）：
   config.getGlobalConfig/getDefaultAgentConfig、aiProvider.getAiProviderList/getAiProviderRuntimeState、market.getMcpCategories/getMcpList/getModelCategories/getModelList/getProviderList/getAssistantList/registerClientInMarketplace、connector.syncBuiltinTool、messenger.availablePlatforms、home.getSidebarAgentList、recent.getAll、workspaceUserSettings.getPreference/updatePreference、task.list/groupList、taskTemplate.listDailyRecommend/dismiss、device.listDevices。
   其余 procedure（eval/verify/document/notebook/plugin/ragEval 等）属于上游 LobeHub 服务器能力，C 端页面已重接线到 /app/front-hub REST（harness/generation/hitl/browser 等），trpc 客户端仅作为类型/兼容层保留——**未删除**（删除需按页面逐个重接线，超出本次清理范围，避免误伤）。
3. **已确认并删除的无用接口文件**：src/services/electron/devtools.ts（全 src 0 引用）。

## 二、关键对照明细（新增功能）

| 前端调用 | 后端路由 | 状态 |
|---|---|---|
| POST /app/front-hub/harness/sessions/:id/tool-result | ✅ 本次新增 | 桌面委托执行回传 |
| /app/front-hub/developer/tokens（CRUD+rotate） | ✅ 本次新增 | 开发者自助 Key |
| /app/front-hub/developer/usage(/summary) | ✅ 本次新增 | 按 Key 用量 |
| /app/front-hub/developer/webhooks(CRUD/test/redeliver) | ✅ 本次新增 | Webhook 自助 |
| /app/front-hub/developer/models、/topup/packages、/topup/session | ✅ 本次新增 | 目录/充值代理 |
| /ai/webhooks（GET/PATCH/DELETE/attempts） | ✅ 本次新增 | 管理端 |
| GET /v1/models（含 context_length/pricing 等富字段）、GET /v1/pricing | ✅ 本次新增 | 公开目录 |
| /v1/responses、/v1/files、/v1/batches、/v1/fine_tuning、/v1/audio/translations、/v1/images/edits、/v1/moderations(501) | ✅ 本次新增 | OpenAI 兼容面 |
| /app/front-hub/generation/*（generate/refine/history/templates/prompts/fewshots/render/extract-variables） | ✅ 已存在 | UI 生成（类 Figma）前后端一致 |

## 三、清理动作记录

- 删除 src/services/electron/devtools.ts（0 引用）。
- 删除审计过程产生的临时文件（scripts-tmp-dead-services.ps1、dead-services.txt、frontend-calls.txt、dev-*/desktop-build*.log、routes-backend.txt）。
