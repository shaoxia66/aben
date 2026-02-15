import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { rotateClientKey, RotateClientKeyError } from "@/server/clients/application/commands/rotate-client-key";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const container = getContainer();
  const { clientId } = await context.params;

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  try {
    const updated = await rotateClientKey(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      clientId,
      input: {}
    });
    return NextResponse.json({ client: updated });
  } catch (err) {
    if (err instanceof RotateClientKeyError) {
      const status = err.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}
