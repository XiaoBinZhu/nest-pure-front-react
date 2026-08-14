'use client';

import { Block, Flexbox, Grid, Text } from '@lobehub/ui';
import { Alert, Button, List, Progress, Table, Tag } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { Coins, RefreshCw, Zap } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import StatisticCard from '@/components/StatisticCard';
import { useClientDataSWR } from '@/libs/swr';
import { quotaKeys } from '@/libs/swr/keys';
import { quotaService, type PointTransactionItem } from '@/services/quota';
import { formatNumber } from '@/utils/format';

const useStyles = createStaticStyles(({ css }) => ({
  cardTitle: css`
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
  `,
}));

const TX_TYPE_MAP: Record<number, string> = {
  1: 'topup',
  2: 'consume',
  3: 'refund',
  4: 'adjust',
  5: 'checkin',
  6: 'gift',
  7: 'redeem',
};

const isUnlimited = (v: number | undefined | null) => Number(v) === -1;

const Credits = memo(() => {
  const { t } = useTranslation('quota');

  const now = dayjs();
  const { data: quota, isLoading: quotaLoading, mutate } = useClientDataSWR(
    quotaKeys.overview,
    () => quotaService.getOverview(),
  );
  const { data: summary, isLoading: summaryLoading } = useClientDataSWR(quotaKeys.summary, () =>
    quotaService.getUsageSummary(now.year(), now.month() + 1),
  );
  const { data: txPage, isLoading: txLoading } = useClientDataSWR(quotaKeys.transactions, () =>
    quotaService.getTransactions({ page: 1, pageSize: 10 }),
  );
  const { data: recentLogs, isLoading: recentLoading } = useClientDataSWR(quotaKeys.recent, () =>
    quotaService.getRecentLogs(10),
  );

  const handleRefresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  const aiQuota = Number(quota?.aiQuota ?? 0);
  const aiUsedQuota = Number(quota?.aiUsedQuota ?? 0);
  const aiQuotaAmount = Number(quota?.aiQuotaAmount ?? 0);
  const aiUsedQuotaAmount = Number(quota?.aiUsedQuotaAmount ?? 0);
  const tokenUnlimited = isUnlimited(quota?.aiQuota);
  const amountUnlimited = isUnlimited(quota?.aiQuotaAmount);
  const tokenTotal = tokenUnlimited ? -1 : aiQuota + aiUsedQuota;
  const amountTotal = amountUnlimited ? -1 : aiQuotaAmount + aiUsedQuotaAmount;
  const tokenPercent =
    tokenUnlimited || tokenTotal <= 0 ? 0 : Math.min(100, Math.round((aiUsedQuota / tokenTotal) * 100));
  const amountPercent =
    amountUnlimited || amountTotal <= 0
      ? 0
      : Math.min(100, Math.round((aiUsedQuotaAmount / amountTotal) * 100));

  const lowToken = !tokenUnlimited && tokenTotal > 0 && aiQuota / tokenTotal < 0.2;
  const exhausted = !tokenUnlimited && aiQuota <= 0 && !amountUnlimited && aiQuotaAmount <= 0;

  const txList: PointTransactionItem[] = txPage?.list ?? [];

  const columns = [
    {
      dataIndex: 'type',
      key: 'type',
      render: (v: number) => (
        <Tag color={v === 2 ? 'blue' : v === 1 ? 'green' : 'default'}>
          {t(`transactions.typeMap.${TX_TYPE_MAP[v] ?? 'adjust'}`, { defaultValue: TX_TYPE_MAP[v] ?? 'adjust' })}
        </Tag>
      ),
      title: t('transactions.type'),
      width: 90,
    },
    {
      dataIndex: 'delta',
      key: 'delta',
      render: (v: number) => (
        <span style={{ color: v > 0 ? cssVar.colorSuccess : cssVar.colorText }}>{v > 0 ? `+${v}` : v}</span>
      ),
      title: t('transactions.delta'),
      width: 110,
    },
    {
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      title: t('transactions.balanceAfter'),
      width: 120,
    },
    {
      dataIndex: 'source',
      key: 'source',
      render: (v: string | null) => v || '-',
      title: t('transactions.source'),
      width: 120,
    },
    {
      dataIndex: 'remark',
      ellipsis: true,
      key: 'remark',
      render: (v: string | null) => v || '-',
      title: t('transactions.remark'),
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      title: t('transactions.time'),
      width: 160,
    },
  ];

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      {/* 页头 */}
      <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
        <Text fontSize={16} weight={500}>
          {t('overview.title')}
        </Text>
        <Button icon={<RefreshCw size={14} />} size={'small'} onClick={handleRefresh}>
          {t('overview.refresh')}
        </Button>
      </Flexbox>

      {exhausted ? (
        <Alert
          description={t('panel.lowHint')}
          showIcon
          title={t('panel.exhausted')}
          type={'error'}
        />
      ) : lowToken ? (
        <Alert description={t('panel.lowHint')} showIcon title={t('panel.exhausted')} type={'warning'} />
      ) : null}

      {/* 额度总览卡片 */}
      <Grid gap={8} maxItemWidth={260} rows={2}>
        <StatisticCard
          loading={quotaLoading}
          statistic={{
            description: (
              <Text fontSize={12} type={'secondary'}>
                {t('overview.tokenUsed')}: {formatNumber(aiUsedQuota)}
              </Text>
            ),
            prefix: <Zap size={16} />,
            value: tokenUnlimited ? '∞' : formatNumber(aiQuota),
          }}
          title={t('overview.tokenRemaining')}
        />
        <StatisticCard
          loading={quotaLoading}
          statistic={{
            description: (
              <Text fontSize={12} type={'secondary'}>
                {t('overview.amountUsed')}: ${formatNumber(aiUsedQuotaAmount, 2)}
              </Text>
            ),
            prefix: '$',
            value: amountUnlimited ? '∞' : formatNumber(aiQuotaAmount, 2),
          }}
          title={t('overview.amountRemaining')}
        />
        <StatisticCard
          loading={quotaLoading}
          statistic={{
            description: (
              <Text fontSize={12} type={'secondary'}>
                {t('overview.pointsGranted')}: {formatNumber(quota?.pointsTotalGranted ?? 0)}
              </Text>
            ),
            prefix: <Coins size={16} />,
            value: formatNumber(quota?.pointsBalance ?? 0),
          }}
          title={t('overview.pointsBalance')}
        />
        <StatisticCard
          loading={quotaLoading}
          statistic={{
            description: (
              <Text fontSize={12} type={'secondary'}>
                {t('billingMode')}: {t('billingModeDesc')}
              </Text>
            ),
            prefix: <Coins size={16} />,
            value: formatNumber(quota?.pointsTotalConsumed ?? 0),
          }}
          title={t('overview.pointsConsumed')}
        />
      </Grid>

      {/* 使用进度 */}
      <Block gap={16} padding={16} variant={'outlined'}>
        <Flexbox gap={8}>
          <Flexbox horizontal justify={'space-between'}>
            <span>{t('progress.token')}</span>
            <Text type={'secondary'}>
              {t('progress.remaining')}: {tokenUnlimited ? '∞' : formatNumber(aiQuota)}
            </Text>
          </Flexbox>
          <Progress percent={tokenUnlimited ? 0 : tokenPercent} showInfo={false} strokeColor={'#1677ff'} />
        </Flexbox>
        <Flexbox gap={8}>
          <Flexbox horizontal justify={'space-between'}>
            <span>{t('progress.amount')}</span>
            <Text type={'secondary'}>
              {t('progress.remaining')}: ${amountUnlimited ? '∞' : formatNumber(aiQuotaAmount, 2)}
            </Text>
          </Flexbox>
          <Progress percent={amountUnlimited ? 0 : amountPercent} showInfo={false} strokeColor={'#52c41a'} />
        </Flexbox>
      </Block>

      {/* 本月使用情况 */}
      <Block gap={16} padding={16} variant={'outlined'}>
        <div className={useStyles.cardTitle}>{t('usage.title')}</div>
        <Grid gap={8} maxItemWidth={220} rows={1}>
          <StatisticCard
            loading={summaryLoading}
            statistic={{ value: formatNumber(Number(summary?.inputTokens ?? 0)) }}
            title={t('usage.monthInput')}
          />
          <StatisticCard
            loading={summaryLoading}
            statistic={{ value: formatNumber(Number(summary?.outputTokens ?? 0)) }}
            title={t('usage.monthOutput')}
          />
          <StatisticCard
            loading={summaryLoading}
            statistic={{
              prefix: '$',
              precision: 2,
              value: formatNumber(Number(summary?.costAmount ?? 0), 2),
            }}
            title={t('usage.monthCost')}
          />
          <StatisticCard
            loading={summaryLoading}
            statistic={{ value: formatNumber(Number(summary?.requestCount ?? 0)) }}
            title={t('usage.monthRequests')}
          />
        </Grid>

        <div className={useStyles.cardTitle}>{t('usage.recentTitle')}</div>
        <List
          dataSource={recentLogs ?? []}
          loading={recentLoading}
          locale={{ emptyText: t('usage.empty') }}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <Flexbox horizontal gap={8} justify={'space-between'} width={'100%'}>
                <Text ellipsis style={{ maxWidth: '50%' }}>
                  {item.model || `#${item.id}`}
                </Text>
                <Text type={'secondary'}>{formatNumber(Number(item.totalTokens ?? 0))} tokens</Text>
                <Text type={'secondary'}>${formatNumber(Number(item.costAmount ?? 0), 4)}</Text>
                <Text type={'secondary'}>
                  {item.createdAt ? dayjs(item.createdAt).format('MM-DD HH:mm') : '-'}
                </Text>
              </Flexbox>
            </List.Item>
          )}
        />
      </Block>

      {/* 积分流水 */}
      <Block gap={16} padding={16} variant={'outlined'}>
        <div className={useStyles.cardTitle}>{t('transactions.title')}</div>
        <Table
          columns={columns as any}
          dataSource={txList}
          loading={txLoading}
          locale={{ emptyText: t('empty') }}
          pagination={{ pageSize: 10, total: txPage?.total ?? 0 }}
          rowKey={'id'}
          size={'small'}
        />
      </Block>
    </Flexbox>
  );
});

export default Credits;
