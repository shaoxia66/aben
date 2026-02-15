import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";

export type PgUser = {
  id: string;
  email: string | null;
  isDisabled: boolean;
};

export type PgUserAuth = PgUser & {
  passwordHash: string;
  displayName: string | null;
};

export type PgUserProfile = PgUser & {
  displayName: string | null;
};

export type PgTenant = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type PgTenantUser = {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: "invited" | "active" | "suspended" | "removed";
};

export type PgTenantMembership = {
  tenantId: string;
  tenantSlug: string;
  role: string;
  status: PgTenantUser["status"];
};

export type PgTenantMembershipDetails = PgTenantMembership & {
  tenantName: string;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;
  const derived = scryptSync(password, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const parts = passwordHash.split("$");
  if (parts.length !== 6) return false;
  if (parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(password, salt, expected.length, { N, r, p });
  return timingSafeEqual(derived, expected);
}

export async function findUserByEmail(client: PoolClient, email: string): Promise<PgUser | null> {
  const result = await client.query<{
    id: string;
    email: string | null;
    is_disabled: boolean;
  }>("SELECT id, email, is_disabled FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    isDisabled: row.is_disabled
  };
}

export async function findUserAuthByEmail(client: PoolClient, email: string): Promise<PgUserAuth | null> {
  const result = await client.query<{
    id: string;
    email: string | null;
    is_disabled: boolean;
    password_hash: string;
    display_name: string | null;
  }>(
    "SELECT id, email, is_disabled, password_hash, display_name FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    isDisabled: row.is_disabled,
    passwordHash: row.password_hash,
    displayName: row.display_name
  };
}

export async function findUserProfileById(client: PoolClient, userId: string): Promise<PgUserProfile | null> {
  const result = await client.query<{
    id: string;
    email: string | null;
    is_disabled: boolean;
    display_name: string | null;
  }>(
    "SELECT id, email, is_disabled, display_name FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    isDisabled: row.is_disabled,
    displayName: row.display_name
  };
}

export async function createUser(client: PoolClient, params: {
  email: string;
  passwordHash: string;
  displayName?: string | null;
}): Promise<{ id: string }> {
  const result = await client.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
    [params.email, params.passwordHash, params.displayName ?? null]
  );

  return { id: result.rows[0]!.id };
}

export async function createTenant(client: PoolClient, params: {
  slug: string;
  name: string;
}): Promise<PgTenant> {
  const result = await client.query<{
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
  }>(
    "INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING id, slug, name, is_active",
    [params.slug, params.name]
  );

  const row = result.rows[0]!;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active
  };
}

export async function findTenantById(client: PoolClient, tenantId: string): Promise<PgTenant | null> {
  const result = await client.query<{
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
  }>("SELECT id, slug, name, is_active FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active
  };
}

export async function createTenantUser(client: PoolClient, params: {
  tenantId: string;
  userId: string;
  role: string;
  status: PgTenantUser["status"];
}): Promise<PgTenantUser> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    user_id: string;
    role: string;
    status: PgTenantUser["status"];
  }>(
    "INSERT INTO tenant_users (tenant_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, tenant_id, user_id, role, status",
    [params.tenantId, params.userId, params.role, params.status]
  );

  const row = result.rows[0]!;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    status: row.status
  };
}

export async function listActiveMembershipsForUser(
  client: PoolClient,
  userId: string
): Promise<PgTenantMembershipDetails[]> {
  const result = await client.query<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    role: string;
    status: PgTenantUser["status"];
  }>(
    [
      "SELECT tu.tenant_id, t.slug as tenant_slug, t.name as tenant_name, tu.role, tu.status",
      "FROM tenant_users tu",
      "JOIN tenants t ON t.id = tu.tenant_id",
      "WHERE tu.user_id = $1",
      "AND tu.status IN ('invited','active','suspended')",
      "AND t.is_active = TRUE",
      "ORDER BY t.name ASC"
    ].join(" "),
    [userId]
  );

  return result.rows.map((row) => ({
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    role: row.role,
    status: row.status
  }));
}

export async function findActiveMembershipForUserInTenant(
  client: PoolClient,
  params: { userId: string; tenantId: string }
): Promise<PgTenantMembershipDetails | null> {
  const result = await client.query<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    role: string;
    status: PgTenantUser["status"];
  }>(
    [
      "SELECT tu.tenant_id, t.slug as tenant_slug, t.name as tenant_name, tu.role, tu.status",
      "FROM tenant_users tu",
      "JOIN tenants t ON t.id = tu.tenant_id",
      "WHERE tu.user_id = $1",
      "AND tu.tenant_id = $2",
      "AND tu.status IN ('invited','active','suspended')",
      "AND t.is_active = TRUE",
      "LIMIT 1"
    ].join(" "),
    [params.userId, params.tenantId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    role: row.role,
    status: row.status
  };
}

export async function findFirstActiveMembershipForUser(
  client: PoolClient,
  userId: string
): Promise<PgTenantMembership | null> {
  const result = await client.query<{
    tenant_id: string;
    tenant_slug: string;
    role: string;
    status: PgTenantUser["status"];
  }>(
    [
      "SELECT tu.tenant_id, t.slug as tenant_slug, tu.role, tu.status",
      "FROM tenant_users tu",
      "JOIN tenants t ON t.id = tu.tenant_id",
      "WHERE tu.user_id = $1",
      "AND tu.status IN ('invited','active','suspended')",
      "AND t.is_active = TRUE",
      "ORDER BY tu.joined_at ASC",
      "LIMIT 1"
    ].join(" "),
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    role: row.role,
    status: row.status
  };
}
