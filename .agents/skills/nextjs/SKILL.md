---
name: nextjs
description: Next.js 外壳层参考（next.config / middleware / App Router 路由壳 / 构建编排）。仅在改动 Next.js 外壳或构建配置时加载。⚠️ 本项目的 C 端主链路是「Next.js 内嵌 SPA（react-router-dom）」，RSC / Server Actions / fetch 缓存基本不适用。SPA 页面路由用 spa-routes，数据流用 data-fetching-architecture，状态用 zustand。
user-invocable: false
slug: nextjs
version: 1.1.0
homepage: https://clawic.com/skills/nextjs
metadata: {"clawdbot":{"emoji":"⚡","requires":{"bins":[]},"os":["linux","darwin","win32"]}}
---

# Next.js 外壳层参考（按需加载）

> **正文已全部下沉到 `references/`**，本文件只做导航与边界说明。

## ⚠️ 先读：本项目的特殊性

本仓库（`nest-pure-front-react`）是 **LobeHub fork**，形态是：

```
Next.js 16 外壳  +  内嵌 SPA（react-router-dom）  +  后端 = nest-admin（REST）
```

- **C 端生产产物是 Vite 构建的 SPA**（`bun run build:spa` → `public/_spa`），不是 Next.js 页面渲染
- 日常开发用 **`bun run dev:spa`**（只起 Vite，端口见终端输出），不是 `next dev`
- 因此 Next.js 的 **Server Components / Server Actions / `fetch` 自动缓存 / `revalidate` / RSC streaming** 在 C 端主链路**基本用不到**
- Next.js 在本项目只承担：App Router 外壳、middleware（`src/proxy.ts`）、`(backend)` 路由壳、构建编排

**读 `references/` 里的内容时，凡涉及 RSC / Server Actions / 服务端数据获取的部分，默认不适用于本项目的业务页面。**

## 何时加载（收窄后）

- 改 `next.config.ts`、`src/proxy.ts`（Next middleware matcher 写法）
- 改 `src/app/` 下的 App Router 外壳（`layout.tsx`、`(backend)/`、`spa/`、`spa-auth/`、`[variants]/`）
- 调 Next.js 构建（`build:next`）、分析打包（`build:analyze`）
- 排查 Next.js 与 Vite SPA 的集成问题

## 不要加载（走项目已有技能）

| 场景 | 用这个 |
| --- | --- |
| SPA 页面段、`src/routes/` 与 `src/features/` 归属、桌面端双路由配置 | `spa-routes` |
| service → store → SWR 数据流、REST `apiFetch` | `data-fetching-architecture` |
| zustand store 结构、List/Detail 形态 | `zustand`、`store-data-structures` |
| React 组件写法、antd-style、`base-ui` vs `@lobehub/ui` | `react` |
| 后端菜单/路由如何下发 | `project-overview` |

## 内容导航（按需读取）

| 主题 | 文件 | 本项目是否适用 |
| --- | --- | --- |
| 工程搭建与配置 | `references/setup.md` | ⚠️ 仅配置部分适用 |
| App Router 路由壳 | `references/routing.md` | ✅ 适用（`src/app/` 外壳） |
| middleware 与鉴权拦截 | `references/auth.md` | ⚠️ 仅 middleware matcher 适用；本项目 JWT 校验在 nest-admin 侧 |
| 缓存（RSC / revalidate） | `references/caching.md` | ❌ 基本不适用（C 端走 SWR + REST） |
| 服务端数据获取 | `references/data-fetching.md` | ❌ 基本不适用（走 `apiFetch`） |
| 部署 | `references/deployment.md` | ⚠️ 部分适用（本仓库走 nginx + 境外服务器） |
| 记忆模板 | `references/memory-template.md` | ➖ 工具性，可忽略 |

**用法**：只读你当前任务对应的那一个文件，不要一次性读完整个 `references/`。
