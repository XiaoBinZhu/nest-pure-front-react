// 批量修复：给前端 service 添加 unwrap 解包（UTF-8 安全处理）
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/code/my/nest-pure-front-react/src/services';

const FILES = [
  'session/index.ts',
  'topic/index.ts',
  'message/index.ts',
  'thread/index.ts',
  'usage.ts',
  'notification.ts',
  'deptUsage.ts',
];

const HELPER = `\n// 统一解包 { code, data } 信封（后端响应统一包装）\nasync function unwrap<T>(path: string, options?: RequestInit): Promise<T> {\n  const res = await apiFetch<{ code: number; data: T }>(path, options);\n  return 'data' in (res as any) ? (res as any).data : (res as T);\n}\n`;

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  let content = fs.readFileSync(file, 'utf8');

  // 1. 若还没有 unwrap helper，在最后一个 import 语句后插入
  if (!content.includes('async function unwrap')) {
    const importLines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].trim().startsWith('import ')) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      // 找到 import 块结束（连续 import 行）
      let endIdx = lastImportIdx;
      while (endIdx + 1 < importLines.length && importLines[endIdx + 1].trim() === '') {
        endIdx++;
      }
      importLines.splice(endIdx + 1, 0, HELPER);
      content = importLines.join('\n');
    }
  }

  // 2. 替换 apiFetch( → unwrap(（只针对 return 场景）
  content = content.replace(/return apiFetch\(/g, 'return unwrap(');

  // 3. 非 return 的 apiFetch（如 notification read 无 return）也替换
  content = content.replace(/(?<![.\w])apiFetch\(/g, 'unwrap(');

  fs.writeFileSync(file, content, 'utf8');
  console.log('FIXED:', rel);
}
console.log('DONE');
