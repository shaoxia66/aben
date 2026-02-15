'use client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { navItems } from '@/config/nav-config';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useFilteredNavItems } from '@/hooks/use-nav';
import { fetchWithTenantRefresh, setStoredTenantId } from '@/lib/utils';
import {
  IconBell,
  IconChevronRight,
  IconChevronsDown,
  IconCreditCard,
  IconLogout,
  IconUserCircle
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Icons } from '../icons';
import { OrgSwitcher } from '../org-switcher';

type AvatarUser = {
  imageUrl: string;
  fullName: string;
  emailAddresses: Array<{ emailAddress: string }>;
};

type TenantOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const router = useRouter();
  const filteredItems = useFilteredNavItems(navItems);
  const [user, setUser] = React.useState<AvatarUser>({
    imageUrl: '',
    fullName: '用户',
    emailAddresses: [{ emailAddress: '' }]
  });
  const [currentTenant, setCurrentTenant] = React.useState<TenantOption | null>(null);
  const [tenants, setTenants] = React.useState<TenantOption[]>([]);
  const [switchingTenantId, setSwitchingTenantId] = React.useState<string | null>(null);

  const tenantAvatarUser: AvatarUser = React.useMemo(() => {
    const tenantName = currentTenant?.name || '租户';
    return {
      imageUrl: '',
      fullName: tenantName,
      emailAddresses: [{ emailAddress: '' }]
    };
  }, [currentTenant?.name]);

  React.useEffect(() => {
    void isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchWithTenantRefresh('/api/auth/me', { method: 'GET' });
        const data = (await response.json().catch(() => null)) as any;
        if (!response.ok) return;
        const email = typeof data?.user?.email === 'string' ? data.user.email : '';
        const displayName = typeof data?.user?.displayName === 'string' ? data.user.displayName : null;
        const tenant = data?.tenant;
        const list = Array.isArray(data?.tenants) ? data.tenants : [];
        const normalizeTenant = (t: any): TenantOption | null => {
          if (!t || typeof t !== 'object') return null;
          if (typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.slug !== 'string') return null;
          return {
            id: t.id,
            name: t.name,
            slug: t.slug,
            role: typeof t.role === 'string' ? t.role : '',
            status: typeof t.status === 'string' ? t.status : ''
          };
        };
        const normalizedTenants = list.map(normalizeTenant).filter(Boolean) as TenantOption[];
        const normalizedCurrentTenant = normalizeTenant(tenant);
        if (cancelled) return;
        setUser({
          imageUrl: '',
          fullName: displayName || email || '用户',
          emailAddresses: [{ emailAddress: email || '-' }]
        });
        setTenants(normalizedTenants);
        setCurrentTenant(normalizedCurrentTenant);
        setStoredTenantId(normalizedCurrentTenant?.id ?? null);
      } catch {
        if (cancelled) return;
        setUser({
          imageUrl: '',
          fullName: '用户',
          emailAddresses: [{ emailAddress: '' }]
        });
        setTenants([]);
        setCurrentTenant(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSwitchTenant = async (tenantId: string) => {
    if (switchingTenantId) return;
    setSwitchingTenantId(tenantId);
    try {
      const response = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      if (!response.ok) return;
      const data = (await response.json().catch(() => null)) as any;
      const t = data?.tenant;
      if (t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.slug === 'string') {
        setCurrentTenant({
          id: t.id,
          name: t.name,
          slug: t.slug,
          role: typeof t.role === 'string' ? t.role : '',
          status: typeof t.status === 'string' ? t.status : ''
        });
        setStoredTenantId(t.id);
      }
      window.location.assign('/dashboard/overview');
    } finally {
      setSwitchingTenantId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/auth/sign-in');
    }
  };

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            {filteredItems.map((item) => {
              const Icon = item.icon ? Icons[item.icon] : Icons.logo;
              return item?.items && item?.items?.length > 0 ? (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.isActive}
                  className='group/collapsible'
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={pathname === item.url}
                      >
                        {item.icon && <Icon />}
                        <span>{item.title}</span>
                        <IconChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === subItem.url}
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <Icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  <div className='flex flex-1 items-center gap-2'>
                    <UserAvatarProfile className='h-8 w-8 rounded-lg' user={tenantAvatarUser} />
                    <span className='truncate text-sm font-semibold'>
                      {currentTenant?.name || '租户'}
                    </span>
                  </div>
                  <IconChevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuLabel>切换租户</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {tenants.length === 0 ? (
                    <DropdownMenuItem disabled>暂无可切换租户</DropdownMenuItem>
                  ) : (
                    tenants.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        disabled={Boolean(switchingTenantId) || t.id === currentTenant?.id}
                        onClick={() => handleSwitchTenant(t.id)}
                      >
                        <span className='truncate'>
                          {t.name}
                          {t.id === currentTenant?.id ? '（当前）' : ''}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuGroup>

              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
