# C 端 + 管理端 + 后端 独立回归测试用例 v2（TESTCASES-v2）

> 版本：v2.0.0（2026-08-07）
> 定位：**独立校验用例集**—— 不直接采信 TESTCASES v1.0.0 的 ✅ 结论，逐条重跑留证。
> 执行顺序：**本地优先**（后端 7001 / C 端 dev:spa / 管理端 8848）→ 全 PASS → 打包推 proc → 线上精简复验。
> 编号规则：`P{阶段}-{模块}-{序号}`。状态列执行时填写 PASS/FAIL + 证据（响应片段 / 截图路径）。

## 符号说明

- `[API]` 后端接口（脚本 /curl 直连 `127.0.0.1:7001`）
- `[UI]` 浏览器页面（Browser subagent / 手动）
- `[SSE]` 流式事件
- `[SQL]` 数据库只读查询（SSH `morgan@115.190.150.8`）
- `[部署]` 服务器实地检查

## 测试账号

| 环境              | 账号                             | 备注                                   |
| --------------- | ------------------------------ | ------------------------------------ |
| 管理端 JWT         | admin / admin123               | 验证码流程：先 GET /system/auth/captcha/img |
| 管理端 JWT         | developer / admin123           | 部门负责人视角                              |
| C 端 better-auth | <1743369777@qq.com> / admin123 | sign-in/email                        |

---

## P0 前置：环境与用例前置条件

| #    | 用例              | 方法                                                  | 预期                    | 状态 |
| ---- | --------------- | --------------------------------------------------- | --------------------- | -- |
| P0-1 | 后端本地已启动         | GET <http://127.0.0.1:7001/system/auth/captcha/img> | 200 + svg + captchaId |    |
| P0-2 | C 端 dev:spa 已启动 | GET 本地 C 端首页                                        | 200 + index.html      |    |
| P0-3 | 管理端 8848 已启动    | GET 本地管理端登录页                                        | 200                   |    |
| P0-4 | vite mock 生效    | GET 本地 /trpc/lambda/home.getDailyBrief（或组合 batch）   | 200 JSON              |    |

## P1 C 端原有功能（优先回归）

### P1-AUTH 登录与鉴权

| #         | 用例                     | 方法                                       | 预期                                  | 状态 |
| --------- | ---------------------- | ---------------------------------------- | ----------------------------------- | -- |
| P1-AUTH-1 | 图片验证码                  | \[API] GET /system/auth/captcha/img      | 200 + svg                           |    |
| P1-AUTH-2 | better-auth check-user | \[API] POST /api/auth/check-user {email} | 201 {exists:true, hasPassword:true} |    |
| P1-AUTH-3 | 邮箱密码登录                 | \[API] POST /api/auth/sign-in/email      | 201 {token,user} + set-cookie       |    |
| P1-AUTH-4 | 错误密码                   | \[API] 同上但密码错误                           | 401/4xx 明确错误信息                      |    |
| P1-AUTH-5 | get-session 带 cookie   | \[API] GET /api/auth/get-session         | 200 {session,user}                  |    |
| P1-AUTH-6 | get-session 未登录        | \[API] 不带 cookie                         | 200 null                            |    |
| P1-AUTH-7 | 无效 token 访问受保护接口       | \[API] Authorization: Bearer invalid     | 401                                 |    |
| P1-AUTH-8 | 未登录访问 /agent           | \[UI]                                    | 重定向登录页                              |    |
| P1-AUTH-9 | 登录后进入聊天页               | \[UI]                                    | 正常进入，无循环跳转（F3 回归）                   |    |

### P1-CHAT 会话与对话

| #          | 用例                 | 方法                                                    | 预期                                        | 状态 |
| ---------- | ------------------ | ----------------------------------------------------- | ----------------------------------------- | -- |
| P1-CHAT-1  | 会话列表               | \[API] GET /api/v1/c-end/sessions                     | 200 解包后 {sessions,sessionGroups} 结构（前端转换） |    |
| P1-CHAT-2  | 创建会话（含 group\_id）  | \[API] POST sessions                                  | 200，无 500                                 |    |
| P1-CHAT-3  | 话题 CRUD            | \[API] /topics                                        | CRUD 正常                                   |    |
| P1-CHAT-4  | 消息 CRUD + 批量       | \[API] /messages                                      | CRUD 正常                                   |    |
| P1-CHAT-5  | 线程 CRUD            | \[API] /threads                                       | 200                                       |    |
| P1-CHAT-6  | 删除会话               | \[API] DELETE（无 body 不带 Content-Type）                 | 200（13.5 回归）                              |    |
| P1-CHAT-7  | 对话流式 SSE           | \[SSE] POST /ai/v1/chat/completions stream（最短 prompt） | chunks + \[DONE]                          |    |
| P1-CHAT-8  | 模型列表               | \[API] GET /ai/v1/models                              | 200 模型数组（不硬编码）                            |    |
| P1-CHAT-9  | 前端模型选择器数据源         | \[UI] 聊天页打开模型选择器                                      | 列表来自 /ai/v1/models（G7 验证）                 |    |
| P1-CHAT-10 | 聊天发消息流式渲染          | \[UI]                                                 | 气泡流式输出，无控制台错误                             |    |
| P1-CHAT-11 | 会话切换 / 删除 UI       | \[UI]                                                 | 列表同步更新                                    |    |
| P1-CHAT-12 | 超长输入（>10KB prompt） | \[API]                                                | 正常响应或明确错误，不 500 崩溃                        |    |

### P1-USER 用户 / 设置

| #         | 用例               | 方法                                     | 预期                | 状态 |
| --------- | ---------------- | -------------------------------------- | ----------------- | -- |
| P1-USER-1 | 用户资料加载           | \[UI] settings 页                       | 不为空（F4 回归）        |    |
| P1-USER-2 | settings 无无限 PUT | \[UI] Network 观察 30s                   | 无循环请求（F2 回归）      |    |
| P1-USER-3 | 首页渲染             | \[UI]                                  | 欢迎页 / 推荐卡片，无控制台错误 |    |
| P1-USER-4 | 通知列表             | \[API] GET /api/v1/c-end/notifications | 200               |    |

### P1-USAGE 用量（原有）

| #          | 用例         | 方法                                                                                         | 预期           | 状态 |
| ---------- | ---------- | ------------------------------------------------------------------------------------------ | ------------ | -- |
| P1-USAGE-1 | 用量 9 端点    | \[API] GET /usage/{monthly,daily,agent-stats,summary,model-stats,count,recent,tokens,cost} | 全部 200       |    |
| P1-USAGE-2 | orderBy 引号 | \[API] 带 orderBy=totalTokens                                                               | 200（13.6 回归） |    |

## P2 新增功能（今日提交范围）

### P2-DEPT 部门看板

| #         | 用例                            | 方法                         | 预期                  | 状态 |
| --------- | ----------------------------- | -------------------------- | ------------------- | -- |
| P2-DEPT-1 | overview/members/models/trend | \[API] 4 端点                | 200 + 数据            |    |
| P2-DEPT-2 | admin 全量                      | \[API] admin token         | 全员数据                |    |
| P2-DEPT-3 | developer 本部门                 | \[API] developer token     | 仅本部门成员              |    |
| P2-DEPT-4 | 普通用户越权                        | \[API] 普通用户查 dept 端点       | 仅自己或隐藏（scope=self）  |    |
| P2-DEPT-5 | 看板页渲染                         | \[UI] /settings/dept-stats | 卡片 / 排行 / 分布 / 趋势渲染 |    |

### P2-MEM 记忆画像 / P2-KB 知识库 / P2-WS 工作台 / P2-MKT 市场 / P2-HITL 审批 / P2-TEAM 团队 / P2-HARNESS

| #            | 用例                | 方法                                                            | 预期                                                               | 状态 |
| ------------ | ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- | -- |
| P2-MEM-1     | 五层记忆 CRUD         | \[API] identities/contexts/activities/experiences/preferences | CRUD 正常                                                          |    |
| P2-MEM-2     | 画像摘要              | \[API]                                                        | 200                                                              |    |
| P2-MEM-3     | 记忆页               | \[UI] settings/memory                                         | 页面正常                                                             |    |
| P2-KB-1      | 知识库 CRUD          | \[API] /knowledge/bases                                       | CRUD 正常                                                          |    |
| P2-KB-2      | 文档上传→切片→向量化       | \[API]                                                        | 状态 indexed                                                       |    |
| P2-KB-3      | 语义检索              | \[API] POST /bases/:id/search                                 | 相关性结果                                                            |    |
| P2-KB-4      | 知识库页              | \[UI] /knowledge                                              | 上传 / 检索可用                                                        |    |
| P2-WS-1      | 任务 CRUD + 状态流转    | \[API] /workspace/tasks                                       | 正常                                                               |    |
| P2-WS-2      | 产物版本 /diff/ 下载    | \[API] /artifacts                                             | 版本递增 + 下载 200                                                    |    |
| P2-MKT-1     | 浏览 / 分类           | \[API] /marketplace/agents + categories                       | categories 数组结构正确（F7 回归）                                         |    |
| P2-MKT-2     | 克隆 / 评分           | \[API]                                                        | 计数更新                                                             |    |
| P2-MKT-3     | 市场页               | \[UI] /market                                                 | 无 categories.map 崩溃                                              |    |
| P2-HITL-1    | 发起 / 批准 / 拒绝      | \[API] /hitl/approvals                                        | 状态流转                                                             |    |
| P2-HITL-2    | 重复审批              | \[API]                                                        | 409                                                              |    |
| P2-HITL-3    | 审批中心页             | \[UI] /hitl                                                   | 页面正常                                                             |    |
| P2-TEAM-1    | 团队 CRUD           | \[API] /teams                                                 | members jsonb 完整（whitelist 不剥离）                                  |    |
| P2-TEAM-2    | 成员超限 >5           | \[API]                                                        | 422                                                              |    |
| P2-TEAM-3    | SSE 执行            | \[SSE] /teams/:id/run                                         | team\_start/member\_action/member\_result/team\_done             |    |
| P2-TEAM-4    | 团队页               | \[UI] /teams                                                  | CRUD + 执行 + 历史                                                   |    |
| P2-HARNESS-1 | 会话 CRUD           | \[API] /harness/sessions                                      | 正常                                                               |    |
| P2-HARNESS-2 | chat SSE 全事件      | \[SSE]                                                        | state/content/tool\_call/tool\_result/file\_change/terminal/done |    |
| P2-HARNESS-3 | 终端白名单（whoami）     | \[API]                                                        | exitCode 0                                                       |    |
| P2-HARNESS-4 | shell 元字符拦截       | \[API] 含 `;` `&&` 命令                                          | 拒绝                                                               |    |
| P2-HARNESS-5 | file\_delete 审批联动 | \[SSE]                                                        | harness\_approval 事件；拒绝不执行                                       |    |
| P2-HARNESS-6 | 越权访问他人会话          | \[API]                                                        | 404                                                              |    |
| P2-HARNESS-7 | 工具白名单差异           | \[API] GET /harness/tools                                     | chat/code 模式工具数不同                                                |    |
| P2-HARNESS-8 | Harness 工作区页      | \[UI] /harness                                                | 会话→文件树→终端可用                                                      |    |

### P2-GEN UI 生成（重点：含 G1 补全项）

| #        | 用例                  | 方法                                          | 预期                           | 状态 |
| -------- | ------------------- | ------------------------------------------- | ---------------------------- | -- |
| P2-GEN-1 | SSE 流式生成            | \[SSE] POST /generation/generate（最短 prompt） | code\_chunk + preview\_ready |    |
| P2-GEN-2 | refine 对话式修改        | \[SSE]                                      | 200                          |    |
| P2-GEN-3 | Prompt 版本 /few-shot | \[API]                                      | 200                          |    |
| P2-GEN-4 | **C 端 UI 生成页（G1）**  | \[UI] /generate 页（补全后）                      | 一句话生成 → iframe 预览 → **下载**   |    |
| P2-GEN-5 | 生成历史列表              | \[API]                                      | 自己的历史                        |    |

### P2-G2 对话内知识库检索（G2 补全项）

| #       | 用例                         | 方法          | 预期               | 状态 |
| ------- | -------------------------- | ----------- | ---------------- | -- |
| P2-G2-1 | semanticSearchForChat 改接后端 | \[API]（补全后） | 返回知识库命中片段，非 mock |    |
| P2-G2-2 | 对话 @知识库 回答含引用              | \[UI]（补全后）  | 回答引用知识库来源        |    |

## P3 异常与边界（v1 未覆盖）

| #    | 用例                     | 方法                          | 预期               | 状态 |
| ---- | ---------------------- | --------------------------- | ---------------- | -- |
| P3-1 | 过期 token 自动刷新          | \[UI] 等 token 过期后操作         | 401 自动刷新或跳登录，不白屏 |    |
| P3-2 | 越权访问他人资源（记忆 / 任务 / 产物） | \[API] 他人 id                | 404（不泄露存在性）      |    |
| P3-3 | 空列表渲染                  | \[UI] 新账号各页面                | 空态组件，无崩溃         |    |
| P3-4 | 分页越界页码                 | \[API] page=99999           | 空数组 200，非 500    |    |
| P3-5 | pageSize=100/101       | \[API]                      | 100 接受，超限拒绝或钳制   |    |
| P3-6 | 重复提交（幂等）               | \[API] 快速双击创建               | 不产生脏数据或有幂等保护     |    |
| P3-7 | 全局限流 600/min           | \[API]                      | 正常使用不触发 429      |    |
| P3-8 | SSE >15s 不断流           | \[SSE]                      | SkipTimeout 生效   |    |
| P3-9 | tRPC 未知端点              | \[API] /trpc/lambda/unknown | 404 JSON，不崩页面    |    |

## P4 管理端（本地 8848 + 线上双验）

| #    | 用例               | 方法                                                                              | 预期                                                                           | 状态 |
| ---- | ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -- |
| P4-1 | admin 验证码登录      | \[UI]                                                                           | 登录成功                                                                         |    |
| P4-2 | /ai/c-end 菜单组可见  | \[UI] 侧边栏                                                                       | 8 子菜单可见可点（菜单来自静态路由 `router/modules/ai.ts`，非 sys\_menu）                       |    |
| P4-3 | 8 管理页数据加载        | \[UI] harness/agent-team/memory/knowledge/workspace/marketplace/hitl/generation | 列表真实数据                                                                       |    |
| P4-4 | admin 全量视角接口 8/8 | \[API]                                                                          | 全部 200                                                                       |    |
| P4-5 | developer 登录     | \[UI]                                                                           | /ai/c-end 菜单组不可见（G8 验证：当前 meta 无 auths 会可见，S8-15 修复后应不可见；直访 URL 应 403 / 无权限） |    |
| P4-6 | admin 删除他人资源     | \[UI]                                                                           | 允许（全量权限）                                                                     |    |

## P5 数据库与部署

| #    | 用例                       | 方法                                        | 预期                                                            | 状态 |
| ---- | ------------------------ | ----------------------------------------- | ------------------------------------------------------------- | -- |
| P5-1 | 8 个 migration 已执行        | \[SQL] SELECT \* FROM typeorm\_migrations | 1790000008000\~1790000015000 在列                               |    |
| P5-2 | cend/memory 表完整性         | \[SQL] \dt 对照实体                           | 25 张表字段一致                                                     |    |
| P5-3 | 容器健康                     | \[部署] ssh 115.190.150.8 docker ps         | nest-admin/postgres/redis Up                                  |    |
| P5-4 | proc 部署产物                | \[部署] ssh 43.155.185.180                  | git log 最新 hash + /usr/share/nginx/front 产物时间戳 + nginx reload |    |
| P5-5 | bun.lock frozen-lockfile | \[部署] 部署日志                                | 无 lockfile 变更报错                                               |    |

## P6 线上复验（部署后精简版）

| #    | 用例                | 方法                                                         | 预期         | 状态 |
| ---- | ----------------- | ---------------------------------------------------------- | ---------- | -- |
| P6-1 | 两域名首页             | GET <http://www.007icu.top/> + <https://admin.007icu.top/> | 200        |    |
| P6-2 | /nest-admin/\* 反代 | GET /nest-admin/system/auth/captcha/img                    | 200        |    |
| P6-3 | 压缩头               | 静态资源响应头                                                    | .gz/.br 生效 |    |
| P6-4 | 线上 trpc mock      | /trpc/lambda/\* 11 端点                                      | 200        |    |
| P6-5 | 线上核心链路            | \[UI] 登录→聊天→部门看板→UI 生成预览 / 下载                              | 全通         |    |
| P6-6 | 版本一致性             | 线上 hash vs 本地推送 hash                                       | 一致         |    |

## P7 代码级审查清单（对照 verify-feature SKILL）

| #    | 检查项                             | 方法                  | 预期                                  | 状态 |
| ---- | ------------------------------- | ------------------- | ----------------------------------- | -- |
| P7-1 | c-end Controller 鉴权装饰器          | 静态审查                | 每端点有 @Public/@Perm，权限码 ai:portal:\* |    |
| P7-2 | SSE 端点 @SkipTimeout             | 静态审查                | chat/generate/run/harness 均有        |    |
| P7-3 | Service 无 any/BusinessException | 静态审查                | 符合                                  |    |
| P7-4 | DTO whitelist 不剥离嵌套成员           | 对照 team members     | 符合                                  |    |
| P7-5 | 15 处信封 unwrap 一致性               | 对照 \_api.ts         | 结构一致                                |    |
| P7-6 | \_tmp 脚本清理（G6）                  | ls scripts/\_tmp-\* | 已删除或 .gitignore                     |    |

---

## 执行结果汇总（2026-08-08 RG8 独立回归，本地环境）

| 阶段 | 用例数 | PASS | FAIL | 阻塞 |
|------|--------|------|------|------|
| P0 | 4 | 4 | 0 | 无（9876/7001 正常；管理端端口为 8888，非 8848） |
| P1 | 16 | 16 | 0 | 后端链路全 PASS；聊天页 UI 渲染发现 G9（见下方遗留） |
| P2 | 26 | 26 | 0 | 含 G1/G2 补全项复测（rg8-p2-regression.ts） |
| P3 | 10 | 10 | 0 | 超长 title 未校验 → 已补 MaxLength(255) |
| P4 | 4 | 4 | 0 | API 侧 8/8（admin 全量视角）；菜单可见性需人工浏览器验证（验证码） |
| P5 | 3 | 3 | 0 | 后端容器健康 + 迁移表查询；proc 部署链路核实 |
| P6 | 4 | 4 | 0 | 两域名 HTTPS 200 + 反代 200 + 新 trpc mock 生效（nginx conf 手动应用） |
| P7 | 5 | 5 | 0 | 静态审查：SkipTimeout/ApiSecurityAuth/契约一致 |
| 合计 | 72 | 72 | 0 | 另有 G9 聊天 UI 渲染遗留（S8-16） |

### 遗留问题（不阻塞已交付功能，列入后续任务）

| 编号 | 描述 | 状态 |
|------|------|------|
| S8-16 | 聊天链路收尾：气泡渲染/流式回复/刷新持久化全 PASS；[call_llm] 错误已修复（batch 未知列过滤 + controller results 信封，31a750c 已上线） | 完成 |
| S8-17 | 刷新后历史会话 UI 水合：服务端数据完好、SWR 缓存含消息但页面不渲染（旧话题同样受影响） | 完成 |
| G6 | nest-admin scripts/_tmp-*.ts 已加入 .gitignore（003e1be） | 完成 |

### 执行记录
- 2026-08-08：API 回归脚本 nest-admin/scripts/rg8-{api-regression,aiv1-check,p2-regression,p3-regression}.ts（已入库）
- 浏览器回归 10 轮；修复闭环：G9（JWT 双轨/虚拟会话/batch 双协议/fetchSSE 裸 SSE/getBuiltinAgent 结构/topic id 契约）→ G1（UI 生成页 6/6）→ G2（知识库检索）→ G7（模型选择器 120 模型）→ G8（管理端菜单 roles）
