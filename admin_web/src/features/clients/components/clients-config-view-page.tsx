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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, fetchWithTenantRefresh } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

type ClientStatus = 'enabled' | 'disabled' | 'archived';

type SkillSummary = {
  skillKey: string;
  name: string;
};

type ClientSkillBinding = {
  id: string;
  clientId: string;
  skillKey: string;
  skillName: string;
  enabled: boolean;
  orderNo: number;
};

type McpSummary = {
  mcpKey: string;
  name: string;
};

type ClientMcpBinding = {
  id: string;
  clientId: string;
  mcpKey: string;
  mcpName: string;
  isEnabled: boolean;
};

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
  skills?: ClientSkillBinding[];
  mcps?: ClientMcpBinding[];
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

  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillBindings, setSkillBindings] = useState<ClientSkillBinding[]>([]);
  const [skillBindingsLoading, setSkillBindingsLoading] = useState(false);

  const [mcps, setMcps] = useState<McpSummary[]>([]);
  const [mcpsLoading, setMcpsLoading] = useState(false);
  const [mcpBindings, setMcpBindings] = useState<ClientMcpBinding[]>([]);
  const [mcpBindingsLoading, setMcpBindingsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createClientType, setCreateClientType] = useState('windows_agent');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSkillKeys, setCreateSkillKeys] = useState<string[]>([]);
  const [createMcpKeys, setCreateMcpKeys] = useState<string[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSkillKeys, setEditSkillKeys] = useState<string[]>([]);
  const [editMcpKeys, setEditMcpKeys] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const sortedClients = useMemo(() => {
    const bindingsByClientId: Record<string, ClientSkillBinding[]> = {};
    for (const binding of skillBindings) {
      if (!bindingsByClientId[binding.clientId]) bindingsByClientId[binding.clientId] = [];
      bindingsByClientId[binding.clientId].push(binding);
    }

    const mcpBindingsByClientId: Record<string, ClientMcpBinding[]> = {};
    for (const binding of mcpBindings) {
      if (!mcpBindingsByClientId[binding.clientId]) mcpBindingsByClientId[binding.clientId] = [];
      mcpBindingsByClientId[binding.clientId].push(binding);
    }

    return [...clients]
      .map((c) => ({
        ...c,
        skills: (bindingsByClientId[c.id] || []).slice().sort((a, b) => {
          if (a.orderNo !== b.orderNo) return a.orderNo - b.orderNo;
          return a.skillName.localeCompare(b.skillName);
        }),
        mcps: (mcpBindingsByClientId[c.id] || []).slice().sort((a, b) => {
          return a.mcpName.localeCompare(b.mcpName);
        })
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [clients, skillBindings, mcpBindings]);

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

  async function loadSkills() {
    setSkillsLoading(true);
    try {
      const response = await fetchWithTenantRefresh('/api/skills', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      const list = Array.isArray(data?.skills) ? data.skills : [];
      const normalized: SkillSummary[] = list
        .filter((s: any) => s && typeof s === 'object' && typeof s.skillKey === 'string')
        .map((s: any) => ({
          skillKey: s.skillKey as string,
          name:
            typeof s.name === 'string' && s.name.trim()
              ? (s.name as string)
              : (s.skillKey as string)
        }));
      setSkills(normalized);
    } catch {
    } finally {
      setSkillsLoading(false);
    }
  }

  async function loadClientSkillBindings() {
    setSkillBindingsLoading(true);
    try {
      const response = await fetchWithTenantRefresh('/api/client-skills', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      const list = Array.isArray(data?.bindings) ? data.bindings : [];
      const normalized: ClientSkillBinding[] = list
        .filter(
          (b: any) =>
            b &&
            typeof b === 'object' &&
            typeof b.id === 'string' &&
            typeof b.clientId === 'string' &&
            typeof b.skillKey === 'string'
        )
        .map((b: any) => ({
          id: b.id as string,
          clientId: b.clientId as string,
          skillKey: b.skillKey as string,
          skillName:
            typeof b.skillName === 'string' && b.skillName.trim()
              ? (b.skillName as string)
              : (b.skillKey as string),
          enabled: Boolean(b.enabled),
          orderNo: typeof b.orderNo === 'number' ? b.orderNo : 0
        }));
      setSkillBindings(normalized);
    } catch {
    } finally {
      setSkillBindingsLoading(false);
    }
  }

  async function loadMcps() {
    setMcpsLoading(true);
    try {
      const response = await fetchWithTenantRefresh('/api/mcps', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      const list = Array.isArray(data?.mcps) ? data.mcps : [];
      const normalized: McpSummary[] = list
        .filter((m: any) => m && typeof m === 'object' && typeof m.mcpKey === 'string')
        .map((m: any) => ({
          mcpKey: m.mcpKey as string,
          name:
            typeof m.name === 'string' && m.name.trim()
              ? (m.name as string)
              : (m.mcpKey as string)
        }));
      setMcps(normalized);
    } catch {
    } finally {
      setMcpsLoading(false);
    }
  }

  async function loadClientMcpBindings() {
    setMcpBindingsLoading(true);
    try {
      const response = await fetchWithTenantRefresh('/api/client-mcps', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      const list = Array.isArray(data?.bindings) ? data.bindings : [];
      const normalized: ClientMcpBinding[] = list
        .filter(
          (b: any) =>
            b &&
            typeof b === 'object' &&
            typeof b.id === 'string' &&
            typeof b.clientId === 'string' &&
            typeof b.mcpKey === 'string'
        )
        .map((b: any) => ({
          id: b.id as string,
          clientId: b.clientId as string,
          mcpKey: b.mcpKey as string,
          mcpName:
            typeof b.mcpName === 'string' && b.mcpName.trim()
              ? (b.mcpName as string)
              : (b.mcpKey as string),
          isEnabled: Boolean(b.isEnabled)
        }));
      setMcpBindings(normalized);
    } catch {
    } finally {
      setMcpBindingsLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
    void loadSkills();
    void loadClientSkillBindings();
    void loadMcps();
    void loadClientMcpBindings();
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

      if (created?.id && createSkillKeys.length > 0) {
        try {
          await fetchWithTenantRefresh(`/api/clients/${created.id}/skills`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillKeys: createSkillKeys })
          });
        } catch { }
      }

      if (created?.id && createMcpKeys.length > 0) {
        try {
          await fetchWithTenantRefresh(`/api/clients/${created.id}/mcps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mcpKeys: createMcpKeys })
          });
        } catch { }
      }

      await loadClients();
      await loadClientSkillBindings();
      await loadClientMcpBindings();
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
    setEditSkillKeys((row.skills || []).map((b) => b.skillKey));
    setEditMcpKeys((row.mcps || []).map((b) => b.mcpKey));
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

      if (editing && editSkillKeys) {
        try {
          await fetchWithTenantRefresh(`/api/clients/${editing.id}/skills`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillKeys: editSkillKeys })
          });
        } catch { }
      }

      if (editing && editMcpKeys) {
        try {
          await fetchWithTenantRefresh(`/api/clients/${editing.id}/mcps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mcpKeys: editMcpKeys })
          });
        } catch { }
      }

      setEditOpen(false);
      setEditing(null);
      await loadClients();
      await loadClientSkillBindings();
      await loadClientMcpBindings();
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
        } catch { }
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
                  setCreateName('');
                  setCreateDescription('');
                  setCreateSkillKeys([]);
                  setCreateMcpKeys([]);
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
                  <div className='grid gap-2'>
                    <Label>绑定 Skills</Label>
                    <div className='flex flex-wrap gap-2'>
                      {skillsLoading ? (
                        <span className='text-muted-foreground text-xs'>加载中…</span>
                      ) : skills.length === 0 ? (
                        <span className='text-muted-foreground text-xs'>当前租户暂无 skills</span>
                      ) : (
                        skills.map((skill) => {
                          const checked = createSkillKeys.includes(skill.skillKey);
                          return (
                            <button
                              key={skill.skillKey}
                              type='button'
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs',
                                checked
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-foreground'
                              )}
                              onClick={() => {
                                setCreateSkillKeys((prev) =>
                                  prev.includes(skill.skillKey)
                                    ? prev.filter((k) => k !== skill.skillKey)
                                    : [...prev, skill.skillKey]
                                );
                              }}
                            >
                              {skill.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className='grid gap-2'>
                    <Label>绑定 MCPs</Label>
                    <div className='flex flex-wrap gap-2'>
                      {mcpsLoading ? (
                        <span className='text-muted-foreground text-xs'>加载中…</span>
                      ) : mcps.length === 0 ? (
                        <span className='text-muted-foreground text-xs'>当前租户暂无 MCPs</span>
                      ) : (
                        mcps.map((mcp) => {
                          const checked = createMcpKeys.includes(mcp.mcpKey);
                          return (
                            <button
                              key={mcp.mcpKey}
                              type='button'
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs',
                                checked
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-foreground'
                              )}
                              onClick={() => {
                                setCreateMcpKeys((prev) =>
                                  prev.includes(mcp.mcpKey)
                                    ? prev.filter((k) => k !== mcp.mcpKey)
                                    : [...prev, mcp.mcpKey]
                                );
                              }}
                            >
                              {mcp.name}
                            </button>
                          );
                        })
                      )}
                    </div>
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
                            } catch { }
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

        {sortedClients.length === 0 && !loading ? (
          <div className='text-muted-foreground flex h-40 items-center justify-center rounded-md border text-sm'>
            暂无客户端，点击右上角"新建客户端"进行添加
          </div>
        ) : (
          <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {sortedClients.map((row) => {
              const isOnline = row.runStatus === 'online' || row.runStatus === 'running';
              const isArchived = row.status === 'archived';
              return (
                <Card key={row.id} className='flex flex-col'>
                  <CardHeader className='pb-2'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0 flex-1'>
                        <CardTitle className='truncate text-base'>{row.name}</CardTitle>
                        <p className='text-muted-foreground mt-0.5 font-mono text-xs'>{row.clientType}</p>
                      </div>
                      <div className='flex shrink-0 items-center gap-2'>
                        <span
                          className={[
                            'inline-block h-2 w-2 rounded-full',
                            isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'
                          ].join(' ')}
                          title={isOnline ? '在线' : '离线'}
                        />
                        <Switch
                          checked={row.status === 'enabled'}
                          disabled={Boolean(statusUpdating[row.id]) || isArchived}
                          onCheckedChange={(checked) => void setClientEnabled(row, checked)}
                        />
                        {isArchived && (
                          <Badge variant='secondary' className='text-xs'>已归档</Badge>
                        )}
                      </div>
                    </div>
                    {row.description && (
                      <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>{row.description}</p>
                    )}
                  </CardHeader>

                  <CardContent className='flex-1 space-y-3 pb-3'>
                    {/* Auth Key */}
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground w-14 shrink-0 text-xs'>Key</span>
                      <span className='flex-1 truncate font-mono text-xs'>{maskKey(row.authKey)}</span>
                    </div>

                    {/* 最近心跳 */}
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground w-14 shrink-0 text-xs'>心跳</span>
                      <span className='text-muted-foreground text-xs'>{formatDateTime(row.lastSeenAt)}</span>
                    </div>

                    {/* 运行状态 */}
                    {row.runStatus && (
                      <div className='flex items-center gap-2'>
                        <span className='text-muted-foreground w-14 shrink-0 text-xs'>状态</span>
                        <Badge variant={isOnline ? 'default' : 'outline'} className='text-xs'>
                          {row.runStatus}
                        </Badge>
                      </div>
                    )}

                    {/* Skills 绑定 */}
                    <div>
                      <p className='text-muted-foreground mb-2 text-xs'>Skills</p>
                      {skillsLoading && skillBindingsLoading ? (
                        <span className='text-muted-foreground text-xs'>加载中…</span>
                      ) : !row.skills || row.skills.length === 0 ? (
                        <span className='text-muted-foreground text-xs'>未绑定</span>
                      ) : (
                        <div className='flex flex-wrap gap-x-4 gap-y-2'>
                          {row.skills.map((binding) => (
                            <div key={binding.id} className='flex items-center gap-1.5'>
                              <span className='text-xs'>{binding.skillName}</span>
                              <Switch
                                checked={binding.enabled}
                                className='scale-[0.75]'
                                onCheckedChange={async (checked) => {
                                  setSkillBindings((prev) =>
                                    prev.map((b) =>
                                      b.id === binding.id ? { ...b, enabled: checked } : b
                                    )
                                  );
                                  try {
                                    const response = await fetchWithTenantRefresh(
                                      `/api/clients/${row.id}/skills/${encodeURIComponent(binding.skillKey)}`,
                                      {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ enabled: checked })
                                      }
                                    );
                                    if (!response.ok) {
                                      setSkillBindings((prev) =>
                                        prev.map((b) =>
                                          b.id === binding.id ? { ...b, enabled: !checked } : b
                                        )
                                      );
                                    } else {
                                      const data = await response.json().catch(() => null);
                                      const updated = data?.binding;
                                      if (updated?.id) {
                                        setSkillBindings((prev) =>
                                          prev.map((b) =>
                                            b.id === updated.id
                                              ? {
                                                ...b,
                                                enabled: Boolean(updated.enabled),
                                                orderNo:
                                                  typeof updated.orderNo === 'number'
                                                    ? updated.orderNo
                                                    : b.orderNo
                                              }
                                              : b
                                          )
                                        );
                                      }
                                    }
                                  } catch {
                                    setSkillBindings((prev) =>
                                      prev.map((b) =>
                                        b.id === binding.id ? { ...b, enabled: !checked } : b
                                      )
                                    );
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* MCPs 绑定 */}
                    <div>
                      <p className='text-muted-foreground mb-2 text-xs'>MCPs</p>
                      {mcpsLoading && mcpBindingsLoading ? (
                        <span className='text-muted-foreground text-xs'>加载中…</span>
                      ) : !row.mcps || row.mcps.length === 0 ? (
                        <span className='text-muted-foreground text-xs'>未绑定</span>
                      ) : (
                        <div className='flex flex-wrap gap-x-4 gap-y-2'>
                          {row.mcps.map((binding) => (
                            <div key={binding.id} className='flex items-center gap-1.5'>
                              <span className='text-xs'>{binding.mcpName}</span>
                              <Switch
                                checked={binding.isEnabled}
                                className='scale-[0.75]'
                                onCheckedChange={async (checked) => {
                                  setMcpBindings((prev) =>
                                    prev.map((b) =>
                                      b.id === binding.id ? { ...b, isEnabled: checked } : b
                                    )
                                  );
                                  try {
                                    const response = await fetchWithTenantRefresh(
                                      `/api/clients/${row.id}/mcps/${encodeURIComponent(binding.mcpKey)}`,
                                      {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ isEnabled: checked })
                                      }
                                    );
                                    if (!response.ok) {
                                      setMcpBindings((prev) =>
                                        prev.map((b) =>
                                          b.id === binding.id ? { ...b, isEnabled: !checked } : b
                                        )
                                      );
                                    } else {
                                      const data = await response.json().catch(() => null);
                                      const updated = data?.binding;
                                      if (updated?.id) {
                                        setMcpBindings((prev) =>
                                          prev.map((b) =>
                                            b.id === updated.id
                                              ? {
                                                ...b,
                                                isEnabled: Boolean(updated.isEnabled)
                                              }
                                              : b
                                          )
                                        );
                                      }
                                    }
                                  } catch {
                                    setMcpBindings((prev) =>
                                      prev.map((b) =>
                                        b.id === binding.id ? { ...b, isEnabled: !checked } : b
                                      )
                                    );
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className='flex flex-wrap gap-2 border-t pt-3'>
                    <Button size='sm' variant='outline' className='flex-1' onClick={() => openEdit(row)}>
                      编辑
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='flex-1'
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(row.authKey); } catch { }
                      }}
                    >
                      复制 Key
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='flex-1'
                      onClick={() => void handleRotateKey(row)}
                    >
                      重置 Key
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
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
                <Label>绑定 Skills</Label>
                <div className='flex flex-wrap gap-2'>
                  {skillsLoading ? (
                    <span className='text-muted-foreground text-xs'>加载中…</span>
                  ) : skills.length === 0 ? (
                    <span className='text-muted-foreground text-xs'>当前租户暂无 skills</span>
                  ) : (
                    skills.map((skill) => {
                      const checked = editSkillKeys.includes(skill.skillKey);
                      return (
                        <button
                          key={skill.skillKey}
                          type='button'
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground'
                          )}
                          onClick={() => {
                            setEditSkillKeys((prev) =>
                              prev.includes(skill.skillKey)
                                ? prev.filter((k) => k !== skill.skillKey)
                                : [...prev, skill.skillKey]
                            );
                          }}
                        >
                          {skill.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className='grid gap-2'>
                <Label>绑定 MCPs</Label>
                <div className='flex flex-wrap gap-2'>
                  {mcpsLoading ? (
                    <span className='text-muted-foreground text-xs'>加载中…</span>
                  ) : mcps.length === 0 ? (
                    <span className='text-muted-foreground text-xs'>当前租户暂无 MCPs</span>
                  ) : (
                    mcps.map((mcp) => {
                      const checked = editMcpKeys.includes(mcp.mcpKey);
                      return (
                        <button
                          key={mcp.mcpKey}
                          type='button'
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground'
                          )}
                          onClick={() => {
                            setEditMcpKeys((prev) =>
                              prev.includes(mcp.mcpKey)
                                ? prev.filter((k) => k !== mcp.mcpKey)
                                : [...prev, mcp.mcpKey]
                            );
                          }}
                        >
                          {mcp.name}
                        </button>
                      );
                    })
                  )}
                </div>
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
                      } catch { }
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
