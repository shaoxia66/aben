'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IconAlertCircle } from '@tabler/icons-react';

export default function AreaStatsError({ error }: { error: Error }) {
  return (
    <Alert variant='destructive'>
      <IconAlertCircle className='h-4 w-4' />
      <AlertTitle>错误</AlertTitle>
      <AlertDescription>
        加载面积图统计数据失败：{error.message}
      </AlertDescription>
    </Alert>
  );
}
