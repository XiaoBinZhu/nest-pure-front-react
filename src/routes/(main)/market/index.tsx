'use client';

import { App, Button, Card, Col, Empty, Flex, List, Rate, Row, Space, Tag, Typography } from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { marketplaceService, type MarketAgent } from '@/services/marketplace';

// Agent 市场页：浏览/克隆/评分

const MarketPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg } = App.useApp();
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>();
  const [mine, setMine] = useState<MarketAgent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.listAgents({ category, page: 1, pageSize: 50 });
      setAgents(res.items || []);
      const cats = await marketplaceService.getCategories();
      setCategories(cats || []);
      const mineList = await marketplaceService.mine();
      setMine(mineList || []);
    } catch (e: any) {
      antdMsg.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [category, antdMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const clone = useCallback(
    async (agent: MarketAgent) => {
      try {
        await marketplaceService.clone(agent.id);
        antdMsg.success(t('market.cloned'));
        load();
      } catch (e: any) {
        antdMsg.error(e.message);
      }
    },
    [antdMsg, load, t],
  );

  const rate = useCallback(
    async (agent: MarketAgent, value: number) => {
      try {
        await marketplaceService.rate(agent.id, value);
        antdMsg.success(t('market.rated'));
        load();
      } catch (e: any) {
        antdMsg.error(e.message);
      }
    },
    [antdMsg, load, t],
  );

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Card size="small" title={t('market.title')} styles={{ body: { padding: 12 } }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Tag style={{ cursor: 'pointer' }} color={!category ? 'blue' : undefined} onClick={() => setCategory(undefined)}>
            {t('market.all')}
          </Tag>
          {categories.map((c) => (
            <Tag key={c} style={{ cursor: 'pointer' }} color={category === c ? 'blue' : undefined} onClick={() => setCategory(c)}>
              {c}
            </Tag>
          ))}
        </Space>
        <Row gutter={[12, 12]}>
          {(agents || []).map((agent) => (
            <Col key={agent.id} xs={24} sm={12} lg={8} xl={6}>
              <Card size="small" hoverable>
                <Flex vertical gap={6}>
                  <Typography.Text strong ellipsis>{agent.title}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, minHeight: 36 }}>
                    {(agent.description || '').slice(0, 80)}
                  </Typography.Text>
                  <Space size={4} wrap>
                    {(agent.tags || []).map((tag) => (
                      <Tag key={tag} size="small">{tag}</Tag>
                    ))}
                  </Space>
                  <Space size={8}>
                    <Rate disabled value={agent.rating || 0} style={{ fontSize: 12 }} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {agent.ratingCount} 评 · {agent.cloneCount} 克隆
                    </Typography.Text>
                  </Space>
                  <Flex justify="space-between">
                    <Tag color={agent.status === 'approved' ? 'green' : 'orange'} size="small">{agent.status}</Tag>
                    <Button size="small" type="primary" disabled={agent.status !== 'approved'} onClick={() => clone(agent)}>
                      {t('market.clone')}
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
        {(agents || []).length === 0 && !loading && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('market.empty')} style={{ marginTop: 40 }} />
        )}
      </Card>

      {mine.length > 0 && (
        <Card size="small" title={t('market.mine')} styles={{ body: { padding: 12 } }}>
          <Space wrap>
            {mine.map((m) => (
              <Tag key={m.id} color={m.status === 'approved' ? 'green' : m.status === 'pending' ? 'orange' : 'red'}>
                {m.title}（{m.status}）
              </Tag>
            ))}
          </Space>
        </Card>
      )}
    </Flex>
  );
});

export default MarketPage;
