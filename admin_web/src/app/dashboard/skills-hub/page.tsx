import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { Suspense } from 'react';

export const metadata = {
  title: '控制台：Skills 仓库'
};

type HubSkillSummary = {
  skillKey: string;
  name: string;
  description: string | null;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

async function loadHubSkills(): Promise<HubSkillSummary[]> {
  try {
    const response = await fetchWithTenantRefresh('/api/skills-hub', { method: 'GET' });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return [];
    }
    const list = Array.isArray(data?.skills) ? data.skills : [];
    return list
      .filter(
        (s: any) =>
          s &&
          typeof s === 'object' &&
          typeof s.skillKey === 'string' &&
          typeof s.name === 'string'
      )
      .map((s: any) => ({
        skillKey: s.skillKey as string,
        name: s.name as string,
        description:
          typeof s.description === 'string' && s.description.trim()
            ? (s.description as string)
            : null,
        fileCount: typeof s.fileCount === 'number' ? s.fileCount : 0,
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : '',
        updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : ''
      }));
  } catch {
    return [];
  }
}

async function HubSkillsGrid() {
  const skills = await loadHubSkills();

  if (!skills.length) {
    return (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        暂无可用的仓库 Skills
      </div>
    );
  }

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {skills.map((skill) => (
        <Card key={skill.skillKey} className='flex flex-col'>
          <CardHeader>
            <CardTitle className='flex items-center justify-between gap-2'>
              <span className='truncate'>{skill.name}</span>
              <span className='text-muted-foreground text-xs font-mono'>
                {skill.skillKey}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className='flex-1'>
            <div className='space-y-1 text-sm'>
              <p className='text-muted-foreground line-clamp-3'>
                {skill.description ?? '该 skill 暂无描述'}
              </p>
              <p className='text-muted-foreground text-xs'>
                文件数：{skill.fileCount}{' '}
              </p>
            </div>
          </CardContent>
          <CardFooter className='flex items-center justify-between'>
            <div className='text-muted-foreground text-xs'>
              更新于{' '}
              {skill.updatedAt ? new Date(skill.updatedAt).toLocaleString() : '-'}
            </div>
            <form
              action={async () => {
                'use server';
                await fetchWithTenantRefresh(
                  `/api/skills-hub/${encodeURIComponent(skill.skillKey)}/install`,
                  {
                    method: 'POST'
                  }
                );
              }}
            >
              <Button size='sm' type='submit'>
                安装到当前租户
              </Button>
            </form>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default async function Page() {
  return (
    <PageContainer
      scrollable
      pageTitle='Skills 仓库'
      pageDescription='从公共 Skills 仓库中挑选并安装到当前租户'
    >
      <Suspense fallback={<div className='h-40' />}>
        <HubSkillsGrid />
      </Suspense>
    </PageContainer>
  );
}

