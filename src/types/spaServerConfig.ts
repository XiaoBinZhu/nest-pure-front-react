import type { IFeatureFlags } from '@/config/featureFlags';
import type { GlobalServerConfig } from '@/types/serverConfig';

export interface AnalyticsConfig {
  clarity?: { projectId: string };
  desktop?: { baseUrl: string; projectId: string };
  google?: { measurementId: string };
  plausible?: { domain: string; scriptBaseUrl: string };
  posthog?: { debug: boolean; host: string; key: string };
  reactScan?: { apiKey: string };
  umami?: { scriptUrl: string; websiteId: string };
  vercel?: { debug: boolean; enabled: boolean };
  xAds?: {
    eventIds?: Record<string, string | undefined>;
    pixelId: string;
    purchaseEventId?: string;
  };
}

export interface SPAClientEnv {
  marketBaseUrl?: string;
  pyodideIndexUrl?: string;
  pyodidePipIndexUrl?: string;
  s3FilePath?: string;
}

export interface AuthSPAServerConfig {
  analyticsConfig: AnalyticsConfig;
  config: GlobalServerConfig;
  enableOIDC: boolean;
  featureFlags: Partial<IFeatureFlags>;
  globalCDN?: boolean;
}

export interface SPAServerConfig {
  analyticsConfig: AnalyticsConfig;
  clientEnv: SPAClientEnv;
  config: GlobalServerConfig;
  featureFlags: Partial<IFeatureFlags>;
  /** 资源 CDN 开关：true 时 @lobehub/ui 字体/静态资源走 unpkg（npmmirror 无 CORS 头） */
  globalCDN?: boolean;
  isMobile: boolean;
}
