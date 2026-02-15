'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type AvatarUser = {
  imageUrl: string;
  fullName: string;
  emailAddresses: Array<{ emailAddress: string }>;
};

export function UserNav() {
  const router = useRouter();
  const [user, setUser] = useState<AvatarUser>({
    imageUrl: '',
    fullName: '用户',
    emailAddresses: [{ emailAddress: '' }]
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me', { method: 'GET' });
        const data = (await response.json().catch(() => null)) as any;
        if (!response.ok) return;
        const email = typeof data?.user?.email === 'string' ? data.user.email : '';
        const displayName = typeof data?.user?.displayName === 'string' ? data.user.displayName : null;
        if (cancelled) return;
        setUser({
          imageUrl: '',
          fullName: displayName || email || '用户',
          emailAddresses: [{ emailAddress: email || '-' }]
        });
      } catch {
        if (cancelled) return;
        setUser({
          imageUrl: '',
          fullName: '用户',
          emailAddresses: [{ emailAddress: '' }]
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/auth/sign-in');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
          <UserAvatarProfile user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-56'
        align='end'
        sideOffset={10}
        forceMount
      >
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm leading-none font-medium'>{user?.fullName || ''}</p>
            <p className='text-muted-foreground text-xs leading-none'>
              {user?.emailAddresses?.[0]?.emailAddress || ''}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem>New Team</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
