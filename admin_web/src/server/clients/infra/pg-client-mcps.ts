import type { PoolClient } from "pg";

export type PgClientMcp = {
    id: string;
    tenantId: string;
    clientId: string;
    mcpKey: string;
    config: Record<string, unknown>;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    extra: unknown;
};

export type PgClientMcpWithName = PgClientMcp & {
    mcpName: string | null;
};

export async function listClientMcpsByTenantId(
    client: PoolClient,
    tenantId: string
): Promise<PgClientMcpWithName[]> {
    const result = await client.query<{
        id: string;
        tenant_id: string;
        client_id: string;
        mcp_key: string;
        config: Record<string, unknown>;
        is_enabled: boolean;
        created_at: Date;
        updated_at: Date;
        extra: unknown;
        mcp_name: string | null;
    }>(
        [
            "SELECT",
            "  cm.id,",
            "  cm.tenant_id,",
            "  cm.client_id,",
            "  cm.mcp_key,",
            "  cm.config,",
            "  cm.is_enabled,",
            "  cm.created_at,",
            "  cm.updated_at,",
            "  cm.extra,",
            "  COALESCE(m.name, cm.mcp_key) AS mcp_name",
            "FROM client_mcps cm",
            "LEFT JOIN mcps m",
            "  ON m.tenant_id = cm.tenant_id",
            " AND m.mcp_key = cm.mcp_key",
            "WHERE cm.tenant_id = $1",
            "ORDER BY cm.client_id ASC, cm.created_at ASC"
        ].join(" "),
        [tenantId]
    );

    return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        clientId: row.client_id,
        mcpKey: row.mcp_key,
        config: row.config,
        isEnabled: row.is_enabled,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        extra: row.extra ?? {},
        mcpName: row.mcp_name
    }));
}

export async function setClientMcpsForClient(
    client: PoolClient,
    params: {
        tenantId: string;
        clientId: string;
        mcpKeys: string[];
    }
): Promise<PgClientMcp[]> {
    await client.query(
        ["DELETE FROM client_mcps", "WHERE tenant_id = $1 AND client_id = $2"].join(" "),
        [params.tenantId, params.clientId]
    );

    if (!params.mcpKeys || params.mcpKeys.length === 0) {
        return [];
    }

    const rows: PgClientMcp[] = [];

    for (let i = 0; i < params.mcpKeys.length; i++) {
        const mcpKey = params.mcpKeys[i];
        const result = await client.query<{
            id: string;
            tenant_id: string;
            client_id: string;
            mcp_key: string;
            config: Record<string, unknown>;
            is_enabled: boolean;
            created_at: Date;
            updated_at: Date;
            extra: unknown;
        }>(
            [
                "INSERT INTO client_mcps (tenant_id, client_id, mcp_key, is_enabled)",
                "VALUES ($1,$2,$3,TRUE)",
                "RETURNING id, tenant_id, client_id, mcp_key, config, is_enabled, created_at, updated_at, extra"
            ].join(" "),
            [params.tenantId, params.clientId, mcpKey]
        );

        const row = result.rows[0];
        rows.push({
            id: row.id,
            tenantId: row.tenant_id,
            clientId: row.client_id,
            mcpKey: row.mcp_key,
            config: row.config,
            isEnabled: row.is_enabled,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            extra: row.extra ?? {}
        });
    }

    return rows;
}

export async function setClientMcpEnabled(
    client: PoolClient,
    params: {
        tenantId: string;
        clientId: string;
        mcpKey: string;
        isEnabled: boolean;
    }
): Promise<PgClientMcp> {
    const result = await client.query<{
        id: string;
        tenant_id: string;
        client_id: string;
        mcp_key: string;
        config: Record<string, unknown>;
        is_enabled: boolean;
        created_at: Date;
        updated_at: Date;
        extra: unknown;
    }>(
        [
            "INSERT INTO client_mcps (tenant_id, client_id, mcp_key, is_enabled)",
            "VALUES ($1,$2,$3,$4)",
            "ON CONFLICT (tenant_id, client_id, mcp_key)",
            "DO UPDATE SET is_enabled = EXCLUDED.is_enabled",
            "RETURNING id, tenant_id, client_id, mcp_key, config, is_enabled, created_at, updated_at, extra"
        ].join(" "),
        [params.tenantId, params.clientId, params.mcpKey, params.isEnabled]
    );

    const row = result.rows[0];
    return {
        id: row.id,
        tenantId: row.tenant_id,
        clientId: row.client_id,
        mcpKey: row.mcp_key,
        config: row.config,
        isEnabled: row.is_enabled,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        extra: row.extra ?? {}
    };
}

export async function getActiveMcpsForClient(
    client: PoolClient,
    params: { tenantId: string; clientId: string }
): Promise<{ mcpKey: string; config: Record<string, unknown> }[]> {
    const result = await client.query<{
        mcp_key: string;
        config: Record<string, unknown>;
    }>(
        [
            "SELECT",
            "  m.mcp_key,",
            "  m.config",
            "FROM client_mcps cm",
            "JOIN mcps m ON m.tenant_id = cm.tenant_id AND m.mcp_key = cm.mcp_key",
            "WHERE cm.tenant_id = $1 AND cm.client_id = $2 AND cm.is_enabled = TRUE",
            "ORDER BY cm.created_at ASC"
        ].join(" "),
        [params.tenantId, params.clientId]
    );

    return result.rows.map(row => ({
        mcpKey: row.mcp_key,
        config: row.config
    }));
}
