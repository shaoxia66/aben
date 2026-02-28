import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { setClientMcpEnabledCommand } from "@/server/clients/application/commands/set-client-mcps";

export const runtime = "nodejs";

const setMcpEnabledSchema = z.object({
    isEnabled: z.boolean()
});

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ clientId: string; mcpKey: string }> }
) {
    const container = getContainer();
    const { clientId, mcpKey } = await context.params;

    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const body = await request.json().catch(() => null);
    const parsedInput = setMcpEnabledSchema.safeParse(body);
    if (!parsedInput.success) {
        return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
            { status: 400 }
        );
    }

    const row = await setClientMcpEnabledCommand(container, {
        tenantId: auth.context.tenantId,
        userId: auth.context.userId,
        clientId,
        mcpKey,
        input: parsedInput.data
    });

    return NextResponse.json({ binding: row });
}
