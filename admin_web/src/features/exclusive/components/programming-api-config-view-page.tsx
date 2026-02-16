'use client';

import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

type Provider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'azure_openai' | 'custom';
type Status = 'enabled' | 'disabled';

type LlmConfigRow = {
  id: string;
  provider: string;
  modelName: string | null;
  baseUrl: string | null;
  isDefault: boolean;
  status: Status;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  createdAt: string;
  updatedAt: string;
};

const providerOptions: { value: Provider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: '通义千问（Qwen）' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'custom', label: '自定义（兼容 OpenAI）' }
];

function formatDateTime(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function providerLabel(provider: string) {
  return providerOptions.find((p) => p.value === provider)?.label ?? provider;
}

function statusLabel(status: Status) {
  return status === 'enabled' ? '启用' : '禁用';
}

export default function ProgrammingApiConfigViewPage() {
  const [rows, setRows] = useState<LlmConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<LlmConfigRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<LlmConfigRow | null>(null);
  const [deletingSubmitting, setDeletingSubmitting] = useState(false);

  const [provider, setProvider] = useState<Provider>('deepseek');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithTenantRefresh('/api/api-config/llm-config');
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMessage(data?.error?.message || '加载失败');
        setRows([]);
        return;
      }
      const list = Array.isArray(data?.configs) ? data.configs : [];
      const normalized = list
        .map((it: any): LlmConfigRow | null => {
          if (!it || typeof it !== 'object') return null;
          if (typeof it.id !== 'string' || typeof it.provider !== 'string') return null;
          if (it.status !== 'enabled' && it.status !== 'disabled') return null;
          return {
            id: it.id,
            provider: it.provider,
            modelName: typeof it.modelName === 'string' ? it.modelName : null,
            baseUrl: typeof it.baseUrl === 'string' ? it.baseUrl : null,
            isDefault: !!it.isDefault,
            status: it.status,
            hasApiKey: !!it.hasApiKey,
            apiKeyLast4: typeof it.apiKeyLast4 === 'string' ? it.apiKeyLast4 : null,
            createdAt: typeof it.createdAt === 'string' ? it.createdAt : '',
            updatedAt: typeof it.updatedAt === 'string' ? it.updatedAt : ''
          };
        })
        .filter(Boolean) as LlmConfigRow[];
      setRows(normalized);
    } catch {
      setErrorMessage('加载失败');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [rows]);

  function openCreate() {
    setEditing(null);
    setProvider('deepseek');
    setModelName('');
    setBaseUrl('');
    setIsDefault(false);
    setEnabled(true);
    setApiKey('');
    setClearApiKey(false);
    setErrorMessage(null);
    setEditOpen(true);
  }

  function openEdit(row: LlmConfigRow) {
    setEditing(row);
    const p = (providerOptions.find((x) => x.value === row.provider)?.value ?? 'custom') as Provider;
    setProvider(p);
    setModelName(row.modelName ?? '');
    setBaseUrl(row.baseUrl ?? '');
    setIsDefault(!!row.isDefault);
    setEnabled(row.status === 'enabled');
    setApiKey('');
    setClearApiKey(false);
    setErrorMessage(null);
    setEditOpen(true);
  }

  function openDelete(row: LlmConfigRow) {
    setDeleting(row);
    setDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleting || deletingSubmitting) return;
    setDeletingSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithTenantRefresh(`/api/api-config/llm-config?id=${encodeURIComponent(deleting.id)}`, {
        method: 'DELETE'
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMessage(data?.error?.message || '删除失败');
        return;
      }
      setDeleteOpen(false);
      setDeleting(null);
      await refresh();
    } catch {
      setErrorMessage('删除失败');
    } finally {
      setDeletingSubmitting(false);
    }
  }

  async function handleSave() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: any = {
        id: editing?.id ?? null,
        provider,
        modelName: modelName.trim() ? modelName.trim() : null,
        baseUrl: baseUrl.trim() ? baseUrl.trim() : null,
        isDefault,
        status: enabled ? 'enabled' : 'disabled'
      };

      if (clearApiKey) {
        payload.apiKey = null;
      } else if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetchWithTenantRefresh('/api/api-config/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMessage(data?.error?.message || '保存失败');
        return;
      }
      setEditOpen(false);
      setEditing(null);
      await refresh();
    } catch {
      setErrorMessage('保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className='space-y-6'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>API 配置</h1>
            <p className='text-muted-foreground'>为当前租户配置大模型厂商、Base URL、API Key 与模型。</p>
          </div>
          <Button onClick={() => openCreate()} disabled={loading}>
            新增配置
          </Button>
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
                <TableHead>厂商</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>默认</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className='text-right'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center text-sm'>
                    加载中…
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center text-sm'>
                    暂无配置
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className='font-medium'>{providerLabel(row.provider)}</TableCell>
                    <TableCell className='max-w-[220px] whitespace-normal break-words'>{row.modelName ?? '-'}</TableCell>
                    <TableCell className='text-xs'>{row.isDefault ? '是' : '-'}</TableCell>
                    <TableCell>{statusLabel(row.status)}</TableCell>
                    <TableCell className='max-w-[360px] whitespace-normal break-words'>{row.baseUrl ?? '-'}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {row.hasApiKey ? (row.apiKeyLast4 ? `****${row.apiKeyLast4}` : '已配置') : '未配置'}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>{formatDateTime(row.updatedAt)}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button size='sm' variant='outline' onClick={() => openEdit(row)}>
                          编辑
                        </Button>
                        <Button size='sm' variant='destructive' onClick={() => openDelete(row)}>
                          删除
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
            setApiKey('');
            setClearApiKey(false);
            setIsDefault(false);
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑配置' : '新增配置'}</DialogTitle>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>厂商</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger>
                    <SelectValue placeholder='请选择' />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label>状态</Label>
                <div className='flex items-center gap-3 pt-2'>
                  <Switch checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
                  <span className='text-sm text-muted-foreground'>{enabled ? '启用' : '禁用'}</span>
                </div>
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>默认配置</Label>
              <div className='flex items-center gap-3 pt-2'>
                <Switch checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
                <span className='text-sm text-muted-foreground'>{isDefault ? '是（整个租户仅一个默认）' : '否'}</span>
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>模型名称</Label>
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder='可选，例如：deepseek-chat / gpt-4o-mini' />
            </div>

            <div className='grid gap-2'>
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder='可选，例如：https://api.openai.com/v1' />
              <div className='text-muted-foreground text-xs'>留空表示使用 SDK 默认值（如厂商默认网关）。</div>
            </div>

            <div className='grid gap-2'>
              <Label>API Key</Label>
              <Input
                type='password'
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editing?.hasApiKey ? '留空表示不修改' : '请输入 Key'}
                disabled={clearApiKey}
              />
              {editing?.hasApiKey ? (
                <div className='flex items-center justify-between gap-3'>
                  <div className='text-muted-foreground text-xs'>
                    当前：{editing.apiKeyLast4 ? `****${editing.apiKeyLast4}` : '已配置'}
                  </div>
                  <div className='flex items-center gap-2'>
                    <Switch checked={clearApiKey} onCheckedChange={(v) => setClearApiKey(!!v)} />
                    <span className='text-sm text-muted-foreground'>清除 Key</span>
                  </div>
                </div>
              ) : (
                <div className='text-muted-foreground text-xs'>Key 仅用于服务端调用，不会在列表中明文展示。</div>
              )}
            </div>
          </div>

          <DialogFooter className='mt-2'>
            <Button
              variant='outline'
              onClick={() => {
                setEditOpen(false);
              }}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleting(null);
            setDeletingSubmitting(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `将删除「${providerLabel(deleting.provider)}${deleting.modelName ? ` / ${deleting.modelName}` : ''}」这条配置。此操作不可撤销。`
                : '此操作不可撤销。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()} disabled={deletingSubmitting}>
              {deletingSubmitting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
