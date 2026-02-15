import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_GLOBAL_TOKEN, AUTH_COOKIE_TENANT_TOKEN } from "@/shared/auth-cookies";
import { getJwtConfig } from "@/server/auth/infra/jwt-config";
import { verifyJwtHS256 } from "@/server/auth/infra/jwt";
import { getGlobalSessionUserId, getTenantSession } from "@/server/auth/infra/redis-sessions";
import { withTransaction } from "@/server/shared/db/pg";
import { findUserProfileById, listActiveMembershipsForUser } from "@/server/auth/infra/pg-auth";

export const runtime = "nodejs";

const globalClaimsSchema = z.object({
  typ: z.literal("global"),
  sub: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number()
});

const tenantClaimsSchema = z.object({
  typ: z.literal("tenant"),
  sub: z.string().min(1),
  tid: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number()
});

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const globalToken = readCookie(cookieHeader, AUTH_COOKIE_GLOBAL_TOKEN);
  const tenantToken = readCookie(cookieHeader, AUTH_COOKIE_TENANT_TOKEN);

  if (!globalToken || !tenantToken) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Not signed in" } }, { status: 401 });
  }

  const jwtConfig = getJwtConfig();
  const globalVerified = verifyJwtHS256({ secret: jwtConfig.secret, token: globalToken });
  if (!globalVerified.ok) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token" } }, { status: 401 });
  }

  const globalParsed = globalClaimsSchema.safeParse(globalVerified.payload);
  if (!globalParsed.success) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token claims" } }, { status: 401 });
  }

  const allowlistedUserId = await getGlobalSessionUserId(globalParsed.data.jti);
  if (!allowlistedUserId || allowlistedUserId !== globalParsed.data.sub) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session revoked" } }, { status: 401 });
  }

  const tenantVerified = verifyJwtHS256({ secret: jwtConfig.secret, token: tenantToken });
  if (!tenantVerified.ok) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token" } }, { status: 401 });
  }

  const tenantParsed = tenantClaimsSchema.safeParse(tenantVerified.payload);
  if (!tenantParsed.success) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid token claims" } }, { status: 401 });
  }

  if (tenantParsed.data.sub !== globalParsed.data.sub) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid session" } }, { status: 401 });
  }

  const tenantSession = await getTenantSession(tenantParsed.data.jti);
  if (
    !tenantSession ||
    tenantSession.userId !== tenantParsed.data.sub ||
    tenantSession.tenantId !== tenantParsed.data.tid
  ) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session revoked" } }, { status: 401 });
  }

  const sessionData = await withTransaction(async (client) => {
    const user = await findUserProfileById(client, globalParsed.data.sub);
    if (!user) return { user: null as any, memberships: [] as any[] };
    const memberships = await listActiveMembershipsForUser(client, user.id);
    return { user, memberships };
  });

  if (!sessionData.user || sessionData.user.isDisabled) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "User not available" } }, { status: 401 });
  }

  const currentTenant = sessionData.memberships.find((m) => m.tenantId === tenantParsed.data.tid);
  if (!currentTenant) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Tenant not available" } }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: sessionData.user.id,
      email: sessionData.user.email,
      displayName: sessionData.user.displayName
    },
    tenant: {
      id: currentTenant.tenantId,
      slug: currentTenant.tenantSlug,
      name: currentTenant.tenantName,
      role: currentTenant.role,
      status: currentTenant.status
    },
    tenants: sessionData.memberships.map((m) => ({
      id: m.tenantId,
      slug: m.tenantSlug,
      name: m.tenantName,
      role: m.role,
      status: m.status
    }))
  });
}
