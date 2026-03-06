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

/** client 认证接口下发的 skill 摘要（含 hasScripts 标记） */
export type ClientSkillSummary = {
  skillKey: string;
  name: string;
  description: string | null;
  /** 该 skill 是否包含非 markdown 的可执行脚本文件（根据 content_type 判断） */
  hasScripts: boolean;
};

/**
 * 查询指定 client 已启用的 skills 摘要列表。
 *
 * hasScripts 通过检查 skills 表中该 skill_key 是否存在
 * content_type 不以 'text/markdown' 开头的非根文件来判断。
 */
export async function getActiveSkillsForClient(
  client: PoolClient,
  params: { tenantId: string; clientId: string }
): Promise<ClientSkillSummary[]> {
  const result = await client.query<{
    skill_key: string;
    name: string | null;
    description: string | null;
    has_scripts: boolean;
  }>(
    [
      "SELECT",
      "  s.skill_key,",
      "  s.name,",
      "  s.description,",
      // has_scripts: 检查同一 skill_key 下是否存在 content_type 不是 text/markdown 的文件
      "  EXISTS (",
      "    SELECT 1 FROM skills s2",
      "    WHERE s2.tenant_id = s.tenant_id",
      "      AND s2.skill_key = s.skill_key",
      "      AND s2.path <> ''",
      "      AND s2.content_type IS NOT NULL",
      "      AND s2.content_type NOT LIKE 'text/markdown%'",
      "  ) AS has_scripts",
      "FROM skills s",
      "JOIN client_skills cs",
      "  ON cs.tenant_id = s.tenant_id",
      " AND cs.skill_key = s.skill_key",
      " AND cs.client_id = $2",
      " AND cs.enabled = TRUE",
      "WHERE s.tenant_id = $1",
      "  AND s.path = ''",
      "ORDER BY cs.order_no ASC, cs.created_at ASC",
    ].join(" "),
    [params.tenantId, params.clientId]
  );

  return result.rows.map((row) => ({
    skillKey: row.skill_key,
    name: row.name ?? row.skill_key,
    description: row.description,
    hasScripts: row.has_scripts,
  }));
}
