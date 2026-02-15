import { z } from "zod";
import { redis } from "../../shared/db/redis";

export type TenantMembershipStatus = "invited" | "active" | "suspended" | "removed";

export type TenantAllowlistEntry = {
  userId: string;
  tenantId: string;
  role: string;
  status: TenantMembershipStatus;
};

const tenantAllowlistSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(["invited", "active", "suspended", "removed"])
});

function globalAllowlistKey(jti: string) {
  return `auth:wl:global:${jti}`;
}

function tenantAllowlistKey(jti: string) {
  return `auth:wl:tenant:${jti}`;
}

function userGlobalJtisKey(userId: string) {
  return `auth:user_global_jtis:${userId}`;
}

function tenantUserJtisKey(tenantId: string, userId: string) {
  return `auth:tenant_user_jtis:${tenantId}:${userId}`;
}

export async function allowlistPutGlobal(params: { jti: string; userId: string; ttlSeconds: number }) {
  const key = globalAllowlistKey(params.jti);
  await redis.set(key, params.userId, "EX", params.ttlSeconds);
}

export async function allowlistGetGlobalUserId(jti: string) {
  const key = globalAllowlistKey(jti);
  return await redis.get(key);
}

export async function allowlistRevokeGlobal(jti: string) {
  const key = globalAllowlistKey(jti);
  await redis.del(key);
}

export async function allowlistPutTenant(params: { jti: string; entry: TenantAllowlistEntry; ttlSeconds: number }) {
  const key = tenantAllowlistKey(params.jti);
  await redis
    .multi()
    .hset(key, {
      userId: params.entry.userId,
      tenantId: params.entry.tenantId,
      role: params.entry.role,
      status: params.entry.status
    })
    .expire(key, params.ttlSeconds)
    .exec();
}

export async function allowlistGetTenant(jti: string): Promise<TenantAllowlistEntry | null> {
  const key = tenantAllowlistKey(jti);
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) return null;

  const parsed = tenantAllowlistSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid tenant allowlist entry for jti=${jti}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}

export async function allowlistRevokeTenant(jti: string) {
  const key = tenantAllowlistKey(jti);
  await redis.del(key);
}

export async function trackUserGlobalJti(params: { userId: string; jti: string; ttlSeconds: number }) {
  const key = userGlobalJtisKey(params.userId);
  const desiredTtlSeconds = params.ttlSeconds + 60 * 60 * 24;

  const currentTtl = await redis.ttl(key);
  await redis.sadd(key, params.jti);
  if (currentTtl < desiredTtlSeconds) {
    await redis.expire(key, desiredTtlSeconds);
  }
}

export async function trackTenantUserJti(params: {
  tenantId: string;
  userId: string;
  jti: string;
  ttlSeconds: number;
}) {
  const key = tenantUserJtisKey(params.tenantId, params.userId);
  const desiredTtlSeconds = params.ttlSeconds + 60 * 60 * 24;

  const currentTtl = await redis.ttl(key);
  await redis.sadd(key, params.jti);
  if (currentTtl < desiredTtlSeconds) {
    await redis.expire(key, desiredTtlSeconds);
  }
}

export async function revokeAllUserGlobalTokens(userId: string) {
  const setKey = userGlobalJtisKey(userId);
  const jtis = await redis.smembers(setKey);

  if (jtis.length === 0) {
    await redis.del(setKey);
    return 0;
  }

  const pipeline = redis.multi();
  for (const jti of jtis) {
    pipeline.del(globalAllowlistKey(jti));
  }
  pipeline.del(setKey);

  const results = await pipeline.exec();
  if (!results) return 0;

  return results.reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);
}

export async function revokeAllTenantTokensForUser(tenantId: string, userId: string) {
  const setKey = tenantUserJtisKey(tenantId, userId);
  const jtis = await redis.smembers(setKey);

  if (jtis.length === 0) {
    await redis.del(setKey);
    return 0;
  }

  const pipeline = redis.multi();
  for (const jti of jtis) {
    pipeline.del(tenantAllowlistKey(jti));
  }
  pipeline.del(setKey);

  const results = await pipeline.exec();
  if (!results) return 0;

  return results.reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);
}

