import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { DevTools } from '@vitejs/devtools';
import type { PluginOption, ViteDevServer } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { viteEnvRestartKeys } from './plugins/vite/envRestartKeys';
import {
  createSharedRolldownOutput,
  sharedModulePreload,
  sharedOptimizeDeps,
  sharedRendererDefine,
  sharedRendererPlugins,
} from './plugins/vite/sharedRendererConfig';
import { vercelSkewProtection } from './plugins/vite/vercelSkewProtection';

const isMobile = process.env.MOBILE === 'true';
const isAuth = process.env.AUTH === 'true';
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

const isDev = process.env.NODE_ENV !== 'production';
const platform = isAuth ? 'auth' : isMobile ? 'mobile' : 'web';
const enableViteDevTools = process.env.LOBE_VITE_DEVTOOLS === 'true';

const resolveCommandExecutable = (cmd: string) => {
  const pathValue = process.env.PATH;
  if (!pathValue) return;

  if (process.platform === 'win32') {
    const pathExt = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
      .split(';')
      .filter(Boolean)
      .map((ext) => ext.toLowerCase());
    const candidateNames = cmd.includes('.') ? [cmd] : pathExt.map((ext) => `${cmd}${ext}`);

    for (const entry of pathValue.split(path.delimiter).filter(Boolean)) {
      for (const candidate of candidateNames) {
        const resolved = path.win32.join(entry, candidate);
        if (fs.existsSync(resolved)) return resolved;
      }
    }

    return;
  }

  for (const entry of pathValue.split(path.delimiter).filter(Boolean)) {
    const resolved = path.join(entry, cmd);
    if (fs.existsSync(resolved)) return resolved;
  }
};

const openExternalBrowser = async (
  url: string,
  logger?: { warn: (msg: string) => void },
): Promise<boolean> => {
  const command =
    process.platform === 'win32'
      ? {
          args: ['url.dll,FileProtocolHandler', url],
          cmd: 'rundll32',
        }
      : {
          args: [url],
          cmd: process.platform === 'darwin' ? 'open' : 'xdg-open',
        };

  const executable = resolveCommandExecutable(command.cmd);
  if (!executable) {
    logger?.warn(`openExternalBrowser: ${command.cmd} not found on PATH`);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(executable, command.args, {
        detached: true,
        stdio: 'ignore',
      });
      let settled = false;
      const done = (ok: boolean, reason?: string) => {
        if (settled) return;
        settled = true;
        if (!ok && reason) logger?.warn(`openExternalBrowser: ${reason}`);
        resolve(ok);
      };
      child.once('error', (err) => done(false, (err as Error).message));
      child.once('spawn', () => {
        child.unref();
        done(true);
      });
      setTimeout(() => done(true), 200);
    } catch (e) {
      logger?.warn(`openExternalBrowser: ${(e as Error).message}`);
      resolve(false);
    }
  });
};

export default defineConfig({
  base: isDev ? '/' : process.env.VITE_CDN_BASE || (isAuth ? '/_spa-auth/' : '/_spa/'),
  build: {
    // 小资源（<4KB）内联为 base64，减少首屏请求数
    assetsInlineLimit: 4096,
    modulePreload: sharedModulePreload,
    outDir: isAuth ? 'dist/auth' : isMobile ? 'dist/mobile' : 'dist/desktop',
    reportCompressedSize: false,
    // 项目已通过 importmap/cascade-layers 检测 + not-compatible.html 兜底，可安全使用现代语法
    target: 'es2022',
    rolldownOptions: {
      ...(enableViteDevTools && { devtools: {} }),
      input: path.resolve(
        __dirname,
        isAuth ? 'index.auth.html' : isMobile ? 'index.mobile.html' : 'index.html',
      ),
      output: createSharedRolldownOutput({ strictExecutionOrder: true }),
    },
  },
  define: sharedRendererDefine({ isMobile, isElectron: false }),
  experimental: {
    bundledDev: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: sharedOptimizeDeps,
  plugins: [
    vercelSkewProtection(),
    viteEnvRestartKeys(['APP_URL']),
    enableViteDevTools &&
      DevTools({
        build: {
          withApp: true,
        },
      }),
    ...sharedRendererPlugins({ platform }),

    isDev && {
      name: 'lobe-dev-proxy-print',
      configureServer(server: ViteDevServer) {
        const ONLINE_HOST = 'https://app.lobehub.com';
        const c = {
          green: (s: string) => `\x1B[32m${s}\x1B[0m`,
          bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
          cyan: (s: string) => `\x1B[36m${s}\x1B[0m`,
        };
        const { info } = server.config.logger;
        const isBundledDev = (server.config.experimental as any)?.bundledDev;

        const getProxyUrl = () => {
          const urls = server.resolvedUrls;
          if (!urls?.local?.[0]) return;
          const localHost = urls.local[0].replace(/\/$/, '');
          return `${ONLINE_HOST}/_dangerous_local_dev_proxy?debug-host=${encodeURIComponent(localHost)}`;
        };
        const printProxyUrl = () => {
          const proxyUrl = getProxyUrl();
          if (!proxyUrl) return;
          const colorUrl = (url: string) =>
            c.cyan(url.replace(/:(\d+)\//, (_, port) => `:${c.bold(port)}/`));
          info(`  ${c.green('➜')}  ${c.bold('Debug Proxy')}: ${colorUrl(proxyUrl)}`);
        };
        const openProxyUrl = async () => {
          const proxyUrl = getProxyUrl();
          if (!proxyUrl) return;

          const opened = await openExternalBrowser(proxyUrl, server.config.logger);

          if (!opened) {
            server.config.logger.warn(`Failed to open Debug Proxy automatically: ${proxyUrl}`);
          }
        };

        if (isBundledDev) {
          // Disable Vite's built-in browser opening. We always open the debug
          // proxy URL after the first bundled compile finishes instead.
          server.openBrowser = () => {};

          const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
          let spinnerIdx = 0;
          let spinnerTimer: NodeJS.Timeout | null = null;
          const formatElapsed = (ms: number) =>
            ms < 1000 ? `${Math.max(0, Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;

          const startSpinner = (msg: string, since: number) => {
            spinnerIdx = 0;
            spinnerTimer = setInterval(() => {
              const elapsed = formatElapsed(Date.now() - since);
              process.stdout.write(`\r${c.cyan(spinnerFrames[spinnerIdx])} ${msg} (${elapsed})`);
              spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
            }, 80);
          };
          const stopSpinner = (clearLine = true) => {
            if (spinnerTimer) {
              clearInterval(spinnerTimer);
              spinnerTimer = null;
            }
            if (clearLine) process.stdout.write('\r\x1B[K');
          };

          server.httpServer?.once('listening', () => {
            void (async () => {
              const rootUrl =
                server.resolvedUrls?.local?.[0] ||
                `http://localhost:${String(server.config.server.port || 9876)}/`;
              const startedAt = Date.now();
              const timeout = 180_000;
              const interval = 400;
              let ready = false;

              startSpinner('Vite: compile and bundle...', startedAt);

              try {
                while (Date.now() - startedAt < timeout) {
                  try {
                    const res = await fetch(rootUrl, { signal: AbortSignal.timeout(5_000) });
                    const text = await res.text();
                    if (text.includes('Bundling in progress')) {
                      await new Promise((r) => setTimeout(r, interval));
                      continue;
                    }
                    ready = true;
                    stopSpinner();
                    info(
                      `  ${c.green('✅')}  Vite: compile and bundle finished (${res.status}) ${rootUrl}`,
                    );
                    void openProxyUrl();
                    break;
                  } catch {
                    await new Promise((r) => setTimeout(r, interval));
                  }
                }
              } catch (e) {
                stopSpinner();
                console.warn('⚠️ Vite: could not wait for compile and bundle:', e);
              }

              if (!ready && spinnerTimer) {
                stopSpinner();
                console.warn(`⚠️ Vite: compile and bundle timed out after ${timeout / 1000}s`);
              }

              printProxyUrl();
            })();
          });
        }

        return () => {
          server.printUrls = () => {
            if (isBundledDev) return;
            printProxyUrl();
          };
        };
      },
    },

    // 纯 SPA 模式下 mock tRPC 端点（与生产 Nginx c-end.conf 保持一致）
    // LobeHub 前端在纯 SPA 模式下无 Next.js 后端，/trpc 请求需返回 mock JSON
    // 避免 TRPCClientError: Unexpected end of JSON input
    {
      name: 'trpc-spa-mock',
      configureServer(server: ViteDevServer) {
        const sendJson = (res: any, data: unknown, status = 200, batch = false) => {
          const body = batch
            ? `[{"result":{"data":{"json":${JSON.stringify(data)}}}}]`
            : `{"result":{"data":{"json":${JSON.stringify(data)}}}}`;
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(body);
        };

        const sendError = (res: any) => {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(
            '{"error":{"json":{"message":"tRPC not available in SPA mode","code":-32001,"data":{"code":"NOT_FOUND","httpStatus":404}}}}',
          );
        };

        server.middlewares.use('/trpc', (req: any, res: any) => {
          const url = req.url || '';
          // 提取 trpc procedure 名（去掉 query string）
          const procedure = url.split('?')[0].replace(/^\//, '');
          const isBatch = url.includes('batch=1');
          // 组合 batch（逗号分隔多个 procedure）逐个 mock
          // 注意：组合后续项可能不带 lambda/ 前缀（如 agent.getBuiltinAgent,agent.getBuiltinAgent）
          const procedures = procedure
            .split(',')
            .map((p: string) => (p.startsWith('lambda/') ? p : `lambda/${p}`));

          // G7/G9：aiModel.list 动态透传后端真实模型目录（/ai/v1/models 已公开，避免 mock 硬编码）
          if (procedures.length === 1 && procedures[0] === 'lambda/aiModel.list') {
            void (async () => {
              try {
                const upstream = await fetch('http://127.0.0.1:7001/v1/models');
                const json = (await upstream.json()) as { data?: { id: string }[] };
                const list = (json.data || []).map((m) => ({
                  id: m.id,
                  displayName: m.id,
                  enabled: true,
                  isCustom: false,
                }));
                sendJson(res, { data: list }, 200, isBatch);
              } catch {
                sendJson(res, { data: [] }, 200, isBatch);
              }
            })();
            return;
          }

          // G7/G9：provider 运行时状态透传真实模型（AiProviderRuntimeState 结构），驱动模型选择器/能力判定
          if (
            procedures.length === 1 &&
            procedures[0] === 'lambda/aiProvider.getAiProviderRuntimeState'
          ) {
            void (async () => {
              try {
                const upstream = await fetch('http://127.0.0.1:7001/v1/models');
                const json = (await upstream.json()) as { data?: { id: string }[] };
                const ids = (json.data || []).map((m) => m.id);
                const enabledAiModels = ids.map((id) => ({
                  providerId: 'openai',
                  id,
                  type: 'chat',
                  displayName: id,
                  enabled: true,
                  isCustom: false,
                  functionCall: false,
                  vision: false,
                }));
                sendJson(
                  res,
                  {
                    enabledAiModels,
                    enabledAiProviders: [],
                    enabledChatAiProviders: [
                      { id: 'openai', name: 'OpenAI', enabled: true, isSystem: true },
                    ],
                    enabledImageAiProviders: [],
                    enabledVideoAiProviders: [],
                    runtimeConfig: {},
                  },
                  200,
                  isBatch,
                );
              } catch {
                sendJson(
                  res,
                  {
                    enabledAiModels: [],
                    enabledAiProviders: [],
                    enabledChatAiProviders: [],
                    enabledImageAiProviders: [],
                    enabledVideoAiProviders: [],
                    runtimeConfig: {},
                  },
                  200,
                  isBatch,
                );
              }
            })();
            return;
          }

          const mocks: Record<string, unknown> = {
            'lambda/config.getGlobalConfig': {
              serverConfig: { telemetry: { langfuse: false } },
              serverFeatureFlags: {},
              billboard: null,
            },
            'lambda/config.getDefaultAgentConfig': {
              model: 'gpt-4o-mini',
              provider: 'openai',
              params: {},
            },
            'lambda/user.getUserState': null,
            // getBuiltinAgent 需顶层含 id（builtin action 检查 data?.id，G9 修复）；原 {agent:{agentId}} 包裹导致发送按钮禁用
            'lambda/agent.getBuiltinAgent': {
              id: 'inbox',
              agentId: 'inbox',
              slug: 'inbox',
              title: '收件箱',
              description: '默认助手',
              model: 'deepseek-ai/deepseek-v4-pro',
              provider: 'openai',
              settings: {},
              createAt: 0,
            },
            // connector.list 返回 ConnectorWithTools[]（数组），不能包对象否则 connectors.filter 崩溃
            'lambda/connector.list': [],
            'lambda/connector.listAgentBound': [],
            'lambda/connector.listByAgent': [],
            // SidebarAgentListResponse: { groups, pinned, privateGroups?, privateUngrouped?, ungrouped }
            'lambda/home.getSidebarAgentList': {
              groups: [],
              pinned: [],
              privateGroups: [],
              privateUngrouped: [],
              ungrouped: [],
            },
            // recent.getAll 返回 RecentItem[]（数组），不能包对象否则 recents.slice 崩溃
            'lambda/recent.getAll': [],
            'lambda/aiModel.list': { data: [] },
            'lambda/agent.list': { agents: [] },
            // 聊天页初始化必需（G9 修复）：inbox 助手配置 + 列表类空数组，缺失会报“助理配置加载失败”
            'lambda/agent.getAgentConfigById': {
              agentId: 'inbox',
              slug: 'inbox',
              title: '收件箱',
              description: '默认助手',
              model: 'deepseek-ai/deepseek-v4-pro',
              provider: 'openai',
              settings: {},
              createAt: 0,
            },
            'lambda/agent.getAgentConfig': {
              agentId: 'inbox',
              model: 'deepseek-ai/deepseek-v4-pro',
              provider: 'openai',
              settings: {},
            },
            'lambda/agent.queryAgents': [],
            'lambda/agent.countAgents': 0,
            'lambda/agentSkills.list': [],
            'lambda/agentDocument.listDocuments': [],
            'lambda/agentGroup.list': { groups: [] },
            'lambda/topic.list': { items: [], total: 0 },
            // 首页任务推荐（返回 { data, success }）
            'lambda/taskTemplate.listDailyRecommend': { data: [], success: true },
            'lambda/taskTemplate.dismiss': { success: true },
            // 日报/待办/设备（组合 batch 中出现的其他端点）
            // brief.listUnresolved 前端取 result.data（数组）
            'lambda/home.getDailyBrief': null,
            'lambda/brief.listUnresolved': { data: [] },
            'lambda/brief.markRead': { success: true },
            'lambda/device.listDevices': [],
            // 首页“上新/最近/任务”区块组合中出现的端点（S8-17 补全，避免整批 404）
            'lambda/task.groupList': { groups: [] },
            'lambda/notebook.listDocuments': [],
            'lambda/plugin.getPlugins': [],
            'lambda/acceptance.getBySubject': null,
            'lambda/agentDocument.getContextDocuments': [],
          };

          // 组合请求：逐过程返回（已知→mock，未知→null 降级），避免整批 404 导致首页区块加载失败（S8-17 修复）
          // 单过程未知仍 404（前端可容忍，且暴露真实缺口）
          if (procedures.length === 1) {
            if (!(procedures[0] in mocks)) {
              sendError(res);
              return;
            }
            const json = `{"result":{"data":{"json":${JSON.stringify(mocks[procedures[0]])}}}}`;
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.setHeader('cache-control', 'no-store');
            res.end(json);
            return;
          }

          // 多过程组合（batch=1 或逗号分隔）：未知过程返回 json:null，保持数组长度，前端逐项取数
          const json = isBatch
            ? `[${procedures.map((p) => `{"result":{"data":{"json":${JSON.stringify(p in mocks ? mocks[p] : null)}}}}`).join(',')}]`
            : `{"result":{"data":{"json":${JSON.stringify(procedures[0] in mocks ? mocks[procedures[0]] : null)}}}}`;
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(json);
          return;
        });
      },
    },

    !isAuth &&
      VitePWA({
        injectRegister: null,
        manifest: false, // 使用 public/manifest.webmanifest 静态文件（纯静态部署直接可用）
        registerType: 'prompt',
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // SPA 导航请求回退到 index.html，保证离线/直接访问子路由不 404
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/trpc\//,
            /^\/auth\//,
            /^\/system\//,
            /^\/ai\//,
            /\.(?:png|jpg|jpeg|svg|gif|webp|ico|avif|woff2?)$/,
          ],
          runtimeCaching: [
            {
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-stylesheets' },
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            },
            {
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 365, maxEntries: 30 },
              },
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            },
            {
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'image-assets',
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 100 },
              },
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|avif)$/i,
            },
            {
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxAgeSeconds: 60 * 5, maxEntries: 50 },
              },
              urlPattern: /\/(api|trpc)\/.*/i,
            },
          ],
        },
      }),
  ].filter(Boolean) as PluginOption[],

  server: {
    cors: true,
    host: true,
    port: isMobile
      ? Number(process.env.MOBILE_SPA_PORT) || 3012
      : isAuth
        ? Number(process.env.AUTH_SPA_PORT) || 3013
        : Number(process.env.SPA_PORT) || 9876,
    // The dev orchestrator (scripts/devStartupSequence.mts) pre-resolves a free
    // port and injects it via env; never silently drift to another port, since
    // downstream consumers locate this server through that env contract.
    strictPort: true,
    proxy: {
      // 对接 nest-admin 后端（开发期代理，生产由 Nginx 转发）
      '/api': { target: 'http://127.0.0.1:7001', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:7001', changeOrigin: true },
      '/v1': { target: 'http://127.0.0.1:7001', changeOrigin: true, ws: false },
      // C 端业务前缀 /app/front-hub（项目前缀规范，替代原 /api/v1/c-end）
      '/app': { target: 'http://127.0.0.1:7001', changeOrigin: true },
      // token 刷新等系统接口（_api.ts 401 自动刷新调用 /system/auth/refresh-token）
      '/system': { target: 'http://127.0.0.1:7001', changeOrigin: true },
      '/oidc': `http://localhost:${process.env.PORT || 3010}`,
      // /trpc 在纯 SPA 模式下无 Next.js 后端，由下方 trpc-mock 插件返回 mock JSON
      '/webapi': `http://localhost:${process.env.PORT || 3010}`,
    },
    warmup: {
      clientFiles: [
        // src/ business code
        './src/initialize.ts',
        './src/spa/**/*.tsx',
        './src/business/**/*.{ts,tsx}',
        './src/components/**/*.{ts,tsx}',
        './src/const/**/*.ts',
        './src/features/**/*.{ts,tsx}',
        './src/helpers/**/*.ts',
        './src/hooks/**/*.{ts,tsx}',
        './src/layout/**/*.{ts,tsx}',
        './src/libs/**/*.{ts,tsx}',
        './src/routes/**/*.{ts,tsx}',
        './src/services/**/*.ts',
        './src/store/**/*.{ts,tsx}',
        './src/styles/**/*.ts',
        './src/utils/**/*.{ts,tsx}',

        // monorepo packages
        './packages/types/src/**/*.ts',
        './packages/const/src/**/*.ts',
        './packages/utils/src/**/*.ts',
        './packages/context-engine/src/**/*.ts',
        './packages/prompts/src/**/*.ts',
        './packages/model-bank/src/**/*.ts',
        './packages/model-runtime/src/**/*.ts',
        './packages/agent-runtime/src/**/*.ts',
        './packages/conversation-flow/src/**/*.ts',
        './packages/electron-client-ipc/src/**/*.ts',
        './packages/builtin-agents/src/**/*.ts',
        './packages/builtin-skills/src/**/*.ts',
        './packages/builtin-tool-*/src/**/*.ts',
        './packages/builtin-tools/src/**/*.ts',
        './packages/business/*/src/**/*.ts',
        './packages/business-server/src/**/*.ts',
        './packages/config/src/**/*.ts',
        './packages/edge-config/src/**/*.ts',
        './packages/editor-runtime/src/**/*.ts',
        './packages/env/src/**/*.ts',
        './packages/trpc/src/**/*.{ts,tsx}',
        './packages/app-config/src/**/*.ts',
        './packages/locales/src/**/*.ts',
        './packages/fetch-sse/src/**/*.ts',
        './packages/desktop-bridge/src/**/*.ts',
        './packages/python-interpreter/src/**/*.ts',
        './packages/agent-manager-runtime/src/**/*.ts',
      ],
    },
    watch: {
      ignored: ['**/e2e/reports/**', '**/e2e/screenshots/**'],
    },
  },
});
