import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import ProductListingPage from '@/features/products/components/product-listing';
import { searchParamsCache, serialize } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { productInfoContent } from '@/config/infoconfig';

export const metadata = {
  title: '控制台：产品列表'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const searchParams = await props.searchParams;
  // Allow nested RSCs to access the search params (in a type-safe way)
  searchParamsCache.parse(searchParams);

  // This key is used for invoke suspense if any of the search params changed (used for filters).
  // const key = serialize({ ...searchParams });

  return (
    <PageContainer
      scrollable={false}
      pageTitle='产品列表'
      pageDescription='管理产品（服务端表格功能示例）'
      infoContent={productInfoContent}
      pageHeaderAction={
        <Link
          href='/dashboard/product/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add New
        </Link>
      }
    >
      <Suspense
        // key={key}
        fallback={
          <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
        }
      >
        <ProductListingPage />
      </Suspense>
    </PageContainer>
  );
}
