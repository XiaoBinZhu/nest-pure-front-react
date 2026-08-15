'use client';

import { BarChart } from '@lobehub/charts';
import { Center, Empty, Flexbox, Skeleton } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import type { TableColumnType } from 'antd';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import {
  developerService,
  type DeveloperUsageByKey,
  type DeveloperUsagePoint,
} from '@/services/developer';
import { formatNumber } from '@/utils/format';

// C 端开发者用量仪表：汇总卡 + 按日折线 + 每 Key 明细
const DeveloperUsagePage = () => {
  const { t } = useTranslation('auth');

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    mutate: mutateSummary,
  } = useClientDataSWR(['developer:usageSummary'], () => developerService.getUsageSummary());

  const { data: daily, isLoading: dailyLoading } = useClientDataSWR(['developer:usageDaily'], () =>
    developerService.getUsage({ granularity: 'day' }),
  );

  const { data: byKey, isLoading: byKeyLoading } = useClientDataSWR(['developer:usageByKey'], () =>
    developerService.getUsage({}),
  );

  const points = (Array.isArray(daily) ? (daily as DeveloperUsagePoint[]) : []).filter(
    (p: DeveloperUsagePoint) => p.day || p.date,
  );
  const chartData = points.map((p: DeveloperUsagePoint) => ({
    day: (p.day || p.date || '').slice(5),
    requests: p.requests ?? 0,
    spend: p.spend ?? 0,
  }));

  const keyRows = (Array.isArray(byKey) ? (byKey as DeveloperUsageByKey[]) : []).filter(
    (r: DeveloperUsageByKey) => r.tokenId,
  );

  const keyColumns: TableColumnType<DeveloperUsageByKey>[] = [
    { dataIndex: 'name', key: 'name', title: t('developer.usage.key'), ellipsis: true },
    { dataIndex: 'keyLast4', key: 'keyLast4', title: t('developer.usage.last4'), width: 120 },
    { dataIndex: 'requests', key: 'requests', title: t('developer.usage.requests'), width: 120 },
    { dataIndex: 'tokens', key: 'tokens', title: t('developer.usage.tokens'), width: 120 },
    {
      dataIndex: 'spend',
      key: 'spend',
      title: t('developer.usage.spend'),
      width: 120,
      render: (v: number) => '$' + formatNumber(v ?? 0, 6),
    },
  ];

  return (
    <Flexbox gap={16}>
      <Row gutter={12}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              loading={summaryLoading}
              title={t('developer.usage.monthRequests')}
              value={summary?.monthRequests ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              loading={summaryLoading}
              precision={6}
              prefix="$"
              title={t('developer.usage.monthSpend')}
              value={summary?.monthSpend ?? 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              loading={summaryLoading}
              precision={4}
              prefix="$"
              title={t('developer.usage.balance')}
              value={summary?.balance ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('developer.usage.dailyTrend')}>
        {summaryError ? (
          <Center height={200} width="100%">
            <Empty
              description={t('developer.usage.loadError')}
              action={
                <Button size="small" type="primary" onClick={() => mutateSummary()}>
                  {t('common.retry', 'Retry')}
                </Button>
              }
            />
          </Center>
        ) : dailyLoading ? (
          <Skeleton.Block height={240} />
        ) : chartData.length === 0 ? (
          <Center height={200} width="100%">
            <Empty description={t('developer.usage.empty')} />
          </Center>
        ) : (
          <BarChart
            categories={['requests', 'spend']}
            data={chartData}
            index="day"
            valueFormatter={(v) => formatNumber(v, 2)}
          />
        )}
      </Card>

      <Card size="small" title={t('developer.usage.perKey')}>
        <Table<DeveloperUsageByKey>
          columns={keyColumns}
          dataSource={keyRows}
          loading={byKeyLoading}
          pagination={false}
          rowKey="tokenId"
          size="small"
          locale={{
            emptyText: (
              <Center height={120} width="100%">
                <Typography.Text type="secondary">{t('developer.usage.empty')}</Typography.Text>
              </Center>
            ),
          }}
        />
      </Card>
    </Flexbox>
  );
};

export default DeveloperUsagePage;
