'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { IconStar } from '@tabler/icons-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { InteractiveGridPattern } from './interactive-grid';

export const metadata: Metadata = {
  title: '注册认证',
  description: '使用组件构建的注册认证表单。'
};

export default function SignUpViewPage({ stars }: { stars: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setResultJson(null);

    if (password !== confirmPassword) {
      setErrorMessage('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() ? displayName.trim() : undefined,
          tenantName
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '注册失败'
            : '注册失败';
        setErrorMessage(message);
        setResultJson(JSON.stringify(data ?? { error: { message } }, null, 2));
        return;
      }

      setResultJson(JSON.stringify(data, null, 2));
      const next = searchParams.get('next');
      router.push(next || '/dashboard/overview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/examples/authentication'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 hidden md:top-8 md:right-8'
        )}
      >
        Sign Up
      </Link>
      <div className='bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-zinc-900' />
        <div className='relative z-20 flex items-center text-lg font-medium'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2 h-6 w-6'
          >
            <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
          </svg>
          Logo
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;This starter template has saved me countless hours of work
              and helped me deliver projects to my clients faster than ever
              before.&rdquo;
            </p>
            <footer className='text-sm'>Random Dude</footer>
          </blockquote>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
          <Link
            className={cn('group inline-flex hover:text-yellow-200')}
            target='_blank'
            href={'https://github.com/kiranism/next-shadcn-dashboard-starter'}
          >
            <div className='flex items-center'>
              <GitHubLogoIcon className='size-4' />
              <span className='ml-1 inline'>Star on GitHub</span>{' '}
            </div>
            <div className='ml-2 flex items-center gap-1 text-sm md:flex'>
              <IconStar
                className='size-4 text-gray-500 transition-all duration-300 group-hover:text-yellow-300'
                fill='currentColor'
              />
              <span className='font-display font-medium'>{stars}</span>
            </div>
          </Link>
          <div className='w-full rounded-lg border bg-background p-6'>
            <h2 className='mb-2 text-xl font-semibold'>注册新账号</h2>
            <p className='text-muted-foreground mb-4 text-sm'>
              提交后会调用 /api/auth/register 创建用户与租户，并返回 tokens。
            </p>
            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='space-y-2'>
                <label className='text-sm font-medium' htmlFor='tenantName'>
                  租户名称
                </label>
                <input
                  id='tenantName'
                  type='text'
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                  placeholder='例如：aben'
                  required
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium' htmlFor='email'>
                  邮箱
                </label>
                <input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                  placeholder='you@example.com'
                  required
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium' htmlFor='displayName'>
                  显示名称（可选）
                </label>
                <input
                  id='displayName'
                  type='text'
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                  placeholder='例如：wjw'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium' htmlFor='password'>
                  密码
                </label>
                <input
                  id='password'
                  type='password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                  placeholder='请输入密码'
                  required
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium' htmlFor='confirmPassword'>
                  确认密码
                </label>
                <input
                  id='confirmPassword'
                  type='password'
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                  placeholder='请再次输入密码'
                  required
                />
              </div>
              {errorMessage ? (
                <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                  {errorMessage}
                </div>
              ) : null}
              <button
                type='submit'
                disabled={isSubmitting}
                className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
              >
                {isSubmitting ? '注册中...' : '注册'}
              </button>
              {resultJson ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>响应</p>
                    <button
                      type='button'
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(resultJson);
                        } catch {}
                      }}
                    >
                      复制
                    </button>
                  </div>
                  <pre className='max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs'>
                    {resultJson}
                  </pre>
                </div>
              ) : null}
              <p className='text-muted-foreground text-center text-xs'>
                已有账号？{' '}
                <Link
                  href='/auth/sign-in'
                  className='text-primary underline underline-offset-4'
                >
                  前往登录
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
