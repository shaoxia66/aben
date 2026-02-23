import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { setClientSkills } from "@/server/clients/application/commands/set-client-skills";

export const runtime = "nodejs";

const setSkillsSchema = z.object({
  skillKeys: z.array(z.string().min(1).max(100)).max(200)
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const container = getContainer();
  const { clientId } = await context.params;

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedInput = setSkillsSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  await setClientSkills(container, {
    tenantId: auth.context.tenantId,
    userId: auth.context.userId,
    clientId,
    input: parsedInput.data
  });

  return NextResponse.json({ ok: true });
}

