import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listSkills } from "@/server/skills/application/queries/list-skills";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const skills = await listSkills();

  return NextResponse.json({
    skills
  });
}

