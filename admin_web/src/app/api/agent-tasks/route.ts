import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listAgentTasks } from "@/server/agent-tasks/application/queries/list-agent-tasks";

export const runtime = "nodejs";

const querySchema = z.object({
  sessionId: z.string().uuid().optional(),
  lifecycle: z.enum(["open", "blocked", "canceled", "closed"]).optional(),
  status: z.enum(["pending", "running", "succeeded", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export async function GET(request: NextRequest) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const tasks = await listAgentTasks(container, {
    tenantId: auth.context.tenantId,
    sessionId: parsedQuery.data.sessionId,
    lifecycle: parsedQuery.data.lifecycle,
    status: parsedQuery.data.status,
    limit: parsedQuery.data.limit ?? 200
  });

  return NextResponse.json({ tasks });
}
