import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { withTransaction } from "@/server/shared/db/pg";
import { listTenantMembersByTenantId } from "@/server/auth/infra/pg-auth";

export const runtime = "nodejs";

function roleLabel(role: string) {
  if (role === "owner") return "所有者";
  if (role === "admin") return "管理员";
  if (role === "member") return "成员";
  return role || "-";
}

function statusLabel(status: string) {
  if (status === "active") return "正常";
  if (status === "invited") return "已邀请";
  if (status === "suspended") return "已暂停";
  if (status === "removed") return "已移除";
  return status || "-";
}

export async function GET(request: Request) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const members = await withTransaction(async (client) => {
    return await listTenantMembersByTenantId(client, auth.context.tenantId);
  });

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      email: m.email,
      displayName: m.displayName,
      isDisabled: m.isDisabled,
      role: m.role,
      roleLabel: roleLabel(m.role),
      status: m.status,
      statusLabel: statusLabel(m.status),
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    }))
  });
}

