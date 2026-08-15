// Harness 本地模式（桌面端主进程）类型契约。渲染层只传 workspaceId，
// 一切路径校验与权限闸都在主进程完成（主进程权威）。

export type HarnessWorkspacePermission = 'read-only' | 'workspace-write' | 'full';

export interface HarnessWorkspaceEntry {
  id: string;
  name: string;
  root: string;
  permission: HarnessWorkspacePermission;
  createdAt: number;
}

export interface HarnessExecToolRequest {
  workspaceId: string;
  tool: string;
  args: Record<string, any>;
  approved?: boolean;
}

export interface HarnessExecToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface HarnessLocalApi {
  chooseWorkspace(): Promise<HarnessWorkspaceEntry | null>;
  listWorkspaces(): Promise<HarnessWorkspaceEntry[]>;
  removeWorkspace(id: string): Promise<void>;
  setWorkspacePermission(id: string, permission: HarnessWorkspacePermission): Promise<void>;
  execTool(req: HarnessExecToolRequest): Promise<HarnessExecToolResult>;
}
