import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const copyDirs = ['assets', 'i18n', 'vendor'] as const;
const copyRootFilePatterns = [/^favicon.*\.ico$/, /^apple-touch-icon\.png$/] as const;

interface SpaTarget {
  distDir: string;
  publicDir: string;
  /** 需一并复制的入口 html（auth SPA 纯静态部署由 nginx 直接服务） */
  rootHtml?: string;
}

const targets: SpaTarget[] = [
  { distDir: 'desktop', publicDir: 'public/_spa' },
  { distDir: 'mobile', publicDir: 'public/_spa' },
  { distDir: 'auth', publicDir: 'public/_spa-auth', rootHtml: 'index.auth.html' },
];

for (const { distDir, publicDir, rootHtml } of targets) {
  const distRoot = path.resolve(root, `dist/${distDir}`);
  const spaDir = path.resolve(root, publicDir);
  mkdirSync(spaDir, { recursive: true });

  for (const dir of copyDirs) {
    const sourceDir = path.resolve(distRoot, dir);
    const targetDir = path.resolve(spaDir, dir);

    if (!existsSync(sourceDir)) continue;

    cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`Copied dist/${distDir}/${dir} -> ${publicDir}/${dir}`);
  }

  if (rootHtml) {
    const sourceFile = path.resolve(distRoot, rootHtml);
    if (existsSync(sourceFile)) {
      cpSync(sourceFile, path.resolve(spaDir, rootHtml));
      console.log(`Copied dist/${distDir}/${rootHtml} -> ${publicDir}/${rootHtml}`);
    }
  }

  if (!existsSync(distRoot)) continue;

  for (const file of readdirSync(distRoot)) {
    const sourceFile = path.resolve(distRoot, file);

    if (!statSync(sourceFile).isFile()) continue;
    if (!copyRootFilePatterns.some((pattern) => pattern.test(file))) continue;

    cpSync(sourceFile, path.resolve(spaDir, file));
    console.log(`Copied dist/${distDir}/${file} -> ${publicDir}/${file}`);
  }
}
