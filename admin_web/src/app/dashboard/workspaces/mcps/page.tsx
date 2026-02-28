'use client';

import { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type McpSummary = {
    id: string;
    mcpKey: string;
    name: string;
    description: string | null;
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export default function WorkspaceMcpsPage() {
    const [mcps, setMcps] = useState<McpSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selected, setSelected] = useState<McpSummary | null>(null);
    const [deleting, setDeleting] = useState(false);

    // 导入状态
    const [bulkJson, setBulkJson] = useState('');
    const [bulkParsed, setBulkParsed] = useState<{ mcpKey: string; config: Record<string, unknown> }[]>([]);
    const [bulkError, setBulkError] = useState('');
    const [importing, setImporting] = useState(false);

    async function loadMcps() {
        setLoading(true);
        try {
            const response = await fetchWithTenantRefresh('/api/mcps', { method: 'GET' });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                toast.error(data?.error?.message ?? '获取 MCP 列表失败');
                return;
            }
            setMcps(Array.isArray(data?.mcps) ? data.mcps : []);
        } catch {
            toast.error('获取 MCP 列表失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadMcps();
    }, []);



    async function handleDelete() {
        if (!selected) return;
        setDeleting(true);
        try {
            const response = await fetchWithTenantRefresh(
                `/api/mcps/${encodeURIComponent(selected.mcpKey)}`,
                { method: 'DELETE' }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                toast.error(data?.error?.message ?? '删除 MCP 失败');
                return;
            }
            toast.success(`MCP "${selected.name}" 已删除`);
            setDetailOpen(false);
            setSelected(null);
            await loadMcps();
        } catch {
            toast.error('删除 MCP 失败，请稍后重试');
        } finally {
            setDeleting(false);
        }
    }

    function getCommand(config: Record<string, unknown>): string {
        const cmd = config?.command;
        return typeof cmd === 'string' ? cmd : '-';
    }

    function parseBulkJson(raw: string) {
        setBulkJson(raw);
        setBulkError('');
        setBulkParsed([]);
        if (!raw.trim()) return;
        try {
            const parsed = JSON.parse(raw);
            const servers: Record<string, unknown> =
                typeof parsed?.mcpServers === 'object' && parsed.mcpServers !== null
                    ? (parsed.mcpServers as Record<string, unknown>)
                    : parsed;

            const entries: { mcpKey: string; config: Record<string, unknown> }[] = [];
            for (const [key, val] of Object.entries(servers)) {
                if (typeof val !== 'object' || val === null || Array.isArray(val)) {
                    setBulkError(`"${key}" 的值不是有效对象，已跳过`);
                    continue;
                }
                entries.push({ mcpKey: key, config: val as Record<string, unknown> });
            }
            if (entries.length === 0) {
                setBulkError('未能解析到任何 MCP 配置，请检查 JSON 格式');
                return;
            }
            setBulkParsed(entries);
        } catch {
            setBulkError('JSON 格式错误，请检查后重试');
        }
    }

    async function handleBulkImport() {
        if (bulkParsed.length === 0) return;
        setImporting(true);
        let successCount = 0;
        let failCount = 0;
        for (const entry of bulkParsed) {
            try {
                const response = await fetchWithTenantRefresh('/api/mcps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mcpKey: entry.mcpKey,
                        name: entry.mcpKey,
                        description: null,
                        config: entry.config
                    })
                });
                if (response.ok) {
                    successCount++;
                } else {
                    const data = await response.json().catch(() => null);
                    toast.error(`"${entry.mcpKey}" 导入失败：${data?.error?.message ?? '未知错误'}`);
                    failCount++;
                }
            } catch {
                toast.error(`"${entry.mcpKey}" 导入失败`);
                failCount++;
            }
        }
        setImporting(false);
        if (successCount > 0) {
            toast.success(
                `成功导入 ${successCount} 个 MCP${failCount > 0 ? `，${failCount} 个失败` : ''}`
            );
            setCreateOpen(false);
            setBulkJson('');
            setBulkParsed([]);
            setBulkError('');
            await loadMcps();
        }
    }

    function openCreateDialog() {
        setBulkJson('');
        setBulkParsed([]);
        setBulkError('');
        setCreateOpen(true);
    }

    return (
        <PageContainer
            pageTitle='MCP 管理'
            pageDescription='管理当前租户配置的 MCP 工具，config 字段对应 mcp-adapters 的单条 server 配置'
        >
            <div className='space-y-6'>
                <Card>
                    <CardHeader>
                        <div className='flex items-center justify-between gap-4'>
                            <div>
                                <CardTitle>MCP 列表</CardTitle>
                            </div>
                            <Button size='sm' onClick={openCreateDialog}>
                                新增 MCP
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className='rounded-md border'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>名称</TableHead>
                                        <TableHead>标识</TableHead>
                                        <TableHead>command</TableHead>
                                        <TableHead>更新时间</TableHead>
                                        <TableHead className='text-right'>操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className='text-muted-foreground py-6 text-center text-sm'
                                            >
                                                正在加载 MCP 列表…
                                            </TableCell>
                                        </TableRow>
                                    ) : mcps.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className='text-muted-foreground py-6 text-center text-sm'
                                            >
                                                尚未添加任何 MCP，点击右上角"新增 MCP"进行添加。
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        mcps.map((mcp) => (
                                            <TableRow key={mcp.id}>
                                                <TableCell className='font-medium'>{mcp.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant='secondary' className='font-mono text-xs'>
                                                        {mcp.mcpKey}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className='font-mono text-xs text-muted-foreground'>
                                                    {getCommand(mcp.config)}
                                                </TableCell>
                                                <TableCell className='text-muted-foreground text-xs'>
                                                    {new Date(mcp.updatedAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    <Button
                                                        size='sm'
                                                        variant='outline'
                                                        onClick={() => {
                                                            setSelected(mcp);
                                                            setDetailOpen(true);
                                                        }}
                                                    >
                                                        查看
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 新增 MCP Dialog — max-h 限高 + 内部滚动，防止被内容撑开 */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className='sm:max-w-[560px] flex flex-col max-h-[90vh] overflow-hidden'>
                    {/* 固定顶部：标题 + Tab */}
                    <div className='shrink-0'>
                        <DialogHeader>
                            <DialogTitle>新增/导入 MCP</DialogTitle>
                            <DialogDescription>
                                粘贴包含一个或多个 MCP 服务的 JSON 配置以添加到当前租户。
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className='flex flex-col flex-1 overflow-hidden min-h-0 pt-2'>
                        {/* 可滚动区域 */}
                        <div className='flex-1 overflow-y-auto pr-1 space-y-4 pt-1'>
                            <div className='space-y-1.5'>
                                <Label htmlFor='bulk-json'>
                                    粘贴 mcpServers JSON
                                    <span className='text-muted-foreground ml-1 text-xs font-normal'>
                                        （支持 Claude Desktop / Cursor 格式）
                                    </span>
                                </Label>
                                <Textarea
                                    id='bulk-json'
                                    placeholder={`{\n  "mcpServers": {\n    "context7": {\n      "command": "npx",\n      "args": ["-y", "@upstash/context7-mcp@latest"],\n      "env": { "DEFAULT_MINIMUM_TOKENS": "10000" }\n    }\n  }\n}`}
                                    value={bulkJson}
                                    onChange={(e) => parseBulkJson(e.target.value)}
                                    rows={10}
                                    className='font-mono text-xs resize-none'
                                />
                            </div>

                            {bulkError && (
                                <p className='text-destructive text-xs'>{bulkError}</p>
                            )}

                            {bulkParsed.length > 0 && (
                                <div className='rounded-md border p-3 space-y-2'>
                                    <p className='text-xs text-muted-foreground font-medium'>
                                        解析到 {bulkParsed.length} 个 MCP，点击「导入」后将逐条写入：
                                    </p>
                                    <div className='space-y-1.5'>
                                        {bulkParsed.map((entry) => (
                                            <div key={entry.mcpKey} className='flex items-center gap-2'>
                                                <Badge
                                                    variant='secondary'
                                                    className='font-mono text-xs shrink-0'
                                                >
                                                    {entry.mcpKey}
                                                </Badge>
                                                <span className='text-xs text-muted-foreground font-mono truncate'>
                                                    {typeof entry.config.command === 'string'
                                                        ? `${entry.config.command} ${Array.isArray(entry.config.args)
                                                            ? (entry.config.args as string[]).join(' ')
                                                            : ''
                                                        }`
                                                        : JSON.stringify(entry.config).slice(0, 60)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* 固定底部按钮 */}
                        <div className='shrink-0 flex justify-end gap-2 pt-3 border-t mt-3'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => setCreateOpen(false)}
                                disabled={importing}
                            >
                                取消
                            </Button>
                            <Button
                                type='button'
                                disabled={importing || bulkParsed.length === 0}
                                onClick={() => void handleBulkImport()}
                            >
                                {importing
                                    ? '导入中…'
                                    : `导入${bulkParsed.length > 0 ? ` (${bulkParsed.length})` : ''}`}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 详情 Sheet */}
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent side='right' className='sm:max-w-[500px]'>
                    <SheetHeader>
                        <SheetTitle>{selected?.name ?? 'MCP 详情'}</SheetTitle>
                        <SheetDescription>
                            {selected?.mcpKey ? `标识：${selected.mcpKey}` : null}
                        </SheetDescription>
                    </SheetHeader>
                    {selected && (
                        <div className='space-y-4 p-4 pt-2'>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-xs'>描述</p>
                                <p className='text-sm'>{selected.description ?? '暂无描述'}</p>
                            </div>
                            <div className='space-y-1.5'>
                                <p className='text-muted-foreground text-xs'>config</p>
                                <pre className='bg-muted overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed'>
                                    {JSON.stringify(selected.config, null, 2)}
                                </pre>
                            </div>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-xs'>创建时间</p>
                                <p className='text-sm'>{new Date(selected.createdAt).toLocaleString()}</p>
                            </div>
                            <div className='space-y-1'>
                                <p className='text-muted-foreground text-xs'>更新时间</p>
                                <p className='text-sm'>{new Date(selected.updatedAt).toLocaleString()}</p>
                            </div>
                            <div className='border-t pt-4'>
                                <Button
                                    variant='destructive'
                                    size='sm'
                                    disabled={deleting}
                                    onClick={() => void handleDelete()}
                                >
                                    {deleting ? '删除中…' : '删除此 MCP'}
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </PageContainer>
    );
}
