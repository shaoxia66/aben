import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

const salesData = [
  {
    name: '张伟',
    email: 'zhangwei@example.com',
    avatar: 'https://api.slingacademy.com/public/sample-users/1.png',
    fallback: 'ZW',
    amount: '+¥1,999.00'
  },
  {
    name: '李娜',
    email: 'lina@example.com',
    avatar: 'https://api.slingacademy.com/public/sample-users/2.png',
    fallback: 'LN',
    amount: '+¥39.00'
  },
  {
    name: '王强',
    email: 'wangqiang@example.com',
    avatar: 'https://api.slingacademy.com/public/sample-users/3.png',
    fallback: 'WQ',
    amount: '+¥299.00'
  },
  {
    name: '赵敏',
    email: 'zhaomin@example.com',
    avatar: 'https://api.slingacademy.com/public/sample-users/4.png',
    fallback: 'ZM',
    amount: '+¥99.00'
  },
  {
    name: '陈晨',
    email: 'chenchen@example.com',
    avatar: 'https://api.slingacademy.com/public/sample-users/5.png',
    fallback: 'CC',
    amount: '+¥39.00'
  }
];

export function RecentSales() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>最近销售</CardTitle>
        <CardDescription>本月累计完成 265 笔订单。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-8'>
          {salesData.map((sale, index) => (
            <div key={index} className='flex items-center'>
              <Avatar className='h-9 w-9'>
                <AvatarImage src={sale.avatar} alt='Avatar' />
                <AvatarFallback>{sale.fallback}</AvatarFallback>
              </Avatar>
              <div className='ml-4 space-y-1'>
                <p className='text-sm leading-none font-medium'>{sale.name}</p>
                <p className='text-muted-foreground text-sm'>{sale.email}</p>
              </div>
              <div className='ml-auto font-medium'>{sale.amount}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
