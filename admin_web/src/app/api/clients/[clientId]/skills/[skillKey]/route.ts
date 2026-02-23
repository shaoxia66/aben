import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { setClientSkillEnabledCommand } from "@/server/clients/application/commands/set-client-skills";

export const runtime = "nodejs";

const setSkillEnabledSchema = z.object({
  enabled: z.boolean()
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ clientId: string; skillKey: string }> }
) {
  const container = getContainer();
  const { clientId, skillKey } = await context.params;

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedInput = setSkillEnabledSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const row = await setClientSkillEnabledCommand(container, {
    tenantId: auth.context.tenantId,
    userId: auth.context.userId,
    clientId,
    skillKey,
    input: parsedInput.data
  });

  return NextResponse.json({ binding: row });
}

