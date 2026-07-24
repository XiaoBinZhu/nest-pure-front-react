import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// nest-admin JWT 鉴权中间件（简化版）
// 仅检查 accessToken 存在，实际校验由 nest-admin 后端完成
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 登录页、静态资源、API 端点不需要鉴权
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_spa') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/ai')
  ) {
    return NextResponse.next();
  }

  // 检查 accessToken
  const token = request.cookies.get('accessToken')?.value;
  if (!token && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next|_spa|api|auth|ai|login).*)'],
};
