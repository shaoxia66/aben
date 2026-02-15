'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ProfileViewPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('两次输入的新密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && data.error && typeof data.error === 'object'
            ? ((data.error as any).message as string | undefined) || '修改失败'
            : '修改失败';
        setErrorMessage(message);
        return;
      }

      setSuccessMessage('密码已修改，请重新登录');
      router.replace('/auth/sign-in');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '请求失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex w-full flex-col p-4'>
      <div className='space-y-4'>
        <h1 className='text-2xl font-semibold'>个人资料</h1>
        <div className='w-full max-w-md rounded-lg border bg-background p-6'>
          <h2 className='mb-2 text-xl font-semibold'>修改密码</h2>
          <p className='text-muted-foreground mb-4 text-sm'>
            修改成功后会自动退出登录，你需要使用新密码重新登录。
          </p>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <label className='text-sm font-medium' htmlFor='currentPassword'>
                当前密码
              </label>
              <input
                id='currentPassword'
                type='password'
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                placeholder='请输入当前密码'
                required
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium' htmlFor='newPassword'>
                新密码
              </label>
              <input
                id='newPassword'
                type='password'
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                placeholder='至少 8 位'
                required
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium' htmlFor='confirmPassword'>
                确认新密码
              </label>
              <input
                id='confirmPassword'
                type='password'
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'
                placeholder='请再次输入新密码'
                required
              />
            </div>

            {errorMessage ? (
              <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className='rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400'>
                {successMessage}
              </div>
            ) : null}

            <button
              type='submit'
              disabled={isSubmitting}
              className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
            >
              {isSubmitting ? '提交中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
