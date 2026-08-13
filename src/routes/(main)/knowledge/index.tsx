'use client';

import { App, Button, Card, Col, Drawer, Empty, Flex, Form, Input, List, Row, Space, Tag, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { knowledgeBaseService } from '@/services/knowledgeBase';

// 知识库页：库 CRUD + 文档上传/索引 + 检索问答

const KnowledgePage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg } = App.useApp();
  const [bases, setBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [activeBase, setActiveBase] = useState<any>();
  const [docs, setDocs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await knowledgeBaseService.getKnowledgeBaseList();
      setBases(list);
      if (!activeBase && list.length > 0) setActiveBase(list[0]);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [antdMsg, activeBase]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBase = useCallback(async () => {
    const values = await form.validateFields();
    try {
      await knowledgeBaseService.createKnowledgeBase({ title: values.name, description: values.description });
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      antdMsg.error(e.message);
    }
  }, [form, antdMsg, load]);

  const selectBase = useCallback(async (base: any) => {
    setActiveBase(base);
    setResults([]);
    try {
      const res = await knowledgeBaseService.listDocs(base.id);
      setDocs(res?.items || []);
    } catch {
      setDocs([]);
    }
  }, []);

  const uploadDoc = useCallback(
    async (file: File) => {
      if (!activeBase) return;
      try {
        await knowledgeBaseService.indexDoc(activeBase.id, file);
        antdMsg.success(t('knowledge.uploaded'));
        selectBase(activeBase);
      } catch (e: any) {
        antdMsg.error(e.message);
      }
      return false;
    },
    [activeBase, antdMsg, selectBase, t],
  );

  const search = useCallback(async () => {
    if (!activeBase || !query.trim()) return;
    setSearching(true);
    try {
      const res = await knowledgeBaseService.search(activeBase.id, query.trim());
      setResults(res?.results || []);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setSearching(false);
    }
  }, [activeBase, query, antdMsg]);

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左：知识库列表 */}
        <Col flex="280px">
          <Card size="small" title={t('knowledge.bases')} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Button type="primary" block style={{ marginBottom: 8 }} onClick={() => setCreateOpen(true)}>
              {t('knowledge.create')}
            </Button>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <List
                size="small"
                loading={loading}
                dataSource={bases}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(base) => (
                  <List.Item
                    onClick={() => selectBase(base)}
                    style={{ cursor: 'pointer', background: activeBase?.id === base.id ? 'rgba(22,119,255,0.08)' : undefined, borderRadius: 6, padding: '6px 8px' }}
                  >
                    <Flex vertical gap={2}>
                      <Typography.Text strong>{base.title || base.name}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{base.description}</Typography.Text>
                    </Flex>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>

        {/* 右：文档 + 检索 */}
        <Col flex="auto">
          <Card
            size="small"
            title={activeBase ? (activeBase.title || activeBase.name) : t('knowledge.empty')}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12 } }}
          >
            {!activeBase ? (
              <Empty description={t('knowledge.selectHint')} style={{ marginTop: 60 }} />
            ) : (
              <>
                <Upload.Dragger
                  beforeUpload={uploadDoc}
                  showUploadList={false}
                  style={{ padding: 12, marginBottom: 12 }}
                  disabled={!activeBase}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">{t('knowledge.uploadHint')}</p>
                </Upload.Dragger>

                <Flex gap={8} style={{ marginBottom: 12 }}>
                  <Input
                    placeholder={t('knowledge.searchPlaceholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onPressEnter={search}
                  />
                  <Button type="primary" onClick={search} loading={searching}>
                    {t('knowledge.search')}
                  </Button>
                </Flex>

                <div style={{ flex: 1, overflow: 'auto' }}>
                  <Typography.Text strong>{t('knowledge.docs')}（{docs.length}）</Typography.Text>
                  <List
                    size="small"
                    dataSource={docs}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('knowledge.noDocs')} /> }}
                    renderItem={(doc) => (
                      <List.Item>
                        <Space>
                          <Tag>{doc.name}</Tag>
                          <Tag color={doc.status === 'indexed' ? 'green' : doc.status === 'failed' ? 'red' : 'orange'}>{doc.status}</Tag>
                          {doc.chunkCount != null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{doc.chunkCount} chunks</Typography.Text>}
                        </Space>
                      </List.Item>
                    )}
                  />
                  {results.length > 0 && (
                    <>
                      <Typography.Text strong style={{ display: 'block', marginTop: 12 }}>
                        {t('knowledge.results')}
                      </Typography.Text>
                      {results.map((r, i) => (
                        <Card key={i} size="small" style={{ marginTop: 8 }} styles={{ body: { padding: 8 } }}>
                          <Typography.Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{r.content}</Typography.Text>
                          {r.score != null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>  score={r.score?.toFixed?.(2) ?? r.score}</Typography.Text>}
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Drawer title={t('knowledge.create')} open={createOpen} onClose={() => setCreateOpen(false)} width={360}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('knowledge.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('knowledge.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" block onClick={createBase}>
            {t('knowledge.create')}
          </Button>
        </Form>
      </Drawer>
    </Flex>
  );
});

export default KnowledgePage;
