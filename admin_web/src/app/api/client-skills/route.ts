import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listClientSkills } from "@/server/clients/application/queries/list-client-skills";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const bindings = await listClientSkills({ tenantId: auth.context.tenantId });

  return NextResponse.json({
    bindings
  });
}

