import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { installHubMcp, InstallHubMcpError } from "@/server/mcps/application/commands/install-hub-mcp";

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ mcpKey: string }> }
) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const { mcpKey } = await context.params;
    if (!mcpKey) {
        return NextResponse.json(
            { error: { code: "INVALID_INPUT", message: "缺少 MCP 标识" } },
            { status: 400 }
        );
    }

    try {
        const mcp = await installHubMcp({
            tenantId: auth.context.tenantId,
            mcpKey
        });
        return NextResponse.json({ mcp });
    } catch (err) {
        if (err instanceof InstallHubMcpError) {
            const status = err.code === "NOT_FOUND" ? 404 : 409;
            return NextResponse.json(
                { error: { code: err.code, message: err.message } },
                { status }
            );
        }
        return NextResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Internal error" } },
            { status: 500 }
        );
    }
}
