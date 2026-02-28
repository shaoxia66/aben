import { withTransaction } from "@/server/shared/db/pg";
import type { McpSummary } from "@/server/mcps/application/queries/list-mcps";

export class InstallHubMcpError extends Error {
    code: "NOT_FOUND" | "CONFLICT";

    constructor(code: InstallHubMcpError["code"], message: string) {
        super(message);
        this.code = code;
        this.name = "InstallHubMcpError";
    }
}

export async function installHubMcp(params: {
    tenantId: string;
    mcpKey: string;
}): Promise<McpSummary> {
    return await withTransaction(async (client) => {
        // 从 Hub 读取模板
        const hubResult = await client.query<{
            mcp_key: string;
            name: string;
            description: string | null;
            config: Record<string, unknown>;
        }>(
            [
                "SELECT mcp_key, name, description, config",
                "FROM mcp_hub",
                "WHERE mcp_key = $1 AND is_published = true"
            ].join(" "),
            [params.mcpKey]
        );

        if (hubResult.rows.length === 0) {
            throw new InstallHubMcpError("NOT_FOUND", "未在 MCP 仓库中找到对应的 MCP");
        }

        const hub = hubResult.rows[0]!;

        // 幂等：若已存在则覆盖更新
        const upsertResult = await client.query<{
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
                "ON CONFLICT (tenant_id, mcp_key) DO UPDATE SET",
                "  name = EXCLUDED.name,",
                "  description = EXCLUDED.description,",
                "  config = EXCLUDED.config",
                "RETURNING id, mcp_key, name, description, config, created_at, updated_at"
            ].join(" "),
            [
                params.tenantId,
                hub.mcp_key,
                hub.name,
                hub.description,
                JSON.stringify(hub.config ?? {})
            ]
        );

        const row = upsertResult.rows[0]!;
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
