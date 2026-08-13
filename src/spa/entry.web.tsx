import '../initialize';

// ============ Service Worker 自动修复（必须在主应用渲染前执行） ============
// 问题：旧版 sw.js 的 navigateFallback 把 /signin 等认证路由回退到主应用 index.html，
// 导致用户浏览器中已注册的旧 SW 拦截 /signin 请求，返回主应用 SPA，显示"页面不存在"。
// 修复：如果主应用 bundle 在认证路由（/signin /signup 等）下加载，说明 SW 拦截了，
// 此时注销所有 SW 并刷新页面，让请求直接到达 Nginx 返回 auth 入口。
// 注意：ES module import 是静态的会先执行，但渲染部分用 isAuthRouteHijacked 标志阻止。
const AUTH_ROUTES = ['/signin', '/signup', '/reset-password', '/verify-email', '/auth-error'];
const isAuthRouteHijacked =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  AUTH_ROUTES.some(
    (r) => window.location.pathname === r || window.location.pathname.startsWith(r + '/'),
  );

if (isAuthRouteHijacked) {
  // 主应用 bundle 不应该在认证路由下加载 → 旧 SW 拦截了
  // 注销所有 SW，然后刷新页面（这次走网络，Nginx 返回 auth 入口）
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => {
      window.location.reload();
    })
    .catch(() => {
      // 注销失败也刷新，让浏览器重新请求
      window.location.reload();
    });
}

import { RouterProvider } from 'react-router/dom';

import BootErrorBoundary from '@/components/BootErrorBoundary';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import { bootTiming } from '@/libs/bootTiming';
import { createAppRouter } from '@/utils/router';

import { startAppInitialization } from './initialize/bootstrap';
import { desktopRoutes } from './router/desktopRouter.config';
import { createSPARoot } from './runtime';

bootTiming.mark('bundle-eval');

// 如果是被 SW 拦截的认证路由，不渲染主应用（等待 SW 注销后刷新）
if (!isAuthRouteHijacked) {
  startAppInitialization();

  const debugProxyBase = '/_dangerous_local_dev_proxy';
  const basename =
    window.__DEBUG_PROXY__ || window.location.pathname.startsWith(debugProxyBase)
      ? debugProxyBase
      : undefined;

  const router = createAppRouter(desktopRoutes, { basename });

  createSPARoot(document.getElementById('root')!).render(
    <BootErrorBoundary>
      <NextThemeProvider>
        <RouterProvider router={router} />
      </NextThemeProvider>
    </BootErrorBoundary>,
  );
}
