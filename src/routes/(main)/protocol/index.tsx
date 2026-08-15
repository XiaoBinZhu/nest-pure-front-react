'use client';

import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  List,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { protocolHubService, type McpServer, type McpSyncResult } from '@/services/protocolHub';

// 协议中心：MCP Server 注册表 + 协议同步（listTools → ToolRegistry）

const ProtocolPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg, modal } = App.useApp();

  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [syncResults, setSyncResults] = useState<Record<string, McpSyncResult>>({});
  const [syncingId, setSyncingId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await protocolHubService.listMcpServers();
      setServers(list || []);
    } catch (e: any) {
      antdMsg.error(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [antdMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const createServer = useCallback(async () => {
    if (!name.trim() || !url.trim()) {
      antdMsg.warning(t('protocol.nameUrlRequired'));
      return;
    }
    try {
      await protocolHubService.createMcpServer({ name: name.trim(), url: url.trim() });
      setName('');
      setUrl('');
      antdMsg.success(t('protocol.created'));
      load();
    } catch (e: any) {
      antdMsg.error(e?.message || String(e));
    }
  }, [name, url, antdMsg, load, t]);

  const sync = useCallback(
    async (server: McpServer) => {
      setSyncingId(server.id);
      try {
        const result = await protocolHubService.syncMcpTools(server.id);
        setSyncResults((prev) => ({ ...prev, [server.id]: result }));
        antdMsg.success(t('protocol.synced', { count: result.syncedTools?.length ?? 0 }));
        load();
      } catch (e: any) {
        antdMsg.error(e?.message || String(e));
      } finally {
        setSyncingId(undefined);
      }
    },
    [antdMsg, load, t],
  );

  const remove = useCallback(
    (server: McpServer) => {
      modal.confirm({
        title: t('protocol.deleteConfirm'),
        onOk: async () => {
          try {
            await protocolHubService.deleteMcpServer(server.id);
            antdMsg.success(t('protocol.deleted'));
            load();
          } catch (e: any) {
            antdMsg.error(e?.message || String(e));
          }
        },
      });
    },
    [antdMsg, load, modal, t],
  );

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Card size="small" title={t('protocol.title')} styles={{ body: { padding: 12 } }}>
        <Flex gap={8} style={{ marginBottom: 12 }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('protocol.namePlaceholder')}
            style={{ width: 220 }}
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('protocol.urlPlaceholder')}
            style={{ width: 400 }}
          />
          <Button type="primary" onClick={createServer}>
            {t('protocol.addServer')}
          </Button>
        </Flex>

        <Row gutter={12}>
          <Col flex="auto">
            <List
              size="small"
              loading={loading}
              dataSource={servers}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('protocol.empty')} /> }}
              renderItem={(server) => (
                <List.Item
                  actions={[
                    <Button
                      key="sync"
                      size="small"
                      type="primary"
                      loading={syncingId === server.id}
                      onClick={() => sync(server)}
                    >
                      {t('protocol.sync')}
                    </Button>,
                    <Button key="del" size="small" danger onClick={() => remove(server)}>
                      {t('protocol.delete')}
                    </Button>,
                  ]}
                >
                  <Flex vertical gap={2} style={{ minWidth: 0 }}>
                    <Space>
                      <Typography.Text strong>{server.name}</Typography.Text>
                      <Tag color={server.status === 'connected' ? 'green' : server.status === 'failed' ? 'red' : 'default'}>
                        {server.status || 'pending'}
                      </Tag>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {server.url}
                    </Typography.Text>
                  </Flex>
                </List.Item>
              )}
            />
          </Col>
          <Col flex="420px">
            <Card
              size="small"
              title={t('protocol.syncResult')}
              style={{ height: '100%', overflow: 'auto' }}
              styles={{ body: { padding: 8 } }}
            >
              {Object.keys(syncResults).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('protocol.noSync')} />
              ) : (
                Object.entries(syncResults).map(([serverId, result]) => (
                  <Flex key={serverId} vertical gap={4} style={{ marginBottom: 8 }}>
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      {servers.find((s) => s.id === serverId)?.name || serverId.slice(0, 8)}
                      <Tag color="green" style={{ marginLeft: 8 }}>
                        {result.syncedTools?.length ?? 0} tools
                      </Tag>
                    </Typography.Text>
                    {(result.syncedTools || []).map((tool) => (
                      <div key={tool.name} style={{ paddingLeft: 12 }}>
                        <Tag color="blue">{tool.name}</Tag>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {tool.description}
                        </Typography.Text>
                      </div>
                    ))}
                  </Flex>
                ))
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    </Flex>
  );
});

export default ProtocolPage;
