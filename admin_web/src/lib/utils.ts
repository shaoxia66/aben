import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
    sizeType === 'accurate'
      ? (accurateSizes[i] ?? 'Bytest')
      : (sizes[i] ?? 'Bytes')
  }`;
}

const TENANT_ID_STORAGE_KEY = 'aben_current_tenant_id';

export function getStoredTenantId() {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(TENANT_ID_STORAGE_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setStoredTenantId(tenantId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!tenantId) {
      window.localStorage.removeItem(TENANT_ID_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TENANT_ID_STORAGE_KEY, tenantId);
  } catch {}
}

let tenantRefreshPromise: Promise<boolean> | null = null;

async function tryRefreshTenantToken() {
  if (typeof window === 'undefined') return false;

  if (tenantRefreshPromise) return await tenantRefreshPromise;

  tenantRefreshPromise = (async () => {
    const tenantId = getStoredTenantId();
    try {
      const response = await fetch('/api/auth/refresh-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantId ? { tenantId } : {})
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) return false;
      const refreshedTenantId = typeof data?.tenant?.id === 'string' ? data.tenant.id : null;
      if (refreshedTenantId) setStoredTenantId(refreshedTenantId);
      return true;
    } catch {
      return false;
    } finally {
      tenantRefreshPromise = null;
    }
  })();

  return await tenantRefreshPromise;
}

export async function fetchWithTenantRefresh(
  input: string | URL,
  init?: RequestInit,
  opts?: { skipTenantRefresh?: boolean }
) {
  const url = typeof input === 'string' ? input : input.toString();

  const response = await fetch(url, init);
  if (opts?.skipTenantRefresh) return response;
  if (response.status !== 401) return response;
  if (typeof window === 'undefined') return response;
  if (url.startsWith('/api/auth/refresh-tenant')) return response;

  const refreshed = await tryRefreshTenantToken();
  if (!refreshed) return response;

  return await fetch(url, init);
}
