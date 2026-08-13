'use client';

import { App, Button, Card, Col, Empty, Flex, Input, List, Row, Select, Space, Tag, Typography } from 'antd';
import { Download, Loader2, Palette, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  generationPortalService,
  type GenerationHistoryItem,
  type GenerationTemplate,
} from '@/services/generationPortal';

// UI 生成页（G1 补全，AC9）：一句话生成 UI 原型 → iframe 沙箱预览 → 下载 → 对话式修改
// SSE 事件：code_chunk（流式代码）→ preview_ready（{html, componentCode, framework}）

const FRAMEWORK_OPTIONS = [
  { value: 'react-antd', label: 'React + Ant Design' },
  { value: 'html-tailwind', label: 'HTML + Tailwind CSS' },
];

const GenerationPage = memo(() => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [framework, setFramework] = useState('react-antd');
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [historyId, setHistoryId] = useState<string | undefined>();
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [templates, setTemplates] = useState<GenerationTemplate[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await generationPortalService.listHistory(1, 20);
      setHistory(data?.items ?? []);
    } catch (e) {
      console.warn('[generate] load history failed', e);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void generationPortalService.getTemplates().then((d) => setTemplates(d?.list ?? [])).catch(() => undefined);
  }, [loadHistory]);

  const handleEvent = useCallback(
    (evt: Parameters<typeof generationPortalService.generate>[2] extends (e: infer E) => void ? E : never) => {
      if (evt.event === 'code_chunk') {
        setCode((prev) => prev + evt.data.text);
      } else if (evt.event === 'preview_ready') {
        setPreviewHtml(evt.data.html);
        setCode(evt.data.componentCode || '');
      } else if (evt.event === 'error') {
        message.error(evt.data.message || evt.data.code);
      }
    },
    [message],
  );

  const onGenerate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    setCode('');
    setPreviewHtml('');
    setHistoryId(undefined);
    try {
      await generationPortalService.generate(text, framework, handleEvent);
      // 生成完成后自动载入最新一条历史 id，使 refine 立即可用；
      // 不覆盖 code/previewHtml（SSE preview_ready 已给出最终产物，列表 code 可能滞后）
      const data = await generationPortalService.listHistory(1, 1);
      const latest = data?.items?.[0];
      if (latest) {
        setHistoryId(latest.id);
      }
      void loadHistory();
    } catch (e: any) {
      message.error(e?.message ?? '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [prompt, framework, generating, handleEvent, message, loadHistory]);

  const onRefine = useCallback(async () => {
    const text = refinePrompt.trim();
    if (!text || refining) return;
    setRefining(true);
    setCode('');
    try {
      await generationPortalService.refine(
        historyId ?? '',
        text,
        code,
        framework,
        handleEvent,
      );
      void loadHistory();
    } catch (e: any) {
      message.error(e?.message ?? '修改失败');
    } finally {
      setRefining(false);
      setRefinePrompt('');
    }
  }, [refinePrompt, refining, historyId, code, framework, handleEvent, message, loadHistory]);

  const onDownload = useCallback(() => {
    const filename = `ui-${Date.now()}.${framework === 'html-tailwind' ? 'html' : 'tsx'}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, framework]);

  const onPickHistory = useCallback(
    async (id: string) => {
      try {
        const item = await generationPortalService.getHistory(id);
        if (item) {
          setHistoryId(id);
          setCode(item.code ?? '');
          setPreviewHtml(item.previewHtml ?? '');
        }
      } catch (e: any) {
        message.error(e?.message ?? '加载历史失败');
      }
    },
    [message],
  );

  const previewSrcDoc = useMemo(() => {
    return previewHtml || (code && framework === 'html-tailwind' ? code : '');
  }, [previewHtml, code, framework]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Palette /> {t('navigation.uiGenerator', 'UI 生成')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        一句话描述你的界面需求，AI 将生成可运行的 UI 原型（{t('navigation.uiGeneratorDesc', 'React + Ant Design / HTML + Tailwind')}）
      </Typography.Paragraph>

      <Row gutter={16}>
        <Col span={24}>
          <Card size="small" title="生成器">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPressEnter={onGenerate}
                placeholder="例如：一个带搜索和分页的部门成员用量表格页"
                disabled={generating}
                allowClear
              />
              <Select value={framework} onChange={setFramework} options={FRAMEWORK_OPTIONS} style={{ width: 220 }} />
              <Button type="primary" icon={generating ? <Loader2 className="animate-spin" /> : undefined} onClick={onGenerate} disabled={generating || !prompt.trim()}>
                {generating ? '生成中...' : '生成'}
              </Button>
            </Space.Compact>
            {templates.length > 0 && (
              <Flex wrap gap={6} style={{ marginTop: 10 }}>
                {templates.map((tp) => (
                  <Tag
                    key={tp.id}
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setPrompt(tp.description);
                      setFramework(tp.framework);
                    }}
                  >
                    {tp.name}
                  </Tag>
                ))}
              </Flex>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="代码"
            extra={
              <Space>
                <Button size="small" icon={<Download />} onClick={onDownload} disabled={!code}>
                  下载
                </Button>
                <Button
                  size="small"
                  icon={<RefreshCw />}
                  onClick={onRefine}
                  disabled={!historyId || !refinePrompt.trim() || refining}
                >
                  {refining ? '修改中...' : '按修改意见重生成'}
                </Button>
              </Space>
            }
          >
            <Input.TextArea
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="修改意见：例如 改成深色主题，表格加序号列"
              style={{ marginBottom: 8 }}
              disabled={refining || !historyId}
            />
            <pre
              style={{
                minHeight: 420,
                maxHeight: 620,
                overflow: 'auto',
                margin: 0,
                padding: 12,
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {code || (generating ? '生成中...' : '点击"生成"开始')}
            </pre>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="预览" style={{ minHeight: 560 }}>
            {previewSrcDoc ? (
              <iframe
                title="ui-preview"
                srcDoc={previewSrcDoc}
                style={{ width: '100%', minHeight: 500, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}
                sandbox="allow-scripts allow-modals"
              />
            ) : (
              <Empty description={generating ? '原型生成中，请稍候...' : '生成后此处展示 UI 预览'} style={{ paddingTop: 160 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="我的生成历史" style={{ marginTop: 16 }}>
        <List
          dataSource={history}
          locale={{ emptyText: '暂无生成记录' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="load" size="small" type="link" onClick={() => void onPickHistory(item.id)}>
                  载入
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {item.message}
                    <Tag color={item.status === 'done' ? 'green' : 'orange'}>{item.status}</Tag>
                  </Space>
                }
                description={`${item.framework} · ${new Date(item.createdAt).toLocaleString()}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
});

GenerationPage.displayName = 'GenerationPage';

export default GenerationPage;
