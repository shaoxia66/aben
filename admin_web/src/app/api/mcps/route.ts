import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listMcps } from "@/server/mcps/application/queries/list-mcps";
import { createMcp, CreateMcpError } from "@/server/mcps/application/commands/create-mcp";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const mcps = await listMcps(auth.context.tenantId);
    return NextResponse.json({ mcps });
}

export async function POST(request: Request) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: { code: "INVALID_INPUT", message: "请求体不是有效的 JSON" } },
            { status: 400 }
        );
    }

    const b = body as Record<string, unknown>;
    const mcpKey = typeof b?.mcpKey === "string" ? b.mcpKey.trim() : "";
    const name = typeof b?.name === "string" ? b.name.trim() : "";
    const description = typeof b?.description === "string" ? b.description.trim() : null;

    // config 字段：必须是一个对象，例如 {"command": "npx", "args": [...]}
    const config =
        b?.config !== null && typeof b?.config === "object" && !Array.isArray(b?.config)
            ? (b.config as Record<string, unknown>)
            : null;

    if (!mcpKey || !name) {
        return NextResponse.json(
            { error: { code: "INVALID_INPUT", message: "mcpKey 和 name 均为必填项" } },
            { status: 400 }
        );
    }

    if (config === null) {
        return NextResponse.json(
            { error: { code: "INVALID_INPUT", message: "config 必须是一个有效的 JSON 对象" } },
            { status: 400 }
        );
    }

    try {
        const mcp = await createMcp({
            tenantId: auth.context.tenantId,
            mcpKey,
            name,
            description: description || null,
            config
        });
        return NextResponse.json({ mcp }, { status: 201 });
    } catch (err) {
        if (err instanceof CreateMcpError) {
            const status = err.code === "CONFLICT" ? 409 : 400;
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
