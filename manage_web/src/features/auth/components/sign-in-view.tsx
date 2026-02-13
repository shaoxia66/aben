'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { IconStar } from '@tabler/icons-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { InteractiveGridPattern } from './interactive-grid';

export const metadata: Metadata = {
  title: '登录认证',
  description: '使用组件构建的登录认证表单。'
};

export default function SignInViewPage({ stars }: { stars: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<'account' | 'phone'>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push('/dashboard/overview');
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
        Login
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
          <div className='w-full rounded-lg border bg-background p-6'>
            <h2 className='mb-2 text-xl font-semibold'>登录到控制台</h2>
            <div className='mb-4 flex items-center gap-2 rounded-full bg-muted p-1 text-xs'>
              <button
                type='button'
                onClick={() => setMode('account')}
                className={cn(
                  'flex-1 rounded-full px-3 py-1 text-sm transition-colors',
                  mode === 'account'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                账号登录
              </button>
              <button
                type='button'
                onClick={() => setMode('phone')}
                className={cn(
                  'flex-1 rounded-full px-3 py-1 text-sm transition-colors',
                  mode === 'phone'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                手机登录
              </button>
            </div>
            <form className='space-y-4' onSubmit={handleSubmit}>
              {mode === 'account' && (
                <>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium' htmlFor='email'>
                      账号
                    </label>
                    <input
                      id='email'
                      type='text'
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                      placeholder='邮箱或用户名'
                      required
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
                </>
              )}
              {mode === 'phone' && (
                <>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium' htmlFor='phone'>
                      手机号
                    </label>
                    <input
                      id='phone'
                      type='tel'
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                      placeholder='请输入手机号'
                      required
                    />
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='flex-1 space-y-2'>
                      <label className='text-sm font-medium' htmlFor='code'>
                        验证码
                      </label>
                      <input
                        id='code'
                        type='text'
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                        placeholder='短信验证码'
                        required
                      />
                    </div>
                    <button
                      type='button'
                      className={cn(
                        buttonVariants({ variant: 'outline' }),
                        'mt-5 whitespace-nowrap'
                      )}
                    >
                      获取验证码
                    </button>
                  </div>
                </>
              )}
              <button
                type='submit'
                className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
              >
                登录
              </button>
              <p className='text-muted-foreground text-center text-xs'>
                没有账号？{' '}
                <Link
                  href='/auth/sign-up'
                  className='text-primary underline underline-offset-4'
                >
                  前往注册
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
