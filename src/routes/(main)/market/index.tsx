'use client';

import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Flex,
  Input,
  List,
  Rate,
  Row,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tabs,
  Typography,
  Descriptions,
  Divider,
} from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { unzip } from 'fflate';
import { memo, useCallback, useEffect, useState } from 'react';

import { discoverService } from '@/services/discover';
import { marketplaceService } from '@/services/marketplace';
import { agentSkillService } from '@/services/skill';
import { useToolStore } from '@/store/tool';

const { Text, Paragraph, Title } = Typography;

type TabKey = 'agents' | 'skills' | 'mcp' | 'plugins' | 'models' | 'providers';

interface MarketItemCard {
  identifier: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  author?: string;
  installCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  isOfficial?: boolean;
  tags?: string[];
  raw?: any;
}

const PAGE_SIZE = 24;

const MarketPage = memo(() => {
  const { message: antdMsg } = App.useApp();

  const [tab, setTab] = useState<TabKey>('agents');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<MarketItemCard[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MarketItemCard | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [skillZipFiles, setSkillZipFiles] = useState<{ path: string; content: string }[]>([]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'agents') {
        const [res, cats] = await Promise.all([
          discoverService.getAssistantList({
            page, pageSize: PAGE_SIZE,
            category: category === 'all' ? undefined : category,
            q: keyword || undefined,
          }),
          discoverService.getAssistantCategories().catch(() => []),
        ]);
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.title || it.name || it.identifier,
          description: it.description || '', icon: it.avatar || it.meta?.avatar,
          category: it.category, author: it.author,
          installCount: it.installCount ?? it.cloneCount,
          ratingAvg: it.ratingAvg ?? it.rating, ratingCount: it.ratingCount,
          isFeatured: it.isFeatured, tags: it.tags || [], raw: it,
        })));
        setCategories(cats || []);
        setTotal(res.totalCount || res.items?.length || 0);
      } else if (tab === 'skills') {
        const [res, cats] = await Promise.all([
          discoverService.getSkillList({ page, pageSize: PAGE_SIZE, category: category === 'all' ? undefined : category, q: keyword || undefined }),
          discoverService.getSkillCategories().catch(() => []),
        ]);
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.name, description: it.description || '',
          icon: it.icon, category: it.category, author: it.author,
          installCount: it.installCount, ratingAvg: it.ratingAvg, ratingCount: it.ratingCount,
          isFeatured: it.isFeatured, isOfficial: it.isOfficial, tags: it.tags || [], raw: it,
        })));
        setCategories(cats || []);
        setTotal(res.totalCount || 0);
      } else if (tab === 'mcp') {
        const [res, cats] = await Promise.all([
          discoverService.getMcpList({ page, pageSize: PAGE_SIZE, category: category === 'all' ? undefined : category, q: keyword || undefined }),
          discoverService.getMcpCategories().catch(() => []),
        ]);
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.name, description: it.description || '',
          icon: it.icon, category: it.category, author: it.author,
          installCount: it.installCount, isFeatured: it.isFeatured, isOfficial: it.isOfficial,
          tags: it.tags || [], raw: it,
        })));
        setCategories(cats || []);
        setTotal(res.totalCount || 0);
      } else if (tab === 'plugins') {
        const res = await discoverService.getPluginList({ page, pageSize: PAGE_SIZE, category: category === 'all' ? undefined : category, q: keyword || undefined });
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.meta?.title || it.name || it.identifier,
          description: it.meta?.description || it.description || '', icon: it.meta?.avatar || it.icon,
          category: it.category, author: it.author, installCount: it.installCount,
          isFeatured: it.isFeatured, isOfficial: it.isOfficial,
          tags: it.meta?.tags || it.tags || [], raw: it,
        })));
        setCategories([]);
        setTotal(res.totalCount || 0);
      } else if (tab === 'models') {
        const res = await discoverService.getModelList({ page, pageSize: PAGE_SIZE, q: keyword || undefined });
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.displayName || it.identifier,
          description: it.description || it.identifier,
          icon: it.type === 'chat' ? '💬' : it.type === 'embedding' ? '🧮' : it.type === 'image' ? '🎨' : '🤖',
          category: it.category, author: it.provider, raw: it,
        })));
        setCategories([]);
        setTotal(res.totalCount || 0);
      } else if (tab === 'providers') {
        const res = await discoverService.getProviderList({ page, pageSize: PAGE_SIZE, q: keyword || undefined });
        setItems((res.items || []).map((it: any) => ({
          identifier: it.identifier, name: it.name || it.identifier,
          description: it.description || it.modelCount + ' 个模型', icon: it.avatar,
          author: it.identifier, installCount: it.modelCount, raw: it,
        })));
        setCategories([]);
        setTotal(res.totalCount || 0);
      }
    } catch (e: any) {
      antdMsg.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tab, page, category, keyword, reloadKey, antdMsg]);

  useEffect(() => {
    setPage(1);
  }, [tab, category, keyword, reloadKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============ 详情 ============
  const marketDownloadUrl = useCallback((identifier: string, type: 'skills' | 'plugins') => {
    const base = process.env.NEXT_PUBLIC_MARKET_BASE_URL || '';
    return base + '/api/v1/' + type + '/' + encodeURIComponent(identifier) + '/download';
  }, []);

  const openDetail = useCallback(async (item: MarketItemCard) => {
    setDetailItem(item);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setSkillZipFiles([]);
    try {
      if (tab === 'agents') {
        const d = await discoverService.getAssistantDetail({ identifier: item.identifier });
        setDetailData(d || item.raw);
      } else if (tab === 'skills') {
        const d = await discoverService.getSkillDetail({ identifier: item.identifier });
        setDetailData(d || item.raw);
        try {
          const res = await fetch(marketDownloadUrl(item.identifier, 'skills'));
          const buf = await res.arrayBuffer();
          unzip(new Uint8Array(buf), (err, files) => {
            if (err) return;
            const list: { path: string; content: string }[] = [];
            const decoder = new TextDecoder();
            for (const [path, data] of Object.entries(files)) {
              const slash = path.indexOf('/');
              const clean = slash >= 0 ? path.slice(slash + 1) : path;
              if (!clean || path.endsWith('/') || path.includes('__MACOSX')) continue;
              if (clean.endsWith('.md') || clean.endsWith('.txt') || clean.endsWith('.yaml') || clean.endsWith('.json') || clean.endsWith('.ts') || clean.endsWith('.js')) {
                list.push({ path: clean, content: decoder.decode(data) });
              }
            }
            list.sort((a, b) => a.path.localeCompare(b.path));
            setSkillZipFiles(list);
          });
        } catch {
          // zip 预览失败不阻塞
        }
      } else if (tab === 'mcp') {
        const d = await discoverService.getMcpDetail({ identifier: item.identifier });
        setDetailData(d || item.raw);
      } else if (tab === 'plugins') {
        const d = await discoverService.getPluginDetail({ identifier: item.identifier });
        setDetailData(d || item.raw);
      } else {
        setDetailData(item.raw);
      }
    } catch (e: any) {
      antdMsg.warning(e?.message || '详情加载失败');
      setDetailData(item.raw);
    } finally {
      setDetailLoading(false);
    }
  }, [tab, antdMsg, marketDownloadUrl]);

  // ============ 安装动作 ============
  const [installingId, setInstallingId] = useState<string>('');

  const handleInstall = useCallback(
    async (item: MarketItemCard) => {
      setInstallingId(item.identifier);
      try {
        if (tab === 'agents') {
          const res = await marketplaceService.clone(item.identifier);
          antdMsg.success(res?.message || '已克隆到工作区，可在对话中使用');
        } else if (tab === 'skills') {
          await agentSkillService.importFromMarket(item.identifier);
          antdMsg.success('技能安装成功，可在 Agent 技能库中管理');
        } else if (tab === 'mcp') {
          const store = useToolStore.getState() as any;
          if (typeof store.installMCPPlugin === 'function') {
            const ok = await store.installMCPPlugin(item.identifier);
            if (ok === false) antdMsg.info('安装向导已打开，请按提示完成配置');
            else antdMsg.success('MCP 已安装');
          } else {
            antdMsg.info('请前往设置 → MCP 中添加该服务器');
          }
        } else {
          antdMsg.info('该类型支持浏览与预览，安装请前往对应设置页');
        }
      } catch (e: any) {
        antdMsg.error(e?.message || '安装失败');
      } finally {
        setInstallingId('');
      }
    },
    [tab, antdMsg],
  );

  // ============ 渲染 ============
  const renderCard = (item: MarketItemCard) => (
    <Card key={item.identifier} hoverable size="small" styles={{ body: { padding: 14 } }} onClick={() => openDetail(item)}>
      <Flex vertical gap={8}>
        <Flex align="center" gap={10}>
          <span style={{ fontSize: 30, lineHeight: 1 }}>{item.icon || '🤖'}</span>
          <Flex vertical flex={1} style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ fontSize: 14 }}>{item.name}</Text>
            <Space size={4} wrap>
              {item.isOfficial && <Tag color="gold" style={{ fontSize: 10, marginInlineEnd: 0 }}>官方</Tag>}
              {item.isFeatured && <Tag color="blue" style={{ fontSize: 10, marginInlineEnd: 0 }}>推荐</Tag>}
              {item.category && <Tag style={{ fontSize: 10, marginInlineEnd: 0 }}>{item.category}</Tag>}
            </Space>
          </Flex>
        </Flex>
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12, margin: 0, minHeight: 36 }}>
          {item.description}
        </Paragraph>
        <Flex justify="space-between" align="center">
          <Space size={6}>
            {item.ratingAvg != null && (
              <Space size={2}>
                <Rate disabled allowHalf value={item.ratingAvg} style={{ fontSize: 11 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>{Number(item.ratingAvg).toFixed(1)}</Text>
              </Space>
            )}
            {item.installCount != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>{item.installCount} 安装</Text>
            )}
          </Space>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<DownloadOutlined />}
            loading={installingId === item.identifier}
            onClick={(e) => {
              e.stopPropagation();
              handleInstall(item);
            }}
          >
            安装
          </Button>
        </Flex>
      </Flex>
    </Card>
  );

  const tabItems = [
    { key: 'agents', label: '🤖 Agent 助手' },
    { key: 'skills', label: '🧩 Skill 技能' },
    { key: 'mcp', label: '🔌 MCP 服务器' },
    { key: 'plugins', label: '🧰 Plugin 插件' },
    { key: 'models', label: '💬 模型' },
    { key: 'providers', label: '☁️ 供应商' },
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Space size={12}>
            <Title level={4} style={{ margin: 0 }}>🛍️ AI 功能市场</Title>
            <Tabs activeKey={tab} onChange={(k) => setTab(k as TabKey)} items={tabItems} size="small" style={{ marginBottom: 0 }} />
          </Space>
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="搜索市场…" allowClear style={{ width: 220 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Button icon={<ReloadOutlined />} onClick={reload} />
          </Space>
        </Flex>
      </Card>

      {/* 分类 */}
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Space size={4} wrap>
          <Tag key="all" color={category === 'all' ? 'blue' : undefined} style={{ cursor: 'pointer', marginInlineEnd: 4 }} onClick={() => setCategory('all')}>全部</Tag>
          {categories.map((c) => (
            <Tag key={c.category} color={category === c.category ? 'blue' : undefined} style={{ cursor: 'pointer', marginInlineEnd: 4 }} onClick={() => setCategory(c.category)}>
              {c.category}{c.count != null ? ' (' + c.count + ')' : ''}
            </Tag>
          ))}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 个条目</Text>
      </Flex>

      {/* 列表 */}
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description="暂无条目，管理员可在后台导入" style={{ padding: 48 }} />
          ) : (
            <Row gutter={[12, 12]}>
              {items.map((it) => (
                <Col key={it.identifier} xs={24} sm={12} md={8} lg={6} xl={4} xxl={4}>
                  {renderCard(it)}
                </Col>
              ))}
            </Row>
          )}
        </Spin>
        {total > PAGE_SIZE && (
          <Flex justify="end" style={{ marginTop: 16 }}>
            <List
              style={{ width: '100%' }}
              pagination={{
                current: page,
                pageSize: PAGE_SIZE,
                total,
                onChange: (p) => setPage(p),
                showSizeChanger: false,
                size: 'small',
              }}
              dataSource={[]}
              renderItem={() => null}
            />
          </Flex>
        )}
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={Math.min(680, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 680)}
        title={<Space><span style={{ fontSize: 22 }}>{detailItem?.icon || '🤖'}</span><span>{detailItem?.name}</span></Space>}
        extra={
          <Button type="primary" icon={<DownloadOutlined />} loading={installingId === detailItem?.identifier} onClick={() => detailItem && handleInstall(detailItem)}>
            安装
          </Button>
        }
      >
        {detailLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <Flex vertical gap={12}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="标识">{detailItem?.identifier || '-'}</Descriptions.Item>
              <Descriptions.Item label="分类">{detailItem?.category || '-'}</Descriptions.Item>
              {detailItem?.author != null && <Descriptions.Item label="作者">{detailItem.author}</Descriptions.Item>}
              {detailItem?.installCount != null && <Descriptions.Item label="安装">{detailItem.installCount}</Descriptions.Item>}
            </Descriptions>
            <Paragraph type="secondary">{detailItem?.description}</Paragraph>

            {tab === 'skills' && skillZipFiles.length > 0 && (
              <>
                <Divider orientation="left" plain style={{ margin: '4px 0' }}>技能内容预览</Divider>
                <Flex vertical gap={8} style={{ maxHeight: 360, overflow: 'auto' }}>
                  {skillZipFiles.map((f) => (
                    <Card key={f.path} size="small" styles={{ body: { padding: '8px 12px' } }}>
                      <Text code style={{ fontSize: 12 }}>{f.path}</Text>
                      <pre style={{ marginTop: 6, marginBottom: 0, maxHeight: 200, overflow: 'auto', fontSize: 11, background: '#f6f8fa', borderRadius: 6, padding: 8, whiteSpace: 'pre-wrap' }}>
                        {f.content.slice(0, 4000)}
                      </pre>
                    </Card>
                  ))}
                </Flex>
              </>
            )}

            {detailData && (detailData.manifest || detailData.tools) && (
              <>
                <Divider orientation="left" plain style={{ margin: '4px 0' }}>能力清单</Divider>
                {Array.isArray(detailData.tools) && detailData.tools.length > 0 && (
                  <List
                    size="small"
                    dataSource={detailData.tools}
                    renderItem={(tool: any) => (
                      <List.Item>
                        <List.Item.Meta
                          title={<Text code>{tool.name}</Text>}
                          description={<Text type="secondary" style={{ fontSize: 12 }}>{tool.description}</Text>}
                        />
                      </List.Item>
                    )}
                  />
                )}
                {detailData.manifest && (
                  <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 11, background: '#f6f8fa', borderRadius: 6, padding: 10 }}>
                    {JSON.stringify(detailData.manifest, null, 2).slice(0, 6000)}
                  </pre>
                )}
              </>
            )}

            {tab === 'agents' && detailData?.config?.systemRole && (
              <>
                <Divider orientation="left" plain style={{ margin: '4px 0' }}>系统提示词</Divider>
                <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12, background: '#f6f8fa', borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap' }}>
                  {detailData.config.systemRole}
                </pre>
              </>
            )}
          </Flex>
        )}
      </Drawer>
    </Flex>
  );
});

MarketPage.displayName = 'MarketPage';

export default MarketPage;
