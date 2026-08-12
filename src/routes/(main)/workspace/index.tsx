'use client';

import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  workspaceService,
  type Artifact,
  type ArtifactDetail,
  type DiffLine,
  type TaskDetail,
  type WorkspaceLog,
  type WorkspaceTask,
} from '@/services/workspace';

// 工作台页：任务列表 + 产物中心（版本 / diff / 下载）
// 单页 + Tabs，简洁实用；参考 hitl/knowledge/harness 页面模式

// 任务状态颜色映射
const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
};

// 日志级别颜色映射
const LEVEL_COLOR: Record<string, string> = {
  info: 'blue',
  warn: 'orange',
  error: 'red',
  debug: 'default',
};

// 根据 type 推断下载文件扩展名
function guessExt(type?: string): string {
  if (!type) return 'txt';
  const t = type.toLowerCase();
  if (t === 'html') return 'html';
  if (t === 'json') return 'json';
  if (t === 'markdown' || t === 'md') return 'md';
  if (t === 'css') return 'css';
  if (t === 'js' || t === 'javascript') return 'js';
  if (t === 'ts' || t === 'typescript') return 'ts';
  if (t === 'python') return 'py';
  return 'txt';
}

const WorkspacePage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg, modal } = App.useApp();

  // ============ 统计 ============
  const [stats, setStats] = useState<{ total: number; running: number; completed: number; failed: number }>({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });

  // ============ 任务列表 ============
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<string | undefined>(undefined);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskForm] = Form.useForm();

  // 任务详情 Drawer
  const [taskDrawer, setTaskDrawer] = useState<TaskDetail | null>(null);
  const [taskDrawerLoading, setTaskDrawerLoading] = useState(false);
  const [logs, setLogs] = useState<WorkspaceLog[]>([]);

  // ============ 产物列表 ============
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactType, setArtifactType] = useState<string | undefined>(undefined);
  const [createArtifactOpen, setCreateArtifactOpen] = useState(false);
  const [artifactForm] = Form.useForm();

  // 产物详情 Drawer
  const [artifactDrawer, setArtifactDrawer] = useState<ArtifactDetail | null>(null);
  const [artifactDrawerLoading, setArtifactDrawerLoading] = useState(false);
  const [versions, setVersions] = useState<ArtifactDetail['versions']>([]);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [v1, setV1] = useState<number | undefined>(undefined);
  const [v2, setV2] = useState<number | undefined>(undefined);

  // 当前激活的 Tab（点击关联产物时可跳转）
  const [activeTab, setActiveTab] = useState<string>('tasks');

  // ============ 数据加载 ============
  const loadStats = useCallback(async () => {
    try {
      const s = await workspaceService.getTaskStats();
      setStats(s);
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [antdMsg]);

  const loadTasks = useCallback(async () => {
    setTaskLoading(true);
    try {
      const res = await workspaceService.listTasks({ status: taskStatus, page: 1, pageSize: 50 });
      setTasks(res.items || []);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setTaskLoading(false);
    }
  }, [taskStatus, antdMsg]);

  const loadArtifacts = useCallback(async () => {
    setArtifactLoading(true);
    try {
      const res = await workspaceService.listArtifacts({ type: artifactType, page: 1, pageSize: 50 });
      setArtifacts(res.items || []);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setArtifactLoading(false);
    }
  }, [artifactType, antdMsg]);

  useEffect(() => {
    loadStats();
    loadTasks();
    loadArtifacts();
  }, [loadStats, loadTasks, loadArtifacts]);

  // ============ 任务操作 ============
  const viewTask = useCallback(
    async (id: string) => {
      setTaskDrawer(null);
      setTaskDrawerLoading(true);
      setLogs([]);
      try {
        const detail = await workspaceService.getTask(id);
        setTaskDrawer(detail);
        const logRes = await workspaceService.listLogs(id, { page: 1, pageSize: 100 });
        setLogs(logRes.items || []);
      } catch (e: any) {
        antdMsg.error(e.message);
      } finally {
        setTaskDrawerLoading(false);
      }
    },
    [antdMsg],
  );

  const deleteTask = useCallback(
    (id: string) => {
      modal.confirm({
        title: t('workspace.deleteTaskConfirm'),
        onOk: async () => {
          try {
            await workspaceService.deleteTask(id);
            antdMsg.success(t('workspace.deleted'));
            loadTasks();
            loadStats();
          } catch (e: any) {
            antdMsg.error(e.message);
          }
        },
      });
    },
    [modal, antdMsg, t, loadTasks, loadStats],
  );

  const submitCreateTask = useCallback(async () => {
    const values = await taskForm.validateFields();
    try {
      await workspaceService.createTask({ title: values.title, description: values.description });
      setCreateTaskOpen(false);
      taskForm.resetFields();
      antdMsg.success(t('workspace.taskCreated'));
      loadTasks();
      loadStats();
    } catch (e: any) {
      // validateFields 抛出的错误不带 message，避免误报
      if (e?.errorFields) return;
      antdMsg.error(e.message);
    }
  }, [taskForm, antdMsg, t, loadTasks, loadStats]);

  // ============ 产物操作 ============
  const viewArtifact = useCallback(
    async (id: string) => {
      setArtifactDrawer(null);
      setArtifactDrawerLoading(true);
      setVersions([]);
      setDiff(null);
      setV1(undefined);
      setV2(undefined);
      try {
        const detail = await workspaceService.getArtifact(id);
        setArtifactDrawer(detail);
        const vRes = await workspaceService.listVersions(id);
        setVersions(vRes.list || []);
      } catch (e: any) {
        antdMsg.error(e.message);
      } finally {
        setArtifactDrawerLoading(false);
      }
    },
    [antdMsg],
  );

  const deleteArtifact = useCallback(
    (id: string) => {
      modal.confirm({
        title: t('workspace.deleteArtifactConfirm'),
        onOk: async () => {
          try {
            await workspaceService.deleteArtifact(id);
            antdMsg.success(t('workspace.deleted'));
            loadArtifacts();
          } catch (e: any) {
            antdMsg.error(e.message);
          }
        },
      });
    },
    [modal, antdMsg, t, loadArtifacts],
  );

  const submitCreateArtifact = useCallback(async () => {
    const values = await artifactForm.validateFields();
    try {
      await workspaceService.createArtifact({
        title: values.title,
        type: values.type,
        subtype: values.subtype,
        content: values.content,
      });
      setCreateArtifactOpen(false);
      artifactForm.resetFields();
      antdMsg.success(t('workspace.artifactCreated'));
      loadArtifacts();
    } catch (e: any) {
      if (e?.errorFields) return;
      antdMsg.error(e.message);
    }
  }, [artifactForm, antdMsg, t, loadArtifacts]);

  // 下载产物：Blob + URL.createObjectURL 触发浏览器下载
  const downloadArtifact = useCallback(
    async (id: string, title: string, version?: number, type?: string) => {
      try {
        const text = await workspaceService.downloadArtifact(id, version);
        const ext = guessExt(type);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}-v${version ?? 'latest'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e: any) {
        antdMsg.error(e.message);
      }
    },
    [antdMsg],
  );

  // 版本 diff
  const viewDiff = useCallback(async () => {
    if (!artifactDrawer || v1 == null || v2 == null) return;
    setDiffLoading(true);
    try {
      const res = await workspaceService.diffVersions(artifactDrawer.id, v1, v2);
      setDiff(res.diff);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setDiffLoading(false);
    }
  }, [artifactDrawer, v1, v2, antdMsg]);

  // 从任务详情跳到产物 tab 并打开产物详情
  const jumpToArtifact = useCallback(
    (artifact: Artifact) => {
      setTaskDrawer(null);
      setActiveTab('artifacts');
      viewArtifact(artifact.id);
    },
    [viewArtifact],
  );

  // ============ 表格列定义 ============
  const taskColumns = [
    { title: t('workspace.taskTitle'), dataIndex: 'title', ellipsis: true },
    {
      title: t('workspace.status'),
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
    {
      title: t('workspace.progress'),
      dataIndex: 'progress',
      width: 140,
      render: (v: number) => <Progress percent={v || 0} size="small" />,
    },
    {
      title: t('workspace.createdAt'),
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('workspace.updatedAt'),
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('workspace.actions'),
      key: 'actions',
      width: 160,
      render: (_: unknown, row: WorkspaceTask) => (
        <Space>
          <Button size="small" type="link" onClick={() => viewTask(row.id)}>
            {t('workspace.viewDetail')}
          </Button>
          <Button size="small" type="link" danger onClick={() => deleteTask(row.id)}>
            {t('workspace.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  const artifactColumns = [
    { title: t('workspace.artifactTitle'), dataIndex: 'title', ellipsis: true },
    {
      title: t('workspace.type'),
      dataIndex: 'type',
      width: 100,
      render: (v: string) => <Tag>{v || '-'}</Tag>,
    },
    {
      title: t('workspace.subtype'),
      dataIndex: 'subtype',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: t('workspace.currentVersion'),
      dataIndex: 'currentVersion',
      width: 110,
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: t('workspace.createdAt'),
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('workspace.updatedAt'),
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('workspace.actions'),
      key: 'actions',
      width: 220,
      render: (_: unknown, row: Artifact) => (
        <Space>
          <Button size="small" type="link" onClick={() => viewArtifact(row.id)}>
            {t('workspace.viewDetail')}
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => downloadArtifact(row.id, row.title, undefined, row.type)}
          >
            {t('workspace.download')}
          </Button>
          <Button size="small" type="link" danger onClick={() => deleteArtifact(row.id)}>
            {t('workspace.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  // 版本列表列
  const versionColumns = [
    {
      title: t('workspace.version'),
      dataIndex: 'version',
      width: 80,
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    { title: t('workspace.source'), dataIndex: 'source', width: 120, ellipsis: true },
    {
      title: t('workspace.changeLog'),
      dataIndex: 'changeLog',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: t('workspace.createdAt'),
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('workspace.actions'),
      key: 'actions',
      width: 100,
      render: (_: unknown, row: { version: number }) => (
        <Button
          size="small"
          type="link"
          onClick={() =>
            artifactDrawer &&
            downloadArtifact(artifactDrawer.id, artifactDrawer.title, row.version, artifactDrawer.type)
          }
        >
          {t('workspace.download')}
        </Button>
      ),
    },
  ];

  // 统计卡片配置
  const statCards = [
    { key: 'total', label: t('workspace.statsTotal'), value: stats.total, color: undefined },
    { key: 'running', label: t('workspace.statsRunning'), value: stats.running, color: '#1677ff' },
    { key: 'completed', label: t('workspace.statsCompleted'), value: stats.completed, color: '#52c41a' },
    { key: 'failed', label: t('workspace.statsFailed'), value: stats.failed, color: '#ff4d4f' },
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16, overflow: 'auto' }}>
      {/* 标题 + 统计卡片 */}
      <Card size="small" title={t('workspace.title')} styles={{ body: { padding: 12 } }}>
        <Flex gap={12} wrap="wrap">
          {statCards.map((c) => (
            <Card key={c.key} size="small" style={{ flex: 1, minWidth: 120 }} styles={{ body: { padding: 12 } }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {c.label}
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: 0, color: c.color }}>
                {c.value}
              </Typography.Title>
            </Card>
          ))}
        </Flex>
      </Card>

      {/* Tabs：任务列表 / 产物中心 */}
      <Card size="small" styles={{ body: { padding: 12 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'tasks',
              label: t('workspace.tasksTab'),
              children: (
                <>
                  <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
                    <Space wrap>
                      <Tag
                        style={{ cursor: 'pointer' }}
                        color={!taskStatus ? 'blue' : undefined}
                        onClick={() => setTaskStatus(undefined)}
                      >
                        {t('workspace.all')}
                      </Tag>
                      {['pending', 'running', 'completed', 'failed', 'cancelled'].map((s) => (
                        <Tag
                          key={s}
                          style={{ cursor: 'pointer' }}
                          color={taskStatus === s ? 'blue' : undefined}
                          onClick={() => setTaskStatus(s)}
                        >
                          {s}
                        </Tag>
                      ))}
                    </Space>
                    <Button type="primary" onClick={() => setCreateTaskOpen(true)}>
                      {t('workspace.newTask')}
                    </Button>
                  </Flex>
                  <Table
                    rowKey="id"
                    size="small"
                    loading={taskLoading}
                    columns={taskColumns}
                    dataSource={tasks}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workspace.noTasks')} />
                      ),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'artifacts',
              label: t('workspace.artifactsTab'),
              children: (
                <>
                  <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
                    <Input
                      placeholder={t('workspace.typeFilterPlaceholder')}
                      value={artifactType}
                      onChange={(e) => setArtifactType(e.target.value || undefined)}
                      onPressEnter={loadArtifacts}
                      style={{ width: 240 }}
                      allowClear
                    />
                    <Button type="primary" onClick={() => setCreateArtifactOpen(true)}>
                      {t('workspace.newArtifact')}
                    </Button>
                  </Flex>
                  <Table
                    rowKey="id"
                    size="small"
                    loading={artifactLoading}
                    columns={artifactColumns}
                    dataSource={artifacts}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workspace.noArtifacts')} />
                      ),
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 任务详情 Drawer */}
      <Drawer
        title={t('workspace.taskDetail')}
        open={!!taskDrawer || taskDrawerLoading}
        onClose={() => {
          setTaskDrawer(null);
          setTaskDrawerLoading(false);
        }}
        width={560}
      >
        <Spin spinning={taskDrawerLoading}>
          {taskDrawer ? (
            <Flex vertical gap={16}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('workspace.taskTitle')}>
                  {taskDrawer.title}
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.status')}>
                  <Tag color={STATUS_COLOR[taskDrawer.status] || 'default'}>{taskDrawer.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.progress')}>
                  <Progress percent={taskDrawer.progress || 0} size="small" style={{ maxWidth: 200 }} />
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.description')}>
                  {taskDrawer.description || '-'}
                </Descriptions.Item>
                {taskDrawer.errorMessage && (
                  <Descriptions.Item label={t('workspace.errorMessage')}>
                    <Typography.Text type="danger">{taskDrawer.errorMessage}</Typography.Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={t('workspace.createdAt')}>
                  {new Date(taskDrawer.createdAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.updatedAt')}>
                  {new Date(taskDrawer.updatedAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              {/* 关联产物列表（点击跳到产物 Tab） */}
              <div>
                <Typography.Text strong>
                  {t('workspace.relatedArtifacts')}（{taskDrawer.artifacts?.length || 0}）
                </Typography.Text>
                <List
                  size="small"
                  style={{ marginTop: 8 }}
                  dataSource={taskDrawer.artifacts || []}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(a: Artifact) => (
                    <List.Item
                      actions={[
                        <Button
                          key="jump"
                          size="small"
                          type="link"
                          onClick={() => jumpToArtifact(a)}
                        >
                          {t('workspace.viewDetail')}
                        </Button>,
                      ]}
                    >
                      <Space>
                        <Typography.Text>{a.title}</Typography.Text>
                        <Tag>{a.type}</Tag>
                        <Tag color="blue">v{a.currentVersion}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>

              {/* 任务日志列表 */}
              <div>
                <Typography.Text strong>
                  {t('workspace.logs')}（{logs.length}）
                </Typography.Text>
                <List
                  size="small"
                  style={{ marginTop: 8 }}
                  dataSource={logs}
                  locale={{
                    emptyText: (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workspace.noLogs')} />
                    ),
                  }}
                  renderItem={(log) => (
                    <List.Item>
                      <Flex vertical gap={2} style={{ minWidth: 0 }}>
                        <Space>
                          <Tag color={LEVEL_COLOR[log.level] || 'default'}>{log.level}</Tag>
                          {log.step != null && (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              step={log.step}
                            </Typography.Text>
                          )}
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </Typography.Text>
                        </Space>
                        <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                          {log.message}
                        </Typography.Paragraph>
                      </Flex>
                    </List.Item>
                  )}
                />
              </div>
            </Flex>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </Drawer>

      {/* 产物详情 Drawer */}
      <Drawer
        title={t('workspace.artifactDetail')}
        open={!!artifactDrawer || artifactDrawerLoading}
        onClose={() => {
          setArtifactDrawer(null);
          setArtifactDrawerLoading(false);
          setDiff(null);
        }}
        width={680}
      >
        <Spin spinning={artifactDrawerLoading}>
          {artifactDrawer ? (
            <Flex vertical gap={16}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('workspace.artifactTitle')}>
                  {artifactDrawer.title}
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.type')}>
                  <Space>
                    <Tag>{artifactDrawer.type}</Tag>
                    {artifactDrawer.subtype && <Tag>{artifactDrawer.subtype}</Tag>}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.currentVersion')}>
                  <Tag color="blue">v{artifactDrawer.currentVersion}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.createdAt')}>
                  {new Date(artifactDrawer.createdAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label={t('workspace.updatedAt')}>
                  {new Date(artifactDrawer.updatedAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              {/* 当前内容（代码高亮，monospace） */}
              <div>
                <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                  <Typography.Text strong>{t('workspace.content')}</Typography.Text>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() =>
                      downloadArtifact(
                        artifactDrawer.id,
                        artifactDrawer.title,
                        artifactDrawer.currentVersion,
                        artifactDrawer.type,
                      )
                    }
                  >
                    {t('workspace.downloadCurrent')}
                  </Button>
                </Flex>
                <pre
                  style={{
                    background: '#1f1f1f',
                    color: '#d4d4d4',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 320,
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {artifactDrawer.content}
                </pre>
              </div>

              {/* 版本列表 */}
              <div>
                <Typography.Text strong>
                  {t('workspace.versions')}（{versions.length}）
                </Typography.Text>
                <Table
                  rowKey="version"
                  size="small"
                  dataSource={versions}
                  columns={versionColumns}
                  pagination={false}
                  style={{ marginTop: 8 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
              </div>

              {/* Diff 查看 */}
              <div>
                <Typography.Text strong>{t('workspace.diffTitle')}</Typography.Text>
                <Flex gap={8} align="center" style={{ marginTop: 8, marginBottom: 8 }}>
                  <Select
                    placeholder="v1"
                    value={v1}
                    onChange={setV1}
                    style={{ width: 120 }}
                    options={versions.map((v) => ({ value: v.version, label: `v${v.version}` }))}
                  />
                  <Select
                    placeholder="v2"
                    value={v2}
                    onChange={setV2}
                    style={{ width: 120 }}
                    options={versions.map((v) => ({ value: v.version, label: `v${v.version}` }))}
                  />
                  <Button
                    type="primary"
                    onClick={viewDiff}
                    loading={diffLoading}
                    disabled={v1 == null || v2 == null}
                  >
                    {t('workspace.viewDiff')}
                  </Button>
                </Flex>
                {diff && (
                  <pre
                    style={{
                      background: '#fafafa',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre',
                      maxHeight: 400,
                      overflow: 'auto',
                      margin: 0,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    {diff.map((line, i) => {
                      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
                      const color =
                        line.type === 'add' ? '#52c41a' : line.type === 'remove' ? '#ff4d4f' : '#888';
                      return (
                        <div key={i} style={{ color }}>
                          {prefix} {line.content}
                        </div>
                      );
                    })}
                  </pre>
                )}
              </div>
            </Flex>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </Drawer>

      {/* 创建任务 Modal */}
      <Modal
        title={t('workspace.newTask')}
        open={createTaskOpen}
        onCancel={() => setCreateTaskOpen(false)}
        onOk={submitCreateTask}
        destroyOnClose
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item name="title" label={t('workspace.taskTitle')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('workspace.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建产物 Modal */}
      <Modal
        title={t('workspace.newArtifact')}
        open={createArtifactOpen}
        onCancel={() => setCreateArtifactOpen(false)}
        onOk={submitCreateArtifact}
        destroyOnClose
      >
        <Form form={artifactForm} layout="vertical">
          <Form.Item name="title" label={t('workspace.artifactTitle')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label={t('workspace.type')}>
            <Input placeholder="code / document / ..." />
          </Form.Item>
          <Form.Item name="subtype" label={t('workspace.subtype')}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label={t('workspace.content')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
});

export default WorkspacePage;
