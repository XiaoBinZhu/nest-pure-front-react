// 检查 aiModels 数据文件中不允许出现中文字符（替代原 eslint no-restricted-syntax 规则）
// oxlint 不支持 no-restricted-syntax 的 selector 语法，故用此脚本兜底
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AI_MODELS_DIR = resolve(import.meta.dirname, '../packages/model-bank/src/aiModels');

const CJK_REGEX = /[\u4e00-\u9fff]/;

const collectTsFiles = (dir: string): string[] => {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
};

const main = () => {
  const files = collectTsFiles(AI_MODELS_DIR);
  const violations: { file: string; line: number; content: string }[] = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      // 跳过注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      if (CJK_REGEX.test(line)) {
        violations.push({
          file: file.replace(AI_MODELS_DIR, 'aiModels').replaceAll('\\', '/'),
          line: index + 1,
          content: line.trim().slice(0, 100),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error(`❌ 发现 ${violations.length} 处中文字符（aiModels 文件必须使用英文）:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.content}`);
    }
    process.exit(1);
  }

  console.log(`✅ aiModels 检查通过（${files.length} 个文件无中文字符）`);
};

main();
