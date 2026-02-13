'use client';

import PageContainer from '@/components/layout/page-container';
import { workspacesInfoContent } from '@/config/infoconfig';

export default function WorkspacesPage() {
  return (
    <PageContainer
      pageTitle='工作空间'
      pageDescription='管理并切换你的工作空间'
      infoContent={workspacesInfoContent}
    >
      <div className='space-y-4'>
        <p className='text-muted-foreground text-sm'>
          这里原本用于展示 Clerk 提供的组织与工作空间列表。
        </p>
        <p className='text-muted-foreground text-sm'>
          当前示例已移除第三方认证，你可以在此接入自己的团队与工作空间管理逻辑。
        </p>
      </div>
    </PageContainer>
  );
}
