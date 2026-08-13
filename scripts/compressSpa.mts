// 生产构建产物预压缩脚本（零依赖，Node 内置 zlib）
// 为 dist/desktop、dist/mobile、dist/auth 下所有静态资源生成 .br / .gz 旁路文件，
// nginx 配置 gzip_static on; brotli_static on; 后可直接发送预压缩产物，降低首屏传输体积。
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');

// 需要压缩的目标目录（Vite 构建产物）
const TARGET_DIRS = ['dist/desktop', 'dist/mobile', 'dist/auth'];

// 跳过已经很小、压缩收益低的文件
const MIN_SIZE = 1024; // 1KB 以下不压缩
// 跳过二进制/已压缩格式
const SKIP_EXTENSIONS = new Set([
  '.br',
  '.gz',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.mp4',
  '.webm',
  '.woff',
  '.woff2',
  '.ttf',
  '.zip',
]);

const BROTLI_LEVEL = 11;
const GZIP_LEVEL = 9;

interface CompressionStats {
  dir: string;
  files: number;
  brotliBytes: number;
  gzipBytes: number;
  skipped: number;
}

const collectFiles = (dir: string): string[] => {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
};

const compressFile = (filePath: string): { brotliBytes: number; gzipBytes: number } => {
  const content = readFileSyncSafe(filePath);
  if (!content) return { brotliBytes: 0, gzipBytes: 0 };

  const brPath = `${filePath}.br`;
  const gzPath = `${filePath}.gz`;

  // 已存在对应压缩文件则跳过（避免重复压缩 / 覆盖手工产物）
  if (existsSync(brPath) && existsSync(gzPath)) {
    return { brotliBytes: 0, gzipBytes: 0 };
  }

  const brotliBytes = existsSync(brPath)
    ? 0
    : (writeFileSync(brPath, brotliCompressSync(content, { params: { [1]: BROTLI_LEVEL } })),
      statSync(brPath).size);
  const gzipBytes = existsSync(gzPath)
    ? 0
    : (writeFileSync(gzPath, gzipSync(content, { level: GZIP_LEVEL })), statSync(gzPath).size);

  return { brotliBytes, gzipBytes };
};

const readFileSyncSafe = (filePath: string): Buffer | null => {
  try {
    return statSync(filePath).size < MIN_SIZE ? null : readFileSync(filePath);
  } catch {
    return null;
  }
};

const main = () => {
  const stats: CompressionStats[] = [];
  let totalBrotli = 0;
  let totalGzip = 0;
  let totalFiles = 0;

  for (const dir of TARGET_DIRS) {
    const absDir = resolve(root, dir);
    if (!existsSync(absDir)) {
      console.log(`⏭️  ${dir} 不存在，跳过`);
      continue;
    }

    const files = collectFiles(absDir).filter((file) => {
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      try {
        return statSync(file).size >= MIN_SIZE;
      } catch {
        return false;
      }
    });

    const dirStats: CompressionStats = {
      dir,
      files: 0,
      brotliBytes: 0,
      gzipBytes: 0,
      skipped: files.length,
    };

    for (const file of files) {
      const result = compressFile(file);
      if (result.brotliBytes || result.gzipBytes) {
        dirStats.files += 1;
        dirStats.brotliBytes += result.brotliBytes;
        dirStats.gzipBytes += result.gzipBytes;
      }
    }

    if (dirStats.files > 0) {
      totalBrotli += dirStats.brotliBytes;
      totalGzip += dirStats.gzipBytes;
      totalFiles += dirStats.files;
      console.log(
        `✅ ${dir}: 压缩 ${dirStats.files} 个文件 (brotli ${(dirStats.brotliBytes / 1024).toFixed(0)}KB, gzip ${(dirStats.gzipBytes / 1024).toFixed(0)}KB)`,
      );
    } else {
      console.log(`⏭️  ${dir}: 无新文件需要压缩`);
    }
    stats.push(dirStats);
  }

  if (totalFiles === 0) {
    console.log('ℹ️  没有生成任何压缩文件（产物为空或已全部压缩过）');
    return;
  }

  console.log(
    `🎉 预压缩完成: ${totalFiles} 个文件, brotli 共 ${(totalBrotli / 1024 / 1024).toFixed(1)}MB, gzip 共 ${(totalGzip / 1024 / 1024).toFixed(1)}MB`,
  );
};

main();
