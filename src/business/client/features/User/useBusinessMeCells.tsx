import { Coins } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useClientDataSWR } from '@/libs/swr';
import { quotaKeys } from '@/libs/swr/keys';
import { quotaService } from '@/services/quota';
import { formatNumber } from '@/utils/format';
import { type CellProps } from '@/components/Cell';

const isUnlimited = (v: number | undefined | null) => Number(v) === -1;

/**
 * 移动端「我」页业务 Cell（C 端额度入口）。
 * 显示剩余 token + 积分余额，点击跳转移动端设置页「额度」明细。
 */
export default function useBusinessMeCells(): CellProps[] {
  const navigate = useNavigate();
  const { data: quota } = useClientDataSWR(quotaKeys.overview, () => quotaService.getOverview());

  const aiQuota = Number(quota?.aiQuota ?? 0);
  const tokenUnlimited = isUnlimited(quota?.aiQuota);
  const points = Number(quota?.pointsBalance ?? 0);

  return [
    {
      icon: Coins,
      key: 'quota',
      label: `我的额度：${tokenUnlimited ? '无限' : formatNumber(aiQuota)} Tokens · ${formatNumber(points)} 积分`,
      onClick: () => {
        navigate('/me/settings/credits');
      },
    },
    {
      type: 'divider',
    },
  ];
}
