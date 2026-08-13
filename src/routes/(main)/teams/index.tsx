'use client';

import { Alert, App, Button, Card, Col, Drawer, Empty, Flex, Form, Input, List, Row, Space, Tag, Typography } from 'antd';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { harnessKeys } from '@/libs/swr/keys';
import { agentTeamService, type AgentTeam, type TeamEvent, type TeamMember } from '@/services/agentTeam';

// Agent 团队页：团队 CRUD + supervisor 拆解执行（SSE）+ 执行历史

interface RunItem {
  id: string;
  kind: 'plan' | 'action' | 'result' | 'summary' | 'error';
  text: string;
  agent?: string;
}

const AgentTeamsPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg, modal } = App.useApp();

  const { data: teams, mutate } = useClientDataSWR(harnessKeys.sessions(), () => agentTeamService.listTeams());
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [members, setMembers] = useState<TeamMember[]>([{ name: '', role: '', systemPrompt: '' }]);

  const [activeTeam, setActiveTeam] = useState<AgentTeam>();
  const [task, setTask] = useState('');
  const [running, setRunning] = useState(false);
  const [runItems, setRunItems] = useState<RunItem[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const abortRef = useRef<AbortController>();
  const runEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    runEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runItems]);

  const openTeam = useCallback(async (team: AgentTeam) => {
    setActiveTeam(team);
    setRunItems([]);
    setRuns([]);
    try {
      const list = await agentTeamService.listRuns(team.id);
      setRuns(list);
    } catch {
      // ignore
    }
  }, []);

  const createTeam = useCallback(async () => {
    const values = await form.validateFields();
    const validMembers = members.filter((m) => m.name.trim());
    if (validMembers.length === 0) {
      antdMsg.error(t('teams.memberRequired'));
      return;
    }
    try {
      await agentTeamService.createTeam({
        name: values.name,
        description: values.description,
        supervisorPrompt: values.supervisorPrompt,
        members: validMembers,
      });
      antdMsg.success(t('teams.created'));
      setCreateOpen(false);
      form.resetFields();
      setMembers([{ name: '', role: '', systemPrompt: '' }]);
      mutate();
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [form, members, antdMsg, mutate, t]);

  const run = useCallback(async () => {
    if (!activeTeam || !task.trim() || running) return;
    setRunItems([]);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await agentTeamService.runTeam(
        activeTeam.id,
        task.trim(),
        (evt: TeamEvent) => {
          if (evt.event === 'team_start') {
            setRunItems((prev) => [
              ...prev,
              { id: `${Date.now()}-plan`, kind: 'plan', text: JSON.stringify(evt.data.plan) },
            ]);
          } else if (evt.event === 'member_action') {
            setRunItems((prev) => [...prev, { id: `${Date.now()}-act`, kind: 'action', agent: evt.data.agent, text: evt.data.thought }]);
          } else if (evt.event === 'member_result') {
            setRunItems((prev) => [...prev, { id: `${Date.now()}-res`, kind: 'result', agent: evt.data.agent, text: evt.data.result }]);
          } else if (evt.event === 'team_done') {
            setRunItems((prev) => [...prev, { id: `${Date.now()}-sum`, kind: 'summary', text: evt.data.summary }]);
          } else if (evt.event === 'error') {
            setRunItems((prev) => [...prev, { id: `${Date.now()}-err`, kind: 'error', text: evt.data.message }]);
          }
        },
        ac.signal,
      );
      const list = await agentTeamService.listRuns(activeTeam.id);
      setRuns(list);
      mutate();
    } catch (e: any) {
      if (e.name !== 'AbortError') antdMsg.error(e.message);
    } finally {
      setRunning(false);
    }
  }, [activeTeam, task, running, antdMsg, mutate]);

  const deleteTeam = useCallback(
    async (team: AgentTeam) => {
      modal.confirm({
        title: t('teams.deleteConfirm'),
        onOk: async () => {
          await agentTeamService.deleteTeam(team.id);
          if (activeTeam?.id === team.id) setActiveTeam(undefined);
          mutate();
        },
      });
    },
    [activeTeam, modal, mutate, t],
  );

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左：团队列表 */}
        <Col flex="300px">
          <Card size="small" title={t('teams.list')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Button type="primary" block style={{ marginBottom: 8 }} onClick={() => setCreateOpen(true)}>
              {t('teams.create')}
            </Button>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <List
                size="small"
                dataSource={teams || []}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(team: AgentTeam) => (
                  <List.Item
                    onClick={() => openTeam(team)}
                    style={{ cursor: 'pointer', background: activeTeam?.id === team.id ? 'rgba(22,119,255,0.08)' : undefined, borderRadius: 6, padding: '6px 8px' }}
                    actions={[
                      <Button key="del" type="text" size="small" danger onClick={(e) => { e.stopPropagation(); deleteTeam(team); }}>
                        {t('harness.delete')}
                      </Button>,
                    ]}
                  >
                    <Flex vertical gap={2} style={{ minWidth: 0 }}>
                      <Typography.Text ellipsis strong>{team.name}</Typography.Text>
                      <Space size={4}>
                        {(team.members || []).map((m) => (
                          <Tag key={m.name} size="small">{m.name}</Tag>
                        ))}
                      </Space>
                    </Flex>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>

        {/* 右：执行工作区 */}
        <Col flex="auto">
          <Card
            size="small"
            title={activeTeam ? `${activeTeam.name} · ${t('teams.runTitle')}` : t('teams.empty')}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12 } }}
          >
            {!activeTeam ? (
              <Empty description={t('teams.selectHint')} style={{ marginTop: 60 }} />
            ) : (
              <>
                <Flex gap={8} style={{ marginBottom: 8 }}>
                  <Input.TextArea
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder={t('teams.taskPlaceholder')}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    disabled={running}
                  />
                  <Button type="primary" onClick={run} loading={running} disabled={!task.trim()}>
                    {t('teams.run')}
                  </Button>
                  {running && (
                    <Button danger onClick={() => abortRef.current?.abort()}>
                      {t('harness.stop')}
                    </Button>
                  )}
                </Flex>
                <div style={{ flex: 1, overflow: 'auto', marginBottom: 8 }}>
                  {runItems.length === 0 ? (
                    <Typography.Text type="secondary">{t('teams.runHint')}</Typography.Text>
                  ) : (
                    runItems.map((item) => {
                      if (item.kind === 'plan') {
                        return <Alert key={item.id} type="info" message={`📋 ${item.text}`} style={{ marginBottom: 8 }} />;
                      }
                      if (item.kind === 'action') {
                        return (
                          <div key={item.id} style={{ marginBottom: 8 }}>
                            <Tag color="blue">🤖 {item.agent}</Tag>
                            <Typography.Text type="secondary">{item.text}</Typography.Text>
                          </div>
                        );
                      }
                      if (item.kind === 'result') {
                        return (
                          <Card key={item.id} size="small" style={{ marginBottom: 8 }} styles={{ body: { padding: 8 } }}>
                            <Tag color="green">✅ {item.agent}</Tag>
                            <Typography.Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{item.text}</Typography.Paragraph>
                          </Card>
                        );
                      }
                      if (item.kind === 'summary') {
                        return (
                          <Card key={item.id} size="small" style={{ marginBottom: 8, borderColor: '#52c41a' }} styles={{ body: { padding: 8 } }}>
                            <Tag color="gold">🏁 {t('teams.summary')}</Tag>
                            <Typography.Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{item.text}</Typography.Paragraph>
                          </Card>
                        );
                      }
                      return <Alert key={item.id} type="error" message={item.text} style={{ marginBottom: 8 }} showIcon />;
                    })
                  )}
                  <div ref={runEndRef} />
                </div>
                <Card size="small" title={t('teams.history')} styles={{ body: { padding: 8, maxHeight: 200, overflow: 'auto' } }}>
                  {runs.length === 0 ? (
                    <Typography.Text type="secondary">{t('teams.noHistory')}</Typography.Text>
                  ) : (
                    runs.slice(0, 10).map((r) => (
                      <div key={r.id} style={{ marginBottom: 4, fontSize: 13 }}>
                        <Tag color={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'blue'} size="small">
                          {r.status}
                        </Tag>
                        <Typography.Text ellipsis style={{ maxWidth: '70%' }}>{r.task}</Typography.Text>
                      </div>
                    ))
                  )}
                </Card>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 创建团队 */}
      <Drawer
        title={t('teams.create')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={480}
        extra={
          <Button type="primary" onClick={createTeam}>
            {t('teams.create')}
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('teams.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('teams.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="supervisorPrompt" label={t('teams.supervisorPrompt')}>
            <Input.TextArea rows={2} placeholder={t('teams.supervisorPlaceholder')} />
          </Form.Item>
        </Form>
        <Typography.Text strong>{t('teams.members')}（{t('teams.maxMembers')}）</Typography.Text>
        {members.map((m, idx) => (
          <Card key={idx} size="small" style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                placeholder={t('teams.memberName')}
                value={m.name}
                onChange={(e) => setMembers((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
              />
              <Input
                placeholder={t('teams.memberRole')}
                value={m.role}
                onChange={(e) => setMembers((prev) => prev.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)))}
              />
              <Input.TextArea
                placeholder={t('teams.memberPrompt')}
                rows={2}
                value={m.systemPrompt}
                onChange={(e) => setMembers((prev) => prev.map((x, i) => (i === idx ? { ...x, systemPrompt: e.target.value } : x)))}
              />
              <Button
                size="small"
                danger
                disabled={members.length <= 1}
                onClick={() => setMembers((prev) => prev.filter((_, i) => i !== idx))}
              >
                {t('harness.delete')}
              </Button>
            </Space>
          </Card>
        ))}
        <Button
          block
          style={{ marginTop: 8 }}
          disabled={members.length >= 5}
          onClick={() => setMembers((prev) => [...prev, { name: '', role: '', systemPrompt: '' }])}
        >
          + {t('teams.addMember')}
        </Button>
      </Drawer>
    </Flex>
  );
});

export default AgentTeamsPage;
