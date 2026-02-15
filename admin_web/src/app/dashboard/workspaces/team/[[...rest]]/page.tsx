'use client';

import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { teamInfoContent } from '@/config/infoconfig';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

type TeamMemberRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  isDisabled: boolean;
  roleLabel: string;
  statusLabel: string;
  joinedAt: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.roleLabel !== b.roleLabel) return a.roleLabel.localeCompare(b.roleLabel);
      const aKey = (a.displayName || a.email || a.userId).toLowerCase();
      const bKey = (b.displayName || b.email || b.userId).toLowerCase();
      return aKey.localeCompare(bKey);
    });
  }, [members]);

  async function refresh() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithTenantRefresh('/api/team/members');
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMessage(data?.error?.message || '加载失败');
        setMembers([]);
        return;
      }
      const list = Array.isArray(data?.members) ? data.members : [];
      setMembers(
        list.map((m: any) => ({
          userId: String(m?.userId || ''),
          email: typeof m?.email === 'string' ? m.email : null,
          displayName: typeof m?.displayName === 'string' ? m.displayName : null,
          isDisabled: !!m?.isDisabled,
          roleLabel: typeof m?.roleLabel === 'string' ? m.roleLabel : '-',
          statusLabel: typeof m?.statusLabel === 'string' ? m.statusLabel : '-',
          joinedAt: typeof m?.joinedAt === 'string' ? m.joinedAt : null
        }))
      );
    } catch {
      setErrorMessage('加载失败');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <PageContainer
      pageTitle='团队管理'
      pageDescription='管理工作空间团队、成员、角色与安全等。'
      infoContent={teamInfoContent}
    >
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <div className='text-muted-foreground text-sm'>
            {loading ? '加载中…' : `共 ${sorted.length} 位成员`}
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

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>加入时间</TableHead>
                <TableHead className='text-right'>用户ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-10 text-center text-sm'>
                    加载中…
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-10 text-center text-sm'>
                    暂无成员
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className='space-y-1'>
                        <div className='font-medium'>{m.displayName?.trim() ? m.displayName : '未命名用户'}</div>
                        {m.isDisabled ? <div className='text-muted-foreground text-xs'>账号已禁用</div> : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>{m.email || '-'}</TableCell>
                    <TableCell>{m.roleLabel}</TableCell>
                    <TableCell>{m.statusLabel}</TableCell>
                    <TableCell className='text-muted-foreground'>{formatDateTime(m.joinedAt)}</TableCell>
                    <TableCell className='text-right font-mono text-xs text-muted-foreground'>{m.userId}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageContainer>
  );
}
