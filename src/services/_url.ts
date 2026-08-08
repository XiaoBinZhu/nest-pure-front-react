export const API_ENDPOINTS = {
  oauth: '/api/auth',

  // trace
  trace: '/webapi/trace',

  // chat
  // G9 修复：纯 SPA 模式下无 Next.js /webapi 后端，聊天 SSE 直连 nest-admin 网关
  //（JWT 双轨鉴权，22-spec v1.8.0；provider 参数保留仅用于兼容签名）
  chat: (_provider: string) => '/ai/v1/chat/completions',

  // models
  models: (provider: string) => `/webapi/models/${provider}`,
  modelPull: (provider: string) => `/webapi/models/${provider}/pull`,
  pricing: (provider: string) => `/webapi/models/${provider}/pricing`,

  // TTS
  tts: (provider: string) => `/webapi/tts/${provider}`,
};

export const MARKET_OIDC_ENDPOINTS = {
  // NOTE: `auth` is used to open a page in the system browser (desktop) / popup (web),
  // so it must always be an HTTP(S) path joined with `NEXT_PUBLIC_MARKET_BASE_URL`.
  // It MUST NOT be wrapped by the Electron backend protocol.
  auth: '/lobehub-oidc/auth',
  token: '/market/oidc/token',
  userinfo: '/market/oidc/userinfo',
  handoff: '/market/oidc/handoff',
  // Same as `auth`: used as `redirect_uri` (must be a real web URL under market base).
  desktopCallback: '/lobehub-oidc/callback/desktop',
};
