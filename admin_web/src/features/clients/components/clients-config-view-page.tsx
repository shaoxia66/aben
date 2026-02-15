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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, fetchWithTenantRefresh } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

type ClientStatus = 'enabled' | 'disabled' | 'archived';

type ClientRow = {
  id: string;
  tenantId: string;
  clientType: string;
  code: string;
  name: string;
  description: string | null;
  authKey: string;
  authKeyLastUsedAt: string | null;
  status: ClientStatus;
  version: string | null;
  platform: string | null;
  lastSeenAt: string | null;
  runStatus: string | null;
  config: any;
  capabilities: any;
  createdAt: string;
  updatedAt: string;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function maskKey(key: string) {
  if (!key) return '';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export default function ClientsConfigViewPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createClientType, setCreateClientType] = useState('windows_agent');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [clients]);

  async function loadClients() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithTenantRefresh('/api/clients', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '加载失败'
            : '加载失败';
        setErrorMessage(message);
        return;
      }
      const list = data?.clients;
      setClients(Array.isArray(list) ? (list as ClientRow[]) : []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function setClientEnabled(row: ClientRow, enabled: boolean) {
    if (row.status === 'archived') return;
    const nextStatus: ClientStatus = enabled ? 'enabled' : 'disabled';
    if (row.status === nextStatus) return;

    setErrorMessage(null);
    setStatusUpdating((m) => ({ ...m, [row.id]: true }));
    const prev = row.status;
    setClients((items) => items.map((c) => (c.id === row.id ? { ...c, status: nextStatus } : c)));

    try {
      const response = await fetchWithTenantRefresh(`/api/clients/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '更新失败'
            : '更新失败';
        setClients((items) => items.map((c) => (c.id === row.id ? { ...c, status: prev } : c)));
        setErrorMessage(message);
        return;
      }

      const updated = data?.client as ClientRow | undefined;
      if (updated?.id) {
        setClients((items) => items.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      }
    } catch (err) {
      setClients((items) => items.map((c) => (c.id === row.id ? { ...c, status: prev } : c)));
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setStatusUpdating((m) => {
        const { [row.id]: _, ...rest } = m;
        return rest;
      });
    }
  }

  async function handleCreate() {
    setErrorMessage(null);
    setCreatedKey(null);

    if (!createName.trim() || !createClientType.trim()) {
      setErrorMessage('请填写 类型、name');
      return;
    }

    setCreateSubmitting(true);
    try {
      const response = await fetchWithTenantRefresh('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientType: createClientType.trim(),
          name: createName.trim(),
          description: createDescription.trim() ? createDescription.trim() : null
        })
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

      const created = data?.client as ClientRow | undefined;
      if (created?.authKey) {
        setCreatedKey(created.authKey);
      }

      await loadClients();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openEdit(row: ClientRow) {
    setEditing(row);
    setEditName(row.name);
    setEditDescription(row.description ?? '');
    setEditOpen(true);
    setErrorMessage(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;

    setErrorMessage(null);
    if (!editName.trim()) {
      setErrorMessage('name 不能为空');
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await fetchWithTenantRefresh(`/api/clients/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() ? editDescription.trim() : null
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '保存失败'
            : '保存失败';
        setErrorMessage(message);
        return;
      }

      setEditOpen(false);
      setEditing(null);
      await loadClients();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleRotateKey(row: ClientRow) {
    setErrorMessage(null);
    try {
      const response = await fetchWithTenantRefresh(`/api/clients/${row.id}/rotate-key`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '重置失败'
            : '重置失败';
        setErrorMessage(message);
        return;
      }
      const updated = data?.client as ClientRow | undefined;
      const key = updated?.authKey;
      if (key) {
        try {
          await navigator.clipboard.writeText(key);
        } catch {}
      }
      await loadClients();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    }
  }

  return (
    <PageContainer pageTitle='客户端配置' pageDescription='管理工作空间下的各类客户端（windows_agent、voice_control 等）'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {loading ? '加载中…' : `共 ${sortedClients.length} 个客户端`}
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={() => void loadClients()} disabled={loading}>
              刷新
            </Button>
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) {
                  setCreatedKey(null);
                  setErrorMessage(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>新建客户端</Button>
              </DialogTrigger>
              <DialogContent className='max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>新建客户端</DialogTitle>
                </DialogHeader>
                <div className='grid gap-4'>
                  <div className='grid gap-2'>
                    <Label>类型</Label>
                    <Select value={createClientType} onValueChange={setCreateClientType}>
                      <SelectTrigger>
                        <SelectValue placeholder='选择类型' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='windows_agent'>windows_agent</SelectItem>
                        <SelectItem value='voice_control'>voice_control</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2'>
                    <Label>name</Label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder='例如：前台收银机' />
                  </div>
                  <div className='grid gap-2'>
                    <Label>description</Label>
                    <Input
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder='可选'
                    />
                  </div>
                  {createdKey ? (
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='text-sm font-medium'>认证 Key</div>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(createdKey);
                            } catch {}
                          }}
                        >
                          复制
                        </Button>
                      </div>
                      <div className='mt-2 break-all font-mono text-xs'>{createdKey}</div>
                    </div>
                  ) : null}
                  {errorMessage ? (
                    <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                      {errorMessage}
                    </div>
                  ) : null}
                </div>
                <DialogFooter className='mt-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setCreateOpen(false);
                    }}
                    disabled={createSubmitting}
                  >
                    关闭
                  </Button>
                  <Button onClick={() => void handleCreate()} disabled={createSubmitting}>
                    {createSubmitting ? '创建中…' : '创建'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {errorMessage ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
            {errorMessage}
          </div>
        ) : null}

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>运行状态</TableHead>
                <TableHead>key</TableHead>
                <TableHead>最近心跳</TableHead>
                <TableHead className='text-right'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center text-sm'>
                    暂无客户端
                  </TableCell>
                </TableRow>
              ) : (
                sortedClients.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.clientType}</TableCell>
                    <TableCell>{row.name}</TableCell>
                      <TableCell className='text-muted-foreground max-w-[360px] align-top whitespace-normal break-words text-sm'>
                        {row.description ?? '-'}
                      </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Switch
                          checked={row.status === 'enabled'}
                          disabled={Boolean(statusUpdating[row.id]) || row.status === 'archived'}
                          onCheckedChange={(checked) => void setClientEnabled(row, checked)}
                        />
                      </div>
                    </TableCell>
                      <TableCell className='text-muted-foreground max-w-[280px] align-top whitespace-normal break-words text-sm'>
                      {row.runStatus ?? '-'}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>{maskKey(row.authKey)}</TableCell>
                    <TableCell className='text-xs'>{formatDateTime(row.lastSeenAt)}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button size='sm'  onClick={() => openEdit(row)}>
                          编辑
                        </Button>
                        <Button
                          size='sm'
                          
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(row.authKey);
                            } catch {}
                          }}
                        >
                          复制 key
                        </Button>
                        <Button size='sm'  onClick={() => void handleRotateKey(row)}>
                          重置 key
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditing(null);
            setErrorMessage(null);
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>编辑客户端</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className='grid gap-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid gap-2'>
                  <Label>类型</Label>
                  <Input value={editing.clientType} disabled />
                </div>
                <div className='grid gap-2'>
                  <Label>code</Label>
                  <Input value={editing.code} disabled />
                </div>
              </div>
              <div className='grid gap-2'>
                <Label>name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className='grid gap-2'>
                <Label>description</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className='grid gap-2'>
                <Label>认证 Key</Label>
                <div className='flex items-center gap-2'>
                  <Input value={editing.authKey} readOnly className='font-mono text-xs' />
                  <Button
                    variant='outline'
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(editing.authKey);
                      } catch {}
                    }}
                  >
                    复制
                  </Button>
                </div>
              </div>
              {errorMessage ? (
                <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                  {errorMessage}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className='mt-2'>
            <Button variant='outline' onClick={() => setEditOpen(false)} disabled={editSubmitting}>
              取消
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={editSubmitting || !editing}>
              {editSubmitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
