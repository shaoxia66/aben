'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IconAlertCircle } from '@tabler/icons-react';

export default function OverviewError({ error }: { error: Error }) {
  return (
    <Alert variant='destructive'>
      <IconAlertCircle className='h-4 w-4' />
      <AlertTitle>错误</AlertTitle>
      <AlertDescription>
        加载统计概览失败：{error.message}
      </AlertDescription>
    </Alert>
  );
}
