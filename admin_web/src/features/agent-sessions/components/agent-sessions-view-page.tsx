'use client';

import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';

type AgentSessionStatus = 'active' | 'closed' | 'archived';

type AgentSessionRow = {
  id: string;
  tenantId: string;
  clientIds: string[];
  title: string | null;
  status: AgentSessionStatus;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentMessageRow = {
  id: string;
  sessionId: string;
  seq: number;
  authorType: 'agent' | 'system' | 'tool';
  authorId: string | null;
  content: string | null;
  contentJson: any;
  createdAt: string;
};

type ClientLite = {
  id: string;
  name: string;
};

function formatDateTime(v: string | null | undefined) {
  if (!v) return '-';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function AgentSessionsViewPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AgentSessionRow[]>([]);
  const [clientNameById, setClientNameById] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createTitle, setCreateTitle] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessageRow[]>([]);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const ta = new Date(a.lastMessageAt ?? a.createdAt).getTime();
      const tb = new Date(b.lastMessageAt ?? b.createdAt).getTime();
      return tb - ta;
    });
  }, [sessions]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.seq - b.seq);
  }, [messages]);

  useEffect(() => {
    if (!drawerOpen) return;
    if (messagesLoading) return;
    messagesBottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [drawerOpen, messagesLoading, messages.length]);

  async function loadClients() {
    try {
      const response = await fetchWithTenantRefresh('/api/clients', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;

      const items = Array.isArray(data?.clients) ? data.clients : [];
      const normalized: ClientLite[] = items
        .filter((c: any) => c && typeof c === 'object' && typeof c.id === 'string')
        .map((c: any) => ({
          id: c.id,
          name: typeof c.name === 'string' && c.name.trim() ? c.name : c.id
        }));

      setClientNameById((prev) => {
        const next = { ...prev };
        for (const c of normalized) next[c.id] = c.name;
        return next;
      });
    } catch {}
  }

  async function loadSessions() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithTenantRefresh('/api/agent-sessions', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '加载失败'
            : '加载失败';
        setErrorMessage(message);
        return;
      }

      const items = Array.isArray(data?.sessions) ? data.sessions : [];
      const normalized: AgentSessionRow[] = items
        .filter((s: any) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.tenantId === 'string')
        .map((s: any) => ({
          id: s.id,
          tenantId: s.tenantId,
          clientIds: Array.isArray(s.clientIds) ? s.clientIds.filter((v: any) => typeof v === 'string') : [],
          title: typeof s.title === 'string' ? s.title : null,
          status: s.status as AgentSessionStatus,
          lastMessageAt: typeof s.lastMessageAt === 'string' ? s.lastMessageAt : null,
          createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
          updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString()
        }));
      setSessions(normalized);
    } catch {
      setErrorMessage('网络错误');
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    setCreateSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithTenantRefresh('/api/agent-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: createTitle.trim() ? createTitle.trim() : null })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '创建失败'
            : '创建失败';
        setErrorMessage(message);
        return;
      }

      const created = data?.session;
      if (created && typeof created === 'object' && typeof created.id === 'string' && typeof created.tenantId === 'string') {
        const row: AgentSessionRow = {
          id: created.id,
          tenantId: created.tenantId,
          clientIds: Array.isArray(created.clientIds) ? created.clientIds.filter((v: any) => typeof v === 'string') : [],
          title: typeof created.title === 'string' ? created.title : null,
          status: created.status as AgentSessionStatus,
          lastMessageAt: typeof created.lastMessageAt === 'string' ? created.lastMessageAt : null,
          createdAt: typeof created.createdAt === 'string' ? created.createdAt : new Date().toISOString(),
          updatedAt: typeof created.updatedAt === 'string' ? created.updatedAt : new Date().toISOString()
        };
        setSessions((prev) => [row, ...prev]);
      } else {
        await loadSessions();
      }

      setCreateOpen(false);
      setCreateTitle('');
    } catch {
      setErrorMessage('网络错误');
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function loadMessages(sessionId: string) {
    setMessagesLoading(true);
    setMessagesError(null);
    setMessages([]);
    try {
      const response = await fetchWithTenantRefresh(`/api/agent-sessions/${sessionId}/messages?limit=5000`, { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '加载失败'
            : '加载失败';
        setMessagesError(message);
        return;
      }

      const items = Array.isArray(data?.messages) ? data.messages : [];
      const normalized: AgentMessageRow[] = items
        .filter((m: any) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.sessionId === 'string')
        .map((m: any) => ({
          id: m.id,
          sessionId: m.sessionId,
          seq: typeof m.seq === 'number' ? m.seq : 0,
          authorType: m.authorType as AgentMessageRow['authorType'],
          authorId: typeof m.authorId === 'string' ? m.authorId : null,
          content: typeof m.content === 'string' ? m.content : null,
          contentJson: m.contentJson,
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString()
        }));
      setMessages(normalized);
    } catch {
      setMessagesError('网络错误');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    const sessionId = selectedSessionId;
    const content = draft.trim();
    if (!sessionId) return;
    if (!content) return;

    setSending(true);
    setSendError(null);
    try {
      const response = await fetchWithTenantRefresh(`/api/agent-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '发送失败'
            : '发送失败';
        setSendError(message);
        return;
      }

      const created = data?.message;
      if (created && typeof created === 'object' && typeof created.id === 'string' && typeof created.sessionId === 'string') {
        const row: AgentMessageRow = {
          id: created.id,
          sessionId: created.sessionId,
          seq: typeof created.seq === 'number' ? created.seq : 0,
          authorType: created.authorType as AgentMessageRow['authorType'],
          authorId: typeof created.authorId === 'string' ? created.authorId : null,
          content: typeof created.content === 'string' ? created.content : null,
          contentJson: created.contentJson,
          createdAt: typeof created.createdAt === 'string' ? created.createdAt : new Date().toISOString()
        };

        setMessages((prev) => [...prev, row]);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, lastMessageAt: row.createdAt } : s))
        );
        setDraft('');
      } else {
        await loadMessages(sessionId);
        setDraft('');
      }
    } catch {
      setSendError('网络错误');
    } finally {
      setSending(false);
    }
  }

  function enterSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setDrawerOpen(true);
    setDraft("");
    setSendError(null);
    void loadMessages(sessionId);
  }

  useEffect(() => {
    void loadSessions();
    void loadClients();
  }, []);

  return (
    <PageContainer pageTitle='会话管理' pageDescription='管理租户下与 agent 的会话与消息'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>{loading ? '加载中…' : `共 ${sortedSessions.length} 个会话`}</div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              onClick={() => {
                void loadSessions();
                void loadClients();
              }}
              disabled={loading}
            >
              刷新
            </Button>
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) {
                  setCreateTitle('');
                  setErrorMessage(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>新建会话</Button>
              </DialogTrigger>
              <DialogContent className='max-w-lg'>
                <DialogHeader>
                  <DialogTitle>新建会话</DialogTitle>
                </DialogHeader>
                <div className='grid gap-2'>
                  <Label>标题（可选）</Label>
                  <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder='例如：门店巡检任务' />
                  <div className='text-muted-foreground text-xs'>默认会自动绑定当前租户所有 enabled 的客户端</div>
                </div>
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setCreateOpen(false);
                    }}
                    disabled={createSubmitting}
                  >
                    取消
                  </Button>
                  <Button onClick={() => void createSession()} disabled={createSubmitting}>
                    {createSubmitting ? '创建中…' : '创建'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {errorMessage ? (
          <div className='text-sm text-red-600'>{errorMessage}</div>
        ) : null}

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>客户端</TableHead>
                <TableHead>最近消息</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className='text-right'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center text-muted-foreground'>
                    暂无会话
                  </TableCell>
                </TableRow>
              ) : (
                sortedSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className='max-w-[360px] whitespace-normal break-words align-top'>
                      {s.title && s.title.trim() ? s.title : s.id}
                    </TableCell>
                    <TableCell className='align-top'>{s.status}</TableCell>
                    <TableCell className='max-w-[520px] align-top whitespace-normal break-words'>
                      {s.clientIds.length === 0 ? (
                        <span className='text-muted-foreground text-xs'>-</span>
                      ) : (
                        <div className='flex flex-wrap items-center gap-1'>
                          {s.clientIds.map((clientId) => {
                            const label = clientNameById[clientId] ?? clientId;
                            return (
                              <Badge key={clientId} variant='outline' className='max-w-[180px] truncate'>
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='align-top text-xs'>{formatDateTime(s.lastMessageAt)}</TableCell>
                    <TableCell className='align-top text-xs'>{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className='text-right'>
                      <Button variant='outline' size='sm' onClick={() => enterSession(s.id)}>
                        进入会话
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Drawer
          direction='right'
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) {
              setSelectedSessionId(null);
              setMessages([]);
              setMessagesError(null);
              setMessagesLoading(false);
              setDraft("");
              setSendError(null);
              setSending(false);
            }
          }}
        >
          <DrawerContent className='data-[vaul-drawer-direction=right]:w-[96vw] data-[vaul-drawer-direction=right]:sm:max-w-4xl'>
            <DrawerHeader className='gap-2 border-b'>
              <DrawerTitle>会话消息</DrawerTitle>
              <DrawerDescription className='break-all'>{selectedSessionId ?? '-'}</DrawerDescription>
              <div className='flex items-center justify-between gap-2'>
                <div className='text-muted-foreground text-xs'>
                  {messagesLoading ? '加载中…' : `共 ${sortedMessages.length} 条消息`}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      if (selectedSessionId) void loadMessages(selectedSessionId);
                    }}
                    disabled={messagesLoading || !selectedSessionId}
                  >
                    刷新
                  </Button>
                  <DrawerClose asChild>
                    <Button variant='outline' size='sm'>
                      关闭
                    </Button>
                  </DrawerClose>
                </div>
              </div>
              {messagesError ? <div className='text-sm text-red-600'>{messagesError}</div> : null}
            </DrawerHeader>

            <div className='flex-1 overflow-auto p-4'>
              {messagesLoading ? (
                <div className='text-center text-muted-foreground text-sm'>加载中…</div>
              ) : sortedMessages.length === 0 ? (
                <div className='text-center text-muted-foreground text-sm'>暂无消息</div>
              ) : (
                <div className='flex flex-col gap-3'>
                  {sortedMessages.map((m) => {
                    const isUser =
                      m.authorType === 'system' &&
                      m.contentJson &&
                      typeof m.contentJson === 'object' &&
                      (m.contentJson as any).role === 'user';
                    const roleLabel = isUser ? '你' : m.authorType === 'agent' ? 'AI' : m.authorType === 'tool' ? 'Tool' : 'System';
                    const badgeVariant = isUser ? 'secondary' : m.authorType === 'agent' ? 'default' : m.authorType === 'tool' ? 'secondary' : 'outline';
                    const text = m.content && m.content.trim() ? m.content : null;
                    const jsonText =
                      text
                        ? null
                        : m.contentJson
                          ? JSON.stringify(m.contentJson, null, 2)
                          : null;

                    return (
                      <div key={m.id} className='flex flex-col gap-1'>
                        <div className={`flex items-center justify-between gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <Badge variant={badgeVariant}>{roleLabel}</Badge>
                            <span className='text-muted-foreground text-xs'>#{m.seq}</span>
                          </div>
                          <span className='text-muted-foreground text-xs'>{formatDateTime(m.createdAt)}</span>
                        </div>
                        <div
                          className={`max-w-[92%] rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                            isUser ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted/40'
                          }`}
                        >
                          {text ? (
                            text
                          ) : jsonText ? (
                            <pre className='whitespace-pre-wrap break-words'>{jsonText}</pre>
                          ) : (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesBottomRef} />
                </div>
              )}
            </div>

            <div className='border-t p-4'>
              <div className='flex items-end gap-2'>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder='输入消息…'
                  className='min-h-12'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!selectedSessionId || messagesLoading || sending}
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={!selectedSessionId || messagesLoading || sending || !draft.trim()}
                >
                  {sending ? '发送中…' : '发送'}
                </Button>
              </div>
              <div className='mt-2 flex items-center justify-between gap-2'>
                <div className='text-muted-foreground text-xs'>Enter 发送，Shift+Enter 换行</div>
                {sendError ? <div className='text-xs text-red-600'>{sendError}</div> : null}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageContainer>
  );
}
