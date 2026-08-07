'use client';

import { App, Button, Card, Empty, Flex, Input, List, Space, Table, Tag, Typography } from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { hitlService, type HitlApproval } from '@/services/hitl';

// HITL 审批中心：审批单 + 策略

const HitlPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg } = App.useApp();
  const [approvals, setApprovals] = useState<HitlApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>();
  const [policies, setPolicies] = useState<any[]>([]);
  const [policyTool, setPolicyTool] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hitlService.listApprovals({ status, page: 1, pageSize: 50 });
      setApprovals(res.items || []);
      const p = await hitlService.listPolicies();
      setPolicies(p || []);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, antdMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(
    async (row: HitlApproval, decision: 'approve' | 'reject') => {
      try {
        if (decision === 'approve') await hitlService.approve(row.id);
        else await hitlService.reject(row.id);
        antdMsg.success(t('hitl.decided'));
        load();
      } catch (e: any) {
        antdMsg.error(e.message);
      }
    },
    [antdMsg, load, t],
  );

  const addPolicy = useCallback(async () => {
    if (!policyTool.trim()) return;
    try {
      await hitlService.createPolicy({ tool: policyTool.trim() });
      setPolicyTool('');
      load();
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [policyTool, antdMsg, load]);

  const columns = [
    { title: t('hitl.tool'), dataIndex: 'tool', width: 130 },
    {
      title: t('hitl.args'),
      dataIndex: 'args',
      render: (v: any) => <Typography.Text style={{ fontSize: 12 }}>{JSON.stringify(v || {})}</Typography.Text>,
    },
    { title: t('hitl.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('hitl.risk'),
      dataIndex: 'risk',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'DANGEROUS' ? 'red' : v === 'MODERATE' ? 'orange' : 'green'}>{v}</Tag>
      ),
    },
    {
      title: t('hitl.status'),
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : v === 'expired' ? 'default' : 'orange'}>{v}</Tag>
      ),
    },
    {
      title: t('hitl.actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, row: HitlApproval) =>
        row.status === 'pending' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => decide(row, 'approve')}>
              {t('hitl.approve')}
            </Button>
            <Button size="small" danger onClick={() => decide(row, 'reject')}>
              {t('hitl.reject')}
            </Button>
          </Space>
        ) : null,
    },
    {
      title: t('hitl.createdAt'),
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Card size="small" title={t('hitl.title')} styles={{ body: { padding: 12 } }}>
        <Space style={{ marginBottom: 12 }}>
          <Tag
            style={{ cursor: 'pointer' }}
            color={!status ? 'blue' : undefined}
            onClick={() => setStatus(undefined)}
          >
            {t('hitl.all')}
          </Tag>
          {['pending', 'approved', 'rejected', 'expired'].map((s) => (
            <Tag
              key={s}
              style={{ cursor: 'pointer' }}
              color={status === s ? 'blue' : undefined}
              onClick={() => setStatus(s)}
            >
              {s}
            </Tag>
          ))}
        </Space>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={approvals}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hitl.empty')} /> }}
          pagination={false}
        />
      </Card>

      <Card size="small" title={t('hitl.policies')} styles={{ body: { padding: 12 } }}>
        <Flex gap={8} style={{ marginBottom: 12 }}>
          <Input
            placeholder={t('hitl.policyPlaceholder')}
            value={policyTool}
            onChange={(e) => setPolicyTool(e.target.value)}
            onPressEnter={addPolicy}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={addPolicy}>
            {t('hitl.addPolicy')}
          </Button>
        </Flex>
        <List
          size="small"
          dataSource={policies}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          renderItem={(p) => (
            <List.Item>
              <Tag>{p.tool}</Tag>
              <Tag color={p.defaultRisk === 'DANGEROUS' ? 'red' : 'orange'}>{p.defaultRisk}</Tag>
              <Tag color={p.forceApproval ? 'blue' : 'default'}>{p.forceApproval ? t('hitl.forceOn') : t('hitl.forceOff')}</Tag>
            </List.Item>
          )}
        />
      </Card>
    </Flex>
  );
});

export default HitlPage;
