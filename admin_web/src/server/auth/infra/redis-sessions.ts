import { randomUUID } from "node:crypto";
import { getJwtConfig } from "./jwt-config";
import {
  allowlistGetGlobalUserId,
  allowlistGetTenant,
  allowlistPutGlobal,
  allowlistPutTenant,
  allowlistRevokeGlobal,
  allowlistRevokeTenant,
  revokeAllTenantTokensForUser,
  revokeAllUserGlobalTokens,
  TenantAllowlistEntry,
  trackTenantUserJti,
  trackUserGlobalJti
} from "./redis-allowlist";

export async function createGlobalSession(userId: string) {
  const jti = randomUUID();
  const ttlSeconds = getJwtConfig().globalTokenTtlSeconds;
  const expiresAtMs = Date.now() + ttlSeconds * 1000;

  await allowlistPutGlobal({ jti, userId, ttlSeconds });
  await trackUserGlobalJti({ userId, jti, ttlSeconds });

  return { jti, expiresAtMs };
}

export async function getGlobalSessionUserId(jti: string) {
  return await allowlistGetGlobalUserId(jti);
}

export async function revokeGlobalSession(jti: string) {
  await allowlistRevokeGlobal(jti);
}

export async function revokeAllGlobalSessionsForUser(userId: string) {
  return await revokeAllUserGlobalTokens(userId);
}

export async function createTenantSession(entry: TenantAllowlistEntry) {
  const jti = randomUUID();
  const ttlSeconds = getJwtConfig().tenantTokenTtlSeconds;
  const expiresAtMs = Date.now() + ttlSeconds * 1000;

  await allowlistPutTenant({ jti, entry, ttlSeconds });
  await trackTenantUserJti({ tenantId: entry.tenantId, userId: entry.userId, jti, ttlSeconds });

  return { jti, expiresAtMs };
}

export async function getTenantSession(jti: string) {
  return await allowlistGetTenant(jti);
}

export async function revokeTenantSession(jti: string) {
  await allowlistRevokeTenant(jti);
}

export async function revokeAllTenantSessionsForUser(tenantId: string, userId: string) {
  return await revokeAllTenantTokensForUser(tenantId, userId);
}
