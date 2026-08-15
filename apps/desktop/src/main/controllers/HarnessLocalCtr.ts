import { randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  type HarnessExecToolRequest,
  type HarnessExecToolResult,
  type HarnessWorkspaceEntry,
  type HarnessWorkspacePermission,
} from '@lobechat/electron-client-ipc';
import { app, dialog } from 'electron';
import { execa } from 'execa';

import { createLogger } from '@/utils/logger';

import { ControllerModule, IpcMethod } from './index';

const logger = createLogger('controllers:HarnessLocalCtr');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'coverage']);
const MAX_TREE_DEPTH = 8;
const MAX_TREE_NODES = 5000;
const MAX_READ_BYTES = 1024 * 1024;
const MAX_SEARCH_RESULTS = 200;
const MAX_CMD_OUTPUT = 4000;
const MAX_CMD_HEAD = 2000;
const CMD_TIMEOUT = 60_000;

// 镜像 nest-admin harness.service 的 SAFE_COMMANDS，Windows 追加 dir/type
const SAFE_COMMANDS = new Set([
  'ls',
  'cat',
  'pwd',
  'date',
  'whoami',
  'echo',
  'head',
  'tail',
  'wc',
  'grep',
]);
const WINDOWS_SAFE_COMMANDS = new Set(['dir', 'type']);

const READ_ONLY_TOOLS = new Set(['file_list', 'file_read', 'file_search']);
const ALL_TOOLS = new Set([
  'file_list',
  'file_read',
  'file_search',
  'file_write',
  'file_revert',
  'file_delete',
  'terminal_run',
]);

interface HarnessTreeNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: HarnessTreeNode[];
}

const truncateOutput = (text: string): { text: string; truncated: boolean } => {
  if (text.length <= MAX_CMD_OUTPUT) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_CMD_HEAD) + '\n...[truncated]...\n' + text.slice(-MAX_CMD_HEAD),
    truncated: true,
  };
};

const toPosix = (p: string) => p.split(path.sep).join('/');

// POSIX 相对路径（模型给的，可能以 / 开头）→ 工作区根下的绝对路径
const resolveWorkspacePath = (root: string, relPath: string): string => {
  const segments = String(relPath).split('/').filter(Boolean);
  return path.resolve(root, ...segments);
};

const isWithinRoot = (root: string, target: string): boolean =>
  target === root || target.startsWith(root + path.sep);

// 校验 resolve 结果在 root 内 + realpath 防 symlink/.. 逃逸。
// 目标不存在时（file_write 新建）逐级向上取最近已存在祖先做 realpath 校验。
const assertSafePath = async (root: string, target: string): Promise<string> => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!isWithinRoot(resolvedRoot, resolvedTarget)) {
    throw new Error('路径逃逸工作区：' + toPosix(resolvedTarget));
  }
  let rootReal: string;
  try {
    rootReal = path.resolve(await realpath(resolvedRoot));
  } catch {
    rootReal = resolvedRoot;
  }
  let cursor = resolvedTarget;
  while (true) {
    try {
      const real = path.resolve(await realpath(cursor));
      if (!isWithinRoot(rootReal, real)) {
        throw new Error('路径逃逸工作区（symlink）：' + toPosix(cursor));
      }
      return resolvedTarget;
    } catch {
      const parent = path.dirname(cursor);
      if (parent === cursor) return resolvedTarget;
      cursor = parent;
    }
  }
};

// 简单 glob → 正则（支持 **、*、?）
const globToRegExp = (glob: string): RegExp => {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+()|[]{}^$'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
};

export default class HarnessLocalCtr extends ControllerModule {
  static override readonly groupName = 'harnessLocal';

  private registryPath(): string {
    return path.join(app.getPath('userData'), 'harness-workspaces.json');
  }

  private async readRegistry(): Promise<HarnessWorkspaceEntry[]> {
    try {
      const raw = await readFile(this.registryPath(), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeRegistry(list: HarnessWorkspaceEntry[]): Promise<void> {
    await mkdir(path.dirname(this.registryPath()), { recursive: true });
    await writeFile(this.registryPath(), JSON.stringify(list, null, 2), 'utf8');
  }

  @IpcMethod()
  async chooseWorkspace(): Promise<HarnessWorkspaceEntry | null> {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;

    const root = path.resolve(result.filePaths[0]);
    const list = await this.readRegistry();
    const existing = list.find((w) => path.resolve(w.root) === root);
    if (existing) return existing;

    const entry: HarnessWorkspaceEntry = {
      id: randomUUID(),
      name: path.basename(root),
      root,
      permission: 'workspace-write',
      createdAt: Date.now(),
    };
    list.push(entry);
    await this.writeRegistry(list);
    logger.debug('registered harness workspace', entry);
    return entry;
  }

  @IpcMethod()
  async listWorkspaces(): Promise<HarnessWorkspaceEntry[]> {
    return this.readRegistry();
  }

  @IpcMethod()
  async removeWorkspace(id: string): Promise<void> {
    const list = await this.readRegistry();
    await this.writeRegistry(list.filter((w) => w.id !== id));
  }

  @IpcMethod()
  async setWorkspacePermission(req: {
    id: string;
    permission: HarnessWorkspacePermission;
  }): Promise<void> {
    const list = await this.readRegistry();
    const next = list.map((w) => (w.id === req.id ? { ...w, permission: req.permission } : w));
    await this.writeRegistry(next);
  }

  @IpcMethod()
  async execTool(req: HarnessExecToolRequest): Promise<HarnessExecToolResult> {
    try {
      const workspace = (await this.readRegistry()).find((w) => w.id === req.workspaceId);
      if (!workspace) return { success: false, error: '工作区不存在' };
      if (!ALL_TOOLS.has(req.tool)) return { success: false, error: '未知工具：' + req.tool };

      if (workspace.permission === 'read-only' && !READ_ONLY_TOOLS.has(req.tool)) {
        return { success: false, error: '只读工作区禁止执行 ' + req.tool };
      }

      return await this.dispatch(workspace, req);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async dispatch(
    workspace: HarnessWorkspaceEntry,
    req: HarnessExecToolRequest,
  ): Promise<HarnessExecToolResult> {
    switch (req.tool) {
      case 'file_list':
        return this.fileList(workspace.root, req.args);
      case 'file_read':
        return this.fileRead(workspace.root, req.args);
      case 'file_search':
        return this.fileSearch(workspace.root, req.args);
      case 'file_write':
        return this.fileWrite(workspace, req.args);
      case 'file_revert':
        return this.fileRevert(workspace, req.args);
      case 'file_delete':
        return this.fileDelete(workspace.root, req.args);
      case 'terminal_run':
        return this.terminalRun(workspace.root, req.args, req.approved);
      default:
        return { success: false, error: '未知工具：' + req.tool };
    }
  }

  // ============ file_list ============
  private async fileList(root: string, args: Record<string, any>): Promise<HarnessExecToolResult> {
    const startDir = args.path
      ? await assertSafePath(root, resolveWorkspacePath(root, args.path))
      : root;
    const counter = { count: 0, truncated: false };
    const tree = await this.buildTree(root, startDir, 0, counter);
    return {
      success: true,
      data: { tree, truncated: counter.truncated },
    };
  }

  private async buildTree(
    root: string,
    dirAbs: string,
    depth: number,
    counter: { count: number; truncated: boolean },
  ): Promise<HarnessTreeNode[]> {
    if (depth > MAX_TREE_DEPTH || counter.truncated) return [];

    let entries;
    try {
      entries = await readdir(dirAbs, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: HarnessTreeNode[] = [];
    for (const entry of entries) {
      if (counter.count >= MAX_TREE_NODES) {
        counter.truncated = true;
        break;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        counter.count += 1;
        const abs = path.join(dirAbs, entry.name);
        nodes.push({
          path: toPosix(path.relative(root, abs)),
          name: entry.name,
          type: 'dir',
          children: await this.buildTree(root, abs, depth + 1, counter),
        });
      } else if (entry.isFile()) {
        counter.count += 1;
        nodes.push({
          path: toPosix(path.relative(root, path.join(dirAbs, entry.name))),
          name: entry.name,
          type: 'file',
        });
      }
    }
    return nodes;
  }

  // ============ file_read ============
  private async fileRead(root: string, args: Record<string, any>): Promise<HarnessExecToolResult> {
    const relPath = String(args.path ?? '');
    const absPath = await assertSafePath(root, resolveWorkspacePath(root, relPath));
    const buf = await readFile(absPath);
    if (buf.includes(0)) {
      return { success: false, error: '二进制文件不可读' };
    }
    const truncated = buf.length > MAX_READ_BYTES;
    let content = buf.subarray(0, MAX_READ_BYTES).toString('utf8');
    const totalLines = content.split('\n').length;

    const offset = Number(args.offset);
    const limit = Number(args.limit);
    if (Number.isFinite(offset) || Number.isFinite(limit)) {
      const allLines = content.split('\n');
      const start = Number.isFinite(offset) ? Math.max(0, offset - 1) : 0;
      const end = Number.isFinite(limit) ? start + limit : undefined;
      content = allLines.slice(start, end).join('\n');
    }

    return {
      success: true,
      data: {
        path: relPath,
        content,
        truncated,
        bytes: buf.length,
        lines: totalLines,
      },
    };
  }

  // ============ file_write（覆盖前自动备份到 userData/harness-backups，供 file_revert 回滚） ============
  private async fileWrite(
    workspace: HarnessWorkspaceEntry,
    args: Record<string, any>,
  ): Promise<HarnessExecToolResult> {
    if (args.content === undefined || args.content === null) {
      return { success: false, error: '缺少 content' };
    }
    const root = workspace.root;
    const relPath = String(args.path ?? '');
    const absPath = await assertSafePath(root, resolveWorkspacePath(root, relPath));
    await mkdir(path.dirname(absPath), { recursive: true });
    await this.backupBeforeWrite(workspace, absPath);

    const content = String(args.content);
    if (args.oldString != null) {
      const oldString = String(args.oldString);
      const existing = await readFile(absPath, 'utf8').catch(() => null);
      if (existing === null) {
        return { success: false, error: 'oldString 指定但文件不存在' };
      }
      const idx = existing.indexOf(oldString);
      if (idx === -1) return { success: false, error: 'oldString 未匹配到' };
      if (existing.indexOf(oldString, idx + oldString.length) !== -1) {
        return { success: false, error: 'oldString 匹配到多处，必须唯一' };
      }
      const next = existing.slice(0, idx) + content + existing.slice(idx + oldString.length);
      await writeFile(absPath, next, 'utf8');
      return {
        success: true,
        data: { path: relPath, written: true, bytes: Buffer.byteLength(next) },
      };
    }

    await writeFile(absPath, content, 'utf8');
    return {
      success: true,
      data: { path: relPath, written: true, bytes: Buffer.byteLength(content) },
    };
  }

  /** 备份原文件（存在时），供 file_revert 恢复最近一次修改前的状态 */
  private async backupBeforeWrite(
    workspace: HarnessWorkspaceEntry,
    absPath: string,
  ): Promise<void> {
    try {
      const s = await stat(absPath).catch(() => null);
      if (!s) return;
      const backupDir = path.join(app.getPath('userData'), 'harness-backups', workspace.id);
      await mkdir(backupDir, { recursive: true });
      const rel = path.relative(workspace.root, absPath);
      await copyFile(absPath, path.join(backupDir, rel.split(path.sep).join('_') + '.bak'));
    } catch (err) {
      logger.warn('harness file backup failed', err);
    }
  }

  // ============ file_revert（恢复最近一次备份） ============
  private async fileRevert(
    workspace: HarnessWorkspaceEntry,
    args: Record<string, any>,
  ): Promise<HarnessExecToolResult> {
    const relPath = String(args.path ?? '');
    const absPath = await assertSafePath(
      workspace.root,
      resolveWorkspacePath(workspace.root, relPath),
    );
    const backupDir = path.join(app.getPath('userData'), 'harness-backups', workspace.id);
    const rel = path.relative(workspace.root, absPath);
    const backupPath = path.join(backupDir, rel.split(path.sep).join('_') + '.bak');
    try {
      const buf = await readFile(backupPath);
      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, buf);
      return { success: true, data: { path: relPath, reverted: true, bytes: buf.length } };
    } catch {
      return { success: false, error: '没有可回滚的备份（该文件尚未被本机工具修改过）' };
    }
  }

  // ============ file_delete ============
  private async fileDelete(
    root: string,
    args: Record<string, any>,
  ): Promise<HarnessExecToolResult> {
    if (args.approved !== true) {
      return { success: false, error: 'file_delete 需要用户审批' };
    }
    const relPath = String(args.path ?? '');
    const absPath = await assertSafePath(root, resolveWorkspacePath(root, relPath));
    const s = await stat(absPath).catch(() => null);
    if (!s) return { success: false, error: '文件不存在' };
    await rm(absPath, { recursive: false });
    return { success: true, data: { path: relPath, deleted: true } };
  }

  // ============ file_search ============
  private async fileSearch(
    root: string,
    args: Record<string, any>,
  ): Promise<HarnessExecToolResult> {
    const query = String(args.query ?? '');
    if (!query) return { success: false, error: '缺少 query' };
    const glob = String(args.glob ?? '**/*');
    const maxResults = Math.min(
      Math.max(Number(args.maxResults) || MAX_SEARCH_RESULTS, 1),
      MAX_SEARCH_RESULTS,
    );
    const matcher = globToRegExp(glob);

    const matches: { file: string; line: number; text: string }[] = [];
    let truncated = false;

    const walk = async (dirAbs: string, rel: string): Promise<void> => {
      if (truncated || matches.length >= maxResults) return;
      let entries;
      try {
        entries = await readdir(dirAbs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (truncated || matches.length >= maxResults) {
          truncated = true;
          return;
        }
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          await walk(path.join(dirAbs, entry.name), rel + '/' + entry.name);
        } else if (entry.isFile()) {
          const relPosix = (rel + '/' + entry.name).replace(/^\//, '');
          if (!matcher.test(relPosix)) continue;
          const buf = await readFile(path.join(dirAbs, entry.name)).catch(() => null);
          if (!buf || buf.includes(0)) continue;
          const lines = buf.toString('utf8').split('\n');
          for (let i = 0; i < lines.length; i += 1) {
            if (lines[i].includes(query)) {
              matches.push({ file: relPosix, line: i + 1, text: lines[i].slice(0, 500) });
              if (matches.length >= maxResults) {
                truncated = true;
                return;
              }
            }
          }
        }
      }
    };

    await walk(root, '');
    return { success: true, data: { matches, total: matches.length, truncated } };
  }

  // ============ terminal_run ============
  private async terminalRun(
    root: string,
    args: Record<string, any>,
    approved?: boolean,
  ): Promise<HarnessExecToolResult> {
    const command = String(args.command ?? '').trim();
    if (!command) return { success: false, error: '缺少 command' };
    const firstToken = command.split(/\s+/)[0];
    const isSafe =
      SAFE_COMMANDS.has(firstToken) ||
      (process.platform === 'win32' && WINDOWS_SAFE_COMMANDS.has(firstToken));
    if (!isSafe && approved !== true) {
      return { success: false, error: '该命令需要用户审批' };
    }

    const [bin, ...cmdArgs] = command.split(/\s+/);
    const startedAt = Date.now();
    try {
      const result = await execa(bin, cmdArgs, {
        cwd: root,
        shell: false,
        windowsHide: true,
        timeout: CMD_TIMEOUT,
        maxBuffer: MAX_READ_BYTES,
        reject: false,
      });
      const stdout = truncateOutput(result.stdout ?? '');
      const stderr = truncateOutput(result.stderr ?? '');
      return {
        success: true,
        data: {
          command,
          exitCode: result.exitCode,
          stdout: stdout.text,
          stderr: stderr.text,
          truncated: stdout.truncated || stderr.truncated,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
