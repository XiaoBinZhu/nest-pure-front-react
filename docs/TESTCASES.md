# C 端 + 后台管理端 完整回归测试用例（TESTCASES）

> 版本：v1.0.0（2026-08-07）
> 覆盖：C 端（nest-pure-front-react）+ 后端（nest-admin c-end 模块）+ 后台管理端（vue-pure-admin）
> 执行方式：本地启动（后端 7001 / C 端 9876 / 管理端 8848）→ API 脚本 + 浏览器验证

## 符号说明
- `[API]` 后端接口回归（脚本：`nest-admin/scripts/_tmp-*-test.ts`）
- `[UI]` 浏览器页面回归
- `[SSE]` 流式事件回归

---

## 1. 登录与鉴权（AC1）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 1.1 | 图片验证码获取 | [API] GET /system/auth/captcha/img | 200 + svg + captchaId | ✅ |
| 1.2 | 管理端 JWT 登录（admin/admin123） | [API] POST /system/auth/login | 200 + token | ✅ |
| 1.3 | better-auth check-user（邮箱查用户） | [API] POST /api/auth/check-user | 201 { exists, hasPassword } | ✅ |
| 1.4 | better-auth 邮箱密码登录 | [API] POST /api/auth/sign-in/email | 201 { token, user } + set-cookie | ✅ |
| 1.5 | get-session（带 cookie） | [API] GET /api/auth/get-session | 200 { session, user } | ✅ |
| 1.6 | get-session（未登录） | [API] GET /api/auth/get-session | 200 null | ✅ |
| 1.7 | 登录守卫：未登录访问 /agent → 重定向首页 | [UI] | URL 变 / | ✅ |
| 1.8 | 登录守卫：已登录访问 /agent → onboarding/聊天 | [UI] | 正常进入 | ✅ |
| 1.9 | 越权：developer 访问 admin 数据 → 404 | [API] | 404 | ✅ |

## 2. 会话/消息/对话流式（AC2）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 2.1 | 会话列表/创建/删除 | [API] GET/POST/DELETE /api/v1/c-end/sessions | CRUD 正常 | ✅ |
| 2.2 | 会话分组 group_id 字段 | [API] 创建分组会话 | 200（无 500） | ✅ |
| 2.3 | 话题/消息 CRUD | [API] /topics /messages | CRUD 正常 | ✅ |
| 2.4 | 对话流式 SSE | [API] POST /ai/v1/chat/completions（stream） | 51+ chunks | ✅ |
| 2.5 | 模型列表动态获取 | [API] GET /ai/v1/models | 120 模型 | ✅ |
| 2.6 | C 端首页渲染（欢迎页/导航） | [UI] GET / | 欢迎语 + 导航栏 | ✅ |
| 2.7 | 聊天页渲染（已登录） | [UI] GET /agent | 聊天界面 | ✅ |

## 3. 用量与部门看板（AC7/AC11）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 3.1 | 用量 9 端点 | [API] GET /api/v1/c-end/usage/* | 全部 200 | ✅ |
| 3.2 | dept overview/members/models/trend | [API] 4 端点 | 200 + 数据 | ✅ |
| 3.3 | 3 角色数据范围（self/dept/all） | [API] | admin 11 人 / developer 本部门 / user 自己 | ✅ |
| 3.4 | 数据正确性（vs ai_gateway_log） | [SQL] | 12623 精确一致 | ✅ |
| 3.5 | 部门看板页 /settings/dept-stats | [UI] | 卡片/排行/分布/趋势 | ✅ |

## 4. 记忆画像（AC6）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 4.1 | 五层记忆 CRUD（identities/contexts/activities/experiences/preferences） | [API] | 19/19 | ✅ |
| 4.2 | 画像摘要/重新生成 | [API] | 200 | ✅ |
| 4.3 | 记忆提取（规则） | [API] POST /memory/extract | 提取计数 | ✅ |
| 4.4 | 语义搜索/标签聚合/注入上下文 | [API] | 200 | ✅ |
| 4.5 | admin 全量视角列表 + 删除 | [API] | 全量返回 | ✅ |
| 4.6 | 记忆页（settings/memory） | [UI] | 页面正常 | ✅ |

## 5. 知识库 RAG（AC3）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 5.1 | 知识库 CRUD | [API] /knowledge/bases | 11/11 | ✅ |
| 5.2 | 文档上传 + 切片 + 向量化（bge-m3 1024 维） | [API] POST documents | indexed | ✅ |
| 5.3 | 语义检索（pgvector <=>） | [API] POST /bases/:id/search | 相关性结果 | ✅ |
| 5.4 | admin 全量视角 | [API] | 全量返回 | ✅ |
| 5.5 | 知识库页 /knowledge（上传/检索） | [UI] | 页面正常 | ✅ |

## 6. 工作台与产物（AC4）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 6.1 | 任务 CRUD + 状态流转 | [API] /workspace/tasks | 19/19 | ✅ |
| 6.2 | 日志追加/分页 | [API] | 200 | ✅ |
| 6.3 | 产物 CRUD + 版本管理 | [API] /artifacts | 版本递增 | ✅ |
| 6.4 | 产物 diff/下载 | [API] | 200 | ✅ |
| 6.5 | 级联删除（任务→日志/产物） | [API] | 数据清理 | ✅ |
| 6.6 | admin 全量视角 | [API] | 全量返回 | ✅ |

## 7. Agent 市场（AC5）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 7.1 | 商品浏览/筛选/分类 | [API] /marketplace/agents | 20/20 | ✅ |
| 7.2 | 发布 → 审核（admin）→ 上架 | [API] publish + review | 状态流转 | ✅ |
| 7.3 | 克隆/评分 | [API] clone + rate | 计数更新 | ✅ |
| 7.4 | 市场页 /market（浏览/克隆） | [UI] | 页面正常 | ✅ |

## 8. HITL 审批（AC8/AC20）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 8.1 | 发起审批（DANGEROUS/SAFE） | [API] POST /hitl/approvals | 14/14 | ✅ |
| 8.2 | 批准/拒绝/重复审批 409 | [API] | 状态流转 | ✅ |
| 8.3 | 策略 CRUD + 强制审批开关 | [API] | 200 | ✅ |
| 8.4 | 审批超时 | [API] | expired | ✅ |
| 8.5 | admin 全量审批列表 | [API] | 全量返回 | ✅ |
| 8.6 | 审批中心页 /hitl | [UI] | 页面正常 | ✅ |
| 8.7 | Harness 危险操作联动（file_delete/命令） | [SSE] harness_approval 事件 | 拒绝不执行/批准执行 | ✅ |

## 9. UI 生成（AC9）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 9.1 | SSE 流式生成（code_chunk/preview_ready） | [SSE] POST /generation/generate | 真实生成 96KB | ✅ |
| 9.2 | 对话式修改 refine | [SSE] | 200 | ✅ |
| 9.3 | Prompt 版本管理 + 激活 | [API] | 200 | ✅ |
| 9.4 | few-shot CRUD | [API] | 200 | ✅ |
| 9.5 | admin 生成历史全量 | [API] | 全量返回 | ✅ |

## 10. Agent 团队（T11）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 10.1 | 团队 CRUD（成员 jsonb） | [API] /teams | 11/11 | ✅ |
| 10.2 | 成员嵌套 DTO 校验（whitelist 不剥离） | [API] 创建含成员 | members 完整 | ✅ |
| 10.3 | 成员超限（>5）拒绝 | [API] | 422 | ✅ |
| 10.4 | SSE 执行（team_start/member_action/member_result/team_done） | [SSE] POST /teams/:id/run | 4 事件齐全 | ✅ |
| 10.5 | 执行历史/详情（plan/results/summary） | [API] | completed | ✅ |
| 10.6 | admin 全量视角 | [API] | 全量返回 | ✅ |
| 10.7 | 团队页 /teams（CRUD + 执行 + 历史） | [UI] | 页面正常 | ✅ |

## 11. Harness 代码智能体（AC16-20）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 11.1 | 会话 CRUD（mode/model） | [API] /harness/sessions | 19/19 | ✅ |
| 11.2 | SSE chat 全事件流（state/content/tool_call/tool_result/file_change/terminal/done） | [SSE] | 事件齐全 | ✅ |
| 11.3 | 文件树实时更新（file_write 后出现） | [SSE]+[API] | 树更新 | ✅ |
| 11.4 | 文件手动 CRUD | [API] | 200 | ✅ |
| 11.5 | 终端白名单命令（whoami）+ 历史 | [API] | exitCode 0 | ✅ |
| 11.6 | 命令 shell 元字符拦截 | [API] | 拒绝 | ✅ |
| 11.7 | file_delete → 审批 → 批准执行/拒绝保留 | [SSE] | 文件状态正确 | ✅ |
| 11.8 | 无效模型 → error 事件（多 Provider 生效） | [SSE] | error 事件 | ✅ |
| 11.9 | 多模式工具白名单差异 | [API] GET /harness/tools | chat 2 / code 7 | ✅ |
| 11.10 | 越权 404 | [API] | 404 | ✅ |
| 11.11 | Harness 工作区页 /harness | [UI] | 页面正常 | ✅ |

## 12. 后台管理端（vue-pure-admin /ai/c-end）

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 12.1 | 后端 admin 全量接口（5 模块） | [API] | 8/8 | ✅ |
| 12.2 | Harness 会话管理页（文件/命令查看/删除） | [UI] 8848 | 编译通过 | ✅ |
| 12.3 | Agent 团队管理页（成员/执行记录） | [UI] | 编译通过 | ✅ |
| 12.4 | 记忆画像管理页（五层 Tab） | [UI] | 编译通过 | ✅ |
| 12.5 | 知识库管理页（文档查看） | [UI] | 编译通过 | ✅ |
| 12.6 | 工作台/产物管理页（双 Tab） | [UI] | 编译通过 | ✅ |
| 12.7 | Agent 市场管理页（审核/下架） | [UI] | 编译通过 | ✅ |
| 12.8 | HITL 审批管理页（批准/拒绝/策略） | [UI] | 编译通过 | ✅ |
| 12.9 | UI 生成管理页（Prompt/few-shot） | [UI] | 编译通过 | ✅ |

## 13. 基础设施与修复项

| # | 用例 | 方法 | 预期 | 状态 |
|---|------|------|------|------|
| 13.1 | tRPC mock 端点（11 个 + 组合 batch） | [API] GET /trpc/lambda/* | 200 数组/对象 | ✅ |
| 13.2 | tRPC 未知端点 404（不崩页面） | [API] | 404 JSON | ✅ |
| 13.3 | 全局限流（600/min） | [API] | 不触发 429 | ✅ |
| 13.4 | SSE 端点跳过 15s 超时（SkipTimeout） | [SSE] | >15s 不断流 | ✅ |
| 13.5 | apiFetch 无 body DELETE 不发送 Content-Type | [API] | 200 | ✅ |
| 13.6 | PostgreSQL orderBy 引号（"totalTokens"） | [API] | 200 | ✅ |
| 13.7 | WAF 规避（UA header + 无 CDN URL prompt） | [API] | 200 | ✅ |
| 13.8 | deepseek-v4-pro JSON 工具协议（无原生 tool_calls） | [SSE] | 3/3 | ✅ |
| 13.9 | 数据库表完整性（25 张 cend/memory 表） | [SQL] | 字段与实体一致 | ✅ |
| 13.10 | bun.lock frozen-lockfile CI 通过 | [CI] | no changes | ✅ |

---

## 权限矩阵

| 权限码 | 普通用户 | 部门负责人 | admin |
|--------|---------|-----------|-------|
| ai:portal:harness:* | ✅ self | ✅ self | ✅ 全量 |
| ai:portal:team:* | ✅ self | ✅ self | ✅ 全量 |
| ai:portal:usage:dept:view | 仅自己 | 本部门 | 全量 |
| memory/knowledge/workspace/marketplace/hitl/generation 列表 | ✅ self | ✅ self | ✅ 全量 |
| 删除操作 | 仅自己 | 仅自己 | 全量 |

## 执行结果汇总

- 后端 c-end 回归：T5 19/19、T6 11/11、T7 19/19、T8 20/20、T9 14/14、T11 11/11、T12 19/19、admin 接口 8/8 = **121/121 全部 PASS**
- 前端编译：8 个业务页面（harness/teams/hitl/knowledge/market/dept-stats）+ 4 个 service 全部通过
- 管理端编译：8 个页面全部通过
