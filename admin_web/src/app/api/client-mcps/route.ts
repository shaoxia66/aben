import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listClientMcps } from "@/server/clients/application/queries/list-client-mcps";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const bindings = await listClientMcps({ tenantId: auth.context.tenantId });

    return NextResponse.json({
        bindings
    });
}
