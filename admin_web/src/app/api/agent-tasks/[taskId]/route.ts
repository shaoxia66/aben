import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { getAgentTaskDetail } from "@/server/agent-tasks/application/queries/get-agent-task-detail";

export const runtime = "nodejs";

const paramsSchema = z.object({
  taskId: z.string().uuid()
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  const detail = await getAgentTaskDetail(container, {
    tenantId: auth.context.tenantId,
    taskId: parsedParams.data.taskId
  });
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json(detail);
}
