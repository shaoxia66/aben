import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listAgentMessages } from "@/server/agent-sessions/application/queries/list-agent-messages";
import { appendUserMessage, AppendUserMessageError } from "@/server/agent-sessions/application/commands/append-user-message";

export const runtime = "nodejs";

const paramsSchema = z.object({
  sessionId: z.string().min(1)
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional()
});

const createSchema = z.object({
  content: z.string().trim().min(1).max(8000)
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const { sessionId } = await context.params;
  const parsedParams = paramsSchema.safeParse({ sessionId });
  if (!parsedParams.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const parsedQuery = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const messages = await listAgentMessages(container, {
    tenantId: auth.context.tenantId,
    sessionId: parsedParams.data.sessionId,
    limit: parsedQuery.data.limit ?? 5000
  });

  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const container = getContainer();
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const { sessionId } = await context.params;
  const parsedParams = paramsSchema.safeParse({ sessionId });
  if (!parsedParams.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = createSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  try {
    const created = await appendUserMessage(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      sessionId: parsedParams.data.sessionId,
      input: parsedInput.data
    });

    return NextResponse.json({ message: created });
  } catch (err) {
    if (err instanceof AppendUserMessageError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 404 });
    }
    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}
