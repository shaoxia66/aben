import { withTransaction } from "@/server/shared/db/pg";
import type { McpSummary } from "@/server/mcps/application/queries/list-mcps";

export class CreateMcpError extends Error {
    code: "CONFLICT" | "INVALID_INPUT";

    constructor(code: CreateMcpError["code"], message: string) {
        super(message);
        this.code = code;
        this.name = "CreateMcpError";
    }
}

export async function createMcp(params: {
    tenantId: string;
    mcpKey: string;
    name: string;
    description: string | null;
    config: Record<string, unknown>;
}): Promise<McpSummary> {
    return await withTransaction(async (client) => {
        const existing = await client.query(
            "SELECT id FROM mcps WHERE tenant_id = $1 AND mcp_key = $2",
            [params.tenantId, params.mcpKey]
        );
        if (existing.rows.length > 0) {
            throw new CreateMcpError("CONFLICT", `标识 "${params.mcpKey}" 在当前租户已存在`);
        }

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
                "INSERT INTO mcps (tenant_id, mcp_key, name, description, config)",
                "VALUES ($1, $2, $3, $4, $5)",
                "RETURNING id, mcp_key, name, description, config, created_at, updated_at"
            ].join(" "),
            [
                params.tenantId,
                params.mcpKey,
                params.name,
                params.description,
                JSON.stringify(params.config)
            ]
        );

        const row = result.rows[0]!;
        return {
            id: row.id,
            mcpKey: row.mcp_key,
            name: row.name,
            description: row.description,
            config: (row.config ?? {}) as Record<string, unknown>,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString()
        };
    });
}
