'use client';

import { Card, Col, DatePicker, Input, Progress, Row, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import { useClientDataSWR } from '@/libs/swr';
import { deptUsageKeys } from '@/libs/swr/keys';
import { deptUsageService, type DeptMemberRow } from '@/services/deptUsage';
import { formatNumber, formatTokenNumber } from '@/utils/format';

// 部门负责人数据看板
// 数据范围由后端 DataScopeService 解析：admin→全量 / 部门负责人→本部门 / 普通用户→仅自己
// 普通用户访问时后端仅返回自身数据（scope=self），前端仍展示（入口由导航控制）

const DeptStats = memo(() => {
  const { t } = useTranslation('auth');
  const [month, setMonth] = useState<dayjs.Dayjs>(dayjs(new Date()));
  const [keyword, setKeyword] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const year = month.year();
  const monthNum = month.month() + 1;

  const { data: overview, error: overviewError, mutate: mutateOverview } = useClientDataSWR(
    deptUsageKeys.overview(year, monthNum),
    () => deptUsageService.getOverview(year, monthNum),
  );

  const { data: members, error: membersError, mutate: mutateMembers } = useClientDataSWR(
    deptUsageKeys.members({ year, month: monthNum, keyword, page, pageSize }),
    () => deptUsageService.getMembers({ year, month: monthNum, keyword, page, pageSize }),
  );

  const { data: models, error: modelsError, mutate: mutateModels } = useClientDataSWR(
    deptUsageKeys.models(year, monthNum),
    () => deptUsageService.getModels(year, monthNum),
  );

  const { data: trend, error: trendError, mutate: mutateTrend } = useClientDataSWR(
    deptUsageKeys.trend(year, monthNum),
    () => deptUsageService.getTrend(year, monthNum),
  );

  useEffect(() => {
    mutateOverview();
    mutateMembers();
    mutateModels();
    mutateTrend();
  }, [year, monthNum]);

  const memberColumns = useMemo(
    () => [
      {
        title: '#',
        width: 60,
        render: (_: unknown, __: DeptMemberRow, index: number) => (page - 1) * pageSize + index + 1,
      },
      {
        title: t('stats.member.username'),
        dataIndex: 'username',
        key: 'username',
        render: (_: string, row: DeptMemberRow) => (
          <Typography.Text strong>{row.nickname || row.username}</Typography.Text>
        ),
      },
      { title: t('stats.member.nickname'), dataIndex: 'nickname', key: 'nickname' },
      {
        title: t('stats.member.requestCount'),
        dataIndex: 'requestCount',
        key: 'requestCount',
        sorter: (a: DeptMemberRow, b: DeptMemberRow) => Number(a.requestCount) - Number(b.requestCount),
        render: (v: string) => formatNumber(Number(v)),
      },
      {
        title: t('stats.member.totalTokens'),
        dataIndex: 'totalTokens',
        key: 'totalTokens',
        sorter: (a: DeptMemberRow, b: DeptMemberRow) => Number(a.totalTokens) - Number(b.totalTokens),
        render: (v: string) => formatTokenNumber(Number(v)),
      },
      {
        title: t('stats.member.cost'),
        dataIndex: 'sellAmount',
        key: 'sellAmount',
        sorter: (a: DeptMemberRow, b: DeptMemberRow) => Number(a.sellAmount) - Number(b.sellAmount),
        render: (v: string) => `$${formatNumber(Number(v), 4)}`,
      },
    ],
    [page, pageSize, t],
  );

  const modelColumns = useMemo(
    () => [
      { title: t('stats.model.name'), dataIndex: 'model', key: 'model' },
      {
        title: t('stats.model.requestCount'),
        dataIndex: 'requestCount',
        key: 'requestCount',
        render: (v: string) => formatNumber(Number(v)),
      },
      {
        title: t('stats.model.totalTokens'),
        dataIndex: 'totalTokens',
        key: 'totalTokens',
        render: (v: string) => formatTokenNumber(Number(v)),
      },
      {
        title: t('stats.model.cost'),
        dataIndex: 'sellAmount',
        key: 'sellAmount',
        render: (v: string) => `$${formatNumber(Number(v), 4)}`,
      },
    ],
    [t],
  );

  // 模型分布占比（按 token）
  const maxTokens = useMemo(() => {
    if (!models || models.length === 0) return 1;
    return Math.max(...models.map((m) => Number(m.totalTokens)));
  }, [models]);

  const trendMax = useMemo(() => {
    if (!trend || trend.length === 0) return 1;
    return Math.max(...trend.map((d) => Number(d.totalTokens)));
  }, [trend]);

  return (
    <>
      <Typography.Title level={4}>{t('stats.dept.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('stats.dept.description')}（{month.format('YYYY-MM')}）
      </Typography.Paragraph>

      {/* ===== 总览卡片 ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={t('stats.dept.memberCount')} value={overview?.memberCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('stats.dept.activeMemberCount')}
              value={Number(overview?.activeMemberCount ?? 0)}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('stats.dept.totalTokens')}
              value={formatTokenNumber(Number(overview?.totalTokens ?? 0))}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('stats.dept.totalCost')}
              value={`$${formatNumber(Number(overview?.sellAmount ?? 0), 4)}`}
            />
          </Card>
        </Col>
      </Row>

      {/* ===== 成员用量排行 ===== */}
      <Card
        title={t('stats.dept.members')}
        style={{ marginBottom: 24 }}
        extra={
          <>
            <DatePicker
              picker="month"
              value={month}
              onChange={(d) => d && setMonth(d)}
              style={{ marginRight: 8 }}
            />
            <Input.Search
              allowClear
              placeholder={t('stats.dept.searchPlaceholder')}
              onSearch={(v) => {
                setKeyword(v || undefined);
                setPage(1);
              }}
              style={{ width: 220 }}
            />
          </>
        }
      >
        <AsyncBoundary data={members} error={membersError} errorVariant="block">
          <Table<DeptMemberRow>
            columns={memberColumns}
            dataSource={members?.items ?? []}
            loading={!members}
            pagination={{
              current: page,
              pageSize,
              total: members?.total ?? 0,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
              showSizeChanger: true,
              showTotal: (total) => `${t('stats.dept.total')}: ${total}`,
            }}
            rowKey="userId"
            size="small"
          />
        </AsyncBoundary>
      </Card>

      <Row gutter={[16, 16]}>
        {/* ===== 模型使用分布 ===== */}
        <Col xs={24} lg={12}>
          <Card title={t('stats.dept.models')}>
            <AsyncBoundary data={models} error={modelsError} errorVariant="block">
              {models && models.length > 0 ? (
                models.slice(0, 10).map((m) => (
                  <div key={m.model} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Typography.Text ellipsis style={{ maxWidth: '60%' }}>
                        <Tag color="blue">{m.model}</Tag>
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {formatTokenNumber(Number(m.totalTokens))} · $
                        {formatNumber(Number(m.sellAmount), 4)}
                      </Typography.Text>
                    </div>
                    <Progress
                      percent={Math.round((Number(m.totalTokens) / maxTokens) * 100)}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))
              ) : (
                <Typography.Text type="secondary">{t('stats.dept.noData')}</Typography.Text>
              )}
            </AsyncBoundary>
          </Card>
        </Col>

        {/* ===== 用量趋势 ===== */}
        <Col xs={24} lg={12}>
          <Card title={t('stats.dept.trend')}>
            <AsyncBoundary data={trend} error={trendError} errorVariant="block">
              {trend && trend.length > 0 ? (
                trend.map((d) => (
                  <div key={d.date} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Typography.Text>{dayjs(d.date).format('MM-DD')}</Typography.Text>
                      <Typography.Text type="secondary">
                        {formatTokenNumber(Number(d.totalTokens))} · {formatNumber(Number(d.requestCount))}{' '}
                        {t('stats.dept.requests')}
                      </Typography.Text>
                    </div>
                    <Progress
                      percent={Math.round((Number(d.totalTokens) / trendMax) * 100)}
                      showInfo={false}
                      size="small"
                      strokeColor="#1677ff"
                    />
                  </div>
                ))
              ) : (
                <Typography.Text type="secondary">{t('stats.dept.noData')}</Typography.Text>
              )}
            </AsyncBoundary>
          </Card>
        </Col>
      </Row>
    </>
  );
});

export default DeptStats;
