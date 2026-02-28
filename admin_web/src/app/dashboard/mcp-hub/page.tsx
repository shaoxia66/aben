import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { Suspense } from 'react';

export const metadata = {
    title: '控制台：MCP 仓库'
};

type HubMcpSummary = {
    id: string;
    mcpKey: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    config: Record<string, unknown>;
    author: string | null;
    version: string;
    githubUrl: string | null;
    siteUrl: string | null;
    isPublished: boolean;
    updatedAt: string;
};

async function loadHubMcps(): Promise<HubMcpSummary[]> {
    try {
        const response = await fetchWithTenantRefresh('/api/mcp-hub', { method: 'GET' });
        const data = await response.json().catch(() => null);
        if (!response.ok) return [];
        const list = Array.isArray(data?.mcps) ? data.mcps : [];
        return list.filter(
            (m: any) =>
                m &&
                typeof m === 'object' &&
                typeof m.mcpKey === 'string' &&
                typeof m.name === 'string'
        );
    } catch {
        return [];
    }
}

async function HubMcpsGrid() {
    const mcps = await loadHubMcps();

    if (!mcps.length) {
        return (
            <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
                暂无可用的 MCP 仓库插件
            </div>
        );
    }

    return (
        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {mcps.map((mcp) => {
                const command = typeof mcp.config?.command === 'string' ? mcp.config.command : null;
                return (
                    <Card key={mcp.mcpKey} className='flex flex-col'>
                        <CardHeader className='pb-2'>
                            <div className='flex items-start justify-between gap-2'>
                                <CardTitle className='truncate text-base'>{mcp.name}</CardTitle>
                                <Badge variant='secondary' className='shrink-0 font-mono text-xs'>
                                    {mcp.mcpKey}
                                </Badge>
                            </div>
                            <div className='flex items-center gap-2 pt-1'>
                                {command && (
                                    <span className='text-muted-foreground font-mono text-xs'>{command}</span>
                                )}
                                <Badge variant='outline' className='text-xs'>
                                    v{mcp.version}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className='flex-1 space-y-3'>
                            <p className='text-muted-foreground line-clamp-2 text-sm'>
                                {mcp.description ?? '该 MCP 暂无描述'}
                            </p>
                            {/* config 预览 */}
                            <pre className='bg-muted overflow-hidden rounded p-2 font-mono text-xs leading-relaxed line-clamp-3'>
                                {JSON.stringify(mcp.config, null, 2)}
                            </pre>
                            {mcp.author && (
                                <p className='text-muted-foreground text-xs'>作者：{mcp.author}</p>
                            )}
                        </CardContent>
                        <CardFooter className='flex items-center justify-between gap-2 border-t pt-3'>
                            <div className='flex gap-3'>
                                {mcp.githubUrl && (
                                    <a
                                        href={mcp.githubUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 transition-colors'
                                    >
                                        GitHub
                                    </a>
                                )}
                                {mcp.siteUrl && (
                                    <a
                                        href={mcp.siteUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 transition-colors'
                                    >
                                        官网
                                    </a>
                                )}
                            </div>
                            <form
                                action={async () => {
                                    'use server';
                                    await fetchWithTenantRefresh(
                                        `/api/mcp-hub/${encodeURIComponent(mcp.mcpKey)}/install`,
                                        { method: 'POST' }
                                    );
                                }}
                            >
                                <Button size='sm' type='submit'>
                                    安装到当前租户
                                </Button>
                            </form>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}

export default async function Page() {
    return (
        <PageContainer
            scrollable
            pageTitle='MCP 仓库'
            pageDescription='从公共 MCP 仓库中挑选并安装到当前租户，快速接入各类工具能力'
        >
            <Suspense fallback={<div className='h-40' />}>
                <HubMcpsGrid />
            </Suspense>
        </PageContainer>
    );
}
