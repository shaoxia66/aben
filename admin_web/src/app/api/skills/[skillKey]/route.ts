import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { getSkillDetail } from "@/server/skills/application/queries/get-skill-detail";
import { updateSkillFile } from "@/server/skills/application/commands/update-skill-file";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillKey: string }> }
) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const params = await context.params;
  const skillKey = params.skillKey;

  if (!skillKey) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "缺少 skill 标识" } },
      { status: 400 }
    );
  }

  const detail = await getSkillDetail(auth.context.tenantId, skillKey);

  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到对应的 skill" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ skill: detail });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ skillKey: string }> }
) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const params = await context.params;
  const skillKey = params.skillKey;

  if (!skillKey) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "缺少 skill 标识" } },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "请求体不是有效的 JSON" } },
      { status: 400 }
    );
  }

  const hasPath = Object.prototype.hasOwnProperty.call(body as object, "path");
  const hasContent = Object.prototype.hasOwnProperty.call(
    body as object,
    "content"
  );

  if (!hasPath && !hasContent) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "请求体中至少需要包含 path 或 content 字段"
        }
      },
      { status: 400 }
    );
  }

  if (hasPath || hasContent) {
    const path =
      typeof (body as { path?: unknown })?.path === "string"
        ? (body as { path: string }).path
        : "";
    const content =
      typeof (body as { content?: unknown })?.content === "string"
        ? (body as { content: string }).content
        : "";
    if (!path && !content) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "path 与 content 不能同时为空"
          }
        },
        { status: 400 }
      );
    }
    if (path) {
      await updateSkillFile({
        tenantId: auth.context.tenantId,
        skillKey,
        path,
        content
      });
    }
  }

  const detail = await getSkillDetail(auth.context.tenantId, skillKey);

  return NextResponse.json({ ok: true, skill: detail });
}
