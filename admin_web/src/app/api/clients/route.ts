import { NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listClients } from "@/server/clients/application/queries/list-clients";
import { createClient, CreateClientError } from "@/server/clients/application/commands/create-client";

export const runtime = "nodejs";

const createSchema = z.object({
  clientType: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  code: z.string().min(1).max(64).optional()
});

export async function GET(request: Request) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const clients = await listClients({ tenantId: auth.context.tenantId });
  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const container = getContainer();

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = createSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
      { status: 400 }
    );
  }

  try {
    const created = await createClient(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      input: parsedInput.data
    });
    return NextResponse.json({ client: created });
  } catch (err) {
    if (err instanceof CreateClientError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
    }
    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}
