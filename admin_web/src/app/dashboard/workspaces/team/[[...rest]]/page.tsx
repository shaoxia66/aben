'use client';

import PageContainer from '@/components/layout/page-container';
import { teamInfoContent } from '@/config/infoconfig';

export default function TeamPage() {
  return (
    <PageContainer
      pageTitle='团队管理'
      pageDescription='管理工作空间团队、成员、角色与安全等。'
      infoContent={teamInfoContent}
    >
      <div className='space-y-4'>
        <p className='text-muted-foreground text-sm'>
          这里原本用于展示 Clerk 的 OrganizationProfile 组件。
        </p>
        <p className='text-muted-foreground text-sm'>
          当前示例已移除第三方认证，你可以在此接入自己的团队管理页面。
        </p>
      </div>
    </PageContainer>
  );
}
