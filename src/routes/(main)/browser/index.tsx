'use client';

import { App, Button, Card, Col, Empty, Flex, Image, Input, Row, Space, Spin, Tag, Typography } from 'antd';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { browserAgentService } from '@/services/browserAgent';

// 浏览器 Agent：真实 Playwright 会话 + 导航/点击/输入/JS 执行/截图

const BrowserPage = memo(() => {
  const { t } = useTranslation('auth');
  const { message: antdMsg } = App.useApp();

  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);

  const [url, setUrl] = useState('https://example.com');
  const [selector, setSelector] = useState('');
  const [text, setText] = useState('');
  const [expression, setExpression] = useState('document.title');

  const [snapshot, setSnapshot] = useState<{ url?: string; title?: string; content?: string }>();
  const [screenshot, setScreenshot] = useState<string>();
  const [evalResult, setEvalResult] = useState<any>();

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e: any) {
        antdMsg.error(e?.message || String(e));
      } finally {
        setBusy(false);
      }
    },
    [antdMsg],
  );

  const createSession = useCallback(() => {
    run(async () => {
      const s = await browserAgentService.createSession();
      setSessionId(s.id);
      setSnapshot(undefined);
      setScreenshot(undefined);
      setEvalResult(undefined);
      antdMsg.success(t('browser.created'));
    });
  }, [run, t]);

  const navigate = useCallback(() => {
    if (!sessionId) return;
    run(async () => {
      const s = await browserAgentService.navigate(sessionId, url);
      setSnapshot({ url: s.url, title: s.title, content: s.content });
      const shot = await browserAgentService.screenshot(sessionId);
      setScreenshot(shot.screenshot);
    });
  }, [run, sessionId, url]);

  const click = useCallback(() => {
    if (!sessionId || !selector.trim()) return;
    run(async () => {
      await browserAgentService.click(sessionId, selector.trim());
      antdMsg.success(t('browser.clicked'));
      const shot = await browserAgentService.screenshot(sessionId);
      setScreenshot(shot.screenshot);
    });
  }, [run, sessionId, selector, t]);

  const type = useCallback(() => {
    if (!sessionId || !selector.trim() || !text) return;
    run(async () => {
      await browserAgentService.type(sessionId, selector.trim(), text);
      antdMsg.success(t('browser.typed'));
    });
  }, [run, sessionId, selector, text, t]);

  const evaluate = useCallback(() => {
    if (!sessionId || !expression.trim()) return;
    run(async () => {
      const r = await browserAgentService.evaluate(sessionId, expression.trim());
      setEvalResult(r.result);
    });
  }, [run, sessionId, expression]);

  const screenshotOnly = useCallback(() => {
    if (!sessionId) return;
    run(async () => {
      const shot = await browserAgentService.screenshot(sessionId);
      setScreenshot(shot.screenshot);
    });
  }, [run, sessionId]);

  const closeSession = useCallback(() => {
    if (!sessionId) return;
    run(async () => {
      await browserAgentService.close(sessionId);
      setSessionId(undefined);
      setSnapshot(undefined);
      setScreenshot(undefined);
      setEvalResult(undefined);
      antdMsg.success(t('browser.closed'));
    });
  }, [run, sessionId, t]);

  return (
    <Flex vertical gap={12} style={{ height: '100%', padding: 16 }}>
      <Card
        size="small"
        title={t('browser.title')}
        extra={
          <Space>
            {sessionId ? <Tag color="green">session: {sessionId.slice(0, 12)}…</Tag> : <Tag>no session</Tag>}
            <Button type="primary" onClick={createSession} loading={busy}>
              {t('browser.newSession')}
            </Button>
            {sessionId && (
              <Button danger onClick={closeSession} loading={busy}>
                {t('browser.close')}
              </Button>
            )}
          </Space>
        }
        styles={{ body: { padding: 12 } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Flex gap={8} wrap>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={{ width: 320 }}
              addonBefore="URL"
            />
            <Button type="primary" onClick={navigate} loading={busy} disabled={!sessionId}>
              {t('browser.navigate')}
            </Button>
            <Button onClick={screenshotOnly} loading={busy} disabled={!sessionId}>
              {t('browser.screenshot')}
            </Button>
          </Flex>

          <Flex gap={8} wrap>
            <Input
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="selector, e.g. #submit-btn"
              style={{ width: 240 }}
              addonBefore="selector"
            />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="text"
              style={{ width: 200 }}
              addonBefore="text"
            />
            <Button onClick={click} loading={busy} disabled={!sessionId}>
              {t('browser.click')}
            </Button>
            <Button onClick={type} loading={busy} disabled={!sessionId}>
              {t('browser.type')}
            </Button>
          </Flex>

          <Flex gap={8} wrap>
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="document.title"
              style={{ width: 400 }}
              addonBefore="JS"
            />
            <Button onClick={evaluate} loading={busy} disabled={!sessionId}>
              {t('browser.evaluate')}
            </Button>
          </Flex>
        </Space>
      </Card>

      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        <Col flex="420px">
          <Card size="small" title={t('browser.screenshot')} style={{ height: '100%', overflow: 'auto' }} styles={{ body: { padding: 8 } }}>
            {screenshot ? (
              <Image src={`data:image/png;base64,${screenshot}`} alt="screenshot" style={{ width: '100%' }} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('browser.noScreenshot')} />
            )}
          </Card>
        </Col>
        <Col flex="auto">
          <Flex vertical gap={12} style={{ height: '100%' }}>
            <Card size="small" title={t('browser.content')} style={{ flex: 1, minHeight: 0, overflow: 'auto' }} styles={{ body: { padding: 12 } }}>
              {snapshot ? (
                <Flex vertical gap={8}>
                  <Typography.Text strong>{snapshot.title || '-'}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {snapshot.url}
                  </Typography.Text>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#333' }}>
                    {(snapshot.content || '').slice(0, 4000) || t('browser.noContent')}
                  </div>
                </Flex>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('browser.noContent')} />
              )}
            </Card>
            <Card size="small" title={t('browser.evalResult')} style={{ height: 180, overflow: 'auto' }} styles={{ body: { padding: 12 } }}>
              {evalResult === undefined ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('browser.noEval')}
                </Typography.Text>
              ) : (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(evalResult, null, 2)}</pre>
              )}
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
});

export default BrowserPage;
