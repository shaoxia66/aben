import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listHubMcps } from "@/server/mcps/application/queries/list-hub-mcps";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const mcps = await listHubMcps();
    return NextResponse.json({ mcps });
}
