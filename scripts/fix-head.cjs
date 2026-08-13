// 重写 topic/message 文件头部（干净 import + unwrap helper）
const fs = require('fs');

const HEAD = `import { INBOX_SESSION_ID } from '@/const/session';
import { apiFetch } from '@/services/_api';
import { type BatchTaskResult } from '@/types/service';
import {
  type ChatTopic,
  type ChatTopicMetadata,
  type CreateTopicParams,
  type QueryTopicParams,
  type RecentTopic,
  type TopicRankItem,
} from '@/types/topic';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}
`;

// 1. topic
let t = fs.readFileSync('src/services/topic/index.ts', 'utf8');
const tMarker = t.indexOf('/**');
if (tMarker < 0) {
  console.log('topic: NO MARKER, head dump:');
  console.log(t.slice(0, 400));
} else {
  t = HEAD + '\n' + t.slice(tMarker);
  fs.writeFileSync('src/services/topic/index.ts', t, 'utf8');
  console.log('topic: rewritten OK');
}

// 2. message：先看头部结构
let m = fs.readFileSync('src/services/message/index.ts', 'utf8');
console.log('=== message head (first 600) ===');
console.log(m.slice(0, 600));
