'use client';

import { Center, Empty, Flexbox, Input } from '@lobehub/ui';
import { Button, confirmModal, createModal, Switch, useModalContext } from '@lobehub/ui/base-ui';
import { App, Input as AntInput, Select, Table, Tag, Typography } from 'antd';
import type { TableColumnType } from 'antd';
import { Plus, RefreshCw, Send, Trash } from 'lucide-react';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { developerService, type MyWebhook, type WebhookEvent } from '@/services/developer';

const EVENT_OPTIONS: WebhookEvent[] = ['usage.spend_alert', 'request.failed'];

const WebhookCreateContent: FC<{
  onSubmit: (v: { url: string; events: WebhookEvent[]; secret?: string }) => Promise<void>;
}> = ({ onSubmit }) => {
  const { t } = useTranslation('auth');
  const { close } = useModalContext();
  const { message } = App.useApp();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['usage.spend_alert']);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!url.trim().startsWith('https://')) {
      message.warning(t('developer.webhooks.urlInvalid'));
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ url: url.trim(), events, secret: secret.trim() || undefined });
      close();
    } catch (e: any) {
      message.error(e?.message || t('common.operationFailed', 'Operation failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Flexbox gap={4}>
        <Typography.Text>{t('developer.webhooks.url')}</Typography.Text>
        <Input
          autoFocus
          placeholder="https://example.com/hooks/usage"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={submit}
        />
      </Flexbox>
      <Flexbox gap={4}>
        <Typography.Text>{t('developer.webhooks.events')}</Typography.Text>
        <Select
          mode="multiple"
          options={EVENT_OPTIONS.map((e) => ({ label: e, value: e }))}
          style={{ width: '100%' }}
          value={events}
          onChange={setEvents}
        />
      </Flexbox>
      <Flexbox gap={4}>
        <Typography.Text>{t('developer.webhooks.secret')}</Typography.Text>
        <AntInput.Password
          placeholder={t('developer.webhooks.secretPlaceholder')}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </Flexbox>
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button onClick={close}>{t('developer.tokens.cancel')}</Button>
        <Button loading={loading} type="primary" onClick={submit}>
          {t('developer.webhooks.create')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

// C 端 Webhook 设置页
const WebhookPage = () => {
  const { t } = useTranslation('auth');
  const { message } = App.useApp();

  const {
    data: webhooks,
    isLoading,
    error,
    mutate,
  } = useClientDataSWR(['developer:webhooks'], () => developerService.listWebhooks());

  const openCreate = () => {
    createModal({
      content: (
        <WebhookCreateContent
          onSubmit={async (v) => {
            await developerService.createWebhook(v);
            message.success(t('developer.webhooks.created'));
            await mutate();
          }}
        />
      ),
      footer: null,
      maskClosable: true,
      styles: { content: { paddingBlock: 16, paddingInline: 24 } },
      title: t('developer.webhooks.create'),
      width: 'min(90vw, 560px)',
    });
  };

  const handleDelete = (w: MyWebhook) => {
    confirmModal({
      content: t('developer.webhooks.deleteConfirm'),
      okButtonProps: { danger: true },
      okText: t('developer.tokens.delete'),
      onOk: async () => {
        await developerService.deleteWebhook(w.id);
        message.success(t('developer.webhooks.deleted'));
        await mutate();
      },
      title: t('developer.tokens.delete'),
    });
  };

  const columns: TableColumnType<MyWebhook>[] = [
    { dataIndex: 'url', key: 'url', title: t('developer.webhooks.url'), ellipsis: true },
    {
      dataIndex: 'events',
      key: 'events',
      title: t('developer.webhooks.events'),
      render: (events: WebhookEvent[]) =>
        (events || []).map((e) => (
          <Tag key={e} style={{ marginBottom: 4 }}>
            {e}
          </Tag>
        )),
    },
    {
      dataIndex: 'enabled',
      key: 'enabled',
      title: t('developer.webhooks.enabled'),
      width: 100,
      render: (v: boolean, w: MyWebhook) => (
        <Switch
          checked={!!v}
          onChange={async (checked) => {
            await developerService.updateWebhook(w.id, { enabled: checked }).catch((e) => {
              message.error(e?.message);
            });
            await mutate();
          }}
        />
      ),
    },
    {
      dataIndex: 'lastStatus',
      key: 'lastStatus',
      title: t('developer.webhooks.lastStatus'),
      width: 120,
      render: (v: number | null | undefined, w: MyWebhook) => {
        if (v == null) return <Tag>{t('developer.webhooks.never')}</Tag>;
        const ok = v >= 200 && v < 300;
        return <Tag color={ok ? 'green' : 'red'}>{v}</Tag>;
      },
    },
    {
      key: 'actions',
      title: t('developer.tokens.actions'),
      width: 160,
      render: (_: unknown, w: MyWebhook) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Button
            icon={Send}
            size="small"
            title={t('developer.webhooks.test')}
            type="text"
            onClick={async () => {
              try {
                await developerService.testWebhook(w.id);
                message.success(t('developer.webhooks.testSent'));
              } catch (e: any) {
                message.error(e?.message);
              }
              await mutate();
            }}
          />
          <Button
            icon={RefreshCw}
            size="small"
            title={t('developer.webhooks.redeliver')}
            type="text"
            onClick={async () => {
              try {
                await developerService.redeliverWebhook(w.id);
                message.success(t('developer.webhooks.redelivered'));
              } catch (e: any) {
                message.error(e?.message);
              }
              await mutate();
            }}
          />
          <Button
            danger
            icon={Trash}
            size="small"
            title={t('developer.tokens.delete')}
            type="text"
            onClick={() => handleDelete(w)}
          />
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={Plus} type="primary" onClick={openCreate}>
          {t('developer.webhooks.create')}
        </Button>
      </div>
      {error ? (
        <Center height={240} width="100%">
          <Empty
            description={t('developer.webhooks.loadError')}
            action={
              <Button size="small" type="primary" onClick={() => mutate()}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          />
        </Center>
      ) : (
        <Table<MyWebhook>
          columns={columns}
          dataSource={webhooks || []}
          loading={isLoading}
          pagination={false}
          rowKey="id"
          size="small"
          locale={{
            emptyText: (
              <Center height={240} width="100%">
                <Empty description={t('developer.webhooks.empty')} />
              </Center>
            ),
          }}
        />
      )}
    </div>
  );
};

export default WebhookPage;
