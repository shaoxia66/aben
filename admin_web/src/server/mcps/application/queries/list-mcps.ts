import { withTransaction } from "@/server/shared/db/pg";

export type McpSummary = {
    id: string;
    mcpKey: string;
    name: string;
    description: string | null;
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export async function listMcps(tenantId: string): Promise<McpSummary[]> {
    return await withTransaction(async (client) => {
        const result = await client.query<{
            id: string;
            mcp_key: string;
            name: string;
            description: string | null;
            config: Record<string, unknown>;
            created_at: Date;
            updated_at: Date;
        }>(
            [
                "SELECT id, mcp_key, name, description, config, created_at, updated_at",
                "FROM mcps",
                "WHERE tenant_id = $1",
                "ORDER BY created_at DESC"
            ].join(" "),
            [tenantId]
        );

        return result.rows.map((row) => ({
            id: row.id,
            mcpKey: row.mcp_key,
            name: row.name,
            description: row.description,
            config: (row.config ?? {}) as Record<string, unknown>,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString()
        }));
    });
}
