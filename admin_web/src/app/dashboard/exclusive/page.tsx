'use client';

import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { BadgeCheck } from 'lucide-react';

export default function ExclusivePage() {
  return (
    <PageContainer>
      <div className='space-y-6'>
        <div>
          <h1 className='flex items-center gap-2 text-3xl font-bold tracking-tight'>
            <BadgeCheck className='h-7 w-7 text-green-600' />
            专属页面示例
          </h1>
          <p className='text-muted-foreground'>
            这里原本是基于 Clerk 订阅计划控制访问的专属页面。
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>自由定义访问控制</CardTitle>
            <CardDescription>
              现在你可以根据自身业务，接入任意鉴权或订阅系统来保护此页面。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-muted-foreground'>
              例如：根据后台返回的会员等级、角色或购买记录，决定是否展示这里的内容。
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
