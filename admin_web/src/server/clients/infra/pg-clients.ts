import type { PoolClient } from "pg";

export type PgClient = {
  id: string;
  tenantId: string;
  clientType: string;
  code: string;
  name: string;
  description: string | null;
  authKey: string;
  authKeyLastUsedAt: string | null;
  status: "enabled" | "disabled" | "archived";
  version: string | null;
  platform: string | null;
  lastSeenAt: string | null;
  runStatus: string | null;
  config: unknown;
  capabilities: unknown;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export async function listClientsByTenantId(client: PoolClient, tenantId: string): Promise<PgClient[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_type: string;
    code: string;
    name: string;
    description: string | null;
    auth_key: string;
    auth_key_last_used_at: Date | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    last_seen_at: Date | null;
    run_status: string | null;
    config: unknown;
    capabilities: unknown;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, client_type, code, name, description, auth_key, auth_key_last_used_at, status, version, platform, last_seen_at, run_status, config, capabilities, created_by, updated_by, created_at, updated_at, extra",
      "FROM clients",
      "WHERE tenant_id = $1",
      "ORDER BY created_at DESC"
    ].join(" "),
    [tenantId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    clientType: row.client_type,
    code: row.code,
    name: row.name,
    description: row.description,
    authKey: row.auth_key,
    authKeyLastUsedAt: row.auth_key_last_used_at ? row.auth_key_last_used_at.toISOString() : null,
    status: row.status,
    version: row.version,
    platform: row.platform,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    runStatus: row.run_status,
    config: row.config ?? {},
    capabilities: row.capabilities ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}

export async function listEnabledClientIdsByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    ["SELECT id", "FROM clients", "WHERE tenant_id = $1 AND status = 'enabled'", "ORDER BY created_at ASC"].join(" "),
    [tenantId]
  );

  return result.rows.map((row) => row.id);
}

export async function createClientRow(
  client: PoolClient,
  params: {
    tenantId: string;
    clientType: string;
    code: string;
    name: string;
    description: string | null;
    authKey: string;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    config: unknown;
    capabilities: unknown;
    createdBy: string | null;
  }
): Promise<PgClient> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_type: string;
    code: string;
    name: string;
    description: string | null;
    auth_key: string;
    auth_key_last_used_at: Date | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    last_seen_at: Date | null;
    run_status: string | null;
    config: unknown;
    capabilities: unknown;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "INSERT INTO clients (tenant_id, client_type, code, name, description, auth_key, status, version, platform, config, capabilities, created_by, updated_by)",
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)",
      "RETURNING id, tenant_id, client_type, code, name, description, auth_key, auth_key_last_used_at, status, version, platform, last_seen_at, run_status, config, capabilities, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    [
      params.tenantId,
      params.clientType,
      params.code,
      params.name,
      params.description,
      params.authKey,
      params.status,
      params.version,
      params.platform,
      params.config ?? {},
      params.capabilities ?? {},
      params.createdBy
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientType: row.client_type,
    code: row.code,
    name: row.name,
    description: row.description,
    authKey: row.auth_key,
    authKeyLastUsedAt: row.auth_key_last_used_at ? row.auth_key_last_used_at.toISOString() : null,
    status: row.status,
    version: row.version,
    platform: row.platform,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    runStatus: row.run_status,
    config: row.config ?? {},
    capabilities: row.capabilities ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function updateClientRow(
  client: PoolClient,
  params: {
    tenantId: string;
    clientId: string;
    name: string;
    description: string | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    config: unknown;
    capabilities: unknown;
    updatedBy: string | null;
  }
): Promise<PgClient | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_type: string;
    code: string;
    name: string;
    description: string | null;
    auth_key: string;
    auth_key_last_used_at: Date | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    last_seen_at: Date | null;
    run_status: string | null;
    config: unknown;
    capabilities: unknown;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "UPDATE clients",
      "SET name = $1, description = $2, status = $3, version = $4, platform = $5, config = $6, capabilities = $7, updated_by = $8",
      "WHERE id = $9 AND tenant_id = $10",
      "RETURNING id, tenant_id, client_type, code, name, description, auth_key, auth_key_last_used_at, status, version, platform, last_seen_at, run_status, config, capabilities, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    [
      params.name,
      params.description,
      params.status,
      params.version,
      params.platform,
      params.config ?? {},
      params.capabilities ?? {},
      params.updatedBy,
      params.clientId,
      params.tenantId
    ]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientType: row.client_type,
    code: row.code,
    name: row.name,
    description: row.description,
    authKey: row.auth_key,
    authKeyLastUsedAt: row.auth_key_last_used_at ? row.auth_key_last_used_at.toISOString() : null,
    status: row.status,
    version: row.version,
    platform: row.platform,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    runStatus: row.run_status,
    config: row.config ?? {},
    capabilities: row.capabilities ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function updateClientRowPatch(
  client: PoolClient,
  params: {
    tenantId: string;
    clientId: string;
    patch: Partial<{
      name: string;
      description: string | null;
      status: PgClient["status"];
      version: string | null;
      platform: string | null;
      config: unknown;
      capabilities: unknown;
    }>;
    updatedBy: string | null;
  }
): Promise<PgClient | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];

  if ("name" in params.patch) {
    values.push(params.patch.name);
    setParts.push(`name = $${values.length}`);
  }
  if ("description" in params.patch) {
    values.push(params.patch.description);
    setParts.push(`description = $${values.length}`);
  }
  if ("status" in params.patch) {
    values.push(params.patch.status);
    setParts.push(`status = $${values.length}`);
  }
  if ("version" in params.patch) {
    values.push(params.patch.version);
    setParts.push(`version = $${values.length}`);
  }
  if ("platform" in params.patch) {
    values.push(params.patch.platform);
    setParts.push(`platform = $${values.length}`);
  }
  if ("config" in params.patch) {
    values.push(params.patch.config ?? {});
    setParts.push(`config = $${values.length}`);
  }
  if ("capabilities" in params.patch) {
    values.push(params.patch.capabilities ?? {});
    setParts.push(`capabilities = $${values.length}`);
  }

  values.push(params.updatedBy);
  setParts.push(`updated_by = $${values.length}`);

  values.push(params.clientId);
  const clientIdIndex = values.length;
  values.push(params.tenantId);
  const tenantIdIndex = values.length;

  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_type: string;
    code: string;
    name: string;
    description: string | null;
    auth_key: string;
    auth_key_last_used_at: Date | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    last_seen_at: Date | null;
    run_status: string | null;
    config: unknown;
    capabilities: unknown;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "UPDATE clients",
      `SET ${setParts.join(", ")}`,
      `WHERE id = $${clientIdIndex} AND tenant_id = $${tenantIdIndex}`,
      "RETURNING id, tenant_id, client_type, code, name, description, auth_key, auth_key_last_used_at, status, version, platform, last_seen_at, run_status, config, capabilities, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    values
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientType: row.client_type,
    code: row.code,
    name: row.name,
    description: row.description,
    authKey: row.auth_key,
    authKeyLastUsedAt: row.auth_key_last_used_at ? row.auth_key_last_used_at.toISOString() : null,
    status: row.status,
    version: row.version,
    platform: row.platform,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    runStatus: row.run_status,
    config: row.config ?? {},
    capabilities: row.capabilities ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function rotateClientAuthKey(
  client: PoolClient,
  params: { tenantId: string; clientId: string; authKey: string; updatedBy: string | null }
): Promise<PgClient | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_type: string;
    code: string;
    name: string;
    description: string | null;
    auth_key: string;
    auth_key_last_used_at: Date | null;
    status: PgClient["status"];
    version: string | null;
    platform: string | null;
    last_seen_at: Date | null;
    run_status: string | null;
    config: unknown;
    capabilities: unknown;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "UPDATE clients",
      "SET auth_key = $1, auth_key_last_used_at = NULL, updated_by = $2",
      "WHERE id = $3 AND tenant_id = $4",
      "RETURNING id, tenant_id, client_type, code, name, description, auth_key, auth_key_last_used_at, status, version, platform, last_seen_at, run_status, config, capabilities, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    [params.authKey, params.updatedBy, params.clientId, params.tenantId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientType: row.client_type,
    code: row.code,
    name: row.name,
    description: row.description,
    authKey: row.auth_key,
    authKeyLastUsedAt: row.auth_key_last_used_at ? row.auth_key_last_used_at.toISOString() : null,
    status: row.status,
    version: row.version,
    platform: row.platform,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    runStatus: row.run_status,
    config: row.config ?? {},
    capabilities: row.capabilities ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}
