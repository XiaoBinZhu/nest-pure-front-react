'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Progress, Tag, Tooltip } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { Coins, Zap } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useClientDataSWR } from '@/libs/swr';
import { quotaKeys } from '@/libs/swr/keys';
import { quotaService } from '@/services/quota';
import { formatNumber } from '@/utils/format';

const useStyles = createStaticStyles(({ css }) => ({
  container: css`
    padding: 8px;
    margin-bottom: 8px;
    border: 1px solid ${cssVar.colorFillSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorFillQuaternary};
  `,
  label: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  value: css`
    font-size: 13px;
    font-weight: 600;
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
}));

const isUnlimited = (v: number | undefined | null) => Number(v) === -1;

/**
 * 用户悬浮面板中的「我的额度」卡片（Business 插槽）。
 * 显示剩余 token / 剩余金额 / 积分余额 + 使用进度条，低额度时给出醒目提示。
 * 点击跳转设置页「额度」明细。
 */
const BusinessPanelContent = memo(() => {
  const { t } = useTranslation('quota');
  const navigate = useNavigate();

  const { data: quota } = useClientDataSWR(quotaKeys.overview, () => quotaService.getOverview());

  const aiQuota = Number(quota?.aiQuota ?? 0);
  const aiUsedQuota = Number(quota?.aiUsedQuota ?? 0);
  const aiQuotaAmount = Number(quota?.aiQuotaAmount ?? 0);
  const tokenUnlimited = isUnlimited(quota?.aiQuota);
  const amountUnlimited = isUnlimited(quota?.aiQuotaAmount);
  const tokenTotal = tokenUnlimited ? -1 : aiQuota + aiUsedQuota;
  const tokenPercent =
    tokenUnlimited || tokenTotal <= 0 ? 0 : Math.min(100, Math.round((aiUsedQuota / tokenTotal) * 100));
  const lowToken = !tokenUnlimited && tokenTotal > 0 && aiQuota / tokenTotal < 0.2;
  const exhausted = !tokenUnlimited && aiQuota <= 0 && !amountUnlimited && aiQuotaAmount <= 0;

  const openDetails = () => {
    navigate('/settings/credits');
  };

  return (
    <div className={useStyles.container}>
      <Flexbox gap={6}>
        <Flexbox className={useStyles.row}>
          <span className={useStyles.label}>{t('panel.title')}</span>
          <Tooltip title={t('panel.viewDetails')}>
            <Text
              fontSize={12}
              onClick={openDetails}
              style={{ color: cssVar.colorPrimary, cursor: 'pointer' }}
            >
              {t('panel.viewDetails')}
            </Text>
          </Tooltip>
        </Flexbox>

        <Flexbox className={useStyles.row}>
          <Flexbox horizontal align={'center'} gap={4}>
            <Zap size={12} color={cssVar.colorPrimary} />
            <span className={useStyles.label}>{t('overview.tokenRemaining')}</span>
          </Flexbox>
          <Tag bordered={false} color={exhausted || lowToken ? 'error' : 'blue'}>
            {tokenUnlimited ? t('progress.unlimited') : formatNumber(aiQuota)}
          </Tag>
        </Flexbox>

        <Flexbox className={useStyles.row}>
          <Flexbox horizontal align={'center'} gap={4}>
            <Coins size={12} color={cssVar.colorSuccess} />
            <span className={useStyles.label}>{t('overview.pointsBalance')}</span>
          </Flexbox>
          <span className={useStyles.value}>{formatNumber(quota?.pointsBalance ?? 0)}</span>
        </Flexbox>

        {!tokenUnlimited && (
          <Progress
            percent={tokenPercent}
            showInfo={false}
            size={'small'}
            status={exhausted || lowToken ? 'exception' : 'active'}
            strokeColor={exhausted || lowToken ? cssVar.colorError : cssVar.colorPrimary}
          />
        )}

        {(exhausted || lowToken) && (
          <Text fontSize={11} style={{ color: cssVar.colorError }}>
            {exhausted ? t('panel.exhausted') : t('panel.lowHint')}
          </Text>
        )}
      </Flexbox>
    </div>
  );
});

export default BusinessPanelContent;
