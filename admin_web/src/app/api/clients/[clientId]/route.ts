import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { updateClient, UpdateClientError } from "@/server/clients/application/commands/update-client";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["enabled", "disabled", "archived"]).optional(),
  version: z.string().max(50).optional().nullable(),
  platform: z.string().max(50).optional().nullable(),
  config: z.unknown().optional(),
  capabilities: z.unknown().optional()
}).refine(
  (v) => {
    return (
      "name" in v ||
      "description" in v ||
      "status" in v ||
      "version" in v ||
      "platform" in v ||
      "config" in v ||
      "capabilities" in v
    );
  },
  { message: "No fields to update" }
);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const container = getContainer();
  const { clientId } = await context.params;

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = updateSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  try {
    const updated = await updateClient(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      clientId,
      input: parsedInput.data
    });
    return NextResponse.json({ client: updated });
  } catch (err) {
    if (err instanceof UpdateClientError) {
      const status = err.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}
