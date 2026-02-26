import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import {
  installHubSkill,
  InstallHubSkillError
} from "@/server/skills/application/commands/install-hub-skill";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ skillKey: string }> }
) {
  const container = getContainer();
  const { skillKey } = await context.params;

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  try {
    const summary = await installHubSkill(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      skillKey
    });

    return NextResponse.json({ skill: summary });
  } catch (err) {
    if (err instanceof InstallHubSkillError) {
      const status = err.code === "NOT_FOUND" ? 404 : 400;
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

