import { NextResponse } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { listLlmProviderConfigs } from "@/server/llm-config/application/queries/list-llm-provider-configs";
import {
  upsertLlmProviderConfig,
  UpsertLlmProviderConfigError
} from "@/server/llm-config/application/commands/upsert-llm-provider-config";
import {
  deleteLlmProviderConfig,
  DeleteLlmProviderConfigError
} from "@/server/llm-config/application/commands/delete-llm-provider-config";

export const runtime = "nodejs";

const updateSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  provider: z.enum(["openai", "anthropic", "deepseek", "qwen", "azure_openai", "custom"]),
  name: z.string().max(255).optional().nullable(),
  baseUrl: z.string().max(2000).optional().nullable(),
  defaultModel: z.string().max(100).optional().nullable(),
  isDefault: z.boolean().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  apiKey: z.string().optional().nullable()
});

function toSafeDto(row: {
  id: string;
  tenantId: string;
  provider: string;
  name: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  apiKeyLast4: string | null;
  defaultModel: string | null;
  isDefault: boolean;
  status: "enabled" | "disabled";
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    baseUrl: row.baseUrl,
    defaultModel: row.defaultModel,
    isDefault: row.isDefault,
    status: row.status,
    hasApiKey: !!(row.apiKey && row.apiKey.trim()),
    apiKeyLast4: row.apiKeyLast4,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function GET(request: Request) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const list = await listLlmProviderConfigs({ tenantId: auth.context.tenantId });
  return NextResponse.json({ configs: list.map(toSafeDto) });
}

export async function PUT(request: Request) {
  const container = getContainer();

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = updateSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  try {
    const saved = await upsertLlmProviderConfig(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      input: parsedInput.data
    });

    return NextResponse.json({ config: toSafeDto(saved) });
  } catch (err) {
    if (err instanceof UpsertLlmProviderConfigError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 400 });
    }
    if (err && typeof err === "object" && "issues" in (err as any)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const container = getContainer();

  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.error.code, message: auth.error.message } }, { status: auth.error.status });
  }

  const idSchema = z.object({ id: z.string().uuid() });
  const url = new URL(request.url);
  const parsed = idSchema.safeParse({ id: url.searchParams.get("id") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "参数错误" } }, { status: 400 });
  }

  try {
    const deleted = await deleteLlmProviderConfig(container, {
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      configId: parsed.data.id
    });
    return NextResponse.json({ deletedId: deleted.id });
  } catch (err) {
    if (err instanceof DeleteLlmProviderConfigError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } }, { status: 500 });
  }
}
