'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  List,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
} from 'antd';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { harnessKeys } from '@/libs/swr/keys';
import {
  harnessService,
  type HarnessFileNode,
  type HarnessSession,
} from '@/services/harness';

// Harness 代码智能体工作区
// 布局：左=会话列表 | 中=聊天流 | 右=文件树+编辑器+终端

interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'terminal' | 'system';
  text?: string;
  tool?: string;
  args?: any;
  success?: boolean;
  result?: any;
  action?: string;
  path?: string;
  command?: string;
  exitCode?: number;
  output?: string;
}

const MODE_OPTIONS = [
  { value: 'chat', label: '对话' },
  { value: 'code', label: '代码' },
  { value: 'browser', label: '浏览器' },
];

const HarnessPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg, modal } = App.useApp();

  // ============ 会话 ============
  const { data: sessions, mutate: mutateSessions } = useClientDataSWR(harnessKeys.sessions(), () =>
    harnessService.listSessions(),
  );
  const [activeId, setActiveId] = useState<string>();
  const [mode, setMode] = useState<'chat' | 'code' | 'browser'>('code');
  const [model, setModel] = useState('deepseek-ai/DeepSeek-V4-Pro');
  const [sessionName, setSessionName] = useState('Harness 会话');

  const { data: sessionDetail, mutate: mutateSession } = useClientDataSWR(
    activeId ? harnessKeys.session(activeId) : null,
    () => (activeId ? harnessService.getSession(activeId) : undefined),
  );

  // 切换会话时同步 mode/model
  useEffect(() => {
    if (sessionDetail) {
      setMode(sessionDetail.mode);
      setModel(sessionDetail.model);
      setSessionName(sessionDetail.name);
    }
  }, [sessionDetail?.id]);

  // ============ 文件 ============
  const { data: fileTree, mutate: mutateFiles } = useClientDataSWR(
    activeId ? harnessKeys.files(activeId) : null,
    () => (activeId ? harnessService.listFiles(activeId) : undefined),
  );
  const [editorPath, setEditorPath] = useState<string>();
  const [editorContent, setEditorContent] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);

  const openFile = useCallback(
    async (path: string) => {
      if (!activeId) return;
      setEditorPath(path);
      setEditorLoading(true);
      try {
        const file = await harnessService.getFileContent(activeId, path);
        setEditorContent(file.content);
      } catch (e: any) {
        antdMsg.error(e.message);
      } finally {
        setEditorLoading(false);
      }
    },
    [activeId, antdMsg],
  );

  const saveFile = useCallback(async () => {
    if (!activeId || !editorPath) return;
    try {
      await harnessService.saveFile(activeId, editorPath, editorContent);
      antdMsg.success(t('harness.saved'));
      mutateFiles();
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [activeId, editorPath, editorContent, antdMsg, mutateFiles, t]);

  // ============ 聊天 ============
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController>();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems]);

  const send = useCallback(async () => {
    if (!activeId || !input.trim() || running) return;
    const text = input.trim();
    setInput('');
    const userItem: ChatItem = { id: `${Date.now()}-u`, role: 'user', text };
    setChatItems((prev) => [...prev, userItem, { id: `${Date.now()}-a`, role: 'assistant', text: '' }]);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await harnessService.chat(
        activeId,
        text,
        (evt) => {
          // 注意：setState 回调顺序执行，用函数式更新保证顺序
          if (evt.event === 'harness_content') {
            setChatItems((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                const next = [...prev];
                next[next.length - 1] = { ...last, text: (last.text || '') + (evt.data as any).text };
                return next;
              }
              return prev;
            });
          } else if (evt.event === 'harness_tool_call') {
            const d = evt.data as any;
            setChatItems((prev) => [...prev, { id: `${Date.now()}-tool`, role: 'tool', tool: d.tool, args: d.args }]);
          } else if (evt.event === 'harness_tool_result') {
            const d = evt.data as any;
            setChatItems((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === 'tool' && next[i].tool === d.tool && next[i].success === undefined) {
                  next[i] = { ...next[i], success: d.success, result: d.result };
                  break;
                }
              }
              return next;
            });
          } else if (evt.event === 'harness_file_change') {
            const d = evt.data as any;
            setChatItems((prev) => [...prev, { id: `${Date.now()}-fc`, role: 'system', action: d.action, path: d.path }]);
            mutateFiles();
            if (editorPath === d.path) openFile(d.path);
          } else if (evt.event === 'harness_terminal') {
            const d = evt.data as any;
            setChatItems((prev) => [...prev, { id: `${Date.now()}-term`, role: 'terminal', command: d.command, exitCode: d.exitCode, output: d.output }]);
          } else if (evt.event === 'harness_approval') {
            const d = evt.data as any;
            setChatItems((prev) => [...prev, { id: `${Date.now()}-approval`, role: 'system', tool: d.tool, args: d.args, text: t('harness.approval') }]);
          } else if (evt.event === 'error') {
            const d = evt.data as any;
            setChatItems((prev) => [...prev, { id: `${Date.now()}-err`, role: 'system', text: `[${d.code}] ${d.message}` }]);
          }
        },
        ac.signal,
      );
    } catch (e: any) {
      if (e.name !== 'AbortError') antdMsg.error(e.message);
    } finally {
      setRunning(false);
      mutateSessions();
    }
  }, [activeId, input, running, antdMsg, mutateFiles, mutateSessions, editorPath, openFile, t]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // ============ 会话操作 ============
  const createSession = useCallback(async () => {
    try {
      const s = await harnessService.createSession({ name: sessionName, mode, model });
      setActiveId(s.id);
      setChatItems([]);
      mutateSessions();
      mutateFiles();
      antdMsg.success(t('harness.created'));
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [sessionName, mode, model, antdMsg, mutateSessions, mutateFiles, t]);

  const selectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      setChatItems([]);
      setEditorPath(undefined);
      setEditorContent('');
    },
    [],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      modal.confirm({
        title: t('harness.deleteConfirm'),
        onOk: async () => {
          try {
            await harnessService.deleteSession(id);
            if (activeId === id) setActiveId(undefined);
            mutateSessions();
          } catch (e: any) {
            antdMsg.error(e.message);
          }
        },
      });
    },
    [activeId, antdMsg, modal, mutateSessions, t],
  );

  const deleteFile = useCallback(async () => {
    if (!activeId || !editorPath) return;
    modal.confirm({
      title: t('harness.deleteFileConfirm'),
      onOk: async () => {
        try {
          await harnessService.deleteFile(activeId, editorPath);
          antdMsg.success(t('harness.deleted'));
          setEditorPath(undefined);
          setEditorContent('');
          mutateFiles();
        } catch (e: any) {
          antdMsg.error(e.message);
        }
      },
    });
  }, [activeId, editorPath, antdMsg, modal, mutateFiles, t]);

  // ============ 模式/模型变更 ============
  const changeMode = useCallback(
    async (m: 'chat' | 'code' | 'browser') => {
      setMode(m);
      if (activeId) {
        await harnessService.updateSession(activeId, { mode: m }).catch(() => undefined);
        mutateSession();
      }
    },
    [activeId, mutateSession],
  );

  const changeModel = useCallback(
    async (m: string) => {
      setModel(m);
      if (activeId) {
        await harnessService.updateSession(activeId, { model: m }).catch(() => undefined);
      }
    },
    [activeId],
  );

  // ============ 渲染 ============
  const treeData = useMemo(() => {
    const build = (nodes: HarnessFileNode[]): any[] =>
      nodes.map((n) => ({
        title: n.name,
        key: n.path,
        isLeaf: n.type === 'file',
        children: n.children ? build(n.children) : undefined,
      }));
    return build(fileTree || []);
  }, [fileTree]);

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左：会话列表 */}
        <Col flex="240px">
          <Card size="small" title={t('harness.sessions')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Button type="primary" block onClick={createSession} style={{ marginBottom: 8 }}>
              {t('harness.newSession')}
            </Button>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <List
                size="small"
                dataSource={sessions || []}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('harness.empty')} /> }}
                renderItem={(s: HarnessSession) => (
                  <List.Item
                    onClick={() => selectSession(s.id)}
                    style={{
                      cursor: 'pointer',
                      background: s.id === activeId ? 'rgba(22,119,255,0.08)' : undefined,
                      padding: '6px 8px',
                      borderRadius: 6,
                    }}
                    actions={[
                      <Button key="del" type="text" size="small" danger onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}>
                        {t('harness.delete')}
                      </Button>,
                    ]}
                  >
                    <Flex vertical gap={2} style={{ minWidth: 0 }}>
                      <Typography.Text ellipsis>{s.name}</Typography.Text>
                      <Tag style={{ margin: 0 }}>{s.mode}</Tag>
                    </Flex>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>

        {/* 中：聊天流 */}
        <Col flex="auto">
          <Card
            size="small"
            title={
              <Space>
                <Input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  onBlur={() => activeId && harnessService.updateSession(activeId, { name: sessionName }).catch(() => undefined)}
                  style={{ width: 180 }}
                />
                <Select
                  value={mode}
                  options={MODE_OPTIONS}
                  onChange={changeMode}
                  style={{ width: 100 }}
                />
                <Input
                  value={model}
                  onChange={(e) => changeModel(e.target.value)}
                  placeholder="model"
                  style={{ width: 240 }}
                />
                {running && <Tag color="processing">{t('harness.running')}</Tag>}
              </Space>
            }
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12 } }}
          >
            <div style={{ flex: 1, overflow: 'auto', marginBottom: 8 }}>
              {chatItems.length === 0 && !running ? (
                <Empty description={t('harness.chatEmpty')} style={{ marginTop: 60 }} />
              ) : (
                chatItems.map((item) => {
                  if (item.role === 'user') {
                    return (
                      <Flex key={item.id} justify="flex-end" style={{ marginBottom: 8 }}>
                        <div style={{ maxWidth: '80%', background: 'rgba(22,119,255,0.1)', borderRadius: 10, padding: '6px 12px' }}>
                          <Typography.Text>{item.text}</Typography.Text>
                        </div>
                      </Flex>
                    );
                  }
                  if (item.role === 'assistant') {
                    return (
                      <div key={item.id} style={{ marginBottom: 8 }}>
                        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{item.text || '…'}</Typography.Paragraph>
                      </div>
                    );
                  }
                  if (item.role === 'tool') {
                    return (
                      <Card key={item.id} size="small" style={{ marginBottom: 8 }} styles={{ body: { padding: 8 } }}>
                        <Space>
                          <Tag color="blue">{t('harness.toolCall')}: {item.tool}</Tag>
                          {item.success === true && <Tag color="green">ok</Tag>}
                          {item.success === false && <Tag color="red">fail</Tag>}
                        </Space>
                        <Typography.Paragraph style={{ margin: '4px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(item.args)}
                          {item.result !== undefined ? `\n→ ${JSON.stringify(item.result).slice(0, 200)}` : ''}
                        </Typography.Paragraph>
                      </Card>
                    );
                  }
                  if (item.role === 'terminal') {
                    return (
                      <Card key={item.id} size="small" style={{ marginBottom: 8, background: '#1f1f1f' }} styles={{ body: { padding: 8 } }}>
                        <Typography.Text style={{ color: '#d4d4d4', fontFamily: 'monospace', fontSize: 12 }}>
                          <Tag color={item.exitCode === 0 ? 'green' : 'red'}>$ {item.command}</Tag>
                          {item.output ? `\n${item.output}` : ''}
                        </Typography.Text>
                      </Card>
                    );
                  }
                  if (item.role === 'system') {
                    return (
                      <Alert
                        key={item.id}
                        type={item.tool ? 'warning' : 'info'}
                        message={item.tool ? `${item.text}: ${item.tool} ${JSON.stringify(item.args)}` : item.text}
                        showIcon
                        style={{ marginBottom: 8 }}
                      />
                    );
                  }
                  return null;
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <Flex gap={8}>
              <Input.TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t('harness.placeholder')}
                autoSize={{ minRows: 2, maxRows: 4 }}
                disabled={!activeId || running}
              />
              <Flex vertical gap={4}>
                <Button type="primary" onClick={send} loading={running} disabled={!activeId}>
                  {t('harness.send')}
                </Button>
                {running && (
                  <Button onClick={stop} danger>
                    {t('harness.stop')}
                  </Button>
                )}
              </Flex>
            </Flex>
          </Card>
        </Col>

        {/* 右：文件树 + 编辑器 + 终端 */}
        <Col flex="340px">
          <Flex vertical gap={12} style={{ height: '100%' }}>
            <Card size="small" title={t('harness.files')} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {activeId ? (
                  <Tree
                    treeData={treeData}
                    defaultExpandAll
                    showLine
                    onSelect={(_, info) => {
                      const node = info.node as any;
                      if (node?.isLeaf) openFile(String(node.key));
                    }}
                    style={{ fontSize: 13 }}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('harness.empty')} />
                )}
              </div>
            </Card>
            <Card
              size="small"
              title={editorPath || t('harness.editor')}
              extra={
                editorPath ? (
                  <Space>
                    <Button size="small" type="primary" onClick={saveFile}>
                      {t('harness.save')}
                    </Button>
                    <Button size="small" danger onClick={deleteFile}>
                      {t('harness.delete')}
                    </Button>
                  </Space>
                ) : undefined
              }
              style={{ flex: 1.2, minHeight: 0, display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, minHeight: 0, padding: 4 } }}
            >
              {editorPath ? (
                <Spin spinning={editorLoading}>
                  <Input.TextArea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    style={{ height: '100%', fontFamily: 'monospace', fontSize: 13 }}
                  />
                </Spin>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('harness.noFile')} />
              )}
            </Card>
            <Card size="small" title={t('harness.terminal')} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, overflow: 'auto', padding: 8 } }}>
              {chatItems.filter((i) => i.role === 'terminal').length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('harness.terminalEmpty')}
                </Typography.Text>
              ) : (
                chatItems
                  .filter((i) => i.role === 'terminal')
                  .slice(-20)
                  .map((i) => (
                    <div key={i.id} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>
                      <Tag color={i.exitCode === 0 ? 'green' : 'red'}>$ {i.command}</Tag>
                      {i.output && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#666' }}>{i.output.slice(0, 300)}</pre>}
                    </div>
                  ))
              )}
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
});

export default HarnessPage;
