'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';

type AgentTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';
type AgentTaskLifecycle = 'open' | 'blocked' | 'canceled' | 'closed';

type TaskRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  sessionTitle: string | null;
  parentTaskId: string | null;
  orderNo: number;
  title: string;
  goal: string | null;
  acceptanceCriteria: string | null;
  status: AgentTaskStatus;
  lifecycle: AgentTaskLifecycle;
  assignedClientId: string | null;
  idempotencyKey: string | null;
  input: unknown;
  output: unknown;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

type TaskRunRow = {
  id: string;
  tenantId: string;
  taskId: string;
  runNo: number;
  clientId: string;
  status: AgentTaskStatus;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

type TaskEventRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  taskId: string | null;
  runId: string | null;
  type: string;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

type TaskDetail = { task: TaskRow; runs: TaskRunRow[]; events: TaskEventRow[] };

const statusColumns: Array<{ id: AgentTaskStatus; title: string }> = [
  { id: 'pending', title: '待执行' },
  { id: 'running', title: '执行中' },
  { id: 'succeeded', title: '成功' },
  { id: 'failed', title: '失败' }
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(
    null
  );
  const [detail, setDetail] = useState<TaskDetail | null>(null);

  const tasksByStatus = useMemo(() => {
    const map = new Map<AgentTaskStatus, TaskRow[]>();
    for (const col of statusColumns) map.set(col.id, []);
    for (const t of tasks) {
      map.get(t.status)?.push(t);
    }
    return map;
  }, [tasks]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithTenantRefresh('/api/agent-tasks?limit=200');
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMessage(data?.error?.message || '加载失败');
        setTasks([]);
        return;
      }
      const list = Array.isArray(data?.tasks) ? data.tasks : [];
      setTasks(
        list
          .filter((t: any) => t && typeof t.id === 'string')
          .map((t: any) => ({
            id: String(t.id),
            tenantId: String(t.tenantId),
            sessionId: String(t.sessionId),
            sessionTitle:
              typeof t.sessionTitle === 'string' ? t.sessionTitle : null,
            parentTaskId:
              typeof t.parentTaskId === 'string' ? t.parentTaskId : null,
            orderNo: Number.isFinite(t.orderNo) ? t.orderNo : 0,
            title: typeof t.title === 'string' ? t.title : '',
            goal: typeof t.goal === 'string' ? t.goal : null,
            acceptanceCriteria:
              typeof t.acceptanceCriteria === 'string'
                ? t.acceptanceCriteria
                : null,
            status: t.status as AgentTaskStatus,
            lifecycle: t.lifecycle as AgentTaskLifecycle,
            assignedClientId:
              typeof t.assignedClientId === 'string' ? t.assignedClientId : null,
            idempotencyKey:
              typeof t.idempotencyKey === 'string' ? t.idempotencyKey : null,
            input: t.input ?? {},
            output: t.output ?? {},
            createdAt: typeof t.createdAt === 'string' ? t.createdAt : '',
            updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : '',
            extra: t.extra ?? {}
          }))
      );
    } catch {
      setErrorMessage('加载失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!drawerOpen || !selectedTaskId) return;
    let cancelled = false;

    (async () => {
      setDetailLoading(true);
      setDetailErrorMessage(null);
      setDetail(null);
      try {
        const res = await fetchWithTenantRefresh(
          `/api/agent-tasks/${selectedTaskId}`
        );
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          if (cancelled) return;
          setDetailErrorMessage(data?.error?.message || '加载失败');
          return;
        }
        if (cancelled) return;
        setDetail(data as TaskDetail);
      } catch {
        if (cancelled) return;
        setDetailErrorMessage('加载失败');
      } finally {
        if (cancelled) return;
        setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, selectedTaskId]);

  const totalCount = tasks.length;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='text-muted-foreground text-sm'>
          {loading ? '加载中…' : `共 ${totalCount} 个任务`}
        </div>
        <Button variant='outline' onClick={() => void refresh()} disabled={loading}>
          刷新
        </Button>
      </div>

      {errorMessage ? (
        <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
          {errorMessage}
        </div>
      ) : null}

      <ScrollArea className='w-full rounded-md whitespace-nowrap'>
        <div className='flex flex-row items-start justify-start gap-4 px-2 pb-4 md:px-0'>
          {statusColumns.map((col) => {
            const items = tasksByStatus.get(col.id) ?? [];
            return (
              <Card
                key={col.id}
                className='h-[75vh] max-h-[75vh] w-[calc(25%-12px)] min-w-[300px] max-w-full shrink-0 bg-secondary'
              >
                <CardHeader className='flex flex-row items-center justify-between border-b-2 p-4'>
                  <div className='font-semibold'>{col.title}</div>
                  <Badge variant='outline' className='font-semibold'>
                    {items.length}
                  </Badge>
                </CardHeader>
                <CardContent className='flex h-[calc(75vh-72px)] flex-col gap-2 overflow-hidden p-2'>
                  <ScrollArea className='h-full'>
                    {items.length === 0 ? (
                      <div className='text-muted-foreground px-2 py-4 text-sm'>
                        暂无任务
                      </div>
                    ) : (
                      <div className='space-y-2 px-1'>
                        {items.map((t) => (
                          <Card
                            key={t.id}
                            className='cursor-pointer'
                            onClick={() => {
                              setSelectedTaskId(t.id);
                              setDrawerOpen(true);
                            }}
                          >
                            <CardHeader className='flex flex-row items-center justify-between gap-2 border-b px-3 py-3'>
                              <div className='flex items-center gap-2'>
                                <Badge variant={statusBadgeVariant(t.status)}>
                                  {statusLabel(t.status)}
                                </Badge>
                                <Badge variant='outline'>
                                  {lifecycleLabel(t.lifecycle)}
                                </Badge>
                              </div>
                              <div className='text-muted-foreground truncate text-xs'>
                                {t.sessionTitle?.trim()
                                  ? t.sessionTitle
                                  : `会话 ${t.sessionId}`}
                              </div>
                            </CardHeader>
                            <CardContent className='px-3 pb-4 pt-3 text-left'>
                              <div className='line-clamp-3 whitespace-pre-wrap text-sm font-medium'>
                                {t.title || '未命名任务'}
                              </div>
                              <div className='text-muted-foreground mt-2 text-xs'>
                                更新时间：{formatDateTime(t.updatedAt)}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation='horizontal' />
      </ScrollArea>

      <Drawer
        direction='right'
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedTaskId(null);
            setDetail(null);
            setDetailErrorMessage(null);
            setDetailLoading(false);
          }
        }}
      >
        <DrawerContent className='sm:max-w-xl'>
          <DrawerHeader className='gap-2'>
            <div className='flex items-center justify-between gap-3'>
              <DrawerTitle>任务详情</DrawerTitle>
              <DrawerClose asChild>
                <Button variant='outline'>关闭</Button>
              </DrawerClose>
            </div>
            <div className='text-muted-foreground text-xs'>
              {selectedTaskId ? `任务ID：${selectedTaskId}` : ''}
            </div>
          </DrawerHeader>

          <div className='space-y-4 overflow-auto px-4 pb-4'>
            {detailLoading ? (
              <div className='text-muted-foreground text-sm'>加载中…</div>
            ) : detailErrorMessage ? (
              <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {detailErrorMessage}
              </div>
            ) : detail ? (
              <div className='space-y-4'>
                <Card>
                  <CardHeader className='border-b px-4 py-3 font-semibold'>
                    基本信息
                  </CardHeader>
                  <CardContent className='space-y-2 px-4 py-3 text-sm'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={statusBadgeVariant(detail.task.status)}>
                        {statusLabel(detail.task.status)}
                      </Badge>
                      <Badge variant='outline'>
                        {lifecycleLabel(detail.task.lifecycle)}
                      </Badge>
                    </div>
                    <div className='font-medium'>
                      {detail.task.title || '未命名任务'}
                    </div>
                    <div className='text-muted-foreground'>
                      会话：
                      {detail.task.sessionTitle?.trim()
                        ? detail.task.sessionTitle
                        : detail.task.sessionId}
                    </div>
                    <div className='text-muted-foreground'>
                      创建时间：{formatDateTime(detail.task.createdAt)}
                    </div>
                    <div className='text-muted-foreground'>
                      更新时间：{formatDateTime(detail.task.updatedAt)}
                    </div>
                    <div className='text-muted-foreground'>
                      分派客户端：
                      {detail.task.assignedClientId || '-'}
                    </div>
                    <div className='text-muted-foreground'>
                      父任务：{detail.task.parentTaskId || '-'}
                    </div>
                    <div className='text-muted-foreground'>
                      顺序号：{detail.task.orderNo}
                    </div>
                    <div className='text-muted-foreground'>
                      幂等键：{detail.task.idempotencyKey || '-'}
                    </div>
                    {detail.task.goal ? (
                      <div>
                        <div className='font-medium'>目标</div>
                        <div className='text-muted-foreground whitespace-pre-wrap'>
                          {detail.task.goal}
                        </div>
                      </div>
                    ) : null}
                    {detail.task.acceptanceCriteria ? (
                      <div>
                        <div className='font-medium'>验收标准</div>
                        <div className='text-muted-foreground whitespace-pre-wrap'>
                          {detail.task.acceptanceCriteria}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='border-b px-4 py-3 font-semibold'>
                    输入 / 输出
                  </CardHeader>
                  <CardContent className='space-y-3 px-4 py-3'>
                    <div>
                      <div className='mb-2 text-sm font-medium'>输入</div>
                      <pre className='bg-muted overflow-auto rounded-md p-3 text-xs'>
                        {safeJson(detail.task.input)}
                      </pre>
                    </div>
                    <div>
                      <div className='mb-2 text-sm font-medium'>输出</div>
                      <pre className='bg-muted overflow-auto rounded-md p-3 text-xs'>
                        {safeJson(detail.task.output)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='border-b px-4 py-3 font-semibold'>
                    执行记录
                  </CardHeader>
                  <CardContent className='space-y-2 px-4 py-3'>
                    {detail.runs.length === 0 ? (
                      <div className='text-muted-foreground text-sm'>
                        暂无执行记录
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        {detail.runs.map((r) => (
                          <div
                            key={r.id}
                            className='rounded-md border px-3 py-2 text-sm'
                          >
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <div className='font-medium'>Run #{r.runNo}</div>
                              <Badge variant={statusBadgeVariant(r.status)}>
                                {statusLabel(r.status)}
                              </Badge>
                            </div>
                            <div className='text-muted-foreground mt-1 text-xs'>
                              客户端：{r.clientId}
                            </div>
                            <div className='text-muted-foreground mt-1 text-xs'>
                              开始：{formatDateTime(r.startedAt)}
                            </div>
                            <div className='text-muted-foreground mt-1 text-xs'>
                              结束：{formatDateTime(r.finishedAt)}
                            </div>
                            {r.error ? (
                              <div className='text-destructive mt-2 whitespace-pre-wrap text-xs'>
                                {r.error}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='border-b px-4 py-3 font-semibold'>
                    事件时间线
                  </CardHeader>
                  <CardContent className='space-y-2 px-4 py-3'>
                    {detail.events.length === 0 ? (
                      <div className='text-muted-foreground text-sm'>
                        暂无事件
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        {detail.events.map((e) => (
                          <div
                            key={e.id}
                            className='rounded-md border px-3 py-2 text-sm'
                          >
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <div className='font-medium'>{e.type}</div>
                              <div className='text-muted-foreground text-xs'>
                                {formatDateTime(e.occurredAt)}
                              </div>
                            </div>
                            <pre className='bg-muted mt-2 overflow-auto rounded-md p-3 text-xs'>
                              {safeJson(e.payload)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className='text-muted-foreground text-sm'>
                请选择一个任务查看详情
              </div>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant='outline'>关闭</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function statusLabel(status: AgentTaskStatus) {
  if (status === 'pending') return '待执行';
  if (status === 'running') return '执行中';
  if (status === 'succeeded') return '成功';
  return '失败';
}

function lifecycleLabel(lifecycle: AgentTaskLifecycle) {
  if (lifecycle === 'open') return '开放';
  if (lifecycle === 'blocked') return '阻塞';
  if (lifecycle === 'canceled') return '已取消';
  return '已关闭';
}

function statusBadgeVariant(
  status: AgentTaskStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'running') return 'default';
  if (status === 'succeeded') return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}
