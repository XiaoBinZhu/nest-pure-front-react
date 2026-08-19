'use client';

import { Center, Empty, Flexbox } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Card, Col, Row, Table, Tabs, Tag, Typography } from 'antd';
import type { TableColumnType } from 'antd';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { developerService, type DeveloperModel } from '@/services/developer';
import { formatNumber } from '@/utils/format';

const KEY_PLACEHOLDER = '$MASS_API_KEY';

const curlExample = [
  'curl https://<your-domain>/v1/chat/completions \\',
  '  -H "Authorization: Bearer $MASS_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  '  -d \'{"model":"<model-id>","messages":[{"role":"user","content":"hello"}]}\'',
].join('\n');

const jsExample = [
  "const res = await fetch('https://<your-domain>/v1/chat/completions', {",
  "  method: 'POST',",
  '  headers: {',
  "    'Authorization': 'Bearer ' + process.env.MASS_API_KEY,",
  "    'Content-Type': 'application/json',",
  '  },',
  '  body: JSON.stringify({',
  "    model: '<model-id>',",
  "    messages: [{ role: 'user', content: 'hello' }],",
  '  }),',
  '});',
  'const data = await res.json();',
].join('\n');

const pythonExample = [
  'import os',
  'from openai import OpenAI',
  '',
  'client = OpenAI(',
  '    base_url="https://<your-domain>/v1",',
  '    api_key=os.environ.get("MASS_API_KEY"),',
  ')',
  'resp = client.chat.completions.create(',
  '    model="<model-id>",',
  '    messages=[{"role": "user", "content": "hello"}],',
  ')',
  'print(resp.choices[0].message.content)',
].join('\n');

const ENDPOINTS = [
  'POST /v1/chat/completions',
  'POST /v1/completions',
  'POST /v1/embeddings',
  'GET /v1/models',
  'GET /v1/models/:id',
  'POST /v1/images/generations',
  'POST /v1/audio/speech',
  'POST /v1/audio/transcriptions',
  'POST /v1/responses',
  'GET/POST /v1/files',
  'GET/POST /v1/batches',
  'GET/POST /v1/fine_tuning/jobs',
];

// C 端开发者中心：公开模型目录 + 定价 + 示例 + 端点清单
const DeveloperPage = () => {
  const { t } = useTranslation('auth');

  const {
    data: models,
    isLoading,
    error,
    mutate,
  } = useClientDataSWR(['developer:models'], () => developerService.getModels());

  const modelColumns: TableColumnType<DeveloperModel>[] = [
    { dataIndex: 'id', key: 'id', title: t('developer.docs.model'), ellipsis: true },
    {
      dataIndex: 'context_length',
      key: 'context_length',
      title: t('developer.docs.context'),
      width: 140,
      render: (v: number) => (v ? formatNumber(v, 0) : '-'),
    },
    {
      dataIndex: 'capabilities',
      key: 'capabilities',
      title: t('developer.docs.capabilities'),
      render: (v: string[]) =>
        (v || []).map((c) => (
          <Tag key={c} style={{ marginBottom: 4 }}>
            {c}
          </Tag>
        )),
    },
    {
      dataIndex: 'modalities',
      key: 'modalities',
      title: t('developer.docs.modalities'),
      render: (v: string[]) => (v || []).join(', ') || '-',
    },
    {
      dataIndex: 'pricing',
      key: 'pricing',
      title: t('developer.docs.pricing'),
      render: (v: Record<string, unknown>) => {
        if (!v) return '-';
        const input = (v.input as number) ?? (v.prompt as number);
        const output = (v.output as number) ?? (v.completion as number);
        const unit = (v.unit as string) || '';
        return [
          input != null ? 'in $' + formatNumber(input, 6) + unit : null,
          output != null ? 'out $' + formatNumber(output, 6) + unit : null,
        ]
          .filter(Boolean)
          .join(' · ');
      },
    },
  ];

  const codeBlock = (code: string) => (
    <Typography.Paragraph
      copyable={{ text: code }}
      style={{
        background: '#1f1f1f',
        borderRadius: 8,
        color: '#d4d4d4',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: 12,
        whiteSpace: 'pre-wrap',
      }}
    >
      {code}
    </Typography.Paragraph>
  );

  return (
    <Flexbox gap={16} style={{ padding: 16 }}>
      <Card size="small" title={t('developer.docs.models')}>
        {error ? (
          <Center height={200} width="100%">
            <Empty
              description={t('developer.docs.loadError')}
              action={
                <Button size="small" type="primary" onClick={() => mutate()}>
                  {t('common.retry', 'Retry')}
                </Button>
              }
            />
          </Center>
        ) : (
          <Table<DeveloperModel>
            columns={modelColumns}
            dataSource={models || []}
            loading={isLoading}
            pagination={false}
            rowKey="id"
            size="small"
            locale={{
              emptyText: (
                <Center height={160} width="100%">
                  <Empty description={t('developer.docs.empty')} />
                </Center>
              ),
            }}
          />
        )}
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title={t('developer.docs.examples')}>
            <Tabs
              size="small"
              items={[
                { key: 'curl', label: 'curl', children: codeBlock(curlExample) },
                { key: 'js', label: 'JavaScript', children: codeBlock(jsExample) },
                { key: 'python', label: 'Python', children: codeBlock(pythonExample) },
              ]}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('developer.docs.keyPlaceholder')}: {KEY_PLACEHOLDER}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('developer.docs.endpoints')}>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {ENDPOINTS.map((e) => (
                <li key={e}>
                  <Typography.Text code style={{ fontSize: 12 }}>
                    {e}
                  </Typography.Text>
                </li>
              ))}
            </ul>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {t('developer.docs.rateLimitNote')}
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default DeveloperPage;
