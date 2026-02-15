'use client';

import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { billingInfoContent } from '@/config/infoconfig';

export default function BillingPage() {
  return (
    <PageContainer
      infoContent={billingInfoContent}
      pageTitle='账单与套餐'
      pageDescription='管理订阅与使用额度'
    >
      <div className='space-y-6'>
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            当前示例未集成在线计费系统，你可以在此接入自己的订阅或支付逻辑。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>套餐与额度</CardTitle>
            <CardDescription>展示你应用的套餐、额度或价格信息。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-muted-foreground'>
              这里原本用于展示 Clerk Billing 的计费信息。
              现在你可以根据业务需要替换成自己的计费或升级入口。
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
