import { withTransaction } from "@/server/shared/db/pg";

export class DeleteMcpError extends Error {
    code: "NOT_FOUND";

    constructor(code: DeleteMcpError["code"], message: string) {
        super(message);
        this.code = code;
        this.name = "DeleteMcpError";
    }
}

export async function deleteMcp(params: {
    tenantId: string;
    mcpKey: string;
}): Promise<void> {
    await withTransaction(async (client) => {
        const result = await client.query(
            "DELETE FROM mcps WHERE tenant_id = $1 AND mcp_key = $2 RETURNING id",
            [params.tenantId, params.mcpKey]
        );
        if (result.rowCount === 0) {
            throw new DeleteMcpError("NOT_FOUND", `未找到标识为 "${params.mcpKey}" 的 MCP`);
        }
    });
}
