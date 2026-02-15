import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { createAgentSession, CreateAgentSessionError } from "@/server/agent-sessions/application/commands/create-agent-session";
import { listAgentSessions } from "@/server/agent-sessions/application/queries/list-agent-sessions";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().max(255).optional().nullable()
});

export async function GET(request: NextRequest) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const sessions = await listAgentSessions(container, { tenantId: auth.context.tenantId });
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = createSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  try {
    const created = await createAgentSession(container, {
      tenantId: auth.context.tenantId,
      input: parsedInput.data
    });
    return NextResponse.json({ session: created });
  } catch (err) {
    if (err instanceof CreateAgentSessionError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
    }
    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}

