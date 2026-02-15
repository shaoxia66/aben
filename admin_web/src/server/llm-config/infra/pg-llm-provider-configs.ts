import type { PoolClient } from "pg";

export type PgLlmProviderConfig = {
  id: string;
  tenantId: string;
  provider: string;
  name: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  apiKeyLast4: string | null;
  defaultModel: string | null;
  isDefault: boolean;
  status: "enabled" | "disabled";
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

function mapRow(row: {
  id: string;
  tenant_id: string;
  provider: string;
  name: string | null;
  base_url: string | null;
  api_key: string | null;
  api_key_last4: string | null;
  default_model: string | null;
  is_default: boolean;
  status: PgLlmProviderConfig["status"];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  extra: unknown;
}): PgLlmProviderConfig {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    apiKeyLast4: row.api_key_last4,
    defaultModel: row.default_model,
    isDefault: !!row.is_default,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function listLlmProviderConfigsByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<PgLlmProviderConfig[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    provider: string;
    name: string | null;
    base_url: string | null;
    api_key: string | null;
    api_key_last4: string | null;
    default_model: string | null;
    is_default: boolean;
    status: PgLlmProviderConfig["status"];
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra",
      "FROM llm_provider_configs",
      "WHERE tenant_id = $1",
      "ORDER BY provider ASC, is_default DESC, updated_at DESC, created_at DESC"
    ].join(" "),
    [tenantId]
  );

  return result.rows.map(mapRow);
}

export async function findLlmProviderConfigByTenantIdAndProvider(
  client: PoolClient,
  params: { tenantId: string; provider: string }
): Promise<PgLlmProviderConfig | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    provider: string;
    name: string | null;
    base_url: string | null;
    api_key: string | null;
    api_key_last4: string | null;
    default_model: string | null;
    is_default: boolean;
    status: PgLlmProviderConfig["status"];
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra",
      "FROM llm_provider_configs",
      "WHERE tenant_id = $1 AND provider = $2",
      "ORDER BY is_default DESC, updated_at DESC, created_at DESC",
      "LIMIT 1"
    ].join(" "),
    [params.tenantId, params.provider]
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function saveLlmProviderConfig(
  client: PoolClient,
  params: {
    id: string | null;
    tenantId: string;
    provider: string;
    name: string | null;
    baseUrl: string | null;
    defaultModel: string | null;
    shouldUpdateIsDefault: boolean;
    isDefault: boolean;
    status: PgLlmProviderConfig["status"];
    shouldUpdateApiKey: boolean;
    apiKey: string | null;
    apiKeyLast4: string | null;
    userId: string | null;
  }
): Promise<PgLlmProviderConfig> {
  if (!params.id) {
    const result = await client.query<{
      id: string;
      tenant_id: string;
      provider: string;
      name: string | null;
      base_url: string | null;
      api_key: string | null;
      api_key_last4: string | null;
      default_model: string | null;
      is_default: boolean;
      status: PgLlmProviderConfig["status"];
      created_by: string | null;
      updated_by: string | null;
      created_at: Date;
      updated_at: Date;
      extra: unknown;
    }>(
      [
        "INSERT INTO llm_provider_configs",
        "(tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by)",
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        "RETURNING id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra"
      ].join(" "),
      [
        params.tenantId,
        params.provider,
        params.name,
        params.baseUrl,
        params.apiKey,
        params.apiKeyLast4,
        params.defaultModel,
        params.shouldUpdateIsDefault ? params.isDefault : false,
        params.status,
        params.userId,
        params.userId
      ]
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to insert llm provider config");
    return mapRow(row);
  }

  const result = await client.query<{
    id: string;
    tenant_id: string;
    provider: string;
    name: string | null;
    base_url: string | null;
    api_key: string | null;
    api_key_last4: string | null;
    default_model: string | null;
    is_default: boolean;
    status: PgLlmProviderConfig["status"];
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "UPDATE llm_provider_configs",
      "SET",
      "provider = $1,",
      "name = $2,",
      "base_url = $3,",
      "default_model = $4,",
      "status = $5,",
      "updated_by = $6,",
      "api_key = CASE WHEN $7 THEN $8 ELSE llm_provider_configs.api_key END,",
      "api_key_last4 = CASE WHEN $7 THEN $9 ELSE llm_provider_configs.api_key_last4 END,",
      "is_default = CASE WHEN $10 THEN $11 ELSE llm_provider_configs.is_default END",
      "WHERE tenant_id = $12 AND id = $13",
      "RETURNING id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    [
      params.provider,
      params.name,
      params.baseUrl,
      params.defaultModel,
      params.status,
      params.userId,
      params.shouldUpdateApiKey,
      params.apiKey,
      params.apiKeyLast4,
      params.shouldUpdateIsDefault,
      params.isDefault,
      params.tenantId,
      params.id
    ]
  );

  const row = result.rows[0];
  if (!row) throw new Error("Failed to update llm provider config");
  return mapRow(row);
}

export async function clearDefaultLlmProviderConfigs(
  client: PoolClient,
  params: { tenantId: string }
) {
  await client.query("UPDATE llm_provider_configs SET is_default = FALSE WHERE tenant_id = $1 AND is_default = TRUE", [
    params.tenantId
  ]);
}

export async function setDefaultLlmProviderConfigById(
  client: PoolClient,
  params: { tenantId: string; configId: string }
): Promise<PgLlmProviderConfig | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    provider: string;
    name: string | null;
    base_url: string | null;
    api_key: string | null;
    api_key_last4: string | null;
    default_model: string | null;
    is_default: boolean;
    status: PgLlmProviderConfig["status"];
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "UPDATE llm_provider_configs",
      "SET is_default = TRUE",
      "WHERE tenant_id = $1 AND id = $2",
      "RETURNING id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra"
    ].join(" "),
    [params.tenantId, params.configId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function findDefaultLlmProviderConfigByTenantId(
  client: PoolClient,
  params: { tenantId: string }
): Promise<PgLlmProviderConfig | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    provider: string;
    name: string | null;
    base_url: string | null;
    api_key: string | null;
    api_key_last4: string | null;
    default_model: string | null;
    is_default: boolean;
    status: PgLlmProviderConfig["status"];
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, provider, name, base_url, api_key, api_key_last4, default_model, is_default, status, created_by, updated_by, created_at, updated_at, extra",
      "FROM llm_provider_configs",
      "WHERE tenant_id = $1 AND is_default = TRUE",
      "ORDER BY updated_at DESC, created_at DESC",
      "LIMIT 1"
    ].join(" "),
    [params.tenantId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function deleteLlmProviderConfigById(
  client: PoolClient,
  params: { tenantId: string; configId: string }
): Promise<{ id: string; provider: string; isDefault: boolean } | null> {
  const result = await client.query<{ id: string; provider: string; is_default: boolean }>(
    "DELETE FROM llm_provider_configs WHERE tenant_id = $1 AND id = $2 RETURNING id, provider, is_default",
    [params.tenantId, params.configId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, provider: row.provider, isDefault: !!row.is_default };
}
