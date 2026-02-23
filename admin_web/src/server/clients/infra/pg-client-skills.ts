import type { PoolClient } from "pg";

export type PgClientSkill = {
  id: string;
  tenantId: string;
  clientId: string;
  skillKey: string;
  orderNo: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export type PgClientSkillWithName = PgClientSkill & {
  skillName: string | null;
};

export async function listClientSkillsByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<PgClientSkillWithName[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_id: string;
    skill_key: string;
    order_no: number;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
    skill_name: string | null;
  }>(
    [
      "SELECT",
      "  cs.id,",
      "  cs.tenant_id,",
      "  cs.client_id,",
      "  cs.skill_key,",
      "  cs.order_no,",
      "  cs.enabled,",
      "  cs.created_at,",
      "  cs.updated_at,",
      "  cs.extra,",
      "  COALESCE(root.name, cs.skill_key) AS skill_name",
      "FROM client_skills cs",
      "LEFT JOIN skills root",
      "  ON root.tenant_id = cs.tenant_id",
      " AND root.skill_key = cs.skill_key",
      " AND root.path = ''",
      "WHERE cs.tenant_id = $1",
      "ORDER BY cs.client_id ASC, cs.order_no ASC, cs.created_at ASC"
    ].join(" "),
    [tenantId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    skillKey: row.skill_key,
    orderNo: row.order_no,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {},
    skillName: row.skill_name
  }));
}

export async function setClientSkillsForClient(
  client: PoolClient,
  params: {
    tenantId: string;
    clientId: string;
    skillKeys: string[];
  }
): Promise<PgClientSkill[]> {
  await client.query(
    ["DELETE FROM client_skills", "WHERE tenant_id = $1 AND client_id = $2"].join(" "),
    [params.tenantId, params.clientId]
  );

  if (!params.skillKeys || params.skillKeys.length === 0) {
    return [];
  }

  const rows: PgClientSkill[] = [];

  for (let i = 0; i < params.skillKeys.length; i++) {
    const skillKey = params.skillKeys[i];
    const result = await client.query<{
      id: string;
      tenant_id: string;
      client_id: string;
      skill_key: string;
      order_no: number;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
      extra: unknown;
    }>(
      [
        "INSERT INTO client_skills (tenant_id, client_id, skill_key, order_no, enabled)",
        "VALUES ($1,$2,$3,$4,TRUE)",
        "RETURNING id, tenant_id, client_id, skill_key, order_no, enabled, created_at, updated_at, extra"
      ].join(" "),
      [params.tenantId, params.clientId, skillKey, i]
    );

    const row = result.rows[0];
    rows.push({
      id: row.id,
      tenantId: row.tenant_id,
      clientId: row.client_id,
      skillKey: row.skill_key,
      orderNo: row.order_no,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      extra: row.extra ?? {}
    });
  }

  return rows;
}

export async function setClientSkillEnabled(
  client: PoolClient,
  params: {
    tenantId: string;
    clientId: string;
    skillKey: string;
    enabled: boolean;
  }
): Promise<PgClientSkill> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_id: string;
    skill_key: string;
    order_no: number;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "INSERT INTO client_skills (tenant_id, client_id, skill_key, order_no, enabled)",
      "VALUES ($1,$2,$3,0,$4)",
      "ON CONFLICT (tenant_id, client_id, skill_key)",
      "DO UPDATE SET enabled = EXCLUDED.enabled",
      "RETURNING id, tenant_id, client_id, skill_key, order_no, enabled, created_at, updated_at, extra"
    ].join(" "),
    [params.tenantId, params.clientId, params.skillKey, params.enabled]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    skillKey: row.skill_key,
    orderNo: row.order_no,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

