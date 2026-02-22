import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BarGraphSkeleton() {
  const heights = [40, 65, 30, 80, 55, 60, 35, 75, 50, 70, 45, 85];

  return (
    <Card>
      <CardHeader className='flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row'>
        <div className='flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6'>
          <Skeleton className='h-6 w-[180px]' />
          <Skeleton className='h-4 w-[250px]' />
        </div>
        <div className='flex'>
          {[1, 2].map((i) => (
            <div
              key={i}
              className='relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6'
            >
              <Skeleton className='h-3 w-[80px]' />
              <Skeleton className='h-8 w-[100px] sm:h-10' />
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className='px-2 sm:p-6'>
        {/* Bar-like shapes */}
        <div className='flex aspect-auto h-[280px] w-full items-end justify-around gap-2 pt-8'>
          {heights.map((height, i) => (
            <Skeleton
              key={i}
              className='w-full'
              style={{
                height: `${height}%`
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
