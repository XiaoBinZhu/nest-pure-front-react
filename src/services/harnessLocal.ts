import {
  type HarnessExecToolResult,
  type HarnessWorkspaceEntry,
  type HarnessWorkspacePermission,
} from '@lobechat/electron-client-ipc';

import { ensureElectronIpc } from '@/utils/electron/ipc';

// Harness 本地模式（桌面端）渲染层服务：转发到主进程 HarnessLocalCtr。
// 主进程权威 —— 渲染层只传 workspaceId，路径校验/权限闸全部在主进程完成。

export const isHarnessLocalSupported = (): boolean => {
  try {
    ensureElectronIpc();
    return true;
  } catch {
    return false;
  }
};

export const harnessLocal = {
  chooseWorkspace: (): Promise<HarnessWorkspaceEntry | null> =>
    ensureElectronIpc().harnessLocal.chooseWorkspace(),

  listWorkspaces: (): Promise<HarnessWorkspaceEntry[]> =>
    ensureElectronIpc().harnessLocal.listWorkspaces(),

  removeWorkspace: (id: string): Promise<void> =>
    ensureElectronIpc().harnessLocal.removeWorkspace(id),

  setWorkspacePermission: (id: string, permission: HarnessWorkspacePermission): Promise<void> =>
    ensureElectronIpc().harnessLocal.setWorkspacePermission({ id, permission }),

  execTool: (
    workspaceId: string,
    tool: string,
    args: Record<string, any>,
    approved?: boolean,
  ): Promise<HarnessExecToolResult> =>
    ensureElectronIpc().harnessLocal.execTool({ workspaceId, tool, args, approved }),
};
