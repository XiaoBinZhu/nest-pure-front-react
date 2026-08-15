'use client';

import { Center, Empty } from '@lobehub/ui';
import { Button, confirmModal } from '@lobehub/ui/base-ui';
import { App, Table, Tag, Typography } from 'antd';
import type { TableColumnType } from 'antd';
import { Plus, RefreshCw, Trash } from 'lucide-react';
import { useCallback, type FC } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { developerService, type MyToken } from '@/services/developer';
import { formatDate } from '@/utils/format';

import { openCreateTokenModal, openTokenResultModal } from './CreateTokenModal';

// C 端开发者 API Key 自助页：列表 / 创建（一次性明文）/ 轮换 / 删除
const ApiKey: FC = () => {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();

  const {
    data: tokens,
    isLoading,
    error,
    mutate,
  } = useClientDataSWR(['developer:tokens'], () => developerService.listMyTokens());

  const handleCreate = useCallback(() => {
    openCreateTokenModal({
      onSubmit: async (values) => {
        const r = await developerService.createMyToken({
          name: values.name,
          expiresAt: values.expiresAt,
        });
        await mutate();
        return r;
      },
    });
  }, [mutate]);

  const handleRotate = useCallback(
    (token: MyToken) => {
      confirmModal({
        content: t('developer.tokens.rotateConfirm'),
        okButtonProps: { danger: true },
        okText: t('developer.tokens.rotate'),
        onOk: async () => {
          const r = await developerService.rotateMyToken(token.id);
          await mutate();
          openTokenResultModal(r.plaintext);
        },
        title: t('developer.tokens.rotate'),
      });
    },
    [mutate, t],
  );

  const handleDelete = useCallback(
    (token: MyToken) => {
      confirmModal({
        content: t('developer.tokens.deleteConfirm'),
        okButtonProps: { danger: true },
        okText: t('developer.tokens.delete'),
        onOk: async () => {
          await developerService.deleteMyToken(token.id);
          message.success(t('developer.tokens.deleted'));
          await mutate();
        },
        title: t('developer.tokens.delete'),
      });
    },
    [message, mutate, t],
  );

  const columns: TableColumnType<MyToken>[] = [
    { dataIndex: 'name', key: 'name', title: t('developer.tokens.name'), ellipsis: true },
    {
      dataIndex: 'key',
      key: 'key',
      title: t('developer.tokens.key'),
      render: (_: unknown, token: MyToken) => {
        const last4 = token.keyLast4 || '';
        const prefix = token.keyPrefix || 'sk-****';
        return (
          <Typography.Text code copyable={false} style={{ fontSize: 12 }}>
            {prefix}
            {last4}
          </Typography.Text>
        );
      },
    },
    {
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      title: t('developer.tokens.expiresAt'),
      render: (v: string | null) =>
        v ? formatDate(new Date(v)) : t('developer.tokens.neverExpires'),
    },
    {
      dataIndex: 'usage',
      key: 'usage',
      title: t('developer.tokens.usage'),
      render: (_: unknown, token: MyToken) =>
        token.quota != null
          ? (token.usedQuota ?? 0) + ' / ' + token.quota
          : (token.usedQuota ?? '-'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      title: t('developer.tokens.status'),
      render: (v: MyToken['status']) => {
        const color = v === 'active' ? 'green' : v === 'expired' ? 'default' : 'orange';
        return <Tag color={color}>{t('developer.tokens.status.' + v)}</Tag>;
      },
    },
    {
      key: 'actions',
      title: t('developer.tokens.actions'),
      width: 160,
      render: (_: unknown, token: MyToken) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Button
            icon={RefreshCw}
            size="small"
            title={t('developer.tokens.rotate')}
            type="text"
            onClick={() => handleRotate(token)}
          />
          <Button
            danger
            icon={Trash}
            size="small"
            title={t('developer.tokens.delete')}
            type="text"
            onClick={() => handleDelete(token)}
          />
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={Plus} type="primary" onClick={handleCreate}>
          {t('developer.tokens.create')}
        </Button>
      </div>
      {error ? (
        <Center height={240} width="100%">
          <Empty
            description={t('developer.tokens.loadError')}
            action={
              <Button size="small" type="primary" onClick={() => mutate()}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          />
        </Center>
      ) : (
        <Table<MyToken>
          columns={columns}
          dataSource={tokens || []}
          loading={isLoading}
          pagination={false}
          rowKey="id"
          size="small"
          locale={{
            emptyText: (
              <Center height={240} width="100%">
                <Empty description={t('developer.tokens.empty')} />
              </Center>
            ),
          }}
        />
      )}
    </div>
  );
};

export default ApiKey;
