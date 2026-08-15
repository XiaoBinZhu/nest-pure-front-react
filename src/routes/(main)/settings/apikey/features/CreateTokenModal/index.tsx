'use client';

import { Flexbox, Input } from '@lobehub/ui';
import { Button, createModal, type ModalInstance, useModalContext } from '@lobehub/ui/base-ui';
import { App, DatePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { t } from 'i18next';
import { Copy } from 'lucide-react';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';

import { type CreateMyTokenResult } from '@/services/developer';

// 一次性明文回显：创建/轮换后仅显示一次 + 复制按钮
const TokenResult: FC<{ plaintext: string }> = ({ plaintext }) => {
  const { t: tt } = useTranslation('auth');
  const { close } = useModalContext();
  const { message } = App.useApp();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plaintext);
      message.success(tt('developer.tokens.copied'));
    } catch {
      message.error(tt('apikey.display.copyError'));
    }
  };

  return (
    <Flexbox gap={16}>
      <Typography.Text type="secondary">{tt('developer.tokens.onceOnly')}</Typography.Text>
      <Typography.Paragraph
        copyable={{ text: plaintext, tooltips: false }}
        style={{
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 8,
          fontFamily: 'monospace',
          padding: '10px 12px',
          wordBreak: 'break-all',
        }}
      >
        {plaintext}
      </Typography.Paragraph>
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button onClick={close}>{tt('developer.tokens.done')}</Button>
        <Button icon={Copy} type="primary" onClick={copy}>
          {tt('developer.tokens.copy')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

interface CreateTokenContentProps {
  onSubmit: (values: { name: string; expiresAt?: string | null }) => Promise<CreateMyTokenResult>;
}

// 创建表单 → 一次性明文回显
const CreateTokenContent: FC<CreateTokenContentProps> = ({ onSubmit }) => {
  const { t: tt } = useTranslation('auth');
  const { close } = useModalContext();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateMyTokenResult>();

  const submit = async () => {
    if (!name.trim()) {
      message.warning(tt('apikey.validation.required'));
      return;
    }
    setLoading(true);
    try {
      const r = await onSubmit({
        name: name.trim(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
      setResult(r);
    } catch (e: any) {
      message.error(e?.message || tt('common.operationFailed', 'Operation failed'));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return <TokenResult plaintext={result.plaintext} />;
  }

  return (
    <Flexbox gap={16}>
      <Flexbox gap={4}>
        <Typography.Text>{tt('developer.tokens.name')}</Typography.Text>
        <Input
          autoFocus
          placeholder={tt('developer.tokens.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={submit}
        />
      </Flexbox>
      <Flexbox gap={4}>
        <Typography.Text>{tt('developer.tokens.expiresAt')}</Typography.Text>
        <DatePicker
          minDate={dayjs()}
          showNow={false}
          style={{ width: '100%' }}
          value={expiresAt}
          onChange={(d) => setExpiresAt(d)}
        />
      </Flexbox>
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button onClick={close}>{tt('developer.tokens.cancel')}</Button>
        <Button loading={loading} type="primary" onClick={submit}>
          {tt('developer.tokens.create')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export const openCreateTokenModal = (props: CreateTokenContentProps): ModalInstance =>
  createModal({
    content: <CreateTokenContent {...props} />,
    footer: null,
    maskClosable: true,
    styles: { content: { paddingBlock: 16, paddingInline: 24 } },
    title: t('developer.tokens.createTitle', { ns: 'auth' }),
    width: 'min(90vw, 560px)',
  });

export const openTokenResultModal = (plaintext: string): ModalInstance =>
  createModal({
    content: <TokenResult plaintext={plaintext} />,
    footer: null,
    maskClosable: false,
    styles: { content: { paddingBlock: 16, paddingInline: 24 } },
    title: t('developer.tokens.resultTitle', { ns: 'auth' }),
    width: 'min(90vw, 560px)',
  });
