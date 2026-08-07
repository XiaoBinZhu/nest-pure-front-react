// 批量修复：处理带泛型的 apiFetch<Type>( 调用（保留 import 语句）
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

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  let content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过 import 行
    if (line.trim().startsWith('import ')) continue;
    // 跳过注释行
    if (line.trim().startsWith('//')) continue;
    // 替换 apiFetch< → unwrap< 和 apiFetch( → unwrap(
    if (line.includes('apiFetch')) {
      const newLine = line.replace(/apiFetch(?=<|\()/g, 'unwrap');
      if (newLine !== line) {
        lines[i] = newLine;
        changed++;
      }
    }
  }
  if (changed > 0) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log(`FIXED: ${rel} (${changed} lines)`);
  } else {
    console.log(`NO-CHANGE: ${rel}`);
  }
}
console.log('DONE');
